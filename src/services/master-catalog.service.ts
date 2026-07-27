import { api } from "./api/client";
export const masterCatalogService={list:async()=> (await api.get("/master-catalog?status=PUBLISHED")).data.data as any[],create:async(data:any)=>(await api.post("/master-catalog",data)).data.data};
