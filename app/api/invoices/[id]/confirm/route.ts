import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import type { UserRole } from '@/lib/users'

const VALID_ROLES: UserRole[] = ['STAFF', 'CLERK', 'APPROVER']

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const body = await request.json()
        const role: UserRole = body.role
        if (!VALID_ROLES.includes(role)) {
            return NextResponse.json({ error: '不正なロールです' }, { status: 400 })
        }

        const userId = BigInt(authResult.payload.sub)
        const currentUser = await prisma.user.findUnique({ where: { id: userId } })
        if (!currentUser) {
            return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 401 })
        }
        if (currentUser.role !== role) {
            return NextResponse.json({ error: '自分のロールのボタンのみ操作できます' }, { status: 403 })
        }

        const invoice = await prisma.invoice.findUnique({ where: { id: BigInt(params.id) } })
        if (!invoice) {
            return NextResponse.json({ error: '請求書が見つかりません' }, { status: 404 })
        }

        const currentById =
            role === 'STAFF' ? invoice.staffConfirmedById :
            role === 'CLERK' ? invoice.clerkConfirmedById :
            invoice.approverConfirmedById

        if (currentById !== null && currentById !== userId) {
            return NextResponse.json({ error: '既に他の担当者が確認済みです' }, { status: 409 })
        }

        const isUnconfirm = currentById !== null && currentById === userId
        const nextAt = isUnconfirm ? null : new Date()
        const nextById = isUnconfirm ? null : userId

        const updated = await prisma.invoice.update({
            where: { id: invoice.id },
            data:
                role === 'STAFF' ? { staffConfirmedAt: nextAt, staffConfirmedById: nextById } :
                role === 'CLERK' ? { clerkConfirmedAt: nextAt, clerkConfirmedById: nextById } :
                { approverConfirmedAt: nextAt, approverConfirmedById: nextById },
            include: {
                staffConfirmedBy: { select: { id: true, name: true } },
                clerkConfirmedBy: { select: { id: true, name: true } },
                approverConfirmedBy: { select: { id: true, name: true } },
            },
        })

        return NextResponse.json(
            serializeBigInt({
                id: updated.id.toString(),
                staffConfirmedAt: updated.staffConfirmedAt,
                staffConfirmedBy: updated.staffConfirmedBy
                    ? { id: updated.staffConfirmedBy.id.toString(), name: updated.staffConfirmedBy.name }
                    : null,
                clerkConfirmedAt: updated.clerkConfirmedAt,
                clerkConfirmedBy: updated.clerkConfirmedBy
                    ? { id: updated.clerkConfirmedBy.id.toString(), name: updated.clerkConfirmedBy.name }
                    : null,
                approverConfirmedAt: updated.approverConfirmedAt,
                approverConfirmedBy: updated.approverConfirmedBy
                    ? { id: updated.approverConfirmedBy.id.toString(), name: updated.approverConfirmedBy.name }
                    : null,
            })
        )
    } catch (error: any) {
        console.error('Confirm invoice error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
