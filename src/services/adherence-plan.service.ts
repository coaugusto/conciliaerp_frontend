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

export type AdherencePlanRecipient = { id: string; email: string; name: string | null; createdAt: string };

export const adherencePlanService = {
  get: async () => (await api.get<ApiResponse<AdherencePlanResult>>("/adherence-plan")).data.data,
  listRecipients: async () => (await api.get<ApiResponse<AdherencePlanRecipient[]>>("/adherence-plan/recipients")).data.data,
  addRecipient: async (email: string, name?: string) => (await api.post<ApiResponse<AdherencePlanRecipient>>("/adherence-plan/recipients", { email, name })).data.data,
  removeRecipient: async (id: string) => (await api.delete<ApiResponse<{ deleted: boolean }>>(`/adherence-plan/recipients/${id}`)).data.data,
  // responseType "blob" passa pelo mesmo axios com o header de autenticação — mesmo padrão de
  // connector-package.service.ts e tax-impact-simulator.service.ts.
  downloadPdf: async () => {
    const response = await api.get("/adherence-plan/pdf", { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `plano-aderencia-${new Date().toISOString().slice(0, 10)}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  sendNow: async () => (await api.post<ApiResponse<{ sent: number }>>("/adherence-plan/send")).data.data,
};
