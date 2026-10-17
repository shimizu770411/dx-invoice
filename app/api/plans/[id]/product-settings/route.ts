import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAdmin } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { buildPlanSettingChanges } from '@/lib/masterChangeDiff'
import {
    MASTER_SAVE_TX_TIMEOUT_MS,
    MasterChangeAction,
    MasterChangeTargetType,
    recordMasterChange,
} from '@/lib/masterChangeLog'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const planId = BigInt(params.id)

        const [productItems, overrides] = await Promise.all([
            prisma.productItem.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    name: true,
                    sortNo: true,
                    isSetParent: true,
                    isSetChild: true,
                    setableScope: true,
                    variants: {
                        where: { isActive: true },
                        select: { id: true, name: true, isDefaultSet: true },
                        orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
                    },
                },
                orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
            }),
            prisma.productPlanSetting.findMany({ where: { planId } }),
        ])

        const overrideMap = new Map(overrides.map((o) => [o.productItemId.toString(), o]))

        const result = productItems.map((p) => {
            const ov = overrideMap.get(p.id.toString())
            return {
                productItemId: p.id,
                productName: p.name,
                sortNo: p.sortNo,
                isSetParent: p.isSetParent,
                isSetChild: p.isSetChild,
                defaultSetableScope: p.setableScope,
                isVisible: ov ? ov.isVisible : true,
                setableScope: ov ? ov.setableScope : null,
                overrideDefaultVariantId: ov?.overrideDefaultVariantId ?? null,
                variants: p.variants.map((v) => ({ id: v.id, name: v.name, isDefaultSet: v.isDefaultSet })),
            }
        })

        return NextResponse.json(serializeBigInt(result))
    } catch (error: any) {
        console.error('Get product plan settings error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const planId = BigInt(params.id)
        const body = await request.json()
        const settings = Array.isArray(body.settings) ? body.settings : []
        const SCOPE_VALUES = ['NONE', 'MEMBER_ONLY', 'GENERAL_ONLY', 'BOTH'] as const

        const productItemIds = settings
            .filter((s: any) => s && s.productItemId !== undefined)
            .map((s: any) => BigInt(s.productItemId))
        const productItems = await prisma.productItem.findMany({
            where: { id: { in: productItemIds } },
            select: {
                id: true,
                name: true,
                isSetParent: true,
                isSetChild: true,
                variants: { select: { id: true, name: true } },
            },
        })
        const productItemMap = new Map(productItems.map((p) => [p.id.toString(), p]))
        const variantName = (product: (typeof productItems)[number], variantId: bigint | null) =>
            variantId ? (product.variants.find((v) => v.id === variantId)?.name ?? null) : null

        await prisma.$transaction(async (tx) => {
            const beforeSettings = await tx.productPlanSetting.findMany({ where: { planId } })
            const beforeMap = new Map(beforeSettings.map((b) => [b.productItemId.toString(), b]))
            const changeItems: Parameters<typeof buildPlanSettingChanges>[0] = []

            for (const s of settings) {
                if (!s || s.productItemId === undefined) continue
                const productItemId = BigInt(s.productItemId)
                const product = productItemMap.get(productItemId.toString())
                if (!product) continue
                const isVisible = s.isVisible !== false
                const setableScope = SCOPE_VALUES.includes(s.setableScope) ? s.setableScope : null

                // 「デフォルトセット品」の上書きは一般商品（セット親でもセット子でもない商品）専用。
                // 指定されたバリアントIDがこの商品自身のものであることも確認する。
                const isGeneralProduct = !product.isSetParent && !product.isSetChild
                const requestedVariantId =
                    isGeneralProduct && s.overrideDefaultVariantId ? BigInt(s.overrideDefaultVariantId) : null
                const overrideDefaultVariantId =
                    requestedVariantId && product.variants.some((v) => v.id === requestedVariantId)
                        ? requestedVariantId
                        : null

                // 表示=デフォルトのまま & セット可否=デフォルト継承 & デフォルトセット品=未指定 の場合は上書きレコード自体が不要
                const isDefault = isVisible && setableScope === null && overrideDefaultVariantId === null
                if (isDefault) {
                    await tx.productPlanSetting.deleteMany({ where: { planId, productItemId } })
                } else {
                    await tx.productPlanSetting.upsert({
                        where: { planId_productItemId: { planId, productItemId } },
                        create: { planId, productItemId, isVisible, setableScope, overrideDefaultVariantId },
                        update: { isVisible, setableScope, overrideDefaultVariantId },
                    })
                }

                const prev = beforeMap.get(productItemId.toString())
                changeItems.push({
                    productName: product.name,
                    before: prev
                        ? {
                              isVisible: prev.isVisible,
                              setableScope: prev.setableScope,
                              overrideDefaultVariantName: variantName(product, prev.overrideDefaultVariantId),
                          }
                        : null,
                    after: isDefault
                        ? null
                        : {
                              isVisible,
                              setableScope,
                              overrideDefaultVariantName: variantName(product, overrideDefaultVariantId),
                          },
                })
            }

            const plan = await tx.plan.findUnique({ where: { id: planId }, select: { name: true } })
            await recordMasterChange(tx, {
                userId: authResult.payload.sub,
                targetType: MasterChangeTargetType.PLAN_PRODUCT_SETTING,
                action: MasterChangeAction.UPDATE,
                targetId: planId,
                targetName: plan?.name ?? '',
                changes: buildPlanSettingChanges(changeItems),
            })
        }, { timeout: MASTER_SAVE_TX_TIMEOUT_MS })

        return NextResponse.json({ count: settings.length })
    } catch (error: any) {
        console.error('Save product plan settings error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
