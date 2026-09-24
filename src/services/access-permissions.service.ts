import { api, type ApiResponse } from "./api/client";

export type AccessPermission = { code: string; area: string; name: string; description: string; granted: boolean; global: boolean };

export const accessPermissionsService = {
  list: async (tenantId: string, userId: string) => (await api.get<ApiResponse<AccessPermission[]>>(`/tenants/${tenantId}/users/${userId}/permissions`)).data.data,
  setGranted: async (tenantId: string, userId: string, code: string, granted: boolean) => (await api.patch<ApiResponse<AccessPermission[]>>(`/tenants/${tenantId}/users/${userId}/permissions/${encodeURIComponent(code)}`, { granted })).data.data,
  extendToAllTenants: async (tenantId: string, userId: string, code: string) => (await api.post<ApiResponse<AccessPermission[]>>(`/tenants/${tenantId}/users/${userId}/permissions/${encodeURIComponent(code)}/extend-to-all-tenants`)).data.data,
};
