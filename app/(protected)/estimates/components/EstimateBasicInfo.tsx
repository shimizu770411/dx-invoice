'use client'

import { Control } from 'react-hook-form'
import { EstimateFormData } from '../schemas/EstimateFormSchema'
import { FormInput } from '@/components/form/FormInput'
import { FormSelect } from '@/components/form/FormSelect'
import { STATUS_OPTIONS } from '../constants/estimateOptions'

type Props = {
    control: Control<EstimateFormData>
    isNew?: boolean
    disabled?: boolean
}

export function EstimateBasicInfo({ control, isNew, disabled }: Props) {
    return (
        <div className="mb-6">
            <div className={`grid gap-4 ${isNew ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {!isNew && <FormInput name="docNo" control={control} label="見積番号" placeholder="例: EST-0001" />}
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
                <FormSelect
                    name="status"
                    control={control}
                    label="見積区分"
                    options={STATUS_OPTIONS}
                    disabled
                />
            </div>
        </div>
    )
}
