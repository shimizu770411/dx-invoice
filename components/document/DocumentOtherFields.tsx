'use client'

import { Control, useWatch } from 'react-hook-form'
import { CREMATION_OPTIONS, ALTAR_OPTIONS } from '@/app/(protected)/estimates/constants/estimateOptions'
import { FormInput } from '@/components/form/FormInput'
import { FormSelect } from '@/components/form/FormSelect'
import type { DocumentFormData } from './DocumentItemTable'

type Props = {
    control: Control<DocumentFormData>
    disabled?: boolean
    estimateStaffLabel?: string
    preConsultStaffSlot?: React.ReactNode
}

export function DocumentOtherFields({ control, disabled, estimateStaffLabel = '見積担当', preConsultStaffSlot }: Props) {
    const altarPlaceType = useWatch({ control, name: 'altarPlaceType' })

    return (
        <div className="mb-8">
            <div className="grid grid-cols-2 gap-4">
                <FormSelect
                    name="cremationProcessType"
                    control={control}
                    label="火葬許可証手続"
                    options={CREMATION_OPTIONS}
                    placeholder="選択してください"
                    disabled={disabled}
                />
                <div className="flex flex-col gap-2">
                    <FormSelect
                        name="altarPlaceType"
                        control={control}
                        label="祭壇設置場所"
                        options={ALTAR_OPTIONS}
                        placeholder="選択してください"
                        disabled={disabled}
                    />
                    {altarPlaceType === 'OTHER' && (
                        <FormInput name="altarPlaceOther" control={control} placeholder="祭壇設置場所" />
                    )}
                </div>
                <FormInput name="ceilingHeight" control={control} label="天井高" suffix="尺" />
                {preConsultStaffSlot}
                <FormInput name="estimateStaff" control={control} label={estimateStaffLabel} />
                <FormInput name="ceremonyStaff" control={control} label="式担当" />
                <FormInput name="transportStaff" control={control} label="搬送担当" />
                <FormInput name="decorationStaff" control={control} label="飾り担当" />
                <FormInput name="returnStaff" control={control} label="引上担当" />
            </div>
        </div>
    )
}
