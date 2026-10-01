import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { CASE_PROGRESS_INCLUDE, toCaseProgress } from '@/lib/caseProgress'

/**
 * 1案件ぶんの進捗（見積・請求・入金の有無）を返す。
 *
 * 各画面の上部に置く切替バーが「次にどの書類へ行けるか」を判断するために使う。
 * 案件の取得（GET /api/customers/[id]）は明細まで含めた重い応答なので、
 * 画面を開くたびに呼ぶ切替バー用には進捗だけを返すこちらを用意している。
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const customer = await prisma.customer.findUnique({
            where: { id: BigInt(params.id) },
            select: {
                id: true,
                receptionNo: true,
                deceasedName: true,
                ...CASE_PROGRESS_INCLUDE,
            },
        })

        if (!customer) {
            return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
        }

        // toCaseProgress が id を文字列にするため serializeBigInt は不要
        return NextResponse.json(toCaseProgress(customer))
    } catch (error: any) {
        console.error('Get case progress error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
