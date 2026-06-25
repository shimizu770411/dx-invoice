'use client'

import { Control } from 'react-hook-form'
import { EstimateFormData } from '../schemas/EstimateFormSchema'
import { DocumentOtherFields } from '@/components/document/DocumentOtherFields'
import { FormInput } from '@/components/form/FormInput'
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
        />
    )
}
