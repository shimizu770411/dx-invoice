import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const body = await request.json()
        const data: any = {}
        if (body.name !== undefined) data.name = body.name
        if (body.sortNo !== undefined) data.sortNo = Number(body.sortNo) || 0
        if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

        const updated = await prisma.store.update({
            where: { id: BigInt(params.id) },
            data,
        })
        return NextResponse.json(serializeBigInt(updated))
    } catch (error: any) {
        console.error('Update store error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const updated = await prisma.store.update({
            where: { id: BigInt(params.id) },
            data: { isActive: false },
        })
        return NextResponse.json(serializeBigInt(updated))
    } catch (error: any) {
        console.error('Delete store error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
