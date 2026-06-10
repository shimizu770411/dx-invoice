import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { serializeBigInt } from '@/lib/prisma-utils'
import { readdir, stat } from 'fs/promises'
import path from 'path'

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

type Usage = {
    productId: string
    productName: string
    variantId: string
    variantName: string
}

type FileEntry = {
    url: string
    fileName: string
    relativePath: string // imported/category/file.jpg などのサブディレクトリ含めた相対パス
    size: number
    modifiedAt: string
    usedBy: Usage[]
}

/** 指定ディレクトリ配下の画像ファイルを再帰的に列挙する */
async function walkImages(rootDir: string, baseUrl: string): Promise<FileEntry[]> {
    const result: FileEntry[] = []

    async function recurse(currentDir: string, relPrefix: string) {
        let entries: string[]
        try {
            entries = await readdir(currentDir)
        } catch (err: any) {
            if (err.code === 'ENOENT') return
            throw err
        }
        for (const name of entries) {
            const fullPath = path.join(currentDir, name)
            let st
            try {
                st = await stat(fullPath)
            } catch {
                continue
            }
            const relPath = relPrefix ? `${relPrefix}/${name}` : name
            if (st.isDirectory()) {
                await recurse(fullPath, relPath)
                continue
            }
            if (!st.isFile()) continue
            const ext = path.extname(name).toLowerCase()
            if (!IMAGE_EXTS.has(ext)) continue
            // URLは生のパスのまま返す。エンコードは resolveProductImageUrl が一元担当。
            result.push({
                url: `${baseUrl}/${relPath.replace(/\\/g, '/')}`,
                fileName: name,
                relativePath: relPath,
                size: st.size,
                modifiedAt: st.mtime.toISOString(),
                usedBy: [],
            })
        }
    }

    await recurse(rootDir, '')
    return result
}

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        // ディスク上のファイル一覧（サブディレクトリも再帰的に）
        const dir = path.join(process.cwd(), 'public', 'uploads', 'products')
        const fileEntries = await walkImages(dir, '/uploads/products')

        // DB側の使用状況を取得
        const variants = await prisma.productVariant.findMany({
            where: { imageUrl: { not: null } },
            select: {
                id: true,
                name: true,
                imageUrl: true,
                productItem: { select: { id: true, name: true } },
            },
        })

        const urlToUsages = new Map<string, Usage[]>()
        for (const v of variants) {
            if (!v.imageUrl) continue
            const list = urlToUsages.get(v.imageUrl) ?? []
            list.push({
                productId: String(v.productItem.id),
                productName: v.productItem.name,
                variantId: String(v.id),
                variantName: v.name,
            })
            urlToUsages.set(v.imageUrl, list)
        }

        for (const f of fileEntries) {
            f.usedBy = urlToUsages.get(f.url) ?? []
        }

        // ソート: 使用中→未使用 で、それぞれ更新日時降順
        fileEntries.sort((a, b) => {
            const aUsed = a.usedBy.length > 0 ? 0 : 1
            const bUsed = b.usedBy.length > 0 ? 0 : 1
            if (aUsed !== bUsed) return aUsed - bUsed
            return b.modifiedAt.localeCompare(a.modifiedAt)
        })

        return NextResponse.json(serializeBigInt({ files: fileEntries }))
    } catch (error: any) {
        console.error('List product images error:', error)
        return NextResponse.json(
            { error: 'Internal server error', message: error.message },
            { status: 500 }
        )
    }
}
