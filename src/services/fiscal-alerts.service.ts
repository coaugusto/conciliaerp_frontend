import { api, type ApiResponse } from "./api/client";
export type FiscalAlertEntity="PRODUCT"|"TAXATION"|"FAMILY"|"SUPPLIER"|"SPED";
export type FiscalAlertSeverity="CRITICAL"|"HIGH"|"MEDIUM"|"LOW";
export type FiscalSuggestionReference={table?:string;origin?:string;clientState?:string;rule?:string;reason?:string;sourceUrl?:string};
export type SpedAlertContext={bookkeeping?:"EFD_ICMS_IPI"|"EFD_CONTRIBUTIONS";record?:string;parentRecord?:string;line?:number;sourceFile?:string;relatedRecords:string[]};
export type FiscalAlertItem={id:string;productId?:string;maintenanceId?:string;code:string;description:string;currentValue:string;suggestedValue:string;source:string;confidence:number;actionable?:boolean;spedContext?:SpedAlertContext;suggestionReference?:FiscalSuggestionReference};
export type FiscalAlertGroup={id:string;title:string;description:string;entity:FiscalAlertEntity;field:string;severity:FiscalAlertSeverity;affected:number;items:FiscalAlertItem[]};
export type FiscalAdjustmentDecision="ACCEPTED"|"EDITED";
export type QueueFiscalAdjustmentInput={groupId:string;itemId:string;field:string;value:string;decision:FiscalAdjustmentDecision};
export type FiscalCorrectionRow=Record<string,string|number|null>;
export type FiscalCorrectionBatch={id:string;status:"VALIDATED"|"VALIDATION_FAILED"|"QUEUED_FOR_ERP";totalRows:number;validRows:number;invalidRows:number;validationRate:number;errors:Array<{rowNumber:number;errors:string[]}>};
export const fiscalAlertsService={
  summary:async()=>(await api.get<ApiResponse<FiscalAlertGroup[]>>("/alerts/fiscal-summary")).data.data,
  queueAdjustment:async(input:QueueFiscalAdjustmentInput)=>(await api.post<ApiResponse<{id:string;status:string}>>("/alerts/fiscal-adjustments/integration-queue",input)).data.data,
  scanCatalog:async()=>(await api.post<ApiResponse<{id:string;analyzed:number;withSuggestions:number}>>("/fiscal-validation/catalog-review/scan-alerts")).data.data,
  correctionRows:async()=>(await api.get<ApiResponse<FiscalCorrectionRow[]>>("/fiscal-validation/catalog-review/export")).data.data,
  importCorrections:async(rows:FiscalCorrectionRow[],fileName:string)=>(await api.post<ApiResponse<FiscalCorrectionBatch>>("/fiscal-validation/catalog-review/import",{rows,fileName})).data.data,
  queueCorrectionBatch:async(id:string)=>(await api.post<ApiResponse<{id:string;status:string;queued:number}>>(`/fiscal-validation/catalog-review/batches/${encodeURIComponent(id)}/queue-erp`)).data.data,
};
