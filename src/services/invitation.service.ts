import { api, type ApiResponse } from "./api/client";

export type InvitationPreview = { name: string; email: string };

export const invitationService = {
  preview: async (token: string) => (await api.get<ApiResponse<InvitationPreview>>(`/auth/invitations/${encodeURIComponent(token)}`)).data.data,
  accept: async (token: string, password: string) => (await api.post<ApiResponse<{ email: string }>>("/auth/invitations/accept", { token, password })).data.data,
};
