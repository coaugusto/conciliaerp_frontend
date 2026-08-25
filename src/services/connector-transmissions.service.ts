import { api, type ApiResponse } from "./api/client";

export type ConnectorTransmission = {
  id: string; sourceName: string | null; sourceSize: number | null; status: string; totalRows: number; processedRows: number; duplicateRows: number; error: string | null; createdAt: string;
  records: Array<{ id: string; rowNumber: number; canonicalDescription: string; gtin: string | null; ncm: string | null; cest: string | null; unit: string | null; category: string | null; confidence: number; duplicateOfRecordId: string | null; rawData: Record<string, unknown> }>;
};
export type TransmissionPage = { items: ConnectorTransmission[]; total: number; page: number; pageSize: number; totalPages: number };
export type TransmissionSummary = { products: number; totalItems?: number; withoutPending: number; missingNcm: number; missingCest: number; missingCstIcms: number; missingCfop: number };
export type ValidatedProduct = { code: string; description: string; ncm: string | null; cest: string | null; cstIcms: string | null; cfop: string | null; files: string[] };
export type SpedFiscalProposal = { id: string; productCode: string; canonicalDescription: string; familyKey: string | null; familyName: string | null; ncm: string | null; cest: string | null; taxation: Record<string, string>; evidence: { effectiveIcmsRate?: number | null; effectiveIpiRate?: number | null }; validation: { matchedRules?: unknown[]; error?: string }; confidence: number };
export type ResetConnectorLoadResult = { deletedRecords:number; deletedExecutions:number; deletedProposals:number; connectorCommand:{id:string;status:"DELIVERED"|"PENDING";connectorId:string|null} };

export const connectorTransmissionsService = {
  list: async (params: { page: number; file?: string }) => (await api.get<ApiResponse<TransmissionPage>>("/intelligent-sanitization/executions", { params: { page: params.page, pageSize: 50, ...(params.file ? { file: params.file } : {}) } })).data.data,
  summary: async () => (await api.get<ApiResponse<TransmissionSummary>>("/intelligent-sanitization/summary")).data.data,
  products: async (issue: string) => (await api.get<ApiResponse<ValidatedProduct[]>>("/intelligent-sanitization/products", { params: issue ? { issue } : {} })).data.data,
  record: async (id: string) => (await api.get<ApiResponse<ConnectorTransmissionRecord>>(`/intelligent-sanitization/records/${encodeURIComponent(id)}`)).data.data,
  spedProposals: async () => (await api.get<ApiResponse<{ items: SpedFiscalProposal[]; total: number }>>("/intelligent-sanitization/sped-proposals")).data.data,
  resetLoad: async () => (await api.post<ApiResponse<ResetConnectorLoadResult>>("/connector-data/reset", { clearImportedData:true, clearConnectorQueue:true, command:"CLEAR_IMPORTED_LOAD" })).data.data,
};

export type ConnectorTransmissionRecord = { id: string; rowNumber: number; canonicalDescription: string; consincoDescription: string | null; pdvDescription: string | null; brand: string | null; manufacturer: string | null; category: string | null; gtin: string | null; ncm: string | null; cest: string | null; unit: string | null; confidence: number; duplicateOfRecordId: string | null; rawData: Record<string, unknown>; appliedAbbreviations: Record<string, unknown> | null; execution: { id: string; sourceName: string | null; inputType: string; status: string; createdAt: string } };
