import { prisma } from '@/lib/prisma'

/**
 * 見積・請求の明細行に、保存時点の商品名・種類名を控えるためのサーバー側ユーティリティ。
 *
 * 表示・PDFは商品マスタの名称を直接引いているため、マスタで商品名を変えると
 * 発行済み書類の文言まで変わってしまう。これを防ぐために保存時の名称を明細行に持たせる。
 *
 * 名称は画面から入力する項目ではないので、クライアントの送信値は使わず、
 * 明細が指している商品ID・種類IDから保存時にサーバー側で引き直す。
 */

type ItemWithProductRefs = {
    productItemId?: string | number | bigint | null
    productVariantId?: string | number | bigint | null
    productRowVariantId?: string | number | bigint | null
}

export type ProductNameLookup = {
    productItemNames: Map<string, string>
    productVariantNames: Map<string, string>
    productRowVariantLabels: Map<string, string>
}

function toIdList(values: (string | number | bigint | null | undefined)[]): bigint[] {
    const ids = new Set<string>()
    for (const value of values) {
        if (value === null || value === undefined || value === '') continue
        ids.add(String(value))
    }
    return [...ids].map((id) => BigInt(id))
}

/**
 * 明細が参照している商品・種類の名称をまとめて引く。
 * 商品マスタで無効化されている商品・種類も対象に含める（保存済み明細が指している可能性があるため）。
 */
export async function loadProductNameLookup(items: ItemWithProductRefs[]): Promise<ProductNameLookup> {
    const rows = items ?? []
    const productItemIds = toIdList(rows.map((item) => item.productItemId))
    const productVariantIds = toIdList(rows.map((item) => item.productVariantId))
    const productRowVariantIds = toIdList(rows.map((item) => item.productRowVariantId))

    const [productItems, productVariants, productRowVariants] = await Promise.all([
        productItemIds.length > 0
            ? prisma.productItem.findMany({
                  where: { id: { in: productItemIds } },
                  select: { id: true, name: true },
              })
            : Promise.resolve([]),
        productVariantIds.length > 0
            ? prisma.productVariant.findMany({
                  where: { id: { in: productVariantIds } },
                  select: { id: true, name: true },
              })
            : Promise.resolve([]),
        productRowVariantIds.length > 0
            ? prisma.productRowVariant.findMany({
                  where: { id: { in: productRowVariantIds } },
                  select: { id: true, label: true },
              })
            : Promise.resolve([]),
    ])

    return {
        productItemNames: new Map(productItems.map((p) => [p.id.toString(), p.name])),
        productVariantNames: new Map(productVariants.map((v) => [v.id.toString(), v.name])),
        productRowVariantLabels: new Map(productRowVariants.map((v) => [v.id.toString(), v.label])),
    }
}

/** 明細1行ぶんの、保存時点の商品名。引けなかった場合は null（表示側が商品マスタにフォールバックする） */
export function pickProductItemName(item: ItemWithProductRefs, lookup: ProductNameLookup): string | null {
    if (!item.productItemId) return null
    return lookup.productItemNames.get(String(item.productItemId)) ?? null
}

/** 明細1行ぶんの、保存時点の種類名。引けなかった場合は null（表示側が商品マスタにフォールバックする） */
export function pickProductVariantName(item: ItemWithProductRefs, lookup: ProductNameLookup): string | null {
    if (item.productVariantId) {
        return lookup.productVariantNames.get(String(item.productVariantId)) ?? null
    }
    // 複数行構成商品は種類が行内の選択肢(productRowVariant)なので、そちらのラベルを控える
    if (item.productRowVariantId) {
        return lookup.productRowVariantLabels.get(String(item.productRowVariantId)) ?? null
    }
    return null
}
