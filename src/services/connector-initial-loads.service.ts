import { api, type ApiResponse } from "./api/client";
import type { ConnectorAgent } from "./connector-agent";

export type ConnectorInitialLoad = { id:string; companyId:string; connectorId:string; status:string; createdAt:string; updatedAt:string };
export type ConnectorLoadJob = { id:string; initialLoadId?:string|null; companyId?:string|null; connectorId:string; queryCode:string; queryVersion:number; status:string; requestedAt:string; dispatchedAt?:string|null; completedAt?:string|null; expiresAt:string; errorCode?:string|null; errorMessage?:string|null };
export type ConnectorLoadPanel = { connectors:ConnectorAgent[]; companies:Array<{id:string;legalName:string;tradeName?:string|null;document:string;state?:string|null}>; selectedCompanyId?:string|null; loads:ConnectorInitialLoad[]; jobs:ConnectorLoadJob[]; summary:{total:number;pending:number;running:number;completed:number;failed:number;byStatus:Record<string,number>} };

function unwrap<T>(payload: ApiResponse<T> | T): T {
  if (payload && typeof payload === "object" && "data" in payload) return (payload as ApiResponse<T>).data;
  return payload as T;
}

export const connectorInitialLoadsService = {
  list: async (companyId?:string) => unwrap((await api.get<ApiResponse<ConnectorLoadPanel> | ConnectorLoadPanel>("/connector-initial-loads", { params: companyId ? { companyId } : undefined })).data),
  start: async (connectorId:string, companyId:string) => unwrap((await api.post<ApiResponse<ConnectorInitialLoad & {scheduledJobs:number}> | (ConnectorInitialLoad & {scheduledJobs:number})>("/connector-initial-loads", { connectorId, companyId })).data),
  bootstrap: async (connectorId:string) => unwrap((await api.post<ApiResponse<{success:boolean;duplicate:boolean}> | {success:boolean;duplicate:boolean}>("/connector-initial-loads/bootstrap", { connectorId })).data),
  resume: async (loadId:string) => unwrap((await api.post<ApiResponse<{success:boolean;status:string;scheduledJobs:number}> | {success:boolean;status:string;scheduledJobs:number}>(`/connector-initial-loads/${loadId}/resume`)).data),
  retryJob: async (jobId:string) => unwrap((await api.post<ApiResponse<{success:boolean}> | {success:boolean}>(`/connector-initial-loads/jobs/${jobId}/retry`)).data),
  reset: async (loadId:string, password:string, reason?:string) => unwrap((await api.post<ApiResponse<{success:boolean;status:string;deleted:{records:number;batches:number;jobs:number}}> | {success:boolean;status:string;deleted:{records:number;batches:number;jobs:number}}>(`/connector-initial-loads/${loadId}/reset`, { password, reason })).data),
  approve: async (loadId:string, reason?:string) => unwrap((await api.post<ApiResponse<{success:boolean;status:string}> | {success:boolean;status:string}>(`/connector-initial-loads/${loadId}/approve`, { reason })).data),
  reject: async (loadId:string, reason?:string) => unwrap((await api.post<ApiResponse<{success:boolean;status:string}> | {success:boolean;status:string}>(`/connector-initial-loads/${loadId}/reject`, { reason })).data),
  cancel: async (loadId:string, reason?:string) => unwrap((await api.post<ApiResponse<{success:boolean;status:string}> | {success:boolean;status:string}>(`/connector-initial-loads/${loadId}/cancel`, { reason })).data),
};
