import { api, type ApiResponse } from "./api/client";
import type { ConnectorAgent } from "./connector-agent";

export type ConnectorQueryParameter = { name: string; type: string; required: boolean; default?: unknown };
export type ConnectorQuery = { id: string; code: string; version: number; description: string; sqlPreview: string; sha256: string; parameters: ConnectorQueryParameter[]; timeoutSeconds: number; maxRows: number; batchSize: number; enabled: boolean; syncWithConnector: boolean };
export type ConnectorQueryCoverage={ready:boolean;operationLevelValidationReady:boolean;coveragePercent:number;queries:Array<{code:string;purpose:string;exists:boolean;version?:number;enabled:boolean;approvedForConnector:boolean;missingRequired:string[];missingRecommended:string[];ready:boolean}>};
export type ConnectorJob = { id: string; connectorId: string; companyId?: string | null; queryCode: string; queryVersion: number; status: string; parameters?: Record<string, unknown> | null; requestedAt: string; dispatchedAt?: string | null; completedAt?: string | null; expiresAt: string; errorCode?: string | null; errorMessage?: string | null; recordCount: number };
export type ConnectorCapability = { connectorId: string; queryCode: string; queryVersion: number; sha256: string; enabled: boolean; reportedAt: string };
export type ConnectorSchedule = { id: string; connectorId: string; companyId: string; queryCode: string; queryVersion: number; frequency: "DAILY" | "HOURLY" | "MINUTES"; intervalMinutes?: number | null; nextRunAt: string; lastRunAt?: string | null; active: boolean };
export type ConnectorLastExecution = { id: string; queryCode: string; queryVersion: number; completedAt: string; recordCount: number; connectorId: string; companyId?: string | null };
export type ConnectorMonitoring = { connectors: ConnectorAgent[]; capabilities: ConnectorCapability[]; jobs: ConnectorJob[]; schedules: ConnectorSchedule[]; lastExecution: ConnectorLastExecution | null };

// Resume, para a lista de execuções, o recorte de data/empresa com que o job foi disparado —
// hoje só a FISCAL_DOCUMENT_ITEMS_V1 declara postingFrom/postingTo/companyNumber, mas a função
// não depende do código da consulta para funcionar com qualquer consulta que venha a usar os
// mesmos nomes de parâmetro.
export function jobScopeLabel(parameters?: Record<string, unknown> | null): string | null {
  if (!parameters) return null;
  const from = parameters["postingFrom"], to = parameters["postingTo"], company = parameters["companyNumber"];
  const parts: string[] = [];
  // timeZone:"UTC" é essencial aqui: "2026-08-01" (data sem hora) vira meia-noite UTC ao passar
  // por `new Date()`, e sem fixar o fuso na formatação isso exibia um dia a menos no Brasil
  // (UTC-3) — 01/08 virava "31/07" na tela.
  const asDate = (value: unknown) => { const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("pt-BR", { timeZone: "UTC" }); };
  if (from != null || to != null) parts.push(`Período: ${from != null ? asDate(from) : "?"} – ${to != null ? asDate(to) : "?"}`);
  if (company != null && company !== "") parts.push(`Empresa: ${company}`);
  return parts.length ? parts.join(" · ") : null;
}

export const connectorQueriesService = {
  list: async () => (await api.get<ApiResponse<ConnectorQuery[]>>("/connector-queries")).data.data,
  listConnectors: async () => (await api.get<ApiResponse<ConnectorAgent[]>>("/connector-queries/connectors")).data.data,
  coverage: async () => (await api.get<ApiResponse<ConnectorQueryCoverage>>("/connector-queries/coverage")).data.data,
  monitoring: async () => (await api.get<ApiResponse<ConnectorMonitoring>>("/connector-queries/monitoring")).data.data,
  create: async (data: Omit<ConnectorQuery, "id" | "version" | "sha256" | "enabled" | "syncWithConnector">) => (await api.post<ApiResponse<ConnectorQuery>>("/connector-queries", data)).data.data,
  setEnabled: async (id: string, enabled: boolean) => (await api.patch(`/connector-queries/${id}/enabled`, { enabled })).data,
  remove: async (id: string) => (await api.delete<ApiResponse<{ id: string; code: string; version: number; deleted: boolean }>>(`/connector-queries/${id}`)).data.data,
  publishCatalog: async () => (await api.post<ApiResponse<{ version: number; created: number; existing: number; codes: string[] }>>("/connector-queries/catalog/publish")).data.data,
  activateLatest: async () => (await api.post<ApiResponse<{ activated: number }>>("/connector-queries/activate-latest")).data.data,
  deletePreviousVersions: async () => (await api.delete<ApiResponse<{ deleted: number }>>("/connector-queries/previous-versions")).data.data,
  setSync: async (id: string, syncWithConnector: boolean) => (await api.patch(`/connector-queries/${id}/sync`, { syncWithConnector })).data,
  schedule: async (id: string, connectorId: string, companyId: string, parameters: Record<string, unknown> = {}) => (await api.post<ApiResponse<unknown>>(`/connector-queries/${id}/jobs`, { connectorId, companyId, parameters })).data.data,
  createRecurringSchedule: async (id: string, data: { connectorId: string; companyId: string; startAt: string; frequency: "DAILY" | "HOURLY" | "MINUTES"; intervalMinutes?: number; parameters?: Record<string, unknown> }) => (await api.post<ApiResponse<ConnectorSchedule>>(`/connector-queries/${id}/schedules`, { ...data, parameters: data.parameters ?? {} })).data.data,
  setScheduleActive: async (id: string, active: boolean) => (await api.patch<ApiResponse<ConnectorSchedule>>(`/connector-queries/schedules/${id}/active`, { active })).data.data,
  cancelJob: async (jobId: string) => (await api.post<ApiResponse<ConnectorJob>>(`/connector-queries/jobs/${jobId}/cancel`)).data.data,
};
