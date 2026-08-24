import { api, type ApiResponse } from "./api/client";
export type FiscalAlertEntity="PRODUCT"|"TAXATION"|"FAMILY"|"SUPPLIER";
export type FiscalAlertSeverity="CRITICAL"|"HIGH"|"MEDIUM"|"LOW";
export type FiscalAlertItem={id:string;code:string;description:string;currentValue:string;suggestedValue:string;source:string;confidence:number};
export type FiscalAlertGroup={id:string;title:string;description:string;entity:FiscalAlertEntity;field:string;severity:FiscalAlertSeverity;affected:number;items:FiscalAlertItem[]};
export const fiscalAlertsService={summary:async()=>(await api.get<ApiResponse<FiscalAlertGroup[]>>("/alerts/fiscal-summary")).data.data};
