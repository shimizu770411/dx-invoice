'use client'

import { Control, useWatch } from 'react-hook-form'
import { InvoiceFormData } from '../schemas/InvoiceFormSchema'
import { DocumentOtherFields } from '@/components/document/DocumentOtherFields'
import { FormCurrencyInput } from '@/components/form/FormCurrencyInput'
import { CurrencyInputUI } from '@/components/form/ui/CurrencyInputUI'
import { INVOICE_FEE_LABELS, calcInvoicePaymentTotal } from '@/lib/separateFees'
import { toNullableAmount } from '@/lib/documentUtils'
import type { DocumentFormData } from '@/components/document/DocumentItemTable'

type Props = {
    control: Control<InvoiceFormData>
    disabled?: boolean
    /** 請求書本体の差引合計。備考欄の「葬儀代金」としてそのまま表示する */
    grandTotal: number
}

export function InvoiceOtherFields({ control, disabled, grandTotal }: Props) {
    // 生花代の入力に合わせて支払合計を即座に追従させる
    const flowerFee = useWatch({ control, name: 'flowerFee' })
    const paymentTotal = calcInvoicePaymentTotal(grandTotal, toNullableAmount(flowerFee))

    return (
        <DocumentOtherFields
            control={control as unknown as Control<DocumentFormData>}
            disabled={disabled}
            estimateStaffLabel="請求書発行担当"
            remarksHeaderSlot={
                // 請求書PDFの備考欄冒頭に固定出力する支払合計ブロックの金額。
                // 手入力するのは生花代だけで、葬儀代金と支払合計は自動計算の表示専用。
                // いずれも請求書本体の小計・消費税・差引合計には算入しない
                <div className="mb-4 grid grid-cols-3 gap-3">
                    <CurrencyInputUI
                        value={grandTotal}
                        onChange={() => {}}
                        label={INVOICE_FEE_LABELS.funeralFee}
                        suffix="円"
                        disabled
                    />
                    <FormCurrencyInput<InvoiceFormData>
                        name="flowerFee"
                        control={control}
                        label={INVOICE_FEE_LABELS.flowerFee}
                        suffix="円"
                        disabled={disabled}
                    />
                    <CurrencyInputUI
                        value={paymentTotal}
                        onChange={() => {}}
                        label={INVOICE_FEE_LABELS.paymentTotal}
                        suffix="円"
                        disabled
                    />
                </div>
            }
        />
    )
}
