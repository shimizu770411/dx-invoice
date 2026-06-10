import apiClient from './api';

export interface InvoiceFreeItem {
    id?: string
    invoiceItemId?: string
    productItemName: string
    description?: string
    unitPriceGeneral: number
    qty: number
    amount: number
    sortNo: number
}

export interface InvoiceItem {
  id?: string;
  productItemId?: string;
  productVariantId?: string;
  description?: string;
  unitPriceGeneral: number;
  unitPriceMember: number;
  qty: number;
  amount: number;
  isService?: boolean;
  sortNo: number;
  productItem?: any;
  productVariant?: any;
}

export interface Invoice {
    id: string
    customerId: string
    docNo?: string
    status: string
    subtotal: number
    tax: number
    total: number
    membershipPaidAmount: number
    grandTotal: number
    items: InvoiceItem[]
    freeItems?: InvoiceFreeItem[]
    customer?: any
}

export async function getInvoices(customerId?: string): Promise<Invoice[]> {
  const url = customerId ? `/invoices?customerId=${customerId}` : '/invoices';
  const response = await apiClient.get<Invoice[]>(url);
  return response.data;
}

export async function getInvoice(id: string): Promise<Invoice> {
  const response = await apiClient.get<Invoice>(`/invoices/${id}`);
  return response.data;
}

export async function createInvoice(customerId: string, data: any): Promise<Invoice> {
  const response = await apiClient.post(`/invoices/customers/${customerId}`, data);
  return response.data;
}

export async function createInvoiceFromEstimate(
  customerId: string,
  estimateId: string,
): Promise<Invoice> {
  const response = await apiClient.post(
    `/invoices/customers/${customerId}/from-estimate/${estimateId}`,
  );
  return response.data;
}

export async function updateInvoice(id: string, data: any): Promise<Invoice> {
  const response = await apiClient.put(`/invoices/${id}`, data);
  return response.data;
}
