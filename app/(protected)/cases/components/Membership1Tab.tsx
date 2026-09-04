import { useEffect } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { CaseFormData } from '../schemas/CaseFormSchema'
import { FormInput } from '@/components/form/FormInput'
import { FormCurrencyInput } from '@/components/form/FormCurrencyInput'
import { FormAutocomplete } from '@/components/form/FormAutocomplete'
import { FormEraDateSelect } from '@/components/form/FormEraDateSelect'
import { MEMBERSHIP_RELATION_OPTIONS } from '../constants/casesOptions'

const INDEX = 0

export function Membership1Tab() {
    const {
        control,
        setValue,
        formState: { errors },
    } = useFormContext<CaseFormData>()

    // 1回の入金額 × 入金回数 を自動計算して 入金額 にセット
    const paymentAmountOnce = useWatch({ control, name: `memberships.${INDEX}.paymentAmountOnce` })
    const paymentTimes = useWatch({ control, name: `memberships.${INDEX}.paymentTimes` })
    useEffect(() => {
        const once = Number(paymentAmountOnce) || 0
        const times = Number(paymentTimes) || 0
        const total = once * times
        setValue(`memberships.${INDEX}.paymentAmount`, total > 0 ? total : undefined, {
            shouldDirty: true,
        })
    }, [paymentAmountOnce, paymentTimes, setValue])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>会員1</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    {/* 会員番号 */}
                    <FormInput<CaseFormData>
                        name={`memberships.${INDEX}.memberNo`}
                        control={control}
                        label="会員番号"
                        error={errors.memberships?.[INDEX]?.memberNo}
                    />

                    {/* 加入日 */}
                    <FormEraDateSelect<CaseFormData>
                        name={`memberships.${INDEX}.joinedAt`}
                        control={control}
                        label="加入日"
                        minYear={1950}
                        maxYear={new Date().getFullYear()}
                        error={errors.memberships?.[INDEX]?.joinedAt}
                    />

                    {/* 会員名 */}
                    <div style={{ gridColumn: '1 / -1' }}>
                        <FormInput<CaseFormData>
                            name={`memberships.${INDEX}.memberName`}
                            control={control}
                            label="会員名"
                            error={errors.memberships?.[INDEX]?.memberName}
                        />
                    </div>

                    {/* 金額情報を1行で表示: コース口数 / 満期額 / 1回の入金額 / 入金回数 / 入金額 */}
                    <div
                        style={{
                            gridColumn: '1 / -1',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '0.75rem',
                        }}
                    >
                        <FormCurrencyInput<CaseFormData>
                            name={`memberships.${INDEX}.maturityAmount`}
                            control={control}
                            label="満期額"
                            suffix="円"
                            error={errors.memberships?.[INDEX]?.maturityAmount}
                        />
                        <FormCurrencyInput<CaseFormData>
                            name={`memberships.${INDEX}.paymentAmountOnce`}
                            control={control}
                            label="1回の入金額"
                            suffix="円"
                            error={errors.memberships?.[INDEX]?.paymentAmountOnce}
                        />
                        <FormInput<CaseFormData>
                            name={`memberships.${INDEX}.paymentTimes`}
                            control={control}
                            label="入金回数"
                            type="number"
                            suffix="回"
                            error={errors.memberships?.[INDEX]?.paymentTimes}
                        />
                        <FormCurrencyInput<CaseFormData>
                            name={`memberships.${INDEX}.paymentAmount`}
                            control={control}
                            label="入金額"
                            suffix="円"
                            disabled
                            error={errors.memberships?.[INDEX]?.paymentAmount}
                        />
                    </div>

                    {/* 営業担当者名 */}
                    <div style={{ gridColumn: '1 / -1' }}>
                        <FormInput<CaseFormData>
                            name={`memberships.${INDEX}.salesStaffName`}
                            control={control}
                            label="営業担当者名"
                            error={errors.memberships?.[INDEX]?.salesStaffName}
                        />
                    </div>

                    {/* 故人との関係 */}
                    <div style={{ gridColumn: '1 / -1' }}>
                        <FormAutocomplete<CaseFormData>
                            name={`memberships.${INDEX}.relationToDeceased`}
                            control={control}
                            label="故人との関係"
                            options={[...MEMBERSHIP_RELATION_OPTIONS]}
                            error={errors.memberships?.[INDEX]?.relationToDeceased}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
