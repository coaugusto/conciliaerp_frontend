import { api, type ApiResponse } from "./api/client";

export type FiscalProduct = { productId: string; description: string; barcode: string | null; familyId: string; family: string | null; ncm: string | null; cest: string | null; registration: { pisCst: string | null; cofinsCst: string | null; ipiCst: string | null }; taxation: Record<string, string>; findings: FiscalFinding[]; compliance?: FiscalComplianceCheck[] };
export type RecordAction = { label: string; method: string; url: string; requiresConfirmation?: boolean };
export type ImportedRecord = { duplicate?: boolean; action?: RecordAction; id: string; entityType: string; sourceKey: string; sourceChangedAt: string | null; receivedAt: string | null; origin: { query: string; tables: string[] }; payload: Record<string, unknown>; label: string };
export type FiscalComplianceCheck = { code: string; reason: string; observation: string };
export type FiscalFinding = { code: string; severity: "HIGH" | "MEDIUM" | "LOW"; reason: string; observation: string; estimatedOverpayment?: number; estimatedOverpaymentItemCount?: number; lc224ExpectedAdjustment?: number };
export type TaxationOperationGroup = { code: string; direction: "ENTRADA" | "SAIDA" | null; profileLabel: string; internal: ImportedRecord[]; interstate: ImportedRecord[] };
export type FiscalProductDetail = { product: ImportedRecord; findings: FiscalFinding[]; compliance?: FiscalComplianceCheck[]; family: { id: string; description: string | null; classification: ImportedRecord[]; relatedProducts: { productId: string; description: string; ncm: string | null }[] }; taxation: { profiles: ImportedRecord[]; rulesByState: ImportedRecord[]; byOperation: TaxationOperationGroup[]; defaultRates: ImportedRecord[] }; packaging: ImportedRecord[]; suppliers: ImportedRecord[]; accessCodes: ImportedRecord[]; documentItems: ImportedRecord[] };
// Pendências item-a-item cujo finding só cita "N de M item(ns)..." — abrem o detalhe completo
// (cabeçalho + itens da nota) via fiscalComplianceService.documentItems. Espelha
// DOCUMENT_ITEM_DETAIL_RULES do backend (document-item-stats.ts); CGO_CFOP_MISMATCH e
// ICMS_CST_CADASTRO_DIVERGENCE ainda não têm essa lista completa (dependem de dado de cadastro).
// PIS_COFINS_CST_ALIQUOTA_ZERO_NCM é entity "TAXATION", não "DOCUMENT" — mesmo assim entra aqui,
// porque quem decide se tem detalhe disponível é este código, não a categoria da finding.
export const DOCUMENT_ITEM_DETAIL_RULES = ["DOCUMENT_CONTEXT", "CFOP_DIRECTION", "PIS_COFINS_CST_DIRECTION", "TAX_CALCULATION", "RTC_2026_RATES", "PIS_COFINS_CST_ALIQUOTA_ZERO_NCM"] as const;
export type DocumentItemDetail = {
  item_number: string; cfop: string; ncm: string;
  icms_cst: string; icms_base: number | null; icms_rate: number | null; icms_value: number | null;
  icms_st_base: number | null; icms_st_rate: number | null; icms_st_value: number | null;
  pis_cst: string; pis_base: number | null; pis_rate: number | null; pis_value: number | null;
  cofins_cst: string; cofins_base: number | null; cofins_rate: number | null; cofins_value: number | null;
  ipi_base: number | null; ipi_rate: number | null; ipi_value: number | null;
  cbs_base: number | null; cbs_rate: number | null; cbs_value: number | null;
  ibs_base: number | null; ibs_rate: number | null; ibs_value: number | null;
  pis_cofins_zero_rate_expected_cst: string | null;
  fcp_base: number | null; fcp_value: number | null;
};
export type DocumentItemsGroup = { documentKey: string; documentNumber: string | null; documentSeries: string | null; documentTotal: number | null; issueDate: string; postingDate: string; operationType: string; cgo: string; items: DocumentItemDetail[] };
export type DocumentItemsResponse = { totalCount: number; documents: DocumentItemsGroup[]; page: number; pageSize: number };
export const fiscalComplianceService = {
  products: async () => (await api.get<ApiResponse<{ requiresCompanySelection: boolean; client: { name: string; documentRoot: string; state: string | null; branches: number } | null; items: FiscalProduct[] }>>("/fiscal-compliance/products",{timeout:360_000})).data.data,
  // Recalcula a validação na hora, ignorando o resultado em cache (backend: stale-while-revalidate).
  refreshProducts: async () => (await api.post<ApiResponse<{ products: number }>>("/fiscal-compliance/products/refresh", {}, { timeout: 360_000 })).data.data,
  product: async (id: string) => (await api.get<ApiResponse<FiscalProductDetail>>(`/fiscal-compliance/products/${id}`,{timeout:60_000})).data.data,
  // A exclusão apaga o código importado e, com a autorização ligada, enfileira o DELETE do código
  // no ERP (só o código de acesso — o produto permanece).
  deleteAccessCode: async (productId: string, recordId: string) => (await api.delete<ApiResponse<{ id: string; accessCode: string; remaining: number; erpSync: 'QUEUED' | 'NOT_AUTHORIZED' }>>(`/fiscal-compliance/products/${encodeURIComponent(productId)}/access-codes/${encodeURIComponent(recordId)}`)).data.data,
  addAccessCode: async (productId: string, accessCode: string) => (await api.post<ApiResponse<ImportedRecord>>(`/fiscal-compliance/products/${encodeURIComponent(productId)}/access-codes`, { accessCode })).data.data,
  correct: async (id: string, payload: Record<string, unknown>) => (await api.patch<ApiResponse<ImportedRecord>>(`/fiscal-compliance/imported-records/${id}`, { payload })).data.data,
  bulkCorrect: async (rows: { productId: string; payload: Record<string, unknown> }[]) => (await api.post<ApiResponse<{ updated: number; notFound: string[]; skipped: number }>>("/fiscal-compliance/imported-records/bulk-correct", { rows })).data.data,
  documentItems: async (productId: string, rule: string, page: number, pageSize = 20) => (await api.get<ApiResponse<DocumentItemsResponse>>(`/fiscal-compliance/products/${encodeURIComponent(productId)}/document-items`, { params: { rule, page, pageSize } })).data.data,
};
