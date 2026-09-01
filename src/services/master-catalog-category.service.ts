import { api, type ApiResponse } from "./api/client";

export type CategoryNode = { id: string; parentId: string | null; name: string; level: number; productCount: number };
export type CategoryProductsPage = { items: Array<{ id: string; canonicalDescription: string; ncm: string | null; gtin: string | null; category: string | null; subcategory: string | null }>; total: number; page: number; pageSize: number; totalPages: number };

export const masterCatalogCategoryService = {
  tree: async () => (await api.get<ApiResponse<CategoryNode[]>>("/master-catalog/categories/tree")).data.data,
  productsByNode: async (categoryNodeId: string, page = 1) => (await api.get<ApiResponse<CategoryProductsPage>>(`/master-catalog/categories/${encodeURIComponent(categoryNodeId)}/products`, { params: { page } })).data.data,
  linkCategory: async (productId: string, categoryNodeId: string) => (await api.post(`/master-catalog/${encodeURIComponent(productId)}/category-link`, { categoryNodeId })).data.data,
};
