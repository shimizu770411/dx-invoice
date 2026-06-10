import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const { searchParams } = new URL(request.url)
        const name = searchParams.get('name') || undefined
        const includeInactive = searchParams.get('includeInactive') === 'true'

        const where: any = {}
        if (name) where.name = { contains: name }
        if (!includeInactive) where.isActive = true

        const products = await prisma.productItem.findMany({
            where,
            include: {
                variants: {
                    where: includeInactive ? {} : { isActive: true },
                    include: { store: true },
                    orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
                },
                setParentLinks: {
                    include: { child: { select: { id: true, name: true, sortNo: true } } },
                    orderBy: { sortNo: 'asc' },
                },
            },
            orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
        })

        const enriched = products.map((p: any) => ({
            ...p,
            children: (p.setParentLinks || []).map((l: any) => l.child),
            setParentLinks: undefined,
        }))

        return NextResponse.json(serializeBigInt(enriched))
    } catch (error: any) {
        console.error('Get products error:', error)
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

        const created = await prisma.productItem.create({
            data: {
                name: body.name,
                isActive: body.isActive !== false,
                isSetParent: Boolean(body.isSetParent),
                isSetChild: Boolean(body.isSetChild),
                isServiceable: Boolean(body.isServiceable),
                isMaturityServiceable: Boolean(body.isMaturityServiceable),
                defaultDescription: body.defaultDescription || null,
            },
            include: { variants: true },
        })

        return NextResponse.json(serializeBigInt(created), { status: 201 })
    } catch (error: any) {
        console.error('Create product error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
