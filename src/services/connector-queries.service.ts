import { api, type ApiResponse } from "./api/client";

export type ConnectorQuery = { id: string; code: string; version: number; description: string; sqlPreview: string; sha256: string; parameters: unknown[]; timeoutSeconds: number; maxRows: number; batchSize: number; enabled: boolean; syncWithConnector: boolean };
export type ConnectorTarget = { connectorId: string; machineName?: string | null; environment?: string | null; version?: string | null; lastHeartbeatAt?: string | null };
export type ConnectorQueryCoverage={ready:boolean;operationLevelValidationReady:boolean;coveragePercent:number;queries:Array<{code:string;purpose:string;exists:boolean;version?:number;enabled:boolean;approvedForConnector:boolean;missingRequired:string[];missingRecommended:string[];ready:boolean}>};
export type ConnectorInitialLoad = { id: string; status: string; scheduledJobs: number };
export type ConnectorJob = { id: string; connectorId: string; companyId?: string | null; queryCode: string; queryVersion: number; status: string; requestedAt: string; dispatchedAt?: string | null; completedAt?: string | null; expiresAt: string; errorCode?: string | null; errorMessage?: string | null };
export type ConnectorCapability = { connectorId: string; queryCode: string; queryVersion: number; sha256: string; enabled: boolean; reportedAt: string };
export type ConnectorSchedule = { id: string; connectorId: string; companyId: string; queryCode: string; queryVersion: number; frequency: "DAILY" | "HOURLY" | "MINUTES"; intervalMinutes?: number | null; nextRunAt: string; lastRunAt?: string | null; active: boolean };
export type ConnectorMonitoring = { connectors: ConnectorTarget[]; capabilities: ConnectorCapability[]; jobs: ConnectorJob[]; schedules: ConnectorSchedule[] };

export const connectorQueriesService = {
  list: async () => (await api.get<ApiResponse<ConnectorQuery[]>>("/connector-queries")).data.data,
  listConnectors: async () => (await api.get<ApiResponse<ConnectorTarget[]>>("/connector-queries/connectors")).data.data,
  coverage: async () => (await api.get<ApiResponse<ConnectorQueryCoverage>>("/connector-queries/coverage")).data.data,
  monitoring: async () => (await api.get<ApiResponse<ConnectorMonitoring>>("/connector-queries/monitoring")).data.data,
  create: async (data: Omit<ConnectorQuery, "id" | "version" | "sha256" | "enabled" | "syncWithConnector">) => (await api.post<ApiResponse<ConnectorQuery>>("/connector-queries", data)).data.data,
  setEnabled: async (id: string, enabled: boolean) => (await api.patch(`/connector-queries/${id}/enabled`, { enabled })).data,
  setSync: async (id: string, syncWithConnector: boolean) => (await api.patch(`/connector-queries/${id}/sync`, { syncWithConnector })).data,
  schedule: async (id: string, connectorId: string, companyId: string) => (await api.post<ApiResponse<unknown>>(`/connector-queries/${id}/jobs`, { connectorId, companyId, parameters: {} })).data.data,
  createRecurringSchedule: async (id: string, data: { connectorId: string; companyId: string; startAt: string; frequency: "DAILY" | "HOURLY" | "MINUTES"; intervalMinutes?: number }) => (await api.post<ApiResponse<ConnectorSchedule>>(`/connector-queries/${id}/schedules`, { ...data, parameters: {} })).data.data,
  setScheduleActive: async (id: string, active: boolean) => (await api.patch<ApiResponse<ConnectorSchedule>>(`/connector-queries/schedules/${id}/active`, { active })).data.data,
  startInitialLoad: async (connectorId: string, companyId: string) => (await api.post<ApiResponse<ConnectorInitialLoad> | ConnectorInitialLoad>("/connector-initial-loads", { connectorId, companyId })).data,
};
