'use client'

import { Control, FieldArrayWithId, UseFormSetValue } from 'react-hook-form'
import { EstimateItem, EstimateFreeItem } from '@/lib/estimates'
import { EstimateFormData } from '../schemas/EstimateFormSchema'
import { DocumentItemTable } from '@/components/document/DocumentItemTable'
import type { DocumentFormData } from '@/components/document/DocumentItemTable'
import { ProductVariant } from '@/lib/products'
import type { PlanSurcharge } from '@/lib/planSurcharges'

type Props = {
    items: EstimateItem[]
    fields: FieldArrayWithId<EstimateFormData, 'items', 'id'>[]
    control: Control<EstimateFormData>
    isMember: boolean
    freeItems?: EstimateFreeItem[]
    freeFields?: FieldArrayWithId<EstimateFormData, 'freeItems', 'id'>[]
    handleRemoveFreeItem?: (index: number) => void
    onVariantChange?: (index: number, variant: ProductVariant) => void
    setValue?: UseFormSetValue<EstimateFormData>
    readOnly?: boolean
    currentStoreId?: string | null
    onMultiSelectChange?: (index: number, variantIds: string[], options?: { adhocSetScope?: 'NONE' | 'MEMBER_ONLY' | 'BOTH'; isService?: boolean; isMaturityService?: boolean }) => void
    onGroupVariantChange?: (index: number, groupId: string, variantIds: string[]) => void
    /** 選択中プランの親祭壇の増額選択肢 */
    planSurcharges?: PlanSurcharge[]
}

export function EstimateItemTable({ control, fields, freeFields, setValue, ...rest }: Props) {
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
