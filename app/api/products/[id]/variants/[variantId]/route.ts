import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { VARIANT_FIELDS, diffFields } from '@/lib/masterChangeDiff'
import {
    MasterChangeAction,
    MasterChangeTargetType,
    buildDefaultSetClearedChanges,
    loadVariantSnapshot,
    recordMasterChange,
    variantTargetName,
} from '@/lib/masterChangeLog'

export async function PUT(
    request: NextRequest,
    props: { params: Promise<{ id: string; variantId: string }> }
) {
    const params = await props.params
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const body = await request.json()
        const data: any = {}
        if (body.name !== undefined) data.name = body.name
        if (body.abbreviatedName !== undefined) data.abbreviatedName = body.abbreviatedName || null
        if (body.unitLabel !== undefined) data.unitLabel = body.unitLabel || null
        if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl || null
        if (body.priceGeneral !== undefined) data.priceGeneral = Number(body.priceGeneral) || 0
        if (body.priceMember !== undefined) data.priceMember = Number(body.priceMember) || 0
        if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
        if (body.storeId !== undefined) data.storeId = body.storeId ? BigInt(body.storeId) : null
        if (body.groupId !== undefined) data.groupId = body.groupId ? BigInt(body.groupId) : null
        if (body.isDefaultSet !== undefined) data.isDefaultSet = Boolean(body.isDefaultSet)
        if (body.setPrice !== undefined) data.setPrice = Number(body.setPrice) || 0
        if (body.sortNo !== undefined) data.sortNo = Number(body.sortNo) || 0
        // 初期セットがONになる場合、setPriceは0扱い
        if (data.isDefaultSet === true) data.setPrice = 0

        const productItemId = BigInt(params.id)
        const variantId = BigInt(params.variantId)
        const updated = await prisma.$transaction(async (tx) => {
            const before = await loadVariantSnapshot(tx, variantId)
            // 初期セットONなら、同商品の他種類の isDefaultSet を OFF に
            const clearedChanges =
                data.isDefaultSet === true ? await buildDefaultSetClearedChanges(tx, productItemId, variantId) : []
            if (data.isDefaultSet === true) {
                await tx.productVariant.updateMany({
                    where: {
                        productItemId,
                        id: { not: variantId },
                    },
                    data: { isDefaultSet: false },
                })
            }
            const variant = await tx.productVariant.update({
                where: { id: variantId },
                data,
                include: { store: true },
            })

            const after = await loadVariantSnapshot(tx, variantId)
            await recordMasterChange(tx, {
                userId: authResult.payload.sub,
                targetType: MasterChangeTargetType.PRODUCT_VARIANT,
                action: MasterChangeAction.UPDATE,
                targetId: productItemId,
                targetName: variantTargetName(after?.productName ?? '', variant.name),
                changes: [...diffFields(before, after, VARIANT_FIELDS), ...clearedChanges],
            })
            return variant
        })
        return NextResponse.json(serializeBigInt(updated))
    } catch (error: any) {
        console.error('Update variant error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string; variantId: string }> }
) {
    const params = await props.params
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const variantId = BigInt(params.variantId)

        // 使用履歴（見積・請求の明細）チェック
        const [estimateRefs, invoiceRefs] = await Promise.all([
            prisma.estimateItem.count({ where: { productVariantId: variantId } }),
            prisma.invoiceItem.count({ where: { productVariantId: variantId } }),
        ])
        const inUse = estimateRefs + invoiceRefs > 0

        await prisma.$transaction(async (tx) => {
            const before = await loadVariantSnapshot(tx, variantId)
            if (inUse) {
                // 使用履歴あり → 論理削除（isActive=false）
                await tx.productVariant.update({
                    where: { id: variantId },
                    data: { isActive: false },
                })
            } else {
                // 未使用 → 物理削除
                await tx.productVariant.delete({ where: { id: variantId } })
            }
            await recordMasterChange(tx, {
                userId: authResult.payload.sub,
                targetType: MasterChangeTargetType.PRODUCT_VARIANT,
                action: inUse ? MasterChangeAction.DEACTIVATE : MasterChangeAction.DELETE,
                targetId: BigInt(params.id),
                targetName: variantTargetName(before?.productName ?? '', before?.name ?? ''),
                changes: inUse ? diffFields(before, before && { ...before, isActive: false }, VARIANT_FIELDS) : [],
            })
        })

        return NextResponse.json({ deleted: inUse ? 'logical' : 'physical' })
    } catch (error: any) {
        console.error('Delete variant error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
