import { api } from "./api/client";
export type MasterCatalogProduct = { id: string; canonicalDescription: string; confidence: number; brand?: string | null; manufacturer?: string | null; gtin?: string | null; ncm?: string | null; category?: string | null; version: string | number };
export type CreateMasterCatalogProduct = { canonicalDescription: string; gtin: string; brand: string; manufacturer: string; ncm: string };
export const masterCatalogService={list:async()=> (await api.get("/master-catalog?status=PUBLISHED")).data.data as MasterCatalogProduct[],create:async(data:CreateMasterCatalogProduct)=>(await api.post("/master-catalog",data)).data.data as MasterCatalogProduct};
