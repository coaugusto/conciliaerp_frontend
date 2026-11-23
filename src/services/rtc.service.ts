import { api, type ApiResponse } from "./api/client";

// Reforma Tributária: validação do IBS/CBS contra a base oficial da Receita (backend: src/rtc).
// A análise roda em segundo plano no servidor; a tela só dispara e lê o resultado paginado.

export type RtcSeverity = "HIGH" | "MEDIUM" | "INFO" | "OK";
export type RtcRule = { code: string; severity: Exclude<RtcSeverity, "OK">; title: string; explanation: string; action: string };
export type RtcStats = { combinations: number; items: number; products: number; bySeverity: Record<RtcSeverity, number>; byProblem: Record<string, number> };
export type RtcRun = { id: string; status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"; error: string | null; createdAt: string; startedAt: string | null; finishedAt: string | null; referenceVersion: string | null };
export type RtcStatus = { run: RtcRun | null; lastCompleted: { id: string; finishedAt: string; referenceVersion: string | null } | null; outdated: boolean; stats: RtcStats };
export type RtcReference = { source: string; commit: string; dbVersion: string; dbDate: string | null; sha256: string; counts: Record<string, number>; loadedAt: string } | null;
export type RtcRow = { id: string; productId: string; productName: string | null; ncm: string; cst: string; classCode: string; itemCount: number; lastIssue: string | null; problems: string[]; severity: RtcSeverity; suggestionCount: number };
export type RtcPage = { rows: RtcRow[]; total: number; page: number; pageSize: number };
export type RtcClassInfo = { code: string; official: { code: string; cst: string; description: string; rateType: string | null; annex: string | null } | null; annex: { annexNumber: string | null; annexItem: string | null; annexText: string | null } | null };
export type RtcDetail = RtcRow & {
  companyIds: string[]; firstIssue: string | null;
  rules: RtcRule[];
  cstInfo: { code: string; description: string } | null;
  ncmInfo: { code: string; description: string; endDate: string | null } | null;
  current: RtcClassInfo | null;
  suggestions: RtcClassInfo[];
  sample: Record<string, string | number> | null;
};
export type RtcItemsQuery = { severity?: RtcSeverity; problem?: string; search?: string; page?: number; pageSize?: number };

const data = <T,>(response: { data: ApiResponse<T> }) => response.data.data;

export const rtcService = {
  reference: async () => data(await api.get<ApiResponse<RtcReference>>("/rtc/reference")),
  rules: async () => data(await api.get<ApiResponse<RtcRule[]>>("/rtc/rules")),
  status: async () => data(await api.get<ApiResponse<RtcStatus>>("/rtc/analysis")),
  start: async () => data(await api.post<ApiResponse<{ id: string; status: RtcRun["status"] }>>("/rtc/analysis")),
  items: async (query: RtcItemsQuery) => data(await api.get<ApiResponse<RtcPage>>("/rtc/analysis/items", { params: query })),
  item: async (id: string) => data(await api.get<ApiResponse<RtcDetail>>(`/rtc/analysis/items/${id}`)),
};
