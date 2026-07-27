import { api } from "./api/client";
export type ConsincoConnection={id:string;name:string;baseUrl:string;active:boolean;createdAt:string};
export const consincoService={listConnections:async()=> (await api.get("/consinco/connections")).data.data as ConsincoConnection[],createConnection:async(data:{name:string;baseUrl:string})=>(await api.post("/consinco/connections",data)).data.data};
