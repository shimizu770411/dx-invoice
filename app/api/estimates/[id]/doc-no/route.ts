import { NextRequest, NextResponse } from 'next/server'
import { OperationAction, OperationEntityType } from '@phoenix-jpn/db'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { findNextDocNoForEstimateAndInvoices, findNextEstimateDocNo, isDocNoConflictError } from '@/lib/estimateDocNo'
import { describeDuplicateDocOwner, isValidDocNo } from '@/lib/documentUtils'
import { recordOperationLog } from '@/lib/operationLog'

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

// 請求書作成後の本見積の見積番号を変更する（見積画面の「見積番号を変更」）。
// 間違った番号のまま請求書を作ってしまい、その番号を本来付けるべき別の見積で使えなくなった場合のためのもの。
// 請求番号は見積番号を引き継ぐ運用のため、この見積から作った請求書の請求番号も同じ番号に揃える（入金済みでも変える）。
// 見積の他の項目は請求書作成後は変えられないままにし、番号だけをここで変えさせる。
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) return authResult

        const data = await request.json()
        const isAuto = data?.auto === true
        const requestedDocNo = typeof data?.docNo === 'string' ? data.docNo.trim() : ''

        const estimate = await prisma.estimate.findUnique({
            where: { id: BigInt(params.id) },
            select: {
                id: true,
                estimateType: true,
                customer: { select: { funeralFrom: true } },
                invoices: { select: { id: true } },
            },
        })

        if (!estimate) {
            return NextResponse.json({ error: '見積が見つかりません' }, { status: 404 })
        }
        if (estimate.estimateType !== 'FORMAL') {
            return NextResponse.json({ error: '事前相談見積では見積番号を変更できません' }, { status: 400 })
        }
        if (estimate.invoices.length > 1) {
            // 請求番号は重複できないため、複数の請求書を同じ番号に揃えることはできない
            return NextResponse.json(
                { error: 'この見積から複数の請求書が作られているため、見積番号を変更できません' },
                { status: 400 }
            )
        }
        if (!isAuto && !isValidDocNo(requestedDocNo)) {
            return NextResponse.json({ error: '見積番号は9桁の数字（例: 202607001）で入力してください' }, { status: 400 })
        }
        const funeralFrom = estimate.customer?.funeralFrom
        if (isAuto && !funeralFrom) {
            return NextResponse.json(
                { error: '案件で葬儀・告別式の開始日時を入力してから採番してください' },
                { status: 400 }
            )
        }

        const invoiceIds = estimate.invoices.map((i) => i.id)
        const result = await prisma.$transaction(async (tx) => {
            const docNo = isAuto ? await findNextDocNoForEstimateAndInvoices(tx, funeralFrom!) : requestedDocNo

            const duplicateEstimate = await tx.estimate.findFirst({
                where: { docNo, id: { not: estimate.id } },
                select: { estimateType: true, customer: { select: { receptionNo: true, deceasedName: true } } },
            })
            if (duplicateEstimate) {
                const typeLabel = duplicateEstimate.estimateType === 'PRE_CONSULTATION' ? '事前相談見積' : '本見積'
                return {
                    error: `見積番号「${docNo}」は既に他の見積（${describeDuplicateDocOwner(duplicateEstimate.customer)}の${typeLabel}）で使用されています`,
                }
            }
            const duplicateInvoice = await tx.invoice.findFirst({
                where: { docNo, id: { notIn: invoiceIds } },
                select: { customer: { select: { receptionNo: true, deceasedName: true } } },
            })
            if (duplicateInvoice) {
                return {
                    error: `「${docNo}」は既に他の請求書（${describeDuplicateDocOwner(duplicateInvoice.customer)}）の請求番号で使用されています`,
                }
            }

            await tx.estimate.update({ where: { id: estimate.id }, data: { docNo } })
            if (invoiceIds.length > 0) {
                await tx.invoice.updateMany({ where: { id: { in: invoiceIds } }, data: { docNo } })
            }
            return { docNo }
        })

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: 400 })
        }

        const userId = authResult.payload.sub
        await recordOperationLog({ userId, action: OperationAction.UPDATE, entityType: OperationEntityType.ESTIMATE, entityId: estimate.id, docNo: result.docNo })
        for (const invoiceId of invoiceIds) {
            await recordOperationLog({ userId, action: OperationAction.UPDATE, entityType: OperationEntityType.INVOICE, entityId: invoiceId, docNo: result.docNo })
        }

        return NextResponse.json({ id: estimate.id.toString(), docNo: result.docNo })
    } catch (error: any) {
        if (isDocNoConflictError(error)) {
            return NextResponse.json(
                { error: '見積番号の変更が他の操作と重なりました。もう一度お試しください' },
                { status: 400 }
            )
        }
        console.error('Change estimate docNo error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
