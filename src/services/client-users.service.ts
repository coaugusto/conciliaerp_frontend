import { api, type ApiResponse } from "./api/client";

export type ClientUserRole = "COMPANY_ADMIN" | "ANALYST";
export type ClientUser = {
  id: string;
  name: string;
  email: string;
  role: ClientUserRole;
  active: boolean;
  mustChangePassword: boolean;
  invitationStatus: "PENDING" | "ACCEPTED" | "EXPIRED";
  invitedAt: string | null;
  lastLoginAt: string | null;
};
export type CreateClientUser = Pick<ClientUser, "name" | "email" | "role">;
export type UpdateClientUser = Pick<ClientUser, "name" | "email" | "role" | "active">;

export const clientUsersService = {
  list: async (tenantId: string) => (await api.get<ApiResponse<ClientUser[]>>(`/tenants/${tenantId}/users`)).data.data,
  create: async (tenantId: string, payload: CreateClientUser) => (await api.post<ApiResponse<ClientUser>>(`/tenants/${tenantId}/users`, payload)).data.data,
  update: async (tenantId: string, userId: string, payload: UpdateClientUser) => (await api.patch<ApiResponse<ClientUser>>(`/tenants/${tenantId}/users/${userId}`, payload)).data.data,
  resendInvitation: async (tenantId: string, userId: string) => (await api.post<ApiResponse<ClientUser>>(`/tenants/${tenantId}/users/${userId}/invitation`)).data.data,
};
