import { api, type ApiResponse } from "./api/client";

export type AdminTenantOption = { id: string; name: string; slug: string };
export type AdminUserTenantMembership = { status: "ACTIVE" | "INVITED" | "DISABLED"; tenant: AdminTenantOption };
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
  jobTitle: string | null;
  phone: string | null;
  createdAt: string;
  tenantMemberships: AdminUserTenantMembership[];
};

export const adminUsersService = {
  list: async () => (await api.get<ApiResponse<AdminUser[]>>("/admin/users")).data.data,
  tenants: async () => (await api.get<ApiResponse<AdminTenantOption[]>>("/admin/users/tenants")).data.data,
  linkTenant: async (userId: string, tenantId: string) => (await api.post<ApiResponse<unknown>>(`/admin/users/${userId}/tenants`, { tenantId })).data.data,
  unlinkTenant: async (userId: string, tenantId: string) => (await api.patch<ApiResponse<unknown>>(`/admin/users/${userId}/tenants/${tenantId}`)).data.data,
};
