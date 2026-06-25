import { z } from 'zod'

export const estimateItemFieldSchema = z.object({
    qty: z.coerce.number().min(0).max(3000, '数量オーバー'),
    description: z.string(),
})

// 満期サービスは控除扱いのため 0 以下（負値=控除、0=未利用）。それ以外のフリー項目は 0 以上。
export const estimateFreeItemFieldSchema = z
    .object({
        parentProductItemId: z.string().nullable().optional(),
        productItemName: z.string(),
        description: z.string(),
        unitPriceGeneral: z.coerce.number(),
        qty: z.coerce.number().min(0).max(3000, '数量オーバー'),
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

export const estimateFormSchema = z.object({
    docNo: z.string(),
    status: z.string(),
    isMember: z.string(),
    cremationProcessType: z.string(),
    altarPlaceType: z.string(),
    altarPlaceOther: z.string(),
    ceilingHeight: z.string(),
    preConsultStaff: z.string(),
    estimateStaff: z.string(),
    ceremonyStaff: z.string(),
    transportStaff: z.string(),
    decorationStaff: z.string(),
    returnStaff: z.string(),
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
    status: 'DRAFT',
    isMember: 'false',
    cremationProcessType: '',
    altarPlaceType: '',
    altarPlaceOther: '',
    ceilingHeight: '',
    preConsultStaff: '',
    estimateStaff: '',
    ceremonyStaff: '',
    transportStaff: '',
    decorationStaff: '',
    returnStaff: '',
    items: [],
    freeItems: [],
}
