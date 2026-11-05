import { useEffect } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { CaseFormData } from '../schemas/CaseFormSchema'
import { FormSelect } from '@/components/form/FormSelect'
import { FormEraDateSelect } from '@/components/form/FormEraDateSelect'
import { MEMBERSHIP_STATUS_OPTIONS } from '../constants/casesOptions'

/**
 * 会員タブ（互助会員1・2、けやき）共通の「状況」「完納日」入力欄。
 * 完納日は状況が「完納」のときだけ入力でき、完納以外に切り替えると消す。
 */
export function MembershipStatusFields({ index }: { index: number }) {
    const {
        control,
        setValue,
        getValues,
        formState: { errors },
    } = useFormContext<CaseFormData>()

    const status = useWatch({ control, name: `memberships.${index}.status` })
    const isCompleted = status === 'COMPLETED'

    useEffect(() => {
        if (!isCompleted && getValues(`memberships.${index}.completedAt`)) {
            // undefined を入れると読み込み時の値に戻って表示されるため、空文字で消す
            setValue(`memberships.${index}.completedAt`, '', { shouldDirty: true })
        }
    }, [isCompleted, index, getValues, setValue])

    return (
        <>
            {/* 状況 */}
            <FormSelect<CaseFormData>
                name={`memberships.${index}.status`}
                control={control}
                label="状況"
                options={[...MEMBERSHIP_STATUS_OPTIONS]}
                error={errors.memberships?.[index]?.status}
                placeholder="選択してください"
            />

            {/* 完納日 */}
            <FormEraDateSelect<CaseFormData>
                name={`memberships.${index}.completedAt`}
                control={control}
                label="完納日"
                minYear={1950}
                maxYear={new Date().getFullYear()}
                disabled={!isCompleted}
                error={errors.memberships?.[index]?.completedAt}
            />
        </>
    )
}
