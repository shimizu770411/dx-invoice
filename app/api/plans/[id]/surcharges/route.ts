import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAdmin } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

// プランごとの親祭壇の増額選択肢。
// 見積・請求書の明細画面はここの選択肢を読み、選ばれた額を一般単価・会員単価の両方に上乗せして保存する。

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const surcharges = await prisma.planSurcharge.findMany({
            where: { planId: BigInt(params.id), isActive: true },
            orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
        })

        return NextResponse.json(serializeBigInt(surcharges))
    } catch (error: any) {
        console.error('Get plan surcharges error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAdmin(request)
        if (authResult instanceof NextResponse) return authResult

        const planId = BigInt(params.id)
        const body = await request.json()
        const surcharges = Array.isArray(body.surcharges) ? body.surcharges : []

        // 表示名が空、または増額が0以下の行は登録対象から外す
        const valid = surcharges
            .filter((s: any) => s && String(s.label ?? '').trim() !== '' && Number(s.amount) > 0)
            .map((s: any, index: number) => ({
                id: s.id ? BigInt(s.id) : null,
                label: String(s.label).trim().slice(0, 60),
                amount: Math.trunc(Number(s.amount)),
                sortNo: Number.isFinite(Number(s.sortNo)) ? Number(s.sortNo) : index,
            }))

        const saved = await prisma.$transaction(async (tx) => {
            const existing = await tx.planSurcharge.findMany({ where: { planId }, select: { id: true } })
            const keptIds = new Set(
                valid.filter((s: { id: bigint | null }) => s.id).map((s: { id: bigint | null }) => s.id!.toString())
            )

            // 画面から消された選択肢は無効化する。
            // 過去の見積がこの選択肢を参照しているため、行ごと削除はしない
            const removedIds = existing.filter((e) => !keptIds.has(e.id.toString())).map((e) => e.id)
            if (removedIds.length > 0) {
                await tx.planSurcharge.updateMany({ where: { id: { in: removedIds } }, data: { isActive: false } })
            }

            for (const s of valid) {
                if (s.id) {
                    await tx.planSurcharge.update({
                        where: { id: s.id },
                        data: { label: s.label, amount: s.amount, sortNo: s.sortNo, isActive: true },
                    })
                } else {
                    await tx.planSurcharge.create({
                        data: { planId, label: s.label, amount: s.amount, sortNo: s.sortNo },
                    })
                }
            }

            return tx.planSurcharge.findMany({
                where: { planId, isActive: true },
                orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
            })
        })

        return NextResponse.json(serializeBigInt(saved))
    } catch (error: any) {
        console.error('Save plan surcharges error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
