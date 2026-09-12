import { z } from 'zod'
import { documentItemFieldSchema, documentFreeItemFieldSchema } from '@/lib/documentSchema'
import { isValidDocNo } from '@/lib/documentUtils'

export const invoiceItemFieldSchema = documentItemFieldSchema
export const invoiceFreeItemFieldSchema = documentFreeItemFieldSchema

// 請求番号: 空欄(自動採番) または yyyymm+3桁連番の9桁数字のみ許可
const docNoSchema = z
    .string()
    .refine((val) => val === '' || isValidDocNo(val), {
        message: '請求番号は空欄、または9桁の数字（例: 202607001）で入力してください',
    })

// 備考欄の支払合計ブロックの生花代。未入力は空文字として保持し、保存時に未設定へ変換する。
// 金額入力欄は未入力時に空文字、入力時に数値を返すため両方を受ける
const flowerFeeSchema = z.union([z.string(), z.number()])

export const invoiceFormSchema = z.object({
    docNo: docNoSchema,
    status: z.string(),
    isMember: z.string(),
    cremationProcessType: z.string(),
    altarPlaceType: z.string(),
    altarPlaceOther: z.string(),
    altarType: z.string(),
    ceilingHeight: z.string(),
    memberCardNote: z.string(),
    estimateStaff: z.string(),
    ceremonyStaff: z.string(),
    transportStaff: z.string(),
    decorationStaff: z.string(),
    returnStaff: z.string(),
    remarks: z.string(),
    // 備考欄の支払合計ブロックに表示する生花代。請求書本体の合計金額には算入しない
    flowerFee: flowerFeeSchema,
    items: z.array(invoiceItemFieldSchema),
    freeItems: z.array(invoiceFreeItemFieldSchema),
    _changeMarker: z.string().optional(),
})

export type InvoiceItemField = z.infer<typeof invoiceItemFieldSchema>
export type InvoiceFreeItemField = z.infer<typeof invoiceFreeItemFieldSchema>
export type InvoiceFormData = z.infer<typeof invoiceFormSchema>

export const DEFAULT_INVOICE_FORM_VALUES: InvoiceFormData = {
    docNo: '',
    status: 'DRAFT',
    isMember: 'false',
    cremationProcessType: '',
    altarPlaceType: '',
    altarPlaceOther: '',
    altarType: '',
    ceilingHeight: '',
    memberCardNote: '',
    estimateStaff: '',
    ceremonyStaff: '',
    transportStaff: '',
    decorationStaff: '',
    returnStaff: '',
    remarks: '',
    flowerFee: '',
    items: [],
    freeItems: [],
}
