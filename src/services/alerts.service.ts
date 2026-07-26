import { api } from "./api/client";
export const alertsService = { list:(params?:unknown)=>api.get("/alerts",{params}), get:(id:string)=>api.get(`/alerts/${id}`), update:(id:string,data:unknown)=>api.patch(`/alerts/${id}`,data) };
