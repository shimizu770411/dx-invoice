import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { CaseFormData } from '../schemas/CaseFormSchema'
import { FormInput } from '@/components/form/FormInput'
import { FormSelect } from '@/components/form/FormSelect'
import { FormAutocomplete } from '@/components/form/FormAutocomplete'
import { GENDER_OPTIONS, RELIGION_OPTIONS } from '../constants/casesOptions'
import { AgeCalculatorDialog } from './AgeCalculatorDialog'

export function DeceasedInfoTab() {
    const {
        control,
        setValue,
        formState: { errors },
    } = useFormContext<CaseFormData>()

    const [calcOpen, setCalcOpen] = useState(false)
    const receptionAt = useWatch({ control, name: 'receptionAt' }) as string | undefined

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            {/* 受付日 */}
            <FormInput<CaseFormData>
                name="receptionAt"
                control={control}
                label="受付日"
                type="datetime-local"
                minYear={1950}
                maxYear={new Date().getFullYear()}
                required
                error={errors.receptionAt}
            />

            {/* 故人名 */}
            <FormInput<CaseFormData>
                name="deceasedName"
                control={control}
                label="故人名"
                required
                error={errors.deceasedName}
                prefix="故"
                suffix="様"
            />

            {/* 故人姓（フリガナ） */}
            <FormInput<CaseFormData>
                name="deceasedLastName"
                control={control}
                label="故人姓（フリガナ）"
                error={errors.deceasedLastName}
            />

            {/* 故人名（フリガナ） */}
            <FormInput<CaseFormData>
                name="deceasedFirstName"
                control={control}
                label="故人名（フリガナ）"
                error={errors.deceasedFirstName}
            />

            {/* 性別 */}
            <FormSelect<CaseFormData>
                name="gender"
                control={control}
                label="性別"
                options={[...GENDER_OPTIONS]}
                error={errors.gender}
                placeholder="選択してください"
            />

            {/* 行年 */}
            <div style={{ position: 'relative' }}>
                <label className="brand-label">
                    行年
                    <span className="brand-label-required">*</span>
                </label>
                <button
                    type="button"
                    onClick={() => setCalcOpen(true)}
                    className="inline-flex items-center gap-1 font-mincho transition-colors"
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        padding: '4px 12px',
                        fontSize: '12px',
                        letterSpacing: '0.1em',
                        border: '1px solid var(--brand-gold)',
                        backgroundColor: '#ffffff',
                        color: 'var(--brand-gold-soft)',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--brand-gold)'
                        e.currentTarget.style.color = 'var(--brand-navy-dark)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff'
                        e.currentTarget.style.color = 'var(--brand-gold-soft)'
                    }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        calculate
                    </span>
                    生年月日から算出
                </button>
                <FormInput<CaseFormData>
                    name="age"
                    control={control}
                    type="number"
                    suffix="歳"
                    min={0}
                    max={999}
                    error={errors.age}
                />
            </div>

            {/* 御宗旨 */}
            <FormAutocomplete<CaseFormData>
                name="religion"
                control={control}
                label="御宗旨"
                options={[...RELIGION_OPTIONS]}
                error={errors.religion}
            />

            {/* 見積お名前（見積書タイトルの「○○家御葬儀見積書」に表示する苗字） */}
            <FormInput<CaseFormData>
                name="estimateDisplayName"
                control={control}
                label="見積お名前"
                maxLength={8}
                suffix="家"
                error={errors.estimateDisplayName}
            />

            <AgeCalculatorDialog
                open={calcOpen}
                onClose={() => setCalcOpen(false)}
                onConfirm={(age) => {
                    setValue('age', age, { shouldDirty: true, shouldValidate: true })
                }}
                baseDate={receptionAt}
            />
        </div>
    )
}
