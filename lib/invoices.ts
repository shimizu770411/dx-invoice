import apiClient from './api';
import type { UserRole } from './users';

export interface InvoiceConfirmedBy {
    id: string
    name: string
}

export interface InvoiceFreeItem {
    id?: string
    invoiceItemId?: string
    parentProductItemId?: string | null
    productItemName: string
    description?: string
    unitPriceGeneral: number
    unitPriceMember: number
    qty: number
    amount: number
    sortNo: number
}

export interface InvoiceItem {
  id?: string;
  productItemId?: string;
  productVariantId?: string;
  productRowId?: string | null;
  productRowVariantId?: string | null;
  calcType?: 'FIXED' | 'UNIT_PRICE_X_QTY' | null;
  sign?: number;
  description?: string;
  unitPriceGeneral: number;
  unitPriceMember: number;
  qty: number;
  amount: number;
  isService?: boolean;
  isMaturityService?: boolean;
  adhocSetScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH';
  /** 保存時点で 0 円扱いだったかの控えと、その理由。null / 未設定 は未記録 */
  noChargeScope?: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH' | null;
  noChargeReason?: 'SET' | 'SERVICE' | 'MATURITY_SERVICE' | null;
  multiSelectVariantIds?: string | null;
  /** 親祭壇の増額。一般単価・会員単価には既に上乗せ済み */
  surchargeAmount?: number | null;
  planSurchargeId?: string | null;
  /** 保存後の行がどのバリアントグループ（重箱の基本セット／追加オプション等）由来かを示す */
  productVariantGroupId?: string | null;
  /** 保存時点の商品名。商品マスタで改名されても発行済み書類の文言を保つための控え */
  productItemName?: string | null;
  /** 保存時点の種類名。複数行構成商品では行内の選択肢のラベル */
  productVariantName?: string | null;
  /** グループ商品の選択状態（保存前の一時データ）。JSON文字列: { [groupId]: variantId[] } */
  groupSelections?: string | null;
  sortNo: number;
  productItem?: any;
  productVariant?: any;
  productRow?: any;
  productRowVariant?: any;
}

export interface Invoice {
    id: string
    customerId: string
    planId: string
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
    isPaid?: boolean
    staffConfirmedAt?: string | null
    staffConfirmedBy?: InvoiceConfirmedBy | null
    clerkConfirmedAt?: string | null
    clerkConfirmedBy?: InvoiceConfirmedBy | null
    approverConfirmedAt?: string | null
    approverConfirmedBy?: InvoiceConfirmedBy | null
}

export async function getInvoices(customerId?: string): Promise<Invoice[]> {
  const url = customerId ? `/invoices?customerId=${customerId}` : '/invoices';
  const response = await apiClient.get<Invoice[]>(url);
  return response.data;
}

export async function getInvoice(id: string): Promise<Invoice> {
  const response = await apiClient.get<Invoice>(`/invoices/${id}`)
  if (!response.data) throw new Error('請求書データが見つかりません')
  return response.data
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

export type InvoiceConfirmationFields = Pick<
    Invoice,
    'staffConfirmedAt' | 'staffConfirmedBy' | 'clerkConfirmedAt' | 'clerkConfirmedBy' | 'approverConfirmedAt' | 'approverConfirmedBy'
>

export async function confirmInvoice(id: string, role: UserRole): Promise<InvoiceConfirmationFields> {
  const response = await apiClient.post(`/invoices/${id}/confirm`, { role });
  return response.data;
}
