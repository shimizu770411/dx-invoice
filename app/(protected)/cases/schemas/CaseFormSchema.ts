import { z } from 'zod'

const phoneNumberRegex = /^\d{2,4}-?\d{2,4}-?\d{3,4}$/
const normalizePhoneNumber = (value: string) =>
    value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)).replace(/[ー－]/g, '-')
const phoneNumberSchema = z.preprocess(
    (value) => (typeof value === 'string' ? normalizePhoneNumber(value) : value),
    z
        .string()
        .optional()
        .refine((value) => !value || phoneNumberRegex.test(value), {
            message: '正しい電話番号を数字で入力してください（例: 09012345678 or 090-1234-5678）',
        })
)

// 会員情報のスキーマ
export const customerMembershipSchema = z.object({
    rowNo: z.number(),
    memberNo: z.string().optional(),
    joinedAt: z.string().optional(),
    memberName: z.string().optional(),
    courseUnits: z.coerce.number().optional(),
    maturityAmount: z.preprocess(
        (value) => (typeof value === 'string' ? value.replace(/,/g, '') : value),
        z.coerce.number().optional()
    ),
    paymentAmountOnce: z.preprocess(
        (value) => (typeof value === 'string' ? value.replace(/,/g, '') : value),
        z.coerce.number().optional()
    ),
    paymentTimes: z.coerce.number().optional(),
    paymentAmount: z.preprocess(
        (value) => (typeof value === 'string' ? value.replace(/,/g, '') : value),
        z.coerce.number().optional()
    ),
    salesStaffName: z.string().optional(),
    relationToDeceased: z.string().optional(),
})

// 案件フォームのメインスキーマ
export const caseFormSchema = z.object({
    // 担当店舗
    storeId: z.string().optional(),

    // 故人情報
    receptionAt: z.coerce.string().min(1, '必須です'),
    deceasedName: z.coerce.string().min(1, '必須です'),
    deceasedLastName: z.string().optional(),
    deceasedFirstName: z.string().optional(),
    gender: z.string().optional(),
    age: z.preprocess(
        (val) => {
            if (val === '' || val === null || val === undefined) return undefined
            const num = Number(val)
            return isNaN(num) ? undefined : num
        },
        z.number({ required_error: '必須です', invalid_type_error: '必須です' }).min(1, '必須です')
    ),
    religion: z.string().optional(),

    // 喪主情報
    chiefMournerName: z.coerce.string().min(1, '必須です'),
    chiefMournerRelation: z.string().optional(),
    chiefMournerPostalCode: z.string().optional().default(''),
    chiefMournerCityId: z.string().optional(),
    chiefMournerTownId: z.string().optional(),
    chiefMournerAddress: z.string().optional(),
    chiefMournerTel: phoneNumberSchema,

    // 支払者情報
    sameAsChiefMourner: z.boolean().default(false),
    payerName: z.string().optional(),
    payerRelation: z.string().optional(),
    payerPostalCode: z.string().optional().default(''),
    payerAddress: z.string().optional(),
    payerTel: phoneNumberSchema,

    // 葬儀情報
    pickupPlace: z.string().optional(),
    wakeAt: z.string().optional(),
    wakeAtTimeUnspecified: z.boolean().optional(),
    wakePlace: z.string().optional(),
    departureAt: z.string().optional(),
    departureAtTimeUnspecified: z.boolean().optional(),
    departurePlace: z.string().optional(),
    funeralFrom: z.string().optional(),
    funeralTo: z.string().optional(),
    funeralPlace: z.string().optional(),
    // 会員情報
    memberships: z.array(customerMembershipSchema),
})

// API送信時は郵便番号を除外
const caseFormApiSchema = caseFormSchema.omit({
    chiefMournerPostalCode: true,
    payerPostalCode: true,
})

export type CaseFormData = z.input<typeof caseFormSchema>
export type CaseFormOutput = z.output<typeof caseFormApiSchema>
