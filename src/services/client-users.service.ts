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
  // Só vem preenchido depois que o backend confirma que o SMTP aceitou o envio (EmailService.send
  // sem erro) — distingue "convite existe" de "e-mail realmente saiu" (Hostinger às vezes recusa
  // a autenticação numa conta que estava funcionando).
  invitationEmailSentAt: string | null;
  lastLoginAt: string | null;
  // Liberação de telas: false = todas as telas do contrato; true = só allowedScreens.
  screensRestricted?: boolean;
  allowedScreens?: string[];
};
export type ClientScreenOption = { code: string; name: string; description: string; contracted: boolean };
export type CreateClientUser = Pick<ClientUser, "name" | "email" | "role">;
export type UpdateClientUser = Pick<ClientUser, "name" | "email" | "role" | "active">;

export const clientUsersService = {
  list: async (tenantId: string) => (await api.get<ApiResponse<ClientUser[]>>(`/tenants/${tenantId}/users`)).data.data,
  create: async (tenantId: string, payload: CreateClientUser) => (await api.post<ApiResponse<ClientUser>>(`/tenants/${tenantId}/users`, payload)).data.data,
  update: async (tenantId: string, userId: string, payload: UpdateClientUser) => (await api.patch<ApiResponse<ClientUser>>(`/tenants/${tenantId}/users/${userId}`, payload)).data.data,
  screens: async (tenantId: string) => (await api.get<ApiResponse<ClientScreenOption[]>>(`/tenants/${tenantId}/users/screens`)).data.data,
  updateScreens: async (tenantId: string, userId: string, payload: { restricted: boolean; screens: string[] }) => (await api.patch<ApiResponse<{ userId: string; screensRestricted: boolean; allowedScreens: string[] }>>(`/tenants/${tenantId}/users/${userId}/screens`, payload)).data.data,
  resendInvitation: async (tenantId: string, userId: string) => (await api.post<ApiResponse<ClientUser>>(`/tenants/${tenantId}/users/${userId}/invitation`)).data.data,
};
