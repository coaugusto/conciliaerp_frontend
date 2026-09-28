import { api, type ApiResponse } from "./api/client";

export type AuditLogEntry = {
  id: string;
  tenantId: string | null;
  correlationId: string | null;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadataJson: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
};
export type AuditLogExport = {
  id: string;
  tenantId: string | null;
  periodFrom: string;
  periodTo: string;
  recordCount: number;
  sizeBytes: number;
  createdAt: string;
};
export type Paginated<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };

export const auditLogsService = {
  list: async (page: number, pageSize = 20) => (await api.get<ApiResponse<Paginated<AuditLogEntry>>>("/audit-logs", { params: { page, pageSize } })).data.data,
  listExports: async (page: number, pageSize = 20) => (await api.get<ApiResponse<Paginated<AuditLogExport>>>("/audit-logs/exports", { params: { page, pageSize } })).data.data,
  // responseType "blob" passa pelo mesmo axios com o header de autenticação (mesmo padrão de
  // connector-package.service.ts) — o arquivo é sempre restrito ao tenant de quem baixa.
  downloadExport: async (item: AuditLogExport) => {
    const response = await api.get(`/audit-logs/exports/${encodeURIComponent(item.id)}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `audit-log-${item.periodFrom.slice(0, 10)}-a-${item.periodTo.slice(0, 10)}.ndjson.gz`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
