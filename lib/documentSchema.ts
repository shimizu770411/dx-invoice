import { z } from 'zod'

export const documentItemFieldSchema = z.object({
    qty: z.coerce.number().min(0).max(3000, '数量オーバー'),
    description: z.string(),
})

// 満期サービスは控除扱いのため 0 以下（負値=控除、0=未利用）。それ以外のフリー項目は 0 以上。
export const documentFreeItemFieldSchema = z
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
