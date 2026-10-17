import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAdmin } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { PLAN_FIELDS, diffFields } from '@/lib/masterChangeDiff'
import { MasterChangeAction, MasterChangeTargetType, recordMasterChange } from '@/lib/masterChangeLog'

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const { searchParams } = new URL(request.url)
        const includeInactive = searchParams.get('includeInactive') === 'true'

        const plans = await prisma.plan.findMany({
            where: includeInactive ? {} : { isActive: true },
            orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
        })
        return NextResponse.json(serializeBigInt(plans))
    } catch (error: any) {
        console.error('Get plans error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const body = await request.json()
        if (!body.name || typeof body.name !== 'string') {
            return NextResponse.json({ error: 'name is required' }, { status: 400 })
        }
        const last = await prisma.plan.findFirst({ orderBy: { sortNo: 'desc' } })
        const created = await prisma.$transaction(async (tx) => {
            const plan = await tx.plan.create({
                data: {
                    name: body.name,
                    sortNo: typeof body.sortNo === 'number' ? body.sortNo : (last?.sortNo || 0) + 1,
                    isActive: body.isActive !== false,
                },
            })
            await recordMasterChange(tx, {
                userId: authResult.payload.sub,
                targetType: MasterChangeTargetType.PLAN,
                action: MasterChangeAction.CREATE,
                targetId: plan.id,
                targetName: plan.name,
                changes: diffFields(null, plan, PLAN_FIELDS),
            })
            return plan
        })
        return NextResponse.json(serializeBigInt(created), { status: 201 })
    } catch (error: any) {
        console.error('Create plan error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
