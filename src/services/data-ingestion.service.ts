import { api, type ApiResponse } from './api/client';

export const productEntityTypes = ['MASTER_PRODUCTS_V1', 'PRODUCT_ACCESS_CODES_V1', 'FAMILY_DIVISION_CATEGORY_V1', 'FAMILY_TAX_PROFILE_V1', 'TAXATION_UF_V1', 'FAMILY_UF_DEFAULT_RATE_V1', 'FAMILY_PACKAGING_V1', 'FAMILY_SUPPLIERS_V1', 'FISCAL_DOCUMENT_ITEMS_V1'] as const;
export type ProductEntityType = typeof productEntityTypes[number];
export const adherenceEntityTypes = ['ADHERENCE_PLAN_V1', 'CGO_REFERENCE_V1', 'ACCOUNTING_GAPS_V1', 'SPECIES_ACCOUNT_GAPS_V1', 'BANK_ACCOUNT_GAPS_V1', 'CGO_MODELS_V1', 'SPECIES_MODELS_V1', 'BUDGET_MODELS_V1'] as const;
export type AdherenceEntityType = typeof adherenceEntityTypes[number];
export type EntityType = ProductEntityType | AdherenceEntityType;
export type DataIngestionSettings = { id: string; companyId: string; consincoAutoAdjustEnabled: boolean; connectorDatabaseEnabled: boolean; consincoApiEnabled: boolean; spedEnabled: boolean; catalogReconciliationEnabled: boolean; fiscalValidationEnabled: boolean; entityTypes: EntityType[] };
export type ReconciliationSummary = { total: number; matched: number; divergent: number; missingInCentral: number };

export const dataIngestionService = {
  settings: async (companyId: string) => (await api.get<ApiResponse<DataIngestionSettings>>(`/companies/${companyId}/data-ingestion/settings`)).data.data,
  updateSettings: async (companyId: string, data: Omit<DataIngestionSettings, 'id' | 'companyId'>) => (await api.patch<ApiResponse<DataIngestionSettings>>(`/companies/${companyId}/data-ingestion/settings`, data)).data.data,
  extractConsincoApi: async (companyId: string, connectionId: string) => (await api.post<ApiResponse<{ reconciliation: ReconciliationSummary | null }>>(`/companies/${companyId}/data-ingestion/consinco-api/${connectionId}/extract`)).data.data,
  reconcile: async (companyId: string) => (await api.post<ApiResponse<ReconciliationSummary>>(`/companies/${companyId}/data-ingestion/reconcile`)).data.data,
};
