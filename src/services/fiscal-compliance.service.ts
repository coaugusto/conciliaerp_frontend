import { api, type ApiResponse } from "./api/client";

export type FiscalProduct = { productId: string; description: string; barcode: string | null; familyId: string; family: string | null; ncm: string | null; cest: string | null; registration: { pisCst: string | null; cofinsCst: string | null; ipiCst: string | null }; taxation: Record<string, string>; findings: { code: string; severity: string; reason: string }[] };
export type ImportedRecord = { id: string; entityType: string; sourceKey: string; sourceChangedAt: string | null; receivedAt: string | null; origin: { query: string; tables: string[] }; payload: Record<string, unknown>; label: string };
export type FiscalProductDetail = { product: ImportedRecord; family: { id: string; description: string | null; classification: ImportedRecord[]; relatedProducts: { productId: string; description: string; ncm: string | null }[] }; taxation: { profiles: ImportedRecord[]; rulesByState: ImportedRecord[]; defaultRates: ImportedRecord[] }; packaging: ImportedRecord[]; suppliers: ImportedRecord[] };
export const fiscalComplianceService = {
  products: async () => (await api.get<ApiResponse<{ requiresCompanySelection: boolean; client: { name: string; documentRoot: string; state: string | null; branches: number } | null; items: FiscalProduct[] }>>("/fiscal-compliance/products")).data.data,
  product: async (id: string) => (await api.get<ApiResponse<FiscalProductDetail>>(`/fiscal-compliance/products/${id}`)).data.data,
  correct: async (id: string, payload: Record<string, unknown>) => (await api.patch<ApiResponse<ImportedRecord>>(`/fiscal-compliance/imported-records/${id}`, { payload })).data.data,
};
