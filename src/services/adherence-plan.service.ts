import { api, type ApiResponse } from "./api/client";

export type AdherencePlanItem = { label: string; value: string };
export type AdherencePlanSection = { code: string; title: string; items: AdherencePlanItem[] };
export type AdherencePlanCgoGap = { cgo: string; noteCount: number; name: string | null; description: string | null; direction: "ENTRADA" | "SAIDA" | null };
export type AdherencePlanAccountingGap = { speciesCode: string; speciesDescription: string | null; operationCode: string; operationDescription: string | null };
export type AdherencePlanSpeciesGap = { speciesCode: string; speciesDescription: string | null };
export type AdherencePlanBankAccountGap = { accountId: string; companyNumber: string | null; accountDescription: string | null };
export type AdherencePlanCgoModel = { modelId: string; modelDescription: string | null; cgo: string; cgoDescription: string | null };
export type AdherencePlanSpeciesModel = { modelId: string; modelDescription: string | null; speciesCode: string; speciesDescription: string | null };
export type AdherencePlanBudgetModel = { modelId: string; modelDescription: string | null; expenseNatureId: string; expenseNatureDescription: string | null };
export type AdherencePlanResult = {
  sections: AdherencePlanSection[];
  cgoGaps: AdherencePlanCgoGap[];
  accountingGaps: AdherencePlanAccountingGap[];
  speciesAccountGaps: AdherencePlanSpeciesGap[];
  bankAccountGaps: AdherencePlanBankAccountGap[];
  cgoModels: AdherencePlanCgoModel[];
  speciesModels: AdherencePlanSpeciesModel[];
  budgetModels: AdherencePlanBudgetModel[];
  lastSyncedAt: string | null;
};

export const adherencePlanService = {
  get: async () => (await api.get<ApiResponse<AdherencePlanResult>>("/adherence-plan")).data.data,
};
