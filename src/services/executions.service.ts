import { api } from "./api/client";
export const executionsService = { list:(params?:unknown)=>api.get("/reconciliation-executions",{params}), get:(id:string)=>api.get(`/reconciliation-executions/${id}`) };
