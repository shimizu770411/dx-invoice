import { useFormContext } from 'react-hook-form'
import { CaseFormData } from '../schemas/CaseFormSchema'
import { FormInput } from '@/components/form/FormInput'
import { FormInputWithPostalSearch } from '@/components/form/FormInputWithPostalSearch'

export function ChiefMournerTab() {
    const {
        control,
        formState: { errors },
    } = useFormContext<CaseFormData>()

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            {/* 喪主名 */}
            <FormInput<CaseFormData>
                name="chiefMournerName"
                control={control}
                label="喪主名"
                required
                error={errors.chiefMournerName}
            />

            {/* 故人との関係 */}
            <FormInput<CaseFormData>
                name="chiefMournerRelation"
                control={control}
                label="故人との関係"
                error={errors.chiefMournerRelation}
            />

            {/* 住所 */}
            <div style={{ gridColumn: '1 / -1' }}>
                <FormInputWithPostalSearch<CaseFormData>
                    name="chiefMournerAddress"
                    control={control}
                    label="住所"
                    error={errors.chiefMournerAddress}
                />
            </div>

            {/* 電話番号 */}
            <FormInput<CaseFormData>
                name="chiefMournerTel"
                control={control}
                label="電話番号"
                type="tel"
                error={errors.chiefMournerTel}
            />
        </div>
    )
}
