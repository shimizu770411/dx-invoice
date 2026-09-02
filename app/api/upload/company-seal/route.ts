import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-middleware'
import { handleImageUpload, TRANSPARENT_IMAGE_MIME_TYPES } from '@/lib/upload'

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const formData = await request.formData()
        const result = await handleImageUpload(formData, 'company-seals', TRANSPARENT_IMAGE_MIME_TYPES)
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status })
        }

        return NextResponse.json({ url: result.url }, { status: 201 })
    } catch (error: any) {
        console.error('Company seal upload error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
