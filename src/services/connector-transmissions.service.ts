import { api, type ApiResponse } from "./api/client";

export type ConnectorTransmission = {
  id: string; sourceName: string | null; sourceSize: number | null; inputType?: string | null; queryCode?: string | null; status: string; totalRows: number; processedRows: number; duplicateRows: number; error: string | null; createdAt: string;
  records: Array<{ id: string; rowNumber: number; canonicalDescription: string; gtin: string | null; ncm: string | null; cest: string | null; unit: string | null; category: string | null; confidence: number; duplicateOfRecordId: string | null; rawData: Record<string, unknown> }>;
};
export type TransmissionPage = { items: ConnectorTransmission[]; total: number; page: number; pageSize: number; totalPages: number };
export type TransmissionSummary = { products: number; totalItems?: number; withoutPending: number; missingNcm: number; missingCest: number; missingCstIcms: number; missingCfop: number };
export type ValidatedProduct = { code: string; description: string; ncm: string | null; cest: string | null; cstIcms: string | null; cfop: string | null; files: string[] };
export type SuggestionSource = "CONFAZ_TABLE" | "CATALOG_REUSE" | "SIMILARITY_MATCH" | "AI_ASSISTED";
export type FieldSuggestion = { field: string; suggestedValue: string; source: SuggestionSource; confidence: number; rationale: string; legalSource?: { authority: string; title: string; url: string }; candidateRef?: { type: "GlobalCatalogProduct" | "GlobalCatalogTaxation"; id: string } };
export type AmbiguousField = { field: string; candidates: Array<{ id: string; type: "GlobalCatalogProduct" | "GlobalCatalogTaxation"; label: string; score?: number }> };
export type NeedsReviewField = { field: string; note: string; legalBasis: string };
export type SpedFiscalProposal = { id: string; productCode: string; canonicalDescription: string; familyKey: string | null; familyName: string | null; ncm: string | null; cest: string | null; taxation: Record<string, string>; evidence: { effectiveIcmsRate?: number | null; effectiveIpiRate?: number | null; suggestions?: FieldSuggestion[]; pendingAiReview?: AmbiguousField[]; needsLegalReview?: NeedsReviewField[] }; validation: { standard?: { matchedRules?: unknown[] }; byOrigin?: unknown[]; error?: string }; confidence: number };
export type ResetConnectorLoadResult = { deletedRecords:number; deletedExecutions:number; deletedProposals:number; connectorCommand:{id:string;status:"DELIVERED"|"PENDING";connectorId:string|null} };
export type DeleteExecutionsResult = { tenantId: string; from: string; to: string; deletedExecutions: number; deletedProposals: number };
export type AiSuggestionsJob = { jobId: string; status: string; totalItems?: number; processed?: number; total?: number; aiCalled?: number; aiSkipped?: number; progressVisible?: boolean; error?: string | null; startedAt?: string | null; finishedAt?: string | null };

export const connectorTransmissionsService = {
  list: async (params: { page: number; file?: string; origin?: "API" | "SPED"; queryCode?: string; from?: string; to?: string }) => (await api.get<ApiResponse<TransmissionPage>>("/intelligent-sanitization/executions", { params: { page: params.page, pageSize: 50, ...(params.file ? { file: params.file } : {}), ...(params.origin ? { inputType: params.origin } : {}), ...(params.queryCode ? { queryCode: params.queryCode } : {}), ...(params.from ? { from: params.from } : {}), ...(params.to ? { to: params.to } : {}) } })).data.data,
  summary: async (params?: { origin?: "API" | "SPED"; queryCode?: string }) => (await api.get<ApiResponse<TransmissionSummary>>("/intelligent-sanitization/summary", { params: { ...(params?.origin ? { inputType: params.origin } : {}), ...(params?.queryCode ? { queryCode: params.queryCode } : {}) } })).data.data,
  products: async (issue: string, params?: { origin?: "API" | "SPED"; queryCode?: string }) => (await api.get<ApiResponse<ValidatedProduct[]>>("/intelligent-sanitization/products", { params: { ...(issue ? { issue } : {}), ...(params?.origin ? { inputType: params.origin } : {}), ...(params?.queryCode ? { queryCode: params.queryCode } : {}) } })).data.data,
  record: async (id: string) => (await api.get<ApiResponse<ConnectorTransmissionRecord>>(`/intelligent-sanitization/records/${encodeURIComponent(id)}`)).data.data,
  spedProposals: async () => (await api.get<ApiResponse<{ items: SpedFiscalProposal[]; total: number }>>("/intelligent-sanitization/sped-proposals")).data.data,
  resetLoad: async () => (await api.post<ApiResponse<ResetConnectorLoadResult>>("/connector-data/reset", { clearImportedData:true, clearConnectorQueue:true, command:"CLEAR_IMPORTED_LOAD" })).data.data,
  deleteByDateRange: async (from: string, to: string, password: string, reason?: string) => (await api.delete<ApiResponse<DeleteExecutionsResult>>("/intelligent-sanitization/executions", { data: { from, to, password, ...(reason ? { reason } : {}) } })).data.data,
  startAiSuggestions: async (proposalIds?: string[]) => (await api.post<ApiResponse<AiSuggestionsJob>>("/intelligent-sanitization/sped-proposals/ai-suggestions", { ...(proposalIds?.length ? { proposalIds } : {}) })).data.data,
  aiSuggestionsStatus: async (jobId: string) => (await api.get<ApiResponse<AiSuggestionsJob>>(`/intelligent-sanitization/sped-proposals/ai-suggestions/${encodeURIComponent(jobId)}`)).data.data,
};

export type ConnectorTransmissionRecord = { id: string; rowNumber: number; canonicalDescription: string; consincoDescription: string | null; pdvDescription: string | null; brand: string | null; manufacturer: string | null; category: string | null; gtin: string | null; ncm: string | null; cest: string | null; unit: string | null; confidence: number; duplicateOfRecordId: string | null; rawData: Record<string, unknown>; appliedAbbreviations: Record<string, unknown> | null; execution: { id: string; sourceName: string | null; inputType: string; status: string; createdAt: string } };
