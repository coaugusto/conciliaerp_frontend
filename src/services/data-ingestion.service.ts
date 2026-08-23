import { api, type ApiResponse } from './api/client';

export const productEntityTypes = ['MASTER_PRODUCTS_V1', 'FAMILY_DIVISION_CATEGORY_V1', 'FAMILY_TAX_PROFILE_V1', 'TAXATION_UF_V1', 'FAMILY_UF_DEFAULT_RATE_V1', 'FAMILY_PACKAGING_V1', 'FAMILY_SUPPLIERS_V1'] as const;
export type ProductEntityType = typeof productEntityTypes[number];
export type DataIngestionSettings = { id: string; companyId: string; connectorDatabaseEnabled: boolean; consincoApiEnabled: boolean; spedEnabled: boolean; catalogReconciliationEnabled: boolean; fiscalValidationEnabled: boolean; entityTypes: ProductEntityType[] };
export type ReconciliationSummary = { total: number; matched: number; divergent: number; missingInCentral: number };

export const dataIngestionService = {
  settings: async (companyId: string) => (await api.get<ApiResponse<DataIngestionSettings>>(`/companies/${companyId}/data-ingestion/settings`)).data.data,
  updateSettings: async (companyId: string, data: Omit<DataIngestionSettings, 'id' | 'companyId'>) => (await api.patch<ApiResponse<DataIngestionSettings>>(`/companies/${companyId}/data-ingestion/settings`, data)).data.data,
  extractConsincoApi: async (companyId: string, connectionId: string) => (await api.post<ApiResponse<{ reconciliation: ReconciliationSummary | null }>>(`/companies/${companyId}/data-ingestion/consinco-api/${connectionId}/extract`)).data.data,
  reconcile: async (companyId: string) => (await api.post<ApiResponse<ReconciliationSummary>>(`/companies/${companyId}/data-ingestion/reconcile`)).data.data,
};
