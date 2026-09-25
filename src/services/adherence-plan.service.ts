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
// Mesmo shape de AdherencePlanAccountingGap — contraparte positiva (espécie × operação que JÁ tem
// modelo configurado no motor contábil), pedida pelo cliente como complemento de "Operações sem
// contabilização".
export type AdherencePlanAccountingModel = { speciesCode: string; speciesDescription: string | null; operationCode: string; operationDescription: string | null };
// Alerta de configuração próprio (fora do checklist de PA's, pedido do cliente) — natureza de
// despesa cujo próprio parâmetro (RF_PARAMNATNFDESP.GERCONTABILIZACAO) não gera contabilização.
export type AdherencePlanBudgetAccountingGap = { expenseNatureId: string; expenseNatureDescription: string | null; companyNumber: string | null; cgo: string | null; speciesCode: string | null; operationCode: string | null; taxationType: string | null; generatesFiscalBook: string | null; generatesFinancialTitle: string | null };
export type AdherencePlanResult = {
  sections: AdherencePlanSection[];
  cgoGaps: AdherencePlanCgoGap[];
  accountingGaps: AdherencePlanAccountingGap[];
  speciesAccountGaps: AdherencePlanSpeciesGap[];
  bankAccountGaps: AdherencePlanBankAccountGap[];
  budgetAccountingGaps: AdherencePlanBudgetAccountingGap[];
  cgoModels: AdherencePlanCgoModel[];
  speciesModels: AdherencePlanSpeciesModel[];
  accountingModels: AdherencePlanAccountingModel[];
  budgetModels: AdherencePlanBudgetModel[];
  lastSyncedAt: string | null;
};
// Espelha GAP_SECTION_CODES do backend (adherence-plan.service.ts) — usado pelo botão "Exportar
// PDF" de cada quadro.
export const GAP_SECTION_CODES = ["CGO_GAPS", "ACCOUNTING_GAPS", "SPECIES_ACCOUNT_GAPS", "BANK_ACCOUNT_GAPS", "BUDGET_ACCOUNTING_GAPS", "CGO_MODELS", "SPECIES_MODELS", "ACCOUNTING_MODELS", "BUDGET_MODELS"] as const;
export type GapSectionCode = (typeof GAP_SECTION_CODES)[number];

export type AdherencePlanRecipient = { id: string; email: string; name: string | null; createdAt: string };
export type AdherencePlanReportVersion = { id: string; generatedAt: string; generatedBy: string | null; sectionsTotal: number; sectionsWithGap: number; gapItemsTotal: number; pdfFileName: string; pngFileName: string };

// responseType "blob" passa pelo mesmo axios com o header de autenticação — um <a href> ou
// window.open direto na URL da API não carregaria o token, já que o download/visualização é
// sempre autenticado por tenant. Mesmo padrão de connector-package.service.ts.
async function downloadBlob(url: string, fileName: string) {
  const response = await api.get(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
// Abre numa aba nova em vez de baixar — "possa abrir" (visualizar), não necessariamente salvar.
async function openBlob(url: string) {
  const response = await api.get(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(response.data);
  window.open(objectUrl, "_blank");
  // Sem revoke imediato: a aba nova ainda está carregando o blob quando este código continua.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export const adherencePlanService = {
  get: async () => (await api.get<ApiResponse<AdherencePlanResult>>("/adherence-plan")).data.data,
  listRecipients: async () => (await api.get<ApiResponse<AdherencePlanRecipient[]>>("/adherence-plan/recipients")).data.data,
  addRecipient: async (email: string, name?: string) => (await api.post<ApiResponse<AdherencePlanRecipient>>("/adherence-plan/recipients", { email, name })).data.data,
  removeRecipient: async (id: string) => (await api.delete<ApiResponse<{ deleted: boolean }>>(`/adherence-plan/recipients/${id}`)).data.data,
  downloadPdf: () => downloadBlob("/adherence-plan/pdf", `plano-aderencia-${new Date().toISOString().slice(0, 10)}.pdf`),
  downloadGapSectionPdf: (code: GapSectionCode, fileName: string) => downloadBlob(`/adherence-plan/gap-sections/${code}/pdf`, fileName),
  openInfographic: () => openBlob("/adherence-plan/infographic.png"),
  downloadInfographic: () => downloadBlob("/adherence-plan/infographic.png", `plano-aderencia-infografico-${new Date().toISOString().slice(0, 10)}.png`),
  // Grupo "fora do checklist de PA's" (as nove listas de lacuna/configurado + inconsistências
  // fiscais) — infográfico e PDF separados do relatório principal, pedido do cliente.
  openConfigurationAlertsInfographic: () => openBlob("/adherence-plan/configuration-alerts/infographic.png"),
  downloadConfigurationAlertsPdf: () => downloadBlob("/adherence-plan/configuration-alerts/pdf", `alertas-configuracao-${new Date().toISOString().slice(0, 10)}.pdf`),
  sendNow: async () => (await api.post<ApiResponse<{ sent: number; versionId: string }>>("/adherence-plan/send")).data.data,
  createVersion: async () => (await api.post<ApiResponse<AdherencePlanReportVersion>>("/adherence-plan/versions")).data.data,
  listVersions: async () => (await api.get<ApiResponse<AdherencePlanReportVersion[]>>("/adherence-plan/versions")).data.data,
  downloadVersionPdf: (id: string, fileName: string) => downloadBlob(`/adherence-plan/versions/${id}/pdf`, fileName),
  openVersionPng: (id: string) => openBlob(`/adherence-plan/versions/${id}/png`),
};
