import { useFormContext } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { CaseFormData } from '../schemas/CaseFormSchema'
import { FormInput } from '@/components/form/FormInput'
import { FormDateTimeWithUnspecified } from '@/components/form/FormDateTimeWithUnspecified'
import { FormAutocomplete } from '@/components/form/FormAutocomplete'
import { PICKUP_PLACE_OPTIONS } from '../constants/casesOptions'
import { getStores } from '@/lib/stores'

export function WakeTab() {
    const {
        control,
        formState: { errors },
    } = useFormContext<CaseFormData>()

    // 通夜場所の候補: 有効な店舗（表示順）＋最後に自宅を追加。直接入力も可能。
    const { data: stores = [] } = useQuery({
        queryKey: ['stores'],
        queryFn: () => getStores(),
    })
    const wakePlaceOptions = [...stores.map((s) => s.name), '自宅']

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
            <FormDateTimeWithUnspecified<CaseFormData>
                name="wakeAt"
                unspecifiedName={'wakeAtTimeUnspecified' as any}
                control={control}
                label="通夜日時"
                minYear={1950}
                maxYear={new Date().getFullYear()}
                error={errors.wakeAt}
            />

            {/* 通夜場所 */}
            <FormAutocomplete<CaseFormData>
                name="wakePlace"
                control={control}
                label="通夜場所"
                options={wakePlaceOptions}
                error={errors.wakePlace}
            />

            {/* 出棺日時 */}
            <FormDateTimeWithUnspecified<CaseFormData>
                name="departureAt"
                unspecifiedName={'departureAtTimeUnspecified' as any}
                control={control}
                label="出棺日時"
                minYear={1950}
                maxYear={new Date().getFullYear()}
                error={errors.departureAt}
            />

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
