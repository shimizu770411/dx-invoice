import { z } from 'zod'
import { documentItemFieldSchema, documentFreeItemFieldSchema } from '@/lib/documentSchema'

export const estimateItemFieldSchema = documentItemFieldSchema
export const estimateFreeItemFieldSchema = documentFreeItemFieldSchema

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
