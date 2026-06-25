'use client'

import { Control, FieldArrayWithId, UseFormSetValue } from 'react-hook-form'
import { InvoiceItem, InvoiceFreeItem } from '@/lib/invoices'
import { InvoiceFormData } from '../schemas/InvoiceFormSchema'
import { DocumentItemTable } from '@/components/document/DocumentItemTable'
import type { DocumentFormData } from '@/components/document/DocumentItemTable'
import { ProductVariant } from '@/lib/products'

type Props = {
    items: InvoiceItem[]
    fields: FieldArrayWithId<InvoiceFormData, 'items', 'id'>[]
    control: Control<InvoiceFormData>
    isMember: boolean
    freeItems?: InvoiceFreeItem[]
    freeFields?: FieldArrayWithId<InvoiceFormData, 'freeItems', 'id'>[]
    handleRemoveFreeItem?: (index: number) => void
    onVariantChange?: (index: number, variant: ProductVariant) => void
    setValue?: UseFormSetValue<InvoiceFormData>
    currentStoreId?: string | null
    onMultiSelectChange?: (index: number, variantIds: string[], options?: { adhocSetScope?: 'NONE' | 'MEMBER_ONLY' | 'BOTH'; isService?: boolean; isMaturityService?: boolean }) => void
}

export function InvoiceItemTable({ control, fields, freeFields, setValue, ...rest }: Props) {
    return (
        <DocumentItemTable
            {...rest}
            control={control as unknown as Control<DocumentFormData>}
            fields={fields as unknown as FieldArrayWithId<DocumentFormData, 'items', 'id'>[]}
            freeFields={freeFields as unknown as FieldArrayWithId<DocumentFormData, 'freeItems', 'id'>[]}
            setValue={setValue as unknown as UseFormSetValue<DocumentFormData>}
        />
    )
}
