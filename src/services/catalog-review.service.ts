import { api, type ApiResponse } from "./api/client";

const CATALOG_ENRICHMENT_TIMEOUT_MS = 600_000;

export type CatalogReviewField = "canonicalDescription" | "originalDescription" | "gtin" | "ean" | "brand" | "manufacturer" | "category" | "subcategory" | "ncm" | "cest" | "packaging" | "content" | "contentUnit" | "grossWeight" | "volume" | "shortDescription" | "consincoDescription" | "pdvDescription" | "imageUrl" | "confidence";
export type CatalogReviewChanges = Partial<Record<CatalogReviewField, string | number>>;
export type CatalogFieldSource = { value: string | number; origin: "WEB" | "AI" | "SPED" | "CENTRAL_CATALOG" | "MANUAL" | "DERIVED"; sources?: string[]; eanConfirmed?: string; confidence?: number; researchedAt?: string };
export type TaxationStatus = "MISSING" | "REUSED" | "NEW" | "NEEDS_CONFIRMATION";
export type TaxationProfile = { id: string; name: string | null; companyState: string; counterpartyState: string; taxationType: string | null; taxRegimeId: string | null; cstIcms: string | null; cstPis: string | null; cstCofins: string | null; cstIpi: string | null; cfop: string | null; icmsRate: string | number | null; icmsStRate: string | number | null; icmsStMvaPct: string | number | null; fcpRate: string | number | null; difalRate: string | number | null; linkSource: "FROM_CADASTRO" | "REUSED_EXISTING" | "MANUAL"; sourceTaxationRef?: string | null };
export type TaxationSummary = { status: TaxationStatus; profiles: TaxationProfile[]; reuseApprovalId?: string };
export type CatalogReviewItem = {
  id: string; approvalId: string; approvalCreatedAt: string; fiscalDivergence: string | null; canonicalDescription: string; originalDescription: string | null; gtin: string | null; ean: string | null; brand: string | null; manufacturer: string | null; category: string | null; subcategory: string | null; ncm: string | null; cest: string | null; packaging: string | null; content: string | number | null; contentUnit: string | null; grossWeight: string | number | null; volume: string | number | null; shortDescription: string | null; consincoDescription: string | null; pdvDescription: string | null; imageUrl: string | null; confidence: string | number; version: number; attributes?: { fieldSources?: Partial<Record<CatalogReviewField, CatalogFieldSource>>; webResearchEvidence?: unknown[]; ingestionOrigin?: string } | null; taxation: TaxationSummary;
};
export type CatalogReviewPage = { items: CatalogReviewItem[]; total: number; page: number; pageSize: number; totalPages: number };
export type CatalogWebResearchResult = { processed: number; results: { productId: string; status: "ENRICHED" | "EVIDENCE_ONLY" | "NO_MATCH" | "SKIPPED" | "FAILED"; updatedFields?: string[]; evidenceFields?: string[]; reason?: string }[] };
export type CatalogAiEnrichmentResult = { processed: number; results: { productId: string; status: "AI_ENRICHED" | "AI_NO_MATCH" | "SKIPPED" | "FAILED"; updatedFields?: string[]; reason?: string }[] };

export const catalogReviewService = {
  list: async (page: number) => (await api.get<ApiResponse<CatalogReviewPage>>("/master-catalog/review/pending", { params: { page, pageSize: 50 } })).data.data,
  get: async (id: string) => (await api.get<ApiResponse<CatalogReviewItem>>(`/master-catalog/${encodeURIComponent(id)}`)).data.data,
  update: async (id: string, changes: CatalogReviewChanges) => (await api.patch(`/master-catalog/review/${encodeURIComponent(id)}`, changes)).data.data,
  updateMany: async (productIds: string[], changes: CatalogReviewChanges) => (await api.post("/master-catalog/review/bulk-update", { productIds, ...changes })).data.data,
  publish: async (productIds: string[]) => (await api.post("/master-catalog/review/publish", { productIds })).data.data,
  resolveTaxationDecision: async (productId: string, approvalId: string, decision: "REUSE_EXISTING" | "KEEP_NEW") => (await api.post(`/master-catalog/review/${encodeURIComponent(productId)}/taxation-decision`, { approvalId, decision })).data.data,
  researchPending: async (limit?: number) => (await api.post<ApiResponse<CatalogWebResearchResult>>("/master-catalog/review/research-pending", limit ? { limit } : {}, { timeout: CATALOG_ENRICHMENT_TIMEOUT_MS })).data.data,
  aiEnrich: async (productIds: string[]) => (await api.post<ApiResponse<CatalogAiEnrichmentResult>>("/master-catalog/review/ai-enrichment", { productIds }, { timeout: CATALOG_ENRICHMENT_TIMEOUT_MS })).data.data,
};
