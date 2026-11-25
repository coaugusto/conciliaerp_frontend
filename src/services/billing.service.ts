import { api, type ApiResponse } from "./api/client";

export type BillingInvoiceStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELED" | "FAILED";
export type BillingContract = {
  active: boolean;
  monthlyAmountCents: number;
  dueDay: number;
  issueDaysBefore: number;
  description?: string;
  payerName: string;
  payerDocument: string;
  payerEmails: string[];
  zipCode: string;
  streetName: string;
  streetNumber: string;
  neighborhood: string;
  city: string;
  federalUnit: string;
};
export type BillingInvoice = { id: string; reference: string; amountCents: number; dueDate: string; status: BillingInvoiceStatus; providerStatus: string | null; boletoUrl: string | null; barcode: string | null; paidAt: string | null; lastError: string | null; emailSentAt: string | null };
export type BillingSummary = { contract: BillingContract | null; nextDue: { reference: string; dueDate: string } | null; invoices: BillingInvoice[] };

export const billingService = {
  summary: async () => (await api.get<ApiResponse<BillingSummary>>("/commercial/billing")).data.data,
  saveContract: async (contract: BillingContract) => (await api.put<ApiResponse<BillingContract>>("/commercial/billing/contract", contract)).data.data,
  issue: async (reference?: string) => (await api.post<ApiResponse<BillingInvoice>>("/commercial/billing/invoices", reference ? { reference } : {})).data.data,
  refresh: async (id: string) => (await api.post<ApiResponse<BillingInvoice>>(`/commercial/billing/invoices/${id}/refresh`)).data.data,
  resendEmail: async (id: string) => (await api.post<ApiResponse<BillingInvoice>>(`/commercial/billing/invoices/${id}/email`)).data.data,
};
