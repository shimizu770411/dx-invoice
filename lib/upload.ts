import { put } from '@vercel/blob'
import crypto from 'crypto'

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024 // 5MB

/** 角印など、PDF上で背景に重ねて表示する透過必須の画像。アルファチャンネル対応形式のみ許可する */
export const TRANSPARENT_IMAGE_MIME_TYPES = ['image/png', 'image/webp']

export type ImageUploadResult = { ok: true; url: string } | { ok: false; status: number; error: string }

export async function handleImageUpload(
    formData: FormData,
    blobPathPrefix: string,
    allowedMimeTypes: readonly string[] = ALLOWED_IMAGE_MIME_TYPES
): Promise<ImageUploadResult> {
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
        return { ok: false, status: 400, error: 'file is required' }
    }
    if (!allowedMimeTypes.includes(file.type)) {
        const formatLabels = allowedMimeTypes.map((mime) => mime.split('/')[1].toUpperCase()).join('/')
        return { ok: false, status: 400, error: `${formatLabels} 以外の形式はアップロードできません` }
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        return { ok: false, status: 400, error: 'ファイルサイズは5MB以下にしてください' }
    }

    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const safeExt = /^[a-z0-9]{1,6}$/.test(ext) ? ext : 'bin'
    const fileName = `${crypto.randomBytes(8).toString('hex')}-${Date.now()}.${safeExt}`

    const blob = await put(`${blobPathPrefix}/${fileName}`, file, {
        access: 'public',
        addRandomSuffix: false,
    })

    return { ok: true, url: blob.url }
}
