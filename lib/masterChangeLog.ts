import { MasterChangeAction, MasterChangeTargetType, Prisma } from '@phoenix-jpn/db'
import { VARIANT_FIELDS, diffFields, type FieldChange, type ProductSnapshot } from '@/lib/masterChangeDiff'

export { MasterChangeAction, MasterChangeTargetType }

const DEFAULT_SET_FIELDS = VARIANT_FIELDS.filter((f) => f.key === 'isDefaultSet')

// 商品の更新は「本体・明細行の作り直し・グループ同期・履歴記録」を1トランザクションで行うため、
// 既定の5秒では明細行の多い商品で足りなくなる
export const MASTER_SAVE_TX_TIMEOUT_MS = 30_000

/**
 * 商品マスタ・プラン設定の変更履歴を1件記録する。
 * 変更本体と同じトランザクション(tx)で呼ぶこと。失敗は握りつぶさず、保存ごと失敗させる
 * （履歴の無い変更を作らないため。見積・請求書の件数用の lib/operationLog.ts とは方針が逆）。
 * 更新で変わった項目が無い場合（同じ内容での保存）は記録しない。
 */
export async function recordMasterChange(
    tx: Prisma.TransactionClient,
    params: {
        userId: string | null | undefined
        targetType: MasterChangeTargetType
        action: MasterChangeAction
        targetId: bigint | null
        targetName: string
        changes: FieldChange[]
    }
): Promise<void> {
    if (params.action === MasterChangeAction.UPDATE && params.changes.length === 0) return
    await tx.masterChangeLog.create({
        data: {
            userId: params.userId ? BigInt(params.userId) : null,
            targetType: params.targetType,
            action: params.action,
            targetId: params.targetId,
            targetName: params.targetName,
            changes: params.changes as unknown as Prisma.InputJsonValue,
        },
    })
}

/** 商品の基本項目・明細行構成・バリアントグループを、変更履歴の比較用に読み出す */
export async function loadProductSnapshot(
    tx: Prisma.TransactionClient,
    productItemId: bigint
): Promise<ProductSnapshot | null> {
    const product = await tx.productItem.findUnique({
        where: { id: productItemId },
        include: {
            rows: {
                include: { variants: { orderBy: { sortNo: 'asc' } } },
                orderBy: { sortNo: 'asc' },
            },
            variantGroups: { orderBy: { sortNo: 'asc' } },
        },
    })
    if (!product) return null
    return {
        ...product,
        rows: product.rows.map((row) => ({ ...row, variants: row.variants.map((v) => ({ ...v })) })),
        variantGroups: product.variantGroups.map((g) => ({ ...g, id: g.id.toString() })),
    }
}

/** 種類（ProductVariant）を、店舗名・グループ名込みで変更履歴の比較用に読み出す */
export async function loadVariantSnapshot(tx: Prisma.TransactionClient, variantId: bigint) {
    const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        include: {
            store: { select: { name: true } },
            group: { select: { label: true } },
            productItem: { select: { name: true } },
        },
    })
    if (!variant) return null
    return {
        ...variant,
        storeName: variant.store?.name ?? null,
        groupLabel: variant.group?.label ?? null,
        productName: variant.productItem.name,
    }
}

/**
 * ある種類を「初期セット」にすると同じ商品の他の種類の初期セットは外れる。
 * 外れる側も履歴に残すため、外す前に呼んで変更内容を作る。
 */
export async function buildDefaultSetClearedChanges(
    tx: Prisma.TransactionClient,
    productItemId: bigint,
    exceptVariantId: bigint | null
): Promise<FieldChange[]> {
    const current = await tx.productVariant.findMany({
        where: {
            productItemId,
            isDefaultSet: true,
            ...(exceptVariantId ? { id: { not: exceptVariantId } } : {}),
        },
        select: { name: true },
    })
    return current.flatMap((v) =>
        diffFields({ isDefaultSet: true }, { isDefaultSet: false }, DEFAULT_SET_FIELDS, `種類「${v.name}」`)
    )
}

/** 種類の履歴の対象名（どの商品のどの種類か分かるように商品名を添える） */
export function variantTargetName(productName: string, variantName: string): string {
    return `${productName} / ${variantName}`
}
