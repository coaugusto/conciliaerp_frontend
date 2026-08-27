import { api, type ApiResponse } from "./api/client";

export type ConnectorInitialLoad = { id:string; companyId:string; connectorId:string; status:string; createdAt:string; updatedAt:string };
export type ConnectorLoadJob = { id:string; initialLoadId?:string|null; companyId?:string|null; connectorId:string; queryCode:string; queryVersion:number; status:string; requestedAt:string; dispatchedAt?:string|null; completedAt?:string|null; expiresAt:string; errorCode?:string|null; errorMessage?:string|null };
export type ConnectorLoadPanel = { connectors:Array<{connectorId:string;machineName?:string|null;environment?:string|null;version?:string|null;status:string;lastHeartbeatAt?:string|null}>; companies:Array<{id:string;legalName:string;tradeName?:string|null;document:string;state?:string|null}>; selectedCompanyId?:string|null; loads:ConnectorInitialLoad[]; jobs:ConnectorLoadJob[]; summary:{total:number;pending:number;running:number;completed:number;failed:number;byStatus:Record<string,number>} };

export const connectorInitialLoadsService = {
  list: async (companyId?:string) => (await api.get<ApiResponse<ConnectorLoadPanel>>("/connector-initial-loads", { params: companyId ? { companyId } : undefined })).data.data,
  start: async (connectorId:string, companyId:string) => (await api.post<ApiResponse<ConnectorInitialLoad & {scheduledJobs:number}>>("/connector-initial-loads", { connectorId, companyId })).data.data,
  bootstrap: async (connectorId:string) => (await api.post<ApiResponse<{success:boolean;duplicate:boolean}>>("/connector-initial-loads/bootstrap", { connectorId })).data.data,
  resume: async (loadId:string) => (await api.post<ApiResponse<{success:boolean;status:string;scheduledJobs:number}>>(`/connector-initial-loads/${loadId}/resume`)).data.data,
  retryJob: async (jobId:string) => (await api.post<ApiResponse<{success:boolean}>>(`/connector-initial-loads/jobs/${jobId}/retry`)).data.data,
};
