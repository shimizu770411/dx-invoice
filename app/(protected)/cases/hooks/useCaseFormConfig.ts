import { CaseFormData } from '../schemas/CaseFormSchema'
import { formToApi } from '@/lib/dataTransformUtils'

const normalizePhoneNumber = (value: unknown): string | undefined => {
    if (typeof value !== 'string' || !value) return undefined
    return value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)).replace(/[ー－]/g, '-')
}

/**
 * フォームのデフォルト値を取得
 * フォーム内部では undefined を使用（null は持ち込まない）
 */
export function getFormDefaultValues(): CaseFormData {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const defaultReceptionAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    return {
        storeId: undefined,
        receptionAt: defaultReceptionAt,
        deceasedName: '',
        deceasedLastName: undefined,
        deceasedFirstName: undefined,
        gender: undefined,
        age: 0,
        religion: undefined,
        chiefMournerName: '',
        chiefMournerRelation: undefined,
        chiefMournerCityId: undefined,
        chiefMournerTownId: undefined,
        chiefMournerAddress: undefined,
        chiefMournerTel: undefined,
        sameAsChiefMourner: false,
        payerName: undefined,
        payerRelation: undefined,
        payerAddress: undefined,
        payerTel: undefined,
        pickupPlace: undefined,
        wakeAt: undefined,
        wakePlace: undefined,
        departureAt: undefined,
        departurePlace: undefined,
        funeralFrom: undefined,
        funeralTo: undefined,
        funeralPlace: undefined,
        notes: undefined,
        memberships: [
            {
                rowNo: 1,
                memberNo: '',
                joinedAt: undefined,
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
                joinedAt: undefined,
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
                joinedAt: undefined,
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
}

/**
 * フォーム送信データに変換（日付やnull値の処理）
 * 最終的に formToApi で undefined→削除、""→null に変換する
 */
export function transformSubmitData(data: CaseFormData, formatDateForISO: (val: string | undefined) => string | null) {
    // 「喪主と同じ」チェック時の処理
    let payerData = {
        payerName: data.payerName,
        payerRelation: data.payerRelation,
        payerAddress: data.payerAddress,
        payerTel: data.payerTel,
    }

    if (data.sameAsChiefMourner) {
        // 喪主情報を支払者情報にコピー（未入力の場合は undefined として扱う）
        payerData = {
            payerName: data.chiefMournerName || undefined,
            payerRelation: data.chiefMournerRelation || undefined,
            payerAddress: data.chiefMournerAddress || undefined,
            payerTel: data.chiefMournerTel || undefined,
        }
    }

    const base = {
        ...data,
        ...payerData,
        receptionAt: formatDateForISO(data.receptionAt),
        age: data.age ? parseInt(data.age.toString()) : 0,
        chiefMournerTel: normalizePhoneNumber(data.chiefMournerTel),
        payerTel: normalizePhoneNumber(payerData.payerTel),
        wakeAt: formatDateForISO(data.wakeAt),
        departureAt: formatDateForISO(data.departureAt),
        funeralFrom: formatDateForISO(data.funeralFrom),
        funeralTo: formatDateForISO(data.funeralTo),
        memberships: data.memberships.map((m) => ({
            ...m,
            rowNo: m.rowNo,
            joinedAt: m.joinedAt ? new Date(m.joinedAt).toISOString() : undefined,
            courseUnits: m.courseUnits ? parseInt(m.courseUnits.toString()) : undefined,
            maturityAmount: m.maturityAmount ? parseInt(m.maturityAmount.toString()) : undefined,
            paymentAmountOnce: m.paymentAmountOnce ? parseInt(m.paymentAmountOnce.toString()) : undefined,
            paymentTimes: m.paymentTimes ? parseInt(m.paymentTimes.toString()) : undefined,
            paymentAmount: m.paymentAmount ? parseInt(m.paymentAmount.toString()) : undefined,
        })),
    }
    // 郵便番号フィールドを除外（APIには送信しない）
    const { ...dataWithoutPostalCodes } = base

    // API送信用に変換: undefined→削除, ""→null
    return formToApi(dataWithoutPostalCodes)
}
