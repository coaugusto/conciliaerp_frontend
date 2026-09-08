import { api, type ApiResponse } from "./api/client";

export type AdherencePlanItem = { label: string; value: string };
export type AdherencePlanSection = { code: string; title: string; items: AdherencePlanItem[] };
export type AdherencePlanResult = { sections: AdherencePlanSection[]; lastSyncedAt: string | null };

export const adherencePlanService = {
  get: async () => (await api.get<ApiResponse<AdherencePlanResult>>("/adherence-plan")).data.data,
};
