import { api, type ApiResponse } from "./api/client";
import type { ValidatedProduct } from "./connector-transmissions.service";

export type InitialCatalogReviewRow = {
  code: string;
  description: string;
  gtin: string;
  ncm: string;
  cest: string;
  cstIcms: string;
  cfop: string;
  sourceFiles: string;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  reviewNotes: string;
};

export const initialCatalogLoadService = {
  candidates: async () => (await api.get<ApiResponse<ValidatedProduct[]>>("/intelligent-sanitization/products", { params: { issue: "ok" } })).data.data,
  importReviewed: async (products: InitialCatalogReviewRow[]) => (await api.post<ApiResponse<{ imported: number; rejected: number }>>("/master-catalog/initial-load", { products })).data.data,
};
