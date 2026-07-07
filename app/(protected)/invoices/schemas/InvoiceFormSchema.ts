import { z } from 'zod'
import { documentItemFieldSchema, documentFreeItemFieldSchema } from '@/lib/documentSchema'

export const invoiceItemFieldSchema = documentItemFieldSchema
export const invoiceFreeItemFieldSchema = documentFreeItemFieldSchema

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
    remarks: z.string(),
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
    remarks: '',
    items: [],
    freeItems: [],
}
