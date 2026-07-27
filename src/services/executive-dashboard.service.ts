import { api } from "./api/client";
export type ExecutiveDashboard={kpis:{products:number;activeProducts:number;quality:number;pendingDuplicates:number;pendingPublications:number;economy:number;projection:number;recovery:number;averageRoi:number};heatmap:{area:string;score:number}[];publications:{type:string;status:string;at:string;source:string;error?:string}[];timeline:{label:string;at:string}[];supplier:{manufacturers:number;brands:number}};
export const executiveDashboardService={summary:async()=> (await api.get("/executive-dashboard")).data.data as ExecutiveDashboard};
