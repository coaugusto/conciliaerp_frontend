import { api, type ApiResponse } from "./api/client";
export type ValidationRule={id:string;name:string;category:"CADASTRAL"|"FISCAL"|"RELATIONSHIP"|"DOCUMENT";description:string;validation:string;alertCondition:string;expectedResult:string;appliesTo:string[];severity:"CRITICAL"|"HIGH"|"MEDIUM"|"LOW";active:boolean};
export const validationRulesService={list:async()=>(await api.get<ApiResponse<ValidationRule[]>>("/reconciliation-rules")).data.data};
