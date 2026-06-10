import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const { searchParams } = new URL(request.url)
        const includeInactive = searchParams.get('includeInactive') === 'true'

        const stores = await prisma.store.findMany({
            where: includeInactive ? {} : { isActive: true },
            orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
        })
        return NextResponse.json(serializeBigInt(stores))
    } catch (error: any) {
        console.error('Get stores error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const body = await request.json()
        if (!body.name || typeof body.name !== 'string') {
            return NextResponse.json({ error: 'name is required' }, { status: 400 })
        }
        const last = await prisma.store.findFirst({ orderBy: { sortNo: 'desc' } })
        const created = await prisma.store.create({
            data: {
                name: body.name,
                sortNo: typeof body.sortNo === 'number' ? body.sortNo : (last?.sortNo || 0) + 1,
                isActive: body.isActive !== false,
            },
        })
        return NextResponse.json(serializeBigInt(created), { status: 201 })
    } catch (error: any) {
        console.error('Create store error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
