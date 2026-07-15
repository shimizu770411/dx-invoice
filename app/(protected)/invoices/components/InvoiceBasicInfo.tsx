'use client'

import { Control } from 'react-hook-form'
import { InvoiceFormData } from '../schemas/InvoiceFormSchema'
import { FormInput } from '@/components/form/FormInput'
import { FormSelect } from '@/components/form/FormSelect'
import { DOC_NO_LENGTH } from '@/lib/documentUtils'

type Props = {
    control: Control<InvoiceFormData>
    disabled?: boolean
}

export function InvoiceBasicInfo({ control, disabled }: Props) {
    return (
        <div className="mb-8">
            <div className="flex flex-wrap items-start gap-4">
                <div style={{ width: '220px' }}>
                    <FormInput name="docNo" control={control} label="請求番号" placeholder="例: 202607001" disabled={disabled} maxLength={DOC_NO_LENGTH} />
                    <p
                        className="font-mincho"
                        style={{
                            marginTop: '6px',
                            fontSize: '11px',
                            color: 'var(--brand-text-muted)',
                            letterSpacing: '0.05em',
                        }}
                    >
                        空欄で自動採番。手入力する場合は yyyymm+連番3桁の9桁数字。
                    </p>
                </div>
                <div style={{ width: '160px' }}>
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
        </div>
    )
}
