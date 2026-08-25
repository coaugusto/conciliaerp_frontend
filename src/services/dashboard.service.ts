import { api, type ApiResponse } from "./api/client";
import type { ClientContext } from "./client-context.service";

export type ImplementationStage = "COMPLETED" | "IN_PROGRESS" | "PENDING" | "BLOCKED";
export type ReconciliationDashboard = {
  client: { legalName:string; document:string; branches:number; registrationComplete:number };
  products: { imported:number; validated:number; pending:number; rejected:number };
  taxation: { imported:number; validated:number; divergent:number };
  extraction: { method:string; connectorStatus:"ONLINE"|"OFFLINE"; lastSyncAt:string; frequency:string };
  monitoring: { apiEnabled:boolean; directDatabaseEnabled:boolean; automaticCollection:boolean; openAlerts:number; lastRunAt:string };
  sped: { eventDriven:boolean; lastFile:string; lastStatus:"PROCESSED"|"PROCESSING"|"FAILED"; processedFiles:number; generatedAlerts:number };
  services: Array<{code:string;name:string;enabled:boolean;stage:ImplementationStage}>;
};
export type DashboardClientIdentity={tenantId:string;name:string;cncCode:string;companyId:string|null;cnpj:string|null;legalName:string|null;tradeName:string|null;branches:number};
type ClientTenant={id:string;name:string;cncCode:string};
export const dashboardService={
  summary:async()=>(await api.get<ApiResponse<ReconciliationDashboard>>("/dashboard/reconciliation")).data.data,
  clientIdentity:async():Promise<DashboardClientIdentity>=>{
    const [tenantsResponse,clientsResponse]=await Promise.all([api.get<ApiResponse<ClientTenant[]>>("/auth/tenants"),api.get<ApiResponse<ClientContext[]>>("/client-context/clients")]);
    const tenants=tenantsResponse.data.data,clients=clientsResponse.data.data;
    const selectedTenantId=typeof window!=="undefined"?localStorage.getItem("concilia_tenant_id"):null;
    const selectedCompanyId=typeof window!=="undefined"?localStorage.getItem("concilia_company_id"):null;
    const tenant=tenants.find(item=>item.id===selectedTenantId)??tenants[0];
    if(!tenant)throw new Error("Nenhum cliente vinculado ao usuário.");
    const client=clients.find(item=>!!selectedCompanyId&&item.companyIds.includes(selectedCompanyId))??clients[0]??null;
    return {tenantId:tenant.id,name:tenant.name,cncCode:tenant.cncCode,companyId:selectedCompanyId??client?.companyIds[0]??null,cnpj:client?.matrixCnpj??null,legalName:client?.legalName??null,tradeName:client?.tradeName??null,branches:client?.branches??0};
  },
};
