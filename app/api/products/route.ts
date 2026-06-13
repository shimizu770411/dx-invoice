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
                rows: {
                    where: includeInactive ? {} : { isActive: true },
                    include: {
                        variants: {
                            where: includeInactive ? {} : { isActive: true },
                            orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
                        },
                    },
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

        const SCOPE_VALUES = ['NONE', 'MEMBER_ONLY', 'GENERAL_ONLY', 'BOTH'] as const
        const normalizeScope = (v: unknown) =>
            SCOPE_VALUES.includes(v as any) ? (v as (typeof SCOPE_VALUES)[number]) : 'NONE'

        const created = await prisma.productItem.create({
            data: {
                name: body.name,
                isActive: body.isActive !== false,
                isSetParent: Boolean(body.isSetParent),
                isSetChild: Boolean(body.isSetChild),
                serviceableScope: normalizeScope(body.serviceableScope),
                setableScope: normalizeScope(body.setableScope),
                isMaturityServiceable: Boolean(body.isMaturityServiceable),
                isMultiRow: Boolean(body.isMultiRow),
                defaultDescription: body.defaultDescription || null,
                rows: Array.isArray(body.rows)
                    ? {
                          create: body.rows.map((row: any, rowIdx: number) => ({
                              label: typeof row.label === 'string' ? row.label : '',
                              calcType: row.calcType === 'FIXED' ? 'FIXED' : 'UNIT_PRICE_X_QTY',
                              defaultQty: Number.isFinite(Number(row.defaultQty))
                                  ? Number(row.defaultQty)
                                  : 1,
                              hasReturn: Boolean(row.hasReturn),
                              sortNo: rowIdx,
                              isActive: row.isActive !== false,
                              variants: {
                                  create: (Array.isArray(row.variants) ? row.variants : []).map(
                                      (v: any, vIdx: number) => ({
                                          label: typeof v.label === 'string' ? v.label : '',
                                          imageUrl:
                                              typeof v.imageUrl === 'string' && v.imageUrl
                                                  ? v.imageUrl
                                                  : null,
                                          unitPrice: Number.isFinite(Number(v.unitPrice))
                                              ? Number(v.unitPrice)
                                              : 0,
                                          isDefault: Boolean(v.isDefault),
                                          sortNo: vIdx,
                                          isActive: v.isActive !== false,
                                      })
                                  ),
                              },
                          })),
                      }
                    : undefined,
            },
            include: { variants: true, rows: { include: { variants: true } } },
        })

        return NextResponse.json(serializeBigInt(created), { status: 201 })
    } catch (error: any) {
        console.error('Create product error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
