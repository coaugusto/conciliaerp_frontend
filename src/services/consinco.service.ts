import { api } from "./api/client";
export type ConsincoConnection={id:string;name:string;baseUrl:string;companyId:string|null;active:boolean;createdAt:string};
export const consincoService={listConnections:async()=> (await api.get("/consinco/connections")).data.data as ConsincoConnection[],createConnection:async(data:{name:string;baseUrl:string;companyId?:string;apiKeyEncrypted?:string})=>(await api.post("/consinco/connections",data)).data.data};
