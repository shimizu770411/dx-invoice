import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 5 * 1024 * 1024 // 5MB

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const formData = await request.formData()
        const file = formData.get('file')
        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: 'file is required' }, { status: 400 })
        }
        if (!ALLOWED_MIME.includes(file.type)) {
            return NextResponse.json(
                { error: 'JPEG/PNG/WebP/GIF 以外の形式はアップロードできません' },
                { status: 400 }
            )
        }
        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: 'ファイルサイズは5MB以下にしてください' }, { status: 400 })
        }

        const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
        const safeExt = /^[a-z0-9]{1,6}$/.test(ext) ? ext : 'bin'
        const fileName = `${crypto.randomBytes(8).toString('hex')}-${Date.now()}.${safeExt}`
        const destDir = path.join(process.cwd(), 'public', 'uploads', 'products')
        await mkdir(destDir, { recursive: true })
        const destPath = path.join(destDir, fileName)

        const buf = Buffer.from(await file.arrayBuffer())
        await writeFile(destPath, buf)

        const publicUrl = `/uploads/products/${fileName}`
        return NextResponse.json({ url: publicUrl }, { status: 201 })
    } catch (error: any) {
        console.error('Upload error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
