import { useCallback } from 'react'
import { UseFormSetValue } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { getCities, getTowns, AddressCity, AddressTown } from '@/lib/address'
import { getCustomer } from '@/lib/customers'
import { CaseFormData } from '../schemas/CaseFormSchema'
import { toast } from '@/hooks/use-toast'
import { handleLoadError } from '@/lib/errorHandler'

export function useCaseFormData() {
    const normalizeDateString = (value: string): string => {
        // Convert 'YYYY-MM-DD HH:mm:ss.SSS +0900' -> 'YYYY-MM-DDTHH:mm:ss.SSS+09:00'
        const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?) ([+-]\d{4})$/)
        if (!match) return value

        const [, date, time, offset] = match
        const offsetWithColon = `${offset.slice(0, 3)}:${offset.slice(3)}`
        return `${date}T${time}${offsetWithColon}`
    }

    // 日付を安全に変換する関数（datetime-local入力用）
    // UTC時刻をローカルタイムゾーンに変換して表示
    const formatDateForInput = useCallback((dateValue: string | Date | null | undefined): string => {
        if (!dateValue) return ''
        try {
            const date = typeof dateValue === 'string' ? new Date(normalizeDateString(dateValue)) : dateValue
            if (isNaN(date.getTime())) return ''

            // ローカルタイムゾーンで表示
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')

            return `${year}-${month}-${day}T${hours}:${minutes}`
        } catch {
            return ''
        }
    }, [])

    // 日付を安全に変換する関数（ISO文字列用）
    // datetime-local入力はローカルタイムゾーンで解釈されるため、UTCに変換する
    const formatDateForISO = useCallback((dateValue: string | null | undefined): string | null => {
        if (!dateValue) return null
        try {
            const date = new Date(dateValue)
            if (isNaN(date.getTime())) return null
            return date.toISOString()
        } catch {
            return null
        }
    }, [])

    return { formatDateForInput, formatDateForISO }
}

export function useCaseFormLoader(setValue: UseFormSetValue<any>): {
    loadCities: () => Promise<AddressCity[]>
    loadCitiesAndCustomer: (customerId: string) => Promise<{
        customer: any
        cities: AddressCity[]
    }>
    handleCityChange: (cityId: string) => Promise<AddressTown[]>
} {
    const router = useRouter()
    const { formatDateForInput } = useCaseFormData()

    const loadCities = useCallback(async (): Promise<AddressCity[]> => {
        try {
            const citiesData = await getCities()
            return citiesData
        } catch (error) {
            console.error('Failed to load cities:', error)
            return []
        }
    }, [])

    const loadCitiesAndCustomer = useCallback(
        async (customerId: string) => {
            try {
                const [customerData, citiesData] = await Promise.all([getCustomer(customerId), getCities()])

                if (!customerData) {
                    toast({ title: '案件が見つかりません', variant: 'destructive', duration: 3000 })
                    router.push('/cases')
                    return { customer: null, cities: citiesData }
                }

                // フォームデータに変換
                const formattedData: CaseFormData = {
                    receptionAt: formatDateForInput(customerData.receptionAt),
                    deceasedName: customerData.deceasedName || '',
                    deceasedLastName: customerData.deceasedLastName || '',
                    deceasedFirstName: customerData.deceasedFirstName || '',
                    gender: customerData.gender || '',
                    age: customerData.age ? customerData.age : 0,
                    religion: customerData.religion || '',
                    chiefMournerName: customerData.chiefMournerName || '',
                    chiefMournerRelation: customerData.chiefMournerRelation || '',
                    chiefMournerCityId: customerData.chiefMournerCityId || '',
                    chiefMournerTownId: customerData.chiefMournerTownId || '',
                    chiefMournerAddress: customerData.chiefMournerAddress || '',
                    chiefMournerTel: customerData.chiefMournerTel || '',
                    sameAsChiefMourner: false,
                    payerName: customerData.payerName || '',
                    payerRelation: customerData.payerRelation || '',
                    payerAddress: customerData.payerAddress || '',
                    payerTel: customerData.payerTel || '',
                    pickupPlace: customerData.pickupPlace || '',
                    wakeAt: formatDateForInput(customerData.wakeAt),
                    wakePlace: customerData.wakePlace || '',
                    departureAt: formatDateForInput(customerData.departureAt),
                    departurePlace: customerData.departurePlace || '',
                    funeralFrom: formatDateForInput(customerData.funeralFrom),
                    funeralTo: formatDateForInput(customerData.funeralTo),
                    funeralPlace: customerData.funeralPlace || '',
                    notes: customerData.notes || '',
                    memberships: customerData.memberships?.map((m: any) => ({
                        rowNo: m.rowNo,
                        memberNo: m.memberNo || '',
                        joinedAt: m.joinedAt ? formatDateForInput(m.joinedAt).split('T')[0] : '',
                        memberName: m.memberName || '',
                        courseUnits: m.courseUnits ? m.courseUnits : undefined,
                        maturityAmount: m.maturityAmount ? m.maturityAmount : undefined,
                        paymentAmountOnce: m.paymentAmountOnce ? m.paymentAmountOnce : 3000,
                        paymentTimes: m.paymentTimes ? m.paymentTimes : undefined,
                        paymentAmount: m.paymentAmount ? m.paymentAmount : undefined,
                        salesStaffName: m.salesStaffName || '',
                        relationToDeceased: m.relationToDeceased || '',
                    })) || [
                        {
                            rowNo: 1,
                            memberNo: '',
                            joinedAt: '',
                            memberName: '',
                            courseUnits: undefined,
                            maturityAmount: undefined,
                            paymentAmountOnce: 3000,
                            paymentTimes: undefined,
                            paymentAmount: undefined,
                            salesStaffName: '',
                            relationToDeceased: '',
                        },
                        {
                            rowNo: 2,
                            memberNo: '',
                            joinedAt: '',
                            memberName: '',
                            courseUnits: undefined,
                            maturityAmount: undefined,
                            paymentAmountOnce: 3000,
                            paymentTimes: undefined,
                            paymentAmount: undefined,
                            salesStaffName: '',
                            relationToDeceased: '',
                        },
                        {
                            rowNo: 3,
                            memberNo: '',
                            joinedAt: '',
                            memberName: '',
                            courseUnits: undefined,
                            maturityAmount: undefined,
                            paymentAmountOnce: 3000,
                            paymentTimes: undefined,
                            paymentAmount: undefined,
                            salesStaffName: '',
                            relationToDeceased: '',
                        },
                    ],
                }

                // フォームに値を設定
                setValue('receptionAt', formattedData.receptionAt)
                setValue('deceasedName', formattedData.deceasedName)
                setValue('deceasedLastName', formattedData.deceasedLastName)
                setValue('deceasedFirstName', formattedData.deceasedFirstName)
                setValue('gender', formattedData.gender)
                setValue('age', formattedData.age)
                setValue('religion', formattedData.religion)
                setValue('chiefMournerName', formattedData.chiefMournerName)
                setValue('chiefMournerRelation', formattedData.chiefMournerRelation)
                setValue('chiefMournerCityId', formattedData.chiefMournerCityId)
                setValue('chiefMournerTownId', formattedData.chiefMournerTownId)
                setValue('chiefMournerAddress', formattedData.chiefMournerAddress)
                setValue('chiefMournerTel', formattedData.chiefMournerTel)
                setValue('payerName', formattedData.payerName)
                setValue('payerRelation', formattedData.payerRelation)
                setValue('payerAddress', formattedData.payerAddress)
                setValue('payerTel', formattedData.payerTel)
                setValue('pickupPlace', formattedData.pickupPlace)
                setValue('wakeAt', formattedData.wakeAt)
                setValue('wakePlace', formattedData.wakePlace)
                setValue('departureAt', formattedData.departureAt)
                setValue('departurePlace', formattedData.departurePlace)
                setValue('funeralFrom', formattedData.funeralFrom)
                setValue('funeralTo', formattedData.funeralTo)
                setValue('funeralPlace', formattedData.funeralPlace)
                setValue('notes', formattedData.notes)
                setValue('memberships', formattedData.memberships)

                return { customer: customerData, cities: citiesData }
            } catch (error) {
                handleLoadError(error)
                return { customer: null, cities: [] }
            }
        },
        [setValue, formatDateForInput, router]
    )

    const handleCityChange = useCallback(async (cityId: string) => {
        if (cityId) {
            try {
                const townsData = await getTowns(cityId)
                return townsData
            } catch (error) {
                console.error('Failed to load towns:', error)
                return []
            }
        } else {
            return []
        }
    }, [])

    return { loadCities, loadCitiesAndCustomer, handleCityChange }
}
