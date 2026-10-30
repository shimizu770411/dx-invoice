/**
 * 請求書PDFの備考欄（振込先の下）に出す入金欄・押印欄の中身。
 * 紙の請求書に手で書き込んでいた欄（入金済の「済」・入金日・領収書No／事務・責任者・担当者の押印）を印字する。
 * 領収書Noは手書きするため、ここでは扱わない（PDFでは空欄の枠だけ出す）。
 */

export type StampPerson = { name: string; sealImageUrl?: string | null }

export type InvoiceStampCell = {
    /** 押印欄の見出し */
    label: string
    /** 確認ボタンを押した人。未確認なら null */
    person: StampPerson | null
}

export type InvoicePaymentStamp = {
    isPaid: boolean
    /** 入金日。入金済みのときだけ */
    paidAt: string | Date | null
    cells: InvoiceStampCell[]
}

type InvoiceLike = {
    isPaid?: boolean | null
    paidAt?: string | Date | null
    staffConfirmedBy?: StampPerson | null
    clerkConfirmedBy?: StampPerson | null
    approverConfirmedBy?: StampPerson | null
}

/**
 * 押印欄は紙の請求書と同じく 事務・責任者・担当者 の順。
 * 事務＝事務員の確認、責任者＝決裁者の確認、担当者＝担当者の確認（請求書画面の確認ボタン）。
 */
export function buildInvoicePaymentStamp(invoice: InvoiceLike): InvoicePaymentStamp {
    const isPaid = invoice.isPaid === true
    return {
        isPaid,
        paidAt: isPaid ? (invoice.paidAt ?? null) : null,
        cells: [
            { label: '事務', person: invoice.clerkConfirmedBy ?? null },
            { label: '責任者', person: invoice.approverConfirmedBy ?? null },
            { label: '担当者', person: invoice.staffConfirmedBy ?? null },
        ],
    }
}
