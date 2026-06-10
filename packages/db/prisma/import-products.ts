/**
 * 画像フォルダ構造から商品マスタを自動生成するスクリプト
 *
 * 想定される入力構造:
 *   public/uploads/products/imported/
 *     ├─ <商品カテゴリ>/
 *     │    <画像ファイル>           → 全店舗共通の種類
 *     ├─ <商品カテゴリ>/
 *     │    <サブフォルダ名>/          → 店舗名でマッチ: その店舗の種類
 *     │        <画像ファイル>         → マッチしない: 全店舗共通、種類名にサブ名付与
 *
 * 実行: pnpm tsx prisma/import-products.ts
 */
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// 画像の読み込み元（コンテナ内パス）
const SOURCE_ROOT = '/app/public/uploads/products/imported'
// imageUrl で使う公開パスプレフィックス
const PUBLIC_PREFIX = '/uploads/products/imported'

// 店舗名と検索キーワードの対応
const STORE_KEYWORDS: { keyword: string; storeName: string }[] = [
    { keyword: '西原', storeName: '西原玉泉院' },
    { keyword: '小禄', storeName: '小緑・豊見城玉泉院' },
    { keyword: '豊見城', storeName: '小緑・豊見城玉泉院' },
    { keyword: '那覇', storeName: '那覇玉泉院' },
    { keyword: '一日橋', storeName: '一日橋玉泉院' },
    { keyword: '糸満', storeName: '糸満玉泉院' },
    { keyword: '具志川', storeName: '具志川玉泉院' },
    { keyword: 'やすらぎ', storeName: 'やすらぎ会館玉泉院' },
    { keyword: '名護', storeName: '名護玉泉院' },
]

// カテゴリ名を整形（先頭の連番を除去）
function normalizeCategory(folder: string): string {
    return folder.replace(/^\d+/, '').trim()
}

// ファイル名から価格を推定（優先順: "XX万" → 数字6桁以上 → 一般数字）
function extractPrice(filename: string): number | null {
    const base = filename.replace(/\.[a-z]+$/i, '')
    // 「27万」「14万」「6.5万」「6．5万」
    const manMatch = base.match(/(\d+(?:[\.．]\d+)?)万/)
    if (manMatch) {
        const num = parseFloat(manMatch[1].replace('．', '.'))
        return Math.round(num * 10000)
    }
    // 「335000」「150000」等の数字を抽出（3桁以上）
    const numMatch = base.match(/(\d{3,})/)
    if (numMatch) {
        return parseInt(numMatch[1], 10)
    }
    return null
}

// 画像ファイル判定
function isImageFile(name: string): boolean {
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(name)
}

async function findStoreByKeyword(folderName: string): Promise<{ id: bigint; name: string } | null> {
    for (const { keyword, storeName } of STORE_KEYWORDS) {
        if (folderName.includes(keyword)) {
            const store = await prisma.store.findFirst({ where: { name: storeName } })
            if (store) return { id: store.id, name: store.name }
        }
    }
    return null
}

async function ensureProductItem(name: string) {
    const existing = await prisma.productItem.findFirst({ where: { name } })
    if (existing) return existing
    return await prisma.productItem.create({
        data: { name, isActive: true },
    })
}

interface VariantBuildArgs {
    productItemId: bigint
    storeId: bigint | null
    fileName: string
    relPathFromImported: string
    subFolderLabel?: string
}

async function createVariant({
    productItemId,
    storeId,
    fileName,
    relPathFromImported,
    subFolderLabel,
}: VariantBuildArgs) {
    const price = extractPrice(fileName)
    const stemName = fileName.replace(/\.[a-z]+$/i, '')
    // 価格ファイルの場合は「XX円」形式の種類名、価格がなければファイル名をそのまま種類名に
    let variantName: string
    if (price !== null) {
        variantName = `¥${price.toLocaleString()}`
    } else {
        variantName = stemName
    }
    if (subFolderLabel) {
        variantName = `${subFolderLabel} / ${variantName}`
    }
    const imageUrl = `${PUBLIC_PREFIX}/${relPathFromImported.split(path.sep).join('/')}`
    const priceGeneral = price ?? 0
    const priceMember = price ? Math.round(price * 0.9) : 0

    await prisma.productVariant.create({
        data: {
            productItemId,
            storeId,
            name: variantName,
            imageUrl,
            priceGeneral,
            priceMember,
            isActive: true,
        },
    })
    return { variantName, price, imageUrl }
}

async function processCategory(categoryFolder: string) {
    const categoryPath = path.join(SOURCE_ROOT, categoryFolder)
    const categoryName = normalizeCategory(categoryFolder)
    const product = await ensureProductItem(categoryName)
    console.log(`\n▶ ${categoryName} (id=${product.id})`)

    const entries = fs.readdirSync(categoryPath, { withFileTypes: true })

    for (const entry of entries) {
        const entryPath = path.join(categoryPath, entry.name)
        if (entry.isDirectory()) {
            // サブフォルダ: 店舗判定してバリエーション作成
            const store = await findStoreByKeyword(entry.name)
            const storeId = store?.id ?? null
            const subFolderLabel = store ? undefined : entry.name // 店舗でなければラベル扱い

            const subFiles = fs.readdirSync(entryPath, { withFileTypes: true })
            for (const sf of subFiles) {
                if (sf.isFile() && isImageFile(sf.name)) {
                    const rel = path.join(categoryFolder, entry.name, sf.name)
                    const result = await createVariant({
                        productItemId: product.id,
                        storeId,
                        fileName: sf.name,
                        relPathFromImported: rel,
                        subFolderLabel,
                    })
                    console.log(
                        `    ✓ ${store ? `[${store.name}]` : '[共通]'} ${result.variantName}`
                    )
                } else if (sf.isDirectory()) {
                    // 孫フォルダ: サブフォルダをラベル、孫フォルダをさらにラベル化
                    const grandFiles = fs.readdirSync(path.join(entryPath, sf.name))
                    for (const gName of grandFiles) {
                        if (isImageFile(gName)) {
                            const rel = path.join(categoryFolder, entry.name, sf.name, gName)
                            const result = await createVariant({
                                productItemId: product.id,
                                storeId,
                                fileName: gName,
                                relPathFromImported: rel,
                                subFolderLabel: `${entry.name}/${sf.name}`,
                            })
                            console.log(`    ✓ [共通] ${result.variantName}`)
                        }
                    }
                }
            }
        } else if (entry.isFile() && isImageFile(entry.name)) {
            // 直下の画像: 全店舗共通の種類
            const rel = path.join(categoryFolder, entry.name)
            const result = await createVariant({
                productItemId: product.id,
                storeId: null,
                fileName: entry.name,
                relPathFromImported: rel,
            })
            console.log(`    ✓ [共通] ${result.variantName}`)
        }
    }
}

async function main() {
    if (!fs.existsSync(SOURCE_ROOT)) {
        throw new Error(`画像フォルダが見つかりません: ${SOURCE_ROOT}`)
    }

    // 既存の商品と種類を全削除（洗い替え）
    // 見積/請求の明細で参照されている外部キーを先にnullにする
    console.log('既存の商品参照を解除します…')
    await prisma.estimateItem.updateMany({
        data: { productItemId: null, productVariantId: null },
    })
    await prisma.invoiceItem.updateMany({
        data: { productItemId: null, productVariantId: null },
    })
    console.log('既存の商品・種類を削除します…')
    await prisma.productVariant.deleteMany({})
    await prisma.productItem.deleteMany({})

    const topEntries = fs.readdirSync(SOURCE_ROOT, { withFileTypes: true })
    for (const entry of topEntries) {
        if (entry.isDirectory()) {
            await processCategory(entry.name)
        }
    }

    const productCount = await prisma.productItem.count()
    const variantCount = await prisma.productVariant.count()
    console.log(`\n完了: 商品 ${productCount} 件、種類 ${variantCount} 件`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
