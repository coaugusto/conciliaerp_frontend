import { api, type ApiResponse } from "./api/client";
export type MasterCatalogFieldSource = { value: string | number; origin: "WEB" | "SPED" | "CENTRAL_CATALOG" | "MANUAL" | "DERIVED"; sources?: string[]; eanConfirmed?: string; confidence?: number; researchedAt?: string };
export type MasterCatalogTaxationStatus = "MISSING" | "REUSED" | "NEW" | "NEEDS_CONFIRMATION";
export type MasterCatalogTaxationProfile = { id: string; name: string | null; companyState: string; counterpartyState: string; taxationType: string | null; taxRegimeId: string | null; cstIcms: string | null; cstPis: string | null; cstCofins: string | null; cstIpi: string | null; cfop: string | null; icmsRate: string | number | null; icmsStRate: string | number | null; icmsStMvaPct: string | number | null; fcpRate: string | number | null; difalRate: string | number | null; linkSource: "FROM_CADASTRO" | "REUSED_EXISTING" | "MANUAL" | "AI_SUGGESTED"; sourceTaxationRef?: string | null };
export type TaxationEditableChanges = Partial<Pick<MasterCatalogTaxationProfile, "name" | "companyState" | "counterpartyState" | "taxationType" | "taxRegimeId" | "cstIcms" | "cstPis" | "cstCofins" | "cstIpi" | "cfop">> & { icmsRate?: number | null; icmsStRate?: number | null; icmsStMvaPct?: number | null; fcpRate?: number | null; difalRate?: number | null };
// Quando o cadastro do cliente não traz um nome pra tributação, monta um resumo a partir do CST
// e das alíquotas em vez de deixar "(sem nome)" — ex.: CST 000 (tributação normal) com ICMS 12%
// e MVA (substituição tributária) 37,93% vira "TRIB 12% MVA 37.93%". Puramente de exibição —
// nunca é gravado, e usa só valores já reais do próprio registro (nada inventado).
export function taxationDisplayName(profile: Pick<MasterCatalogTaxationProfile, "name" | "cstIcms" | "icmsRate" | "icmsStMvaPct">): string {
  if (profile.name) return profile.name;
  const rate = profile.icmsRate != null && profile.icmsRate !== "" ? Number(profile.icmsRate) : null;
  const mva = profile.icmsStMvaPct != null && profile.icmsStMvaPct !== "" ? Number(profile.icmsStMvaPct) : null;
  const pct = (value: number) => `${Number(value.toFixed(2))}%`;
  if (profile.cstIcms === "000" && rate != null) return mva ? `TRIB ${pct(rate)} MVA ${pct(mva)}` : `TRIB ${pct(rate)}`;
  if (profile.cstIcms && rate != null) return `CST ${profile.cstIcms} · ICMS ${pct(rate)}${mva ? ` · MVA ${pct(mva)}` : ""}`;
  if (profile.cstIcms) return `CST ${profile.cstIcms}`;
  return "Tributação sem nome";
}
// companyState/counterpartyState são sempre "UF da empresa (cliente)" e "UF da contraparte" —
// NUNCA "origem"/"destino" fixos. Numa entrada (compra), a mercadoria vem DA contraparte (o
// fornecedor, a origem) PARA a empresa (o destino); numa saída (venda), é o oposto: a empresa é
// a origem, a contraparte é o destino. taxationType codifica a direção no 1º caractere (E/S,
// ver TAXATION_TYPE_LABELS) — por isso a rotulagem "origem → destino" precisa inverter para
// entradas, senão mostra a UF errada como origem/destino da operação.
export function taxationRoute(profile: Pick<MasterCatalogTaxationProfile, "companyState" | "counterpartyState" | "taxationType">): { origin: string; destination: string } {
  const isEntrada = profile.taxationType?.toUpperCase().startsWith("E") ?? false;
  return isEntrada ? { origin: profile.counterpartyState, destination: profile.companyState } : { origin: profile.companyState, destination: profile.counterpartyState };
}
export type MasterCatalogTaxationSummary = { status: MasterCatalogTaxationStatus; profiles: MasterCatalogTaxationProfile[]; otherTenantHasTaxation?: boolean };
export type MasterCatalogProduct = { id: string; canonicalDescription: string; confidence: number; brand?: string | null; manufacturer?: string | null; gtin?: string | null; ncm?: string | null; category?: string | null; version: string | number; taxation: MasterCatalogTaxationSummary };
export type MasterCatalogCategoryPathNode = { id: string; parentId: string | null; name: string; level: number };
export type MasterCatalogGtinSuggestion = { approvalId: string; candidateGtin: string; matchedSignals: string[] };
export type MasterCatalogProductDetail = MasterCatalogProduct & { ean?: string | null; subcategory?: string | null; originalDescription?: string | null; shortDescription?: string | null; consincoDescription?: string | null; pdvDescription?: string | null; cest?: string | null; packaging?: string | null; content?: string | number | null; contentUnit?: string | null; grossWeight?: string | number | null; volume?: string | number | null; imageUrl?: string | null; attributes?: { fieldSources?: Record<string, MasterCatalogFieldSource> } | null; categoryNodeId?: string | null; categoryPath?: MasterCatalogCategoryPathNode[]; gtinSuggestion?: MasterCatalogGtinSuggestion | null };
export type CreateMasterCatalogProduct = { canonicalDescription: string; gtin: string; brand: string; manufacturer: string; ncm: string };
export type MasterCatalogProductChanges = Partial<Pick<MasterCatalogProductDetail, "gtin" | "ean" | "brand" | "manufacturer" | "category" | "subcategory" | "originalDescription" | "canonicalDescription" | "shortDescription" | "consincoDescription" | "pdvDescription" | "ncm" | "cest" | "packaging" | "contentUnit" | "imageUrl">> & { content?: number | null; grossWeight?: number | null; volume?: number | null; confidence?: number | null };
export type TaxationSearchResult = { id: string; name: string | null; companyState: string; counterpartyState: string; taxationType: string | null; taxRegimeId: string | null; taxRegimeDescription: string | null; cstIcms: string | null; cstPis: string | null; cstCofins: string | null; cstIpi: string | null; cfop: string | null; icmsRate: string | number | null; icmsStRate: string | number | null; icmsStMvaPct: string | number | null; fcpRate: string | number | null; difalRate: string | number | null };
// As duas variantes sempre apontam para uma tributação REAL já existente no catálogo
// (taxationId/taxation) — nenhuma delas carrega valor inventado. CATALOG_SIMILARITY é puro dado
// (mesmo NCM/prefixo/categoria); AI_ASSISTED_MATCH só existe quando nada acima achou nada, e a
// IA escolheu entre um conjunto mais amplo de tributações reais (nunca gera CST/alíquota novo).
export type TaxationSuggestionCandidate =
  | { method: "CATALOG_SIMILARITY"; taxationId: string; taxation: Record<string, unknown>; confidence: number; basedOn: { field: "ncm" | "ncmPrefix" | "category"; matchedProductCount: number; totalMatched: number } }
  | { method: "AI_ASSISTED_MATCH"; taxationId: string; taxation: Record<string, unknown>; confidence: number; reasoning: string; basedOn: { poolSize: number } };
export type TaxationSuggestionBulkRow = { productId: string; description: string; ncm: string | null; gtin: string | null; candidate: TaxationSuggestionCandidate };
export type TaxationSuggestionBulkApplyRow = { productId: string; candidate: TaxationSuggestionCandidate; decision: "ACEITAR" | "REJEITAR" };
export type TaxationSuggestionBulkApplyResult = { applied: number; rejected: number; notFound: number };
export type MasterCatalogProductPage = { items: MasterCatalogProduct[]; total: number; page: number; pageSize: number; totalPages: number };
export type MasterCatalogTaxationStatusCounts = { total: number; MISSING: number; NEW: number; REUSED: number; NEEDS_CONFIRMATION: number };

export const masterCatalogService = {
  list: async (params?: { search?: string; taxationStatus?: MasterCatalogTaxationStatus; page?: number; pageSize?: number }) =>
    (await api.get<ApiResponse<MasterCatalogProductPage>>("/master-catalog", { params: { status: "PUBLISHED", ...params } })).data.data,
  summary: async () => (await api.get<ApiResponse<MasterCatalogTaxationStatusCounts>>("/master-catalog/summary")).data.data,
  get: async (id: string) => (await api.get<ApiResponse<MasterCatalogProductDetail>>(`/master-catalog/${encodeURIComponent(id)}`)).data.data,
  create: async (data: CreateMasterCatalogProduct) => (await api.post("/master-catalog", data)).data.data as MasterCatalogProduct,
  update: async (id: string, changes: MasterCatalogProductChanges) => (await api.patch<ApiResponse<MasterCatalogProductDetail>>(`/master-catalog/${encodeURIComponent(id)}`, changes)).data.data,
  searchTaxations: async (query: string) => (await api.get<ApiResponse<TaxationSearchResult[]>>("/master-catalog/taxations/search", { params: { q: query } })).data.data,
  linkTaxation: async (id: string, taxationId: string) => (await api.post(`/master-catalog/${encodeURIComponent(id)}/taxation-link`, { taxationId })).data.data,
  resolveGtinSuggestion: async (id: string, approvalId: string, decision: "ACCEPT" | "REJECT") => (await api.post<ApiResponse<MasterCatalogProductDetail>>(`/master-catalog/${encodeURIComponent(id)}/gtin-suggestion/${encodeURIComponent(approvalId)}/decision`, { decision })).data.data,
  updateTaxation: async (taxationId: string, changes: TaxationEditableChanges) => (await api.patch<ApiResponse<MasterCatalogTaxationProfile>>(`/master-catalog/taxations/${encodeURIComponent(taxationId)}`, changes)).data.data,
  taxationSuggestions: async (id: string) => (await api.get<ApiResponse<TaxationSuggestionCandidate[]>>(`/master-catalog/${encodeURIComponent(id)}/taxation-suggestions`)).data.data,
  acceptTaxationSuggestion: async (id: string, candidate: TaxationSuggestionCandidate) => (await api.post(`/master-catalog/${encodeURIComponent(id)}/taxation-suggestions/accept`, { candidate })).data.data,
  taxationSuggestionsBulk: async () => (await api.get<ApiResponse<TaxationSuggestionBulkRow[]>>("/master-catalog/taxation-suggestions/bulk")).data.data,
  acceptTaxationSuggestionsBulk: async (rows: TaxationSuggestionBulkApplyRow[]) => (await api.post<ApiResponse<TaxationSuggestionBulkApplyResult>>("/master-catalog/taxation-suggestions/bulk-apply", { rows })).data.data,
};
