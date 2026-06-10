import { z } from 'zod'

export const invoiceItemFieldSchema = z.object({
    qty: z.coerce.number().min(0).max(99, '数量オーバー'),
    description: z.string(),
})

// 満期サービスは控除扱いのため 0 以下（負値=控除、0=未利用）。
// 解約手数料は 0 以上（請求書のみ）。それ以外のフリー項目は 0 以上。
export const invoiceFreeItemFieldSchema = z
    .object({
        productItemName: z.string(),
        description: z.string(),
        unitPriceGeneral: z.coerce.number(),
        qty: z.coerce.number().min(0).max(99, '数量オーバー'),
    })
    .superRefine((data, ctx) => {
        if (data.productItemName === '満期サービス') {
            if (data.unitPriceGeneral > 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['unitPriceGeneral'],
                    message: '満期サービスは0以下の金額を入力してください',
                })
            }
        } else if (data.unitPriceGeneral < 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['unitPriceGeneral'],
                message: '0以上の金額を入力してください',
            })
        }
    })

export const invoiceFormSchema = z.object({
    docNo: z.string(),
    status: z.string(),
    isMember: z.string(),
    cremationProcessType: z.string(),
    altarPlaceType: z.string(),
    altarPlaceOther: z.string(),
    ceilingHeight: z.string(),
    estimateStaff: z.string(),
    ceremonyStaff: z.string(),
    transportStaff: z.string(),
    decorationStaff: z.string(),
    returnStaff: z.string(),
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
    ceilingHeight: '',
    estimateStaff: '',
    ceremonyStaff: '',
    transportStaff: '',
    decorationStaff: '',
    returnStaff: '',
    items: [],
    freeItems: [],
}
