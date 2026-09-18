import { api, type ApiResponse } from "./api/client";

export type FiscalProduct = { productId: string; description: string; barcode: string | null; familyId: string; family: string | null; ncm: string | null; cest: string | null; registration: { pisCst: string | null; cofinsCst: string | null; ipiCst: string | null }; taxation: Record<string, string>; findings: FiscalFinding[]; compliance?: FiscalComplianceCheck[] };
export type ImportedRecord = { id: string; entityType: string; sourceKey: string; sourceChangedAt: string | null; receivedAt: string | null; origin: { query: string; tables: string[] }; payload: Record<string, unknown>; label: string };
export type FiscalComplianceCheck = { code: string; reason: string; observation: string };
export type FiscalFinding = { code: string; severity: "HIGH" | "MEDIUM" | "LOW"; reason: string; observation: string; estimatedOverpayment?: number; estimatedOverpaymentItemCount?: number; lc224ExpectedAdjustment?: number };
export type TaxationOperationGroup = { code: string; direction: "ENTRADA" | "SAIDA" | null; profileLabel: string; internal: ImportedRecord[]; interstate: ImportedRecord[] };
export type FiscalProductDetail = { product: ImportedRecord; findings: FiscalFinding[]; compliance?: FiscalComplianceCheck[]; family: { id: string; description: string | null; classification: ImportedRecord[]; relatedProducts: { productId: string; description: string; ncm: string | null }[] }; taxation: { profiles: ImportedRecord[]; rulesByState: ImportedRecord[]; byOperation: TaxationOperationGroup[]; defaultRates: ImportedRecord[] }; packaging: ImportedRecord[]; suppliers: ImportedRecord[]; accessCodes: ImportedRecord[]; documentItems: ImportedRecord[] };
export const fiscalComplianceService = {
  products: async () => (await api.get<ApiResponse<{ requiresCompanySelection: boolean; client: { name: string; documentRoot: string; state: string | null; branches: number } | null; items: FiscalProduct[] }>>("/fiscal-compliance/products",{timeout:360_000})).data.data,
  // Recalcula a validação na hora, ignorando o resultado em cache (backend: stale-while-revalidate).
  refreshProducts: async () => (await api.post<ApiResponse<{ products: number }>>("/fiscal-compliance/products/refresh", {}, { timeout: 360_000 })).data.data,
  product: async (id: string) => (await api.get<ApiResponse<FiscalProductDetail>>(`/fiscal-compliance/products/${id}`,{timeout:60_000})).data.data,
  addAccessCode: async (productId: string, accessCode: string) => (await api.post<ApiResponse<ImportedRecord>>(`/fiscal-compliance/products/${encodeURIComponent(productId)}/access-codes`, { accessCode })).data.data,
  correct: async (id: string, payload: Record<string, unknown>) => (await api.patch<ApiResponse<ImportedRecord>>(`/fiscal-compliance/imported-records/${id}`, { payload })).data.data,
  bulkCorrect: async (rows: { productId: string; payload: Record<string, unknown> }[]) => (await api.post<ApiResponse<{ updated: number; notFound: string[]; skipped: number }>>("/fiscal-compliance/imported-records/bulk-correct", { rows })).data.data,
};
