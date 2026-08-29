import { useFormContext } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { CaseFormData } from '../schemas/CaseFormSchema'
import { FormInput } from '@/components/form/FormInput'
import { FormAutocomplete } from '@/components/form/FormAutocomplete'
import { FormSelect } from '@/components/form/FormSelect'
import { FormCheckbox } from '@/components/form/FormCheckbox'
import { FUNERAL_PLACE_OPTIONS } from '../constants/casesOptions'
import { getStores } from '@/lib/stores'

export function FuneralInfoTab() {
    const {
        control,
        formState: { errors },
    } = useFormContext<CaseFormData>()

    const { data: stores = [] } = useQuery({
        queryKey: ['stores'],
        queryFn: () => getStores(),
    })
    // 葬儀・告別式会場の候補: 有効な店舗（表示順）＋最後に自宅を追加。直接入力も可能。
    const funeralPlaceOptions = [...stores.map((s) => s.name), '自宅']

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            {/* 担当店舗 */}
            <FormSelect<CaseFormData>
                name="storeId"
                control={control}
                label="担当店舗"
                options={stores.map((s) => ({ value: s.id, label: s.name }))}
                placeholder="選択してください"
                error={errors.storeId}
            />

            {/* 葬儀・告別式会場 */}
            <FormAutocomplete<CaseFormData>
                name="funeralPlace"
                control={control}
                label="葬儀・告別式会場"
                options={funeralPlaceOptions}
                error={errors.funeralPlace}
            />

            {/* 葬儀・告別式開始日時 */}
            <FormInput<CaseFormData>
                name="funeralFrom"
                control={control}
                label="葬儀・告別式開始日時"
                type="datetime-local"
                minYear={1950}
                maxYear={new Date().getFullYear()}
                error={errors.funeralFrom}
            />

            {/* 葬儀・告別式終了日時 */}
            <FormInput<CaseFormData>
                name="funeralTo"
                control={control}
                label="葬儀・告別式終了日時"
                type="datetime-local"
                minYear={1950}
                maxYear={new Date().getFullYear()}
                error={errors.funeralTo}
            />

            {/* 引上日時 */}
            <div>
                <FormInput<CaseFormData>
                    name="returnAt"
                    control={control}
                    label="引上日時"
                    type="datetime-local"
                    minYear={1950}
                    maxYear={new Date().getFullYear()}
                    error={errors.returnAt}
                />
                <div style={{ marginTop: '0.5rem' }}>
                    <FormCheckbox<CaseFormData>
                        name={'returnAtTimeUnspecified' as any}
                        control={control}
                        label="時間を指定しない（見積/請求書PDFで時刻を表示しない）"
                    />
                </div>
            </div>

            {/* 引上場所 */}
            <FormAutocomplete<CaseFormData>
                name="returnPlace"
                control={control}
                label="引上場所"
                options={[...FUNERAL_PLACE_OPTIONS]}
                error={errors.returnPlace}
            />

        </div>
    )
}
