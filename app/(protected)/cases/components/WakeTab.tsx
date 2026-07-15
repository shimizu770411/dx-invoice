import { useFormContext } from 'react-hook-form'
import { CaseFormData } from '../schemas/CaseFormSchema'
import { FormInput } from '@/components/form/FormInput'
import { FormCheckbox } from '@/components/form/FormCheckbox'
import { FormAutocomplete } from '@/components/form/FormAutocomplete'
import { PICKUP_PLACE_OPTIONS } from '../constants/casesOptions'

export function WakeTab() {
    const {
        control,
        formState: { errors },
    } = useFormContext<CaseFormData>()

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            {/* 引取場所 */}
            <div style={{ gridColumn: '1 / -1' }}>
                <FormAutocomplete<CaseFormData>
                    name="pickupPlace"
                    control={control}
                    label="引取場所"
                    options={[...PICKUP_PLACE_OPTIONS]}
                    error={errors.pickupPlace}
                />
            </div>

            {/* 通夜日時 */}
            <div>
                <FormInput<CaseFormData>
                    name="wakeAt"
                    control={control}
                    label="通夜日時"
                    type="datetime-local"
                    minYear={1950}
                    maxYear={new Date().getFullYear()}
                    error={errors.wakeAt}
                />
                <div style={{ marginTop: '0.5rem' }}>
                    <FormCheckbox<CaseFormData>
                        name={'wakeAtTimeUnspecified' as any}
                        control={control}
                        label="時間を指定しない（見積/請求書PDFで時刻を表示しない）"
                    />
                </div>
            </div>

            {/* 通夜場所 */}
            <FormInput<CaseFormData> name="wakePlace" control={control} label="通夜場所" error={errors.wakePlace} />

            {/* 出棺日時 */}
            <div>
                <FormInput<CaseFormData>
                    name="departureAt"
                    control={control}
                    label="出棺日時"
                    type="datetime-local"
                    minYear={1950}
                    maxYear={new Date().getFullYear()}
                    error={errors.departureAt}
                />
                <div style={{ marginTop: '0.5rem' }}>
                    <FormCheckbox<CaseFormData>
                        name={'departureAtTimeUnspecified' as any}
                        control={control}
                        label="時間を指定しない（見積/請求書PDFで時刻を表示しない）"
                    />
                </div>
            </div>

            {/* 火葬場名 */}
            <FormInput<CaseFormData>
                name="departurePlace"
                control={control}
                label="火葬場名"
                error={errors.departurePlace}
            />
        </div>
    )
}
