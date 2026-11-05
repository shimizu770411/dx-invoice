import apiClient from './api';

export interface CreatePaymentData {
  paidAt: string;
  memo?: string;
  /** 領収書No.（数字7桁・任意。lib/receiptNo.ts）。入金登録のときだけ使う */
  receiptNo?: string;
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

// 供花の入金は供花1件ごと（請求先単位のまとめて入金は廃止）
export async function createFlowerPayment(flowerId: string) {
  const response = await apiClient.post(`/payments/flower/${flowerId}/paid`);
  return response.data;
}

export async function cancelFlowerPayment(flowerId: string) {
  const response = await apiClient.post(`/payments/flower/${flowerId}/cancel`);
  return response.data;
}
