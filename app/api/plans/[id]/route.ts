import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

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

        const updated = await prisma.plan.update({
            where: { id: BigInt(params.id) },
            data,
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

        const updated = await prisma.plan.update({
            where: { id },
            data: { isActive: false },
        })
        return NextResponse.json(serializeBigInt(updated))
    } catch (error: any) {
        console.error('Delete plan error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
