'use client'

import { Control } from 'react-hook-form'
import { EstimateFormData } from '../schemas/EstimateFormSchema'
import { DocumentOtherFields } from '@/components/document/DocumentOtherFields'
import { FormInput } from '@/components/form/FormInput'
import { FormCurrencyInput } from '@/components/form/FormCurrencyInput'
import type { DocumentFormData } from '@/components/document/DocumentItemTable'

type Props = {
    control: Control<EstimateFormData>
    disabled?: boolean
}

export function EstimateOtherFields({ control, disabled }: Props) {
    return (
        <DocumentOtherFields
            control={control as unknown as Control<DocumentFormData>}
            disabled={disabled}
            estimateStaffLabel="本見積担当"
            preConsultStaffSlot={
                <FormInput
                    name="preConsultStaff"
                    control={control as any}
                    label="事前相談見積担当"
                    disabled={disabled}
                />
            }
            remarksHeaderSlot={
                // 見積書PDFの備考欄冒頭に固定出力する【別料金】ブロックの金額。
                // 表示専用の項目で、小計・消費税・合計には算入しない
                <div className="mb-4 grid grid-cols-3 gap-3">
                    <FormCurrencyInput<EstimateFormData>
                        name="cremationFee"
                        control={control}
                        label="火葬料金"
                        suffix="円"
                        disabled={disabled}
                    />
                    <FormCurrencyInput<EstimateFormData>
                        name="offeringFee"
                        control={control}
                        label="お布施"
                        suffix="円"
                        disabled={disabled}
                    />
                    <FormCurrencyInput<EstimateFormData>
                        name="newspaperAdFee"
                        control={control}
                        label="新聞広告"
                        suffix="円"
                        disabled={disabled}
                    />
                </div>
            }
        />
    )
}
