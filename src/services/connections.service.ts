import { api, type ApiResponse } from "./api/client";

export type ConnectionPayload = { name:string; connectorBaseUrl:string; connectorId:string; connectorApiKey:string };
export type Connection = Omit<ConnectionPayload, "connectorApiKey"> & { id:string; active:boolean; apiKeyConfigured:boolean; connectorStatus:string; connectorVersion?:string | null; lastHeartbeatAt?:string | null; lastSuccessfulConnectionAt?:string | null };
type Page<T> = { items:T[]; page:number; pageSize:number; total:number; totalPages:number };

export const connectionsService = {
  list: async () => (await api.get<ApiResponse<Page<Connection>>>("/erp-connections")).data.data,
  create: async (data:ConnectionPayload) => (await api.post<ApiResponse<Connection>>("/erp-connections",data)).data.data,
  update: async (id:string,data:Partial<ConnectionPayload>) => (await api.patch<ApiResponse<Connection>>(`/erp-connections/${id}`,data)).data.data,
  test: async (id:string) => (await api.post<ApiResponse<{valid:boolean}>>(`/erp-connections/${id}/test`)).data.data,
  health: async (id:string) => (await api.get<ApiResponse<unknown>>(`/erp-connections/${id}/health`)).data.data,
  queries: async (id:string) => (await api.get<ApiResponse<Array<{code:string;description?:string;version?:string;enabled:boolean}>>>(`/erp-connections/${id}/queries`)).data.data,
  // Compatibility for the legacy source browser: it now lists authorized query codes, never Oracle tables.
  tables: async (id:string,_prefix:string) => (await connectionsService.queries(id)).filter(query=>query.enabled).map(query=>({TABLE_NAME:query.code})),
};
