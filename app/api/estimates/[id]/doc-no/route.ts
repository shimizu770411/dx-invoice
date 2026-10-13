import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { findNextEstimateDocNo, isDocNoConflictError } from '@/lib/estimateDocNo'

// 本見積の見積番号を自動採番して、その場で保存する（見積画面の「自動採番」ボタン）。
// 本見積の作成時に葬儀・告別式の開始日時が未入力で番号を付けられなかった見積のためのもの。
// 画面の「更新」を待たずに保存するのは、採番から保存までの間に他の人が同じ番号を取らないようにするため。
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const estimate = await prisma.estimate.findUnique({
            where: { id: BigInt(params.id) },
            select: { estimateType: true, docNo: true, customer: { select: { funeralFrom: true } } },
        })

        if (!estimate) {
            return NextResponse.json({ error: '見積が見つかりません' }, { status: 404 })
        }
        if (estimate.estimateType !== 'FORMAL') {
            return NextResponse.json({ error: '事前相談見積では見積番号を自動採番しません' }, { status: 400 })
        }
        if (estimate.docNo) {
            return NextResponse.json({ error: `見積番号は既に「${estimate.docNo}」が付いています` }, { status: 400 })
        }
        const funeralFrom = estimate.customer?.funeralFrom
        if (!funeralFrom) {
            return NextResponse.json(
                { error: '案件で葬儀・告別式の開始日時を入力してから採番してください' },
                { status: 400 }
            )
        }

        const updated = await prisma.$transaction(async (tx) => {
            const docNo = await findNextEstimateDocNo(tx, funeralFrom)
            return tx.estimate.update({
                where: { id: BigInt(params.id) },
                data: { docNo },
                select: { id: true, docNo: true },
            })
        })

        return NextResponse.json(serializeBigInt(updated))
    } catch (error: any) {
        if (isDocNoConflictError(error)) {
            return NextResponse.json(
                { error: '見積番号の採番が他の操作と重なりました。もう一度押してください' },
                { status: 400 }
            )
        }
        console.error('Assign estimate docNo error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
