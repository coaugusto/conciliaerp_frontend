import { api, type ApiResponse } from "./api/client";

export type AdjustmentOrigin = "FISCAL_ALERT" | "ADHERENCE_GAP" | "CONTRACTED_SERVICE";
export type AdjustmentProposalStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";
export type AdjustmentServiceMode = "REMOTE" | "ONSITE";

export type AdjustmentCatalogItem = {
  itemCode: string;
  title: string;
  severity: string | null;
  affected: number;
  estimatedImpact: number | null;
  estimatedHours: number | null;
  hourlyRate: number | null;
  totalCost: number | null;
  actionDescription: string | null;
  configured: boolean;
};
// services: serviços vendidos à parte (ex.: BI Financeiro); affected = empresas ativas do cliente.
export type AdjustmentCatalog = { fiscalAlerts: AdjustmentCatalogItem[]; adherenceGaps: AdjustmentCatalogItem[]; services?: AdjustmentCatalogItem[] };
export type AdjustmentDefaultRates = { remote: number; onsite: number };

export type AdjustmentProposalItemInput = { itemCode: string; title: string; origin: AdjustmentOrigin; affected: number; estimatedHours: number; hourlyRate: number; scheduledDate?: string; actionDescription?: string; serviceMode?: AdjustmentServiceMode };
export type AdjustmentProposalItem = AdjustmentProposalItemInput & { id: string; totalCost: number };
export type AdjustmentProposalSummary = { id: string; companyId: string | null; proposalNumber: number; status: AdjustmentProposalStatus; createdAt: string; acceptedAt: string | null; itemCount: number; totalHours: number; totalCost: number; packagePricing: boolean };
export type AdjustmentProposalDetail = { id: string; tenantId: string; companyId: string | null; proposalNumber: number; status: AdjustmentProposalStatus; createdAt: string; acceptedAt: string | null; packagePricing: boolean; items: AdjustmentProposalItem[] };

export const adjustmentSuggestionsService = {
  catalog: async () => (await api.get<ApiResponse<AdjustmentCatalog>>("/adjustment-suggestions/catalog")).data.data,
  getDefaultRates: async () => (await api.get<ApiResponse<AdjustmentDefaultRates>>("/adjustment-suggestions/default-rates")).data.data,
  setDefaultRates: async (input: AdjustmentDefaultRates) => (await api.put<ApiResponse<AdjustmentDefaultRates>>("/adjustment-suggestions/default-rates", input)).data.data,
  upsertPricing: async (input: { itemCode: string; estimatedHours: number; hourlyRate: number; actionDescription?: string }) =>
    (await api.put<ApiResponse<unknown>>("/adjustment-suggestions/pricing", input)).data.data,
  createProposal: async (input: { companyId?: string; packagePricing?: boolean; items: AdjustmentProposalItemInput[] }) =>
    (await api.post<ApiResponse<AdjustmentProposalDetail>>("/adjustment-suggestions/proposals", input)).data.data,
  // Pacote fechado é só a forma de apresentar ao cliente: as horas continuam gravadas nos itens,
  // então dá para alternar e reemitir o contrato nos dois formatos.
  setProposalPricingMode: async (id: string, packagePricing: boolean) =>
    (await api.patch<ApiResponse<AdjustmentProposalDetail>>(`/adjustment-suggestions/proposals/${id}/pricing-mode`, { packagePricing })).data.data,
  listProposals: async () => (await api.get<ApiResponse<AdjustmentProposalSummary[]>>("/adjustment-suggestions/proposals")).data.data,
  getProposal: async (id: string) => (await api.get<ApiResponse<AdjustmentProposalDetail>>(`/adjustment-suggestions/proposals/${id}`)).data.data,
  updateProposalItems: async (id: string, items: AdjustmentProposalItemInput[]) =>
    (await api.patch<ApiResponse<AdjustmentProposalDetail>>(`/adjustment-suggestions/proposals/${id}/items`, { items })).data.data,
  setProposalStatus: async (id: string, status: AdjustmentProposalStatus) =>
    (await api.patch<ApiResponse<AdjustmentProposalDetail>>(`/adjustment-suggestions/proposals/${id}/status`, { status })).data.data,
  deleteProposal: async (id: string) => (await api.delete<ApiResponse<{ id: string; deleted: boolean }>>(`/adjustment-suggestions/proposals/${id}`)).data.data,
};
