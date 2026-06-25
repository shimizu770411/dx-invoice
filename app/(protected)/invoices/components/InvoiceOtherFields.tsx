'use client'

import { Control } from 'react-hook-form'
import { InvoiceFormData } from '../schemas/InvoiceFormSchema'
import { DocumentOtherFields } from '@/components/document/DocumentOtherFields'
import type { DocumentFormData } from '@/components/document/DocumentItemTable'

type Props = {
    control: Control<InvoiceFormData>
}

export function InvoiceOtherFields({ control }: Props) {
    return (
        <DocumentOtherFields
            control={control as unknown as Control<DocumentFormData>}
            estimateStaffLabel="請求書発行担当"
        />
    )
}
