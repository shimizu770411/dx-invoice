'use client'

import { Control } from 'react-hook-form'
import { InvoiceFormData } from '../schemas/InvoiceFormSchema'
import { FormInput } from '@/components/form/FormInput'
import { FormSelect } from '@/components/form/FormSelect'

type Props = {
    control: Control<InvoiceFormData>
    disabled?: boolean
}

export function InvoiceBasicInfo({ control, disabled }: Props) {
    return (
        <div className="mb-8">
            <div className="grid grid-cols-2 gap-4">
                <FormInput name="docNo" control={control} label="請求番号" placeholder="例: INV-0001" disabled={disabled} />
                <FormSelect
                    name="isMember"
                    control={control}
                    label="一般・会員"
                    options={[
                        { value: 'false', label: '一般' },
                        { value: 'true', label: '会員' },
                    ]}
                    disabled={disabled}
                />
            </div>
        </div>
    )
}
