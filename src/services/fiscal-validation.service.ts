import { api, type ApiResponse } from "./api/client";

export type FiscalValidationSpedContext = {
  bookkeeping: "EFD_CONTRIBUTIONS" | "EFD_ICMS_IPI";
  record: string;
  parentRecord?: string;
  line?: number;
  sourceFile?: string;
};

export type FiscalValidationItem = {
  id: string;
  operation: "SALE" | "PURCHASE";
  issueDate: string;
  ncm?: string;
  cfop?: string;
  pisCst?: string;
  cofinsCst?: string;
  sped?: FiscalValidationSpedContext;
};

export type FiscalValidationInput = {
  persistAlerts: boolean;
  items: FiscalValidationItem[];
};

export const fiscalValidationService = {
  validate: async (input: FiscalValidationInput) => (
    await api.post<ApiResponse<unknown>>("/fiscal-validation/validate", input)
  ).data.data,
};
