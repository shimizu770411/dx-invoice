'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUsers } from '@/lib/users'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { SearchButton } from '@/components/button/SearchButton'
import { ResetButton } from '@/components/button/ResetButton'
import { SearchCustomersParams } from '@/lib/customers'
import { useCitiesQuery, useTownsQuery } from '@/hooks/useAddress'
import { InputUI, SelectUI, CheckboxUI, DatePickerUI } from '@/components/form/ui'
import { AutocompleteUI } from '@/components/form/ui/AutocompleteUI'
import { calculateDateRange } from '@/lib/dateUtils'
import { FUNERAL_PLACE_OPTIONS } from '../constants/casesOptions'

interface CaseSearchFormProps {
    formParams: FormParams
    setFormParams: (params: FormParams) => void
    onSearch: (params: SearchCustomersParams) => void
    onReset: () => void
    isLoading: boolean
}

interface FormParams extends SearchCustomersParams {
    receptionFromInput?: string
    receptionToInput?: string
    funeralFromInput?: string
    funeralToInput?: string
    salesStaffName?: string
    funeralPlace?: string
}

export function CaseSearchForm({ formParams, setFormParams, onSearch, onReset, isLoading }: CaseSearchFormProps) {
    const hasParams = Object.values(formParams).some((v) => v !== undefined && v !== '' && v !== null)
    const [open, setOpen] = useState(hasParams)
    const { data: cities = [] } = useCitiesQuery()
    const { data: towns = [] } = useTownsQuery(formParams.cityId || null)
    const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => getUsers() })
    const userNameOptions = users.map((u) => u.name)

    const handleCityChange = (cityId: string) => {
        setFormParams({ ...formParams, cityId, townId: undefined })
    }

    const handleSearch = () => {
        // 入力値から API 用の日付範囲を計算
        const receptionRange = calculateDateRange(formParams.receptionFromInput, formParams.receptionToInput)
        const funeralRange = calculateDateRange(formParams.funeralFromInput, formParams.funeralToInput)

        const searchParams: SearchCustomersParams = {
            ...formParams,
            receptionFrom: receptionRange.from,
            receptionTo: receptionRange.to,
            funeralFrom: funeralRange.from,
            funeralTo: funeralRange.to,
        }

        // 入力用フィールドはAPI送信から除外
        delete (searchParams as any).receptionFromInput
        delete (searchParams as any).receptionToInput
        delete (searchParams as any).funeralFromInput
        delete (searchParams as any).funeralToInput

        // ※ formParams は親コンポーネントで管理され、検索後も保持されます
        onSearch(searchParams)
        setOpen(true)
    }

    const handleReset = () => {
        setFormParams({})
        onReset()
        setOpen(false)
    }

    return (
        <div
            className="mb-8 bg-white"
            style={{
                border: '1px solid var(--brand-border)',
                borderLeft: '3px solid var(--brand-navy)',
            }}
        >
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-6 py-4 transition-colors"
                style={{
                    fontFamily: 'var(--font-mincho)',
                    fontSize: '16px',
                    fontWeight: 500,
                    letterSpacing: '0.2em',
                    color: 'var(--brand-navy)',
                    backgroundColor: open ? 'var(--brand-ivory)' : '#ffffff',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--brand-ivory)'
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = open ? 'var(--brand-ivory)' : '#ffffff'
                }}
            >
                <span className="flex items-center gap-3">
                    <span
                        className="font-garamond"
                        style={{
                            fontSize: '11px',
                            color: 'var(--brand-gold-soft)',
                            letterSpacing: '0.3em',
                        }}
                    >
                        SEARCH
                    </span>
                    <span>検索条件</span>
                </span>
                {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            {open && (
                <div className="px-6 pt-2 pb-6">
                    <div className="mb-4 grid grid-cols-2 gap-4">
                        <div>
                            <SelectUI
                                value={formParams.cityId || ''}
                                onChange={handleCityChange}
                                label="市区町村"
                                options={cities.map((city) => ({ value: city.id, label: city.name }))}
                                placeholder="選択してください"
                            />
                        </div>

                        <div>
                            <SelectUI
                                value={formParams.townId || ''}
                                onChange={(townId) => setFormParams({ ...formParams, townId })}
                                label="町字"
                                options={towns.map((town) => ({ value: town.id, label: town.name }))}
                                placeholder="選択してください"
                                disabled={!formParams.cityId}
                            />
                        </div>

                        <div className="col-span-2">
                            <InputUI
                                value={formParams.deceasedName || ''}
                                onChange={(deceasedName) => setFormParams({ ...formParams, deceasedName })}
                                label="故人名"
                                placeholder="入力してください"
                            />
                        </div>

                        <div>
                            <DatePickerUI
                                value={formParams.receptionFromInput || ''}
                                onChange={(receptionFromInput) => setFormParams({ ...formParams, receptionFromInput })}
                                label="受付日（From）"
                                placeholder="日付を選択"
                                minYear={2025}
                            />
                        </div>

                        <div>
                            <DatePickerUI
                                value={formParams.receptionToInput || ''}
                                onChange={(receptionToInput) => setFormParams({ ...formParams, receptionToInput })}
                                label="受付日（To）"
                                placeholder="日付を選択"
                                minYear={2025}
                            />
                        </div>

                        <div>
                            <DatePickerUI
                                value={formParams.funeralFromInput || ''}
                                onChange={(funeralFromInput) => setFormParams({ ...formParams, funeralFromInput })}
                                label="葬儀日（From）"
                                placeholder="日付を選択"
                                minYear={2025}
                            />
                        </div>

                        <div>
                            <DatePickerUI
                                value={formParams.funeralToInput || ''}
                                onChange={(funeralToInput) => setFormParams({ ...formParams, funeralToInput })}
                                label="葬儀日（To）"
                                placeholder="日付を選択"
                                minYear={2025}
                            />
                        </div>

                        <div>
                            <AutocompleteUI
                                value={formParams.salesStaffName || ''}
                                onChange={(salesStaffName) => setFormParams({ ...formParams, salesStaffName })}
                                label="担当者"
                                placeholder="入力または選択してください"
                                options={userNameOptions}
                            />
                        </div>

                        <div>
                            <AutocompleteUI
                                value={formParams.funeralPlace || ''}
                                onChange={(funeralPlace) => setFormParams({ ...formParams, funeralPlace })}
                                label="式場"
                                placeholder="入力または選択してください"
                                options={[...FUNERAL_PLACE_OPTIONS]}
                            />
                        </div>

                        <div>
                            <label className="mb-2 block">入金状態</label>
                            <div className="flex gap-4">
                                <CheckboxUI
                                    checked={formParams.paid === true}
                                    onChange={(paid) =>
                                        setFormParams({
                                            ...formParams,
                                            paid: paid ? true : undefined,
                                            unpaid: paid ? undefined : formParams.unpaid,
                                        })
                                    }
                                    label="入金済"
                                />
                                <CheckboxUI
                                    checked={formParams.unpaid === true}
                                    onChange={(unpaid) =>
                                        setFormParams({
                                            ...formParams,
                                            unpaid: unpaid ? true : undefined,
                                            paid: unpaid ? undefined : formParams.paid,
                                        })
                                    }
                                    label="未入金"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <ResetButton onClick={handleReset} />
                        <SearchButton onClick={handleSearch} isLoading={isLoading} />
                    </div>
                </div>
            )}
        </div>
    )
}
