import { api, type ApiResponse } from "./api/client";

export type FiscalInconsistencyTypeSummary = { code: number; description: string; count: number };
export type FiscalInconsistenciesSummary = { total: number; types: FiscalInconsistencyTypeSummary[] };

export const fiscalInconsistenciesService = {
  summary: async () => (await api.get<ApiResponse<FiscalInconsistenciesSummary>>("/fiscal-inconsistencies/summary")).data.data,
};
