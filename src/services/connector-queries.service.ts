import { api, type ApiResponse } from "./api/client";

export type ConnectorQuery = { id: string; code: string; version: number; description: string; sqlPreview: string; sha256: string; parameters: unknown[]; timeoutSeconds: number; maxRows: number; batchSize: number; enabled: boolean; syncWithConnector: boolean };
export type ConnectorTarget = { connectorId: string; machineName?: string | null; environment?: string | null; version?: string | null; lastHeartbeatAt?: string | null };
export type ConnectorQueryCoverage={ready:boolean;operationLevelValidationReady:boolean;coveragePercent:number;queries:Array<{code:string;purpose:string;exists:boolean;version?:number;enabled:boolean;approvedForConnector:boolean;missingRequired:string[];missingRecommended:string[];ready:boolean}>};
export type ConnectorInitialLoad = { id: string; status: string; scheduledJobs: number };

export const connectorQueriesService = {
  list: async () => (await api.get<ApiResponse<ConnectorQuery[]>>("/connector-queries")).data.data,
  listConnectors: async () => (await api.get<ApiResponse<ConnectorTarget[]>>("/connector-queries/connectors")).data.data,
  coverage: async () => (await api.get<ApiResponse<ConnectorQueryCoverage>>("/connector-queries/coverage")).data.data,
  create: async (data: Omit<ConnectorQuery, "id" | "version" | "sha256" | "enabled" | "syncWithConnector">) => (await api.post<ApiResponse<ConnectorQuery>>("/connector-queries", data)).data.data,
  setEnabled: async (id: string, enabled: boolean) => (await api.patch(`/connector-queries/${id}/enabled`, { enabled })).data,
  setSync: async (id: string, syncWithConnector: boolean) => (await api.patch(`/connector-queries/${id}/sync`, { syncWithConnector })).data,
  schedule: async (id: string, connectorId: string, companyId: string) => (await api.post<ApiResponse<unknown>>(`/connector-queries/${id}/jobs`, { connectorId, companyId, parameters: {} })).data.data,
  startInitialLoad: async (connectorId: string, companyId: string) => (await api.post<ApiResponse<ConnectorInitialLoad> | ConnectorInitialLoad>("/connector-initial-loads", { connectorId, companyId })).data,
};
