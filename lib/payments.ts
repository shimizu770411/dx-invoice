import apiClient from './api';

export interface CreatePaymentData {
  paidAt: string;
  memo?: string;
  /** 領収書No.（数字7桁・任意。lib/receiptNo.ts）。入金登録のときだけ使う */
  receiptNo?: string;
  /** 領収書の宛名（任意。lib/receiptAddressee.ts）。入金登録のときだけ使う */
  receiptAddressee?: string;
}

export async function createInvoicePayment(
  invoiceId: string,
  data: CreatePaymentData,
) {
  const response = await apiClient.post(`/payments/invoice/${invoiceId}/paid`, data);
  return response.data;
}

export async function cancelInvoicePayment(
  invoiceId: string,
  data: CreatePaymentData,
) {
  const response = await apiClient.post(`/payments/invoice/${invoiceId}/cancel`, data);
  return response.data;
}

/** 領収書の承認（approve=true）・承認取消（false）。承認した人の印影が領収書の取扱者印に出る */
export async function setReceiptApproval(invoiceId: string, approve: boolean) {
  const response = await apiClient.post(`/payments/invoice/${invoiceId}/receipt-approval`, { approve });
  return response.data;
}

// 供花の入金は供花1件ごと（請求先単位のまとめて入金は廃止）
export async function createFlowerPayment(flowerId: string) {
  const response = await apiClient.post(`/payments/flower/${flowerId}/paid`);
  return response.data;
}

export async function cancelFlowerPayment(flowerId: string) {
  const response = await apiClient.post(`/payments/flower/${flowerId}/cancel`);
  return response.data;
}
