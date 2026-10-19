import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAdmin } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { buildProductChanges } from '@/lib/masterChangeDiff'
import {
    MASTER_SAVE_TX_TIMEOUT_MS,
    MasterChangeAction,
    MasterChangeTargetType,
    loadProductSnapshot,
    recordMasterChange,
} from '@/lib/masterChangeLog'
import { planProductRowSync, splitRemovals, type ExistingRow, type RowSyncPlan } from '@/lib/productRowSync'
import type { Prisma } from '@phoenix-jpn/db'

/**
 * 明細行・行の種類を送られた内容に合わせる。既存のものはIDを保ったまま更新し、
 * 外したものは見積・請求書から参照されていれば無効化、参照が無ければ削除する。
 */
async function applyProductRowSync(
    tx: Prisma.TransactionClient,
    productItemId: bigint,
    plan: RowSyncPlan,
    existing: ExistingRow[]
): Promise<void> {
    const removedRowVariantIds = existing
        .filter((r) => plan.removedRowIds.includes(r.id))
        .flatMap((r) => r.variants.map((v) => v.id))
    const candidateRowIds = plan.removedRowIds.map(BigInt)
    const candidateVariantIds = [...removedRowVariantIds, ...plan.removedVariantIds].map(BigInt)
    const referenced = { rowIds: new Set<string>(), variantIds: new Set<string>() }
    if (candidateRowIds.length > 0 || candidateVariantIds.length > 0) {
        const where = {
            OR: [{ productRowId: { in: candidateRowIds } }, { productRowVariantId: { in: candidateVariantIds } }],
        }
        const select = { productRowId: true, productRowVariantId: true } as const
        const refs = [
            ...(await tx.estimateItem.findMany({ where, select, distinct: ['productRowId', 'productRowVariantId'] })),
            ...(await tx.invoiceItem.findMany({ where, select, distinct: ['productRowId', 'productRowVariantId'] })),
        ]
        for (const ref of refs) {
            if (ref.productRowId !== null) referenced.rowIds.add(ref.productRowId.toString())
            if (ref.productRowVariantId !== null) referenced.variantIds.add(ref.productRowVariantId.toString())
        }
    }
    const removal = splitRemovals(plan, existing, referenced)
    const toIds = (ids: string[]) => ({ in: ids.map(BigInt) })

    if (removal.deleteRowIds.length > 0) {
        await tx.productRow.deleteMany({ where: { id: toIds(removal.deleteRowIds), productItemId } })
    }
    if (removal.deactivateRowIds.length > 0) {
        await tx.productRow.updateMany({ where: { id: toIds(removal.deactivateRowIds), productItemId }, data: { isActive: false } })
    }
    if (removal.deleteVariantIds.length > 0) {
        await tx.productRowVariant.deleteMany({ where: { id: toIds(removal.deleteVariantIds) } })
    }
    if (removal.deactivateVariantIds.length > 0) {
        await tx.productRowVariant.updateMany({ where: { id: toIds(removal.deactivateVariantIds) }, data: { isActive: false } })
    }

    for (const row of plan.rows) {
        const rowId =
            row.id !== null
                ? (await tx.productRow.update({ where: { id: BigInt(row.id) }, data: { ...row.data, sortNo: row.sortNo } })).id
                : (await tx.productRow.create({ data: { ...row.data, sortNo: row.sortNo, productItemId } })).id
        for (const v of row.variants) {
            if (v.id !== null) {
                await tx.productRowVariant.update({ where: { id: BigInt(v.id) }, data: { ...v.data, sortNo: v.sortNo } })
            } else {
                await tx.productRowVariant.create({ data: { ...v.data, sortNo: v.sortNo, productRowId: rowId } })
            }
        }
    }
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const product = await prisma.productItem.findUnique({
            where: { id: BigInt(params.id) },
            include: {
                variants: {
                    include: { store: true },
                    orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
                },
                rows: {
                    include: {
                        variants: {
                            orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
                        },
                    },
                    orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
                },
                variantGroups: {
                    include: {
                        variants: {
                            include: { store: true },
                            orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
                        },
                    },
                    orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
                },
                setParentLinks: {
                    include: { child: { select: { id: true, name: true, sortNo: true } } },
                    orderBy: { sortNo: 'asc' },
                },
            },
        })
        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }
        const enriched = {
            ...product,
            children: (product as any).setParentLinks?.map((l: any) => l.child) || [],
            setParentLinks: undefined,
        }
        return NextResponse.json(serializeBigInt(enriched))
    } catch (error: any) {
        console.error('Get product error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const body = await request.json()
        if (!body.name || typeof body.name !== 'string') {
            return NextResponse.json({ error: 'name is required' }, { status: 400 })
        }

        const SCOPE_VALUES = ['NONE', 'MEMBER_ONLY', 'GENERAL_ONLY', 'BOTH'] as const
        const normalizeScope = (v: unknown) =>
            SCOPE_VALUES.includes(v as any) ? (v as (typeof SCOPE_VALUES)[number]) : 'NONE'

        const updateData: any = { name: body.name }
        if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive)
        if (body.isSetParent !== undefined) updateData.isSetParent = Boolean(body.isSetParent)
        if (body.isSetChild !== undefined) updateData.isSetChild = Boolean(body.isSetChild)
        if (body.serviceableScope !== undefined)
            updateData.serviceableScope = normalizeScope(body.serviceableScope)
        if (body.setableScope !== undefined)
            updateData.setableScope = normalizeScope(body.setableScope)
        if (body.isMaturityServiceable !== undefined)
            updateData.isMaturityServiceable = Boolean(body.isMaturityServiceable)
        if (body.isMultiRow !== undefined) updateData.isMultiRow = Boolean(body.isMultiRow)
        if (body.canAddFreeRow !== undefined) updateData.canAddFreeRow = Boolean(body.canAddFreeRow)
        if (body.isMultiSelect !== undefined) updateData.isMultiSelect = Boolean(body.isMultiSelect)
        if (body.multiSelectMerge !== undefined) updateData.multiSelectMerge = Boolean(body.multiSelectMerge)
        if (body.hasVariantGroups !== undefined) updateData.hasVariantGroups = Boolean(body.hasVariantGroups)
        if (body.overwriteDescriptionOnVariantChange !== undefined)
            updateData.overwriteDescriptionOnVariantChange = Boolean(body.overwriteDescriptionOnVariantChange)
        if (body.showProductVariantName !== undefined)
            updateData.showProductVariantName = Boolean(body.showProductVariantName)
        if (body.showQtyInDescription !== undefined)
            updateData.showQtyInDescription = Boolean(body.showQtyInDescription)
        if (body.defaultDescription !== undefined)
            updateData.defaultDescription = body.defaultDescription || null

        const productItemId = BigInt(params.id)

        // バリアントグループの削除可否は、書き込みを始める前に確かめる。
        // （以前は途中で400を返しており、それまでの本体・明細行の変更だけが保存されていた）
        let removedGroupIds: bigint[] = []
        if (Array.isArray(body.groups)) {
            const existingGroups = await prisma.productVariantGroup.findMany({
                where: { productItemId },
                select: { id: true },
            })
            const sentIds = new Set(
                body.groups.filter((g: any) => g.id).map((g: any) => String(g.id))
            )
            removedGroupIds = existingGroups.filter((g) => !sentIds.has(String(g.id))).map((g) => g.id)
            const variantCount = await prisma.productVariant.count({
                where: { groupId: { in: removedGroupIds }, isActive: true },
            })
            if (variantCount > 0) {
                return NextResponse.json(
                    {
                        error: 'BadRequest',
                        message:
                            'グループ配下に有効な種類（バリアント）が残っているため削除できません。先に配下の種類を削除してください。',
                    },
                    { status: 400 }
                )
            }
        }

        // 明細行の送り内容（他の商品の行のIDなど）も、書き込みを始める前に確かめる
        let rowSync: { plan: RowSyncPlan; existing: ExistingRow[] } | null = null
        if (Array.isArray(body.rows)) {
            const existingRows = await prisma.productRow.findMany({
                where: { productItemId },
                select: { id: true, variants: { select: { id: true } } },
            })
            const existing: ExistingRow[] = existingRows.map((r) => ({
                id: r.id.toString(),
                variants: r.variants.map((v) => ({ id: v.id.toString() })),
            }))
            const result = planProductRowSync(existing, body.rows)
            if (!result.ok) {
                return NextResponse.json({ error: 'BadRequest', message: result.message }, { status: 400 })
            }
            rowSync = { plan: result.plan, existing }
        }

        // 本体・明細行・グループ・変更履歴を1トランザクションで保存し、途中で失敗したら何も残さない
        await prisma.$transaction(async (tx) => {
            const before = await loadProductSnapshot(tx, productItemId)

            // セット親/セット子から一般商品に変更された場合、この商品が関わる親子紐付けは無効になるため合わせて削除する
            await tx.productItem.update({
                where: { id: productItemId },
                data: updateData,
            })
            if (body.isSetChild !== undefined && !Boolean(body.isSetChild)) {
                await tx.productSet.deleteMany({
                    where: { childId: productItemId },
                })
            }
            if (body.isSetParent !== undefined && !Boolean(body.isSetParent)) {
                await tx.productSet.deleteMany({
                    where: { parentId: productItemId },
                })
            }

            // 明細行構成（複数行構成商品時のみ）: body.rows があれば、既存の行・種類はIDを保ったまま合わせる
            if (rowSync) {
                await applyProductRowSync(tx, productItemId, rowSync.plan, rowSync.existing)
            }

            // バリアントグループ（重箱等の「基本セット＋追加オプション」構成）: body.groups があれば同期
            if (Array.isArray(body.groups)) {
                if (removedGroupIds.length > 0) {
                    await tx.productVariantGroup.deleteMany({ where: { id: { in: removedGroupIds } } })
                }

                for (const [gIdx, g] of body.groups.entries()) {
                    const selectionType = g.selectionType === 'MULTI' ? 'MULTI' : 'SINGLE'
                    const mergeDisplay = g.mergeDisplay !== false
                    if (g.id) {
                        await tx.productVariantGroup.update({
                            where: { id: BigInt(g.id) },
                            data: {
                                label: typeof g.label === 'string' ? g.label : '',
                                selectionType,
                                isRequired: Boolean(g.isRequired),
                                mergeDisplay,
                                sortNo: gIdx,
                            },
                        })
                    } else {
                        await tx.productVariantGroup.create({
                            data: {
                                productItemId,
                                label: typeof g.label === 'string' ? g.label : '',
                                selectionType,
                                isRequired: Boolean(g.isRequired),
                                mergeDisplay,
                                sortNo: gIdx,
                            },
                        })
                    }
                }
            }

            const after = await loadProductSnapshot(tx, productItemId)
            await recordMasterChange(tx, {
                userId: authResult.payload.sub,
                targetType: MasterChangeTargetType.PRODUCT,
                action: MasterChangeAction.UPDATE,
                targetId: productItemId,
                targetName: after?.name ?? body.name,
                changes: buildProductChanges(before, after),
            })
        }, { timeout: MASTER_SAVE_TX_TIMEOUT_MS })

        const updated = await prisma.productItem.findUnique({
            where: { id: BigInt(params.id) },
            include: {
                variants: true,
                rows: {
                    include: { variants: { orderBy: { sortNo: 'asc' } } },
                    orderBy: { sortNo: 'asc' },
                },
                variantGroups: {
                    include: { variants: { orderBy: { sortNo: 'asc' } } },
                    orderBy: { sortNo: 'asc' },
                },
            },
        })

        return NextResponse.json(serializeBigInt(updated))
    } catch (error: any) {
        console.error('Update product error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const productId = BigInt(params.id)

        // 使用履歴（見積・請求の明細）チェック。履歴があれば物理削除不可
        const [estimateRefs, invoiceRefs] = await Promise.all([
            prisma.estimateItem.count({ where: { productItemId: productId } }),
            prisma.invoiceItem.count({ where: { productItemId: productId } }),
        ])
        if (estimateRefs + invoiceRefs > 0) {
            return NextResponse.json(
                {
                    error: 'BadRequest',
                    message:
                        'この商品は見積または請求書の明細で使用されているため、削除できません。代わりに「非表示」にしてください。',
                },
                { status: 400 }
            )
        }

        // 関連レコードと商品本体を物理削除（トランザクション）
        await prisma.$transaction(async (tx) => {
            const before = await loadProductSnapshot(tx, productId)
            await recordMasterChange(tx, {
                userId: authResult.payload.sub,
                targetType: MasterChangeTargetType.PRODUCT,
                action: MasterChangeAction.DELETE,
                targetId: productId,
                targetName: before?.name ?? '',
                changes: [],
            })
            // 親子セット関係を削除
            await tx.productSet.deleteMany({
                where: { OR: [{ parentId: productId }, { childId: productId }] },
            })
            // バリアント（種類）を削除
            await tx.productVariant.deleteMany({
                where: { productItemId: productId },
            })
            // 商品本体を削除
            await tx.productItem.delete({ where: { id: productId } })
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Delete product error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
