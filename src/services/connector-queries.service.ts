import { api, type ApiResponse } from "./api/client";

export type ConnectorQuery = { id: string; code: string; version: number; description: string; sqlPreview: string; sha256: string; parameters: unknown[]; timeoutSeconds: number; maxRows: number; batchSize: number; enabled: boolean };
export type ConnectorTarget = { connectorId: string; machineName?: string | null; environment?: string | null; version?: string | null; lastHeartbeatAt?: string | null };

export const connectorQueriesService = {
  list: async () => (await api.get<ApiResponse<ConnectorQuery[]>>("/connector-queries")).data.data,
  listConnectors: async () => (await api.get<ApiResponse<ConnectorTarget[]>>("/connector-queries/connectors")).data.data,
  create: async (data: Omit<ConnectorQuery, "id" | "version" | "sha256" | "enabled">) => (await api.post<ApiResponse<ConnectorQuery>>("/connector-queries", data)).data.data,
  setEnabled: async (id: string, enabled: boolean) => (await api.patch(`/connector-queries/${id}/enabled`, { enabled })).data,
  schedule: async (id: string, connectorId: string) => (await api.post<ApiResponse<unknown>>(`/connector-queries/${id}/jobs`, { connectorId, parameters: {} })).data.data,
};
