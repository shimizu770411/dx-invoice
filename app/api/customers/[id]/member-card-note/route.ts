import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'

// 会員証欄（customers.member_card_note）のみを更新する専用エンドポイント。
// PUT /api/customers/[id] は全項目洗い替えのため、見積・請求書画面から
// この1項目だけ更新する用途には使えない（他の顧客データが消えてしまう）。
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const { id } = params
        const data = await request.json()
        const memberCardNote = data.memberCardNote === '' || data.memberCardNote === undefined ? null : data.memberCardNote

        const customer = await prisma.customer.update({
            where: { id: BigInt(id) },
            data: { memberCardNote },
            select: { id: true, memberCardNote: true },
        })

        return NextResponse.json(serializeBigInt({ ...customer, id: customer.id.toString() }))
    } catch (error: any) {
        console.error('Update member card note error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
