import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { PLAN_FIELDS, diffFields } from '@/lib/masterChangeDiff'
import { MasterChangeAction, MasterChangeTargetType, recordMasterChange } from '@/lib/masterChangeLog'

// 基本プラン（id=1）は Estimate/Invoice の plan_id デフォルト値が参照しているため削除不可
const BASE_PLAN_ID = BigInt(1)

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

        const id = BigInt(params.id)
        const updated = await prisma.$transaction(async (tx) => {
            const before = await tx.plan.findUnique({ where: { id } })
            const plan = await tx.plan.update({
                where: { id },
                data,
            })
            await recordMasterChange(tx, {
                userId: authResult.payload.sub,
                targetType: MasterChangeTargetType.PLAN,
                action: MasterChangeAction.UPDATE,
                targetId: id,
                targetName: plan.name,
                changes: diffFields(before, plan, PLAN_FIELDS),
            })
            return plan
        })
        return NextResponse.json(serializeBigInt(updated))
    } catch (error: any) {
        console.error('Update plan error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const id = BigInt(params.id)
        if (id === BASE_PLAN_ID) {
            return NextResponse.json({ error: '基本プランは削除できません' }, { status: 400 })
        }

        const updated = await prisma.$transaction(async (tx) => {
            const before = await tx.plan.findUnique({ where: { id } })
            const plan = await tx.plan.update({
                where: { id },
                data: { isActive: false },
            })
            await recordMasterChange(tx, {
                userId: authResult.payload.sub,
                targetType: MasterChangeTargetType.PLAN,
                action: MasterChangeAction.DEACTIVATE,
                targetId: id,
                targetName: plan.name,
                changes: diffFields(before, plan, PLAN_FIELDS),
            })
            return plan
        })
        return NextResponse.json(serializeBigInt(updated))
    } catch (error: any) {
        console.error('Delete plan error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
