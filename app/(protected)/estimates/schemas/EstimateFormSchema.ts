import { z } from 'zod'
import { documentItemFieldSchema, documentFreeItemFieldSchema } from '@/lib/documentSchema'
import { isValidDocNo } from '@/lib/documentUtils'
import { BASE_PLAN_ID } from '@/lib/plans'

export const estimateItemFieldSchema = documentItemFieldSchema
export const estimateFreeItemFieldSchema = documentFreeItemFieldSchema

// 見積番号: 空欄(自動採番) または yyyymm+3桁連番の9桁数字のみ許可
const docNoSchema = z
    .string()
    .refine((val) => val === '' || isValidDocNo(val), {
        message: '見積番号は空欄、または9桁の数字（例: 202607001）で入力してください',
    })

// 【別料金】の金額欄。未入力は空文字として保持し、保存時に未設定へ変換する
const separateFeeSchema = z.union([z.string(), z.number()])

export const estimateFormSchema = z.object({
    docNo: docNoSchema,
    planId: z.string(),
    status: z.string(),
    isMember: z.string(),
    cremationProcessType: z.string(),
    altarPlaceType: z.string(),
    altarPlaceOther: z.string(),
    altarType: z.string(),
    ceilingHeight: z.string(),
    memberCardNote: z.string(),
    preConsultStaff: z.string(),
    estimateStaff: z.string(),
    ceremonyStaff: z.string(),
    transportStaff: z.string(),
    decorationStaff: z.string(),
    returnStaff: z.string(),
    remarks: z.string(),
    // 備考欄の【別料金】ブロックに表示する金額。合計金額には算入しない。
    // 金額入力欄は未入力時に空文字、入力時に数値を返すため両方を受ける
    cremationFee: separateFeeSchema,
    offeringFee: separateFeeSchema,
    newspaperAdFee: separateFeeSchema,
    items: z.array(estimateItemFieldSchema),
    freeItems: z.array(estimateFreeItemFieldSchema),
    // 種類変更等、フォーム外の変更を dirty 化するための隠しマーカー
    _changeMarker: z.string().optional(),
})

export type EstimateItemField = z.infer<typeof estimateItemFieldSchema>
export type EstimateFreeItemField = z.infer<typeof estimateFreeItemFieldSchema>
export type EstimateFormData = z.infer<typeof estimateFormSchema>

export const DEFAULT_FORM_VALUES: EstimateFormData = {
    docNo: '',
    planId: BASE_PLAN_ID,
    status: 'DRAFT',
    isMember: 'true',
    cremationProcessType: '',
    altarPlaceType: '',
    altarPlaceOther: '',
    altarType: '',
    ceilingHeight: '',
    memberCardNote: '',
    preConsultStaff: '',
    estimateStaff: '',
    ceremonyStaff: '',
    transportStaff: '',
    decorationStaff: '',
    returnStaff: '',
    remarks: '',
    cremationFee: '',
    offeringFee: '',
    newspaperAdFee: '',
    items: [],
    freeItems: [],
}
