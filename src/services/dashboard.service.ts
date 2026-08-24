import { api, type ApiResponse } from "./api/client";

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
export const dashboardService = { summary:async()=>(await api.get<ApiResponse<ReconciliationDashboard>>("/dashboard/reconciliation")).data.data };
