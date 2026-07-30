'use client'

import { useEffect, useState } from 'react'
import { Control, useWatch } from 'react-hook-form'
import { CREMATION_OPTIONS, ALTAR_OPTIONS } from '@/app/(protected)/estimates/constants/estimateOptions'
import { FormInput } from '@/components/form/FormInput'
import { FormSelect } from '@/components/form/FormSelect'
import { FormTextarea } from '@/components/form/FormTextarea'
import { useUpdateMemberCardNoteMutation } from '@/hooks/useCustomer'
import { toast } from '@/hooks/use-toast'
import { handleSaveError } from '@/lib/errorHandler'
import type { DocumentFormData } from './DocumentItemTable'

export const MAX_REMARKS_LENGTH = 50

type Props = {
    control: Control<DocumentFormData>
    disabled?: boolean
    estimateStaffLabel?: string
    preConsultStaffSlot?: React.ReactNode
    customer?: { id: string; memberCardNote?: string | null } | null
}

// 会員証欄（customers.member_card_note）: 見積・請求書の項目ではなく顧客レコードの値のため、
// このタブの他項目とは別に専用ボタンで保存する（このフォームの登録・更新には含まれない）
function MemberCardNoteField({ customer, disabled }: { customer?: { id: string; memberCardNote?: string | null } | null; disabled?: boolean }) {
    const [value, setValue] = useState(customer?.memberCardNote ?? '')
    const mutation = useUpdateMemberCardNoteMutation()

    useEffect(() => {
        setValue(customer?.memberCardNote ?? '')
    }, [customer?.id, customer?.memberCardNote])

    const isDirty = value !== (customer?.memberCardNote ?? '')

    const handleSave = async () => {
        if (!customer?.id) return
        try {
            await mutation.mutateAsync({ customerId: customer.id, memberCardNote: value })
            toast({ title: '会員証欄を保存しました', variant: 'success', duration: 2000 })
        } catch (error) {
            handleSaveError(error)
        }
    }

    return (
        <div className="mb-6 flex items-end gap-3">
            <div className="flex-1">
                <label className="brand-label">会員証</label>
                <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    disabled={disabled || !customer?.id}
                    maxLength={255}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-xl focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
                />
            </div>
            <button
                type="button"
                onClick={handleSave}
                disabled={disabled || !customer?.id || !isDirty || mutation.isPending}
                className="font-mincho transition-colors"
                style={{
                    padding: '10px 24px',
                    fontSize: '14px',
                    letterSpacing: '0.15em',
                    fontWeight: 500,
                    color: '#ffffff',
                    backgroundColor: disabled || !customer?.id || !isDirty || mutation.isPending ? '#a8a29a' : 'var(--brand-navy)',
                    border: 'none',
                    cursor: disabled || !customer?.id || !isDirty || mutation.isPending ? 'not-allowed' : 'pointer',
                }}
            >
                {mutation.isPending ? '保存中…' : '保存'}
            </button>
        </div>
    )
}

export function DocumentOtherFields({ control, disabled, estimateStaffLabel = '見積担当', preConsultStaffSlot, customer }: Props) {
    const altarPlaceType = useWatch({ control, name: 'altarPlaceType' })

    return (
        <div className="mb-8">
            <MemberCardNoteField customer={customer} disabled={disabled} />
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
            <div className="mt-4">
                <FormTextarea
                    name="remarks"
                    control={control}
                    label="備考"
                    rows={6}
                    maxLength={MAX_REMARKS_LENGTH}
                    noResize
                />
            </div>
        </div>
    )
}
