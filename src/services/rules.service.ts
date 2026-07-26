import { api, type ApiResponse } from "./api/client";

export type RelationshipSuggestion = {
  originFieldId: string;
  destinationFieldId: string;
  originField: string;
  destinationField: string;
  normalizationType: "NONE" | "TRIM" | "UPPERCASE" | "REMOVE_LEADING_ZEROS" | "DATE_ONLY";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
};

export type RelationshipSuggestionResponse = {
  origin: { id: string; tableName: string };
  destination: { id: string; tableName: string };
  suggestions: RelationshipSuggestion[];
};

export type RelationshipValidationResponse = {
  valid: boolean;
  joins: string[];
  generatedQuery: string;
  message: string;
};

export const rulesService = {
  list: () => api.get("/reconciliation-rules"),
  get: (id:string) => api.get(`/reconciliation-rules/${id}`),
  save: (data:unknown) => api.post("/reconciliation-rules",data),
  test: (data:unknown) => api.post("/reconciliation-rules/test",data),
  execute: (id:string) => api.post(`/reconciliation-rules/${id}/execute`),
  suggestRelationships: async (originDataSourceId: string, destinationDataSourceId: string) => (
    await api.post<ApiResponse<RelationshipSuggestionResponse>>("/reconciliation-rules/relationship-suggestions", { originDataSourceId, destinationDataSourceId })
  ).data.data,
  validateManualRelationship: async (payload: { originDataSourceId: string; destinationDataSourceId: string; joins: Array<{ originFieldId: string; destinationFieldId: string }> }) => (
    await api.post<ApiResponse<RelationshipValidationResponse>>("/reconciliation-rules/validate-manual-relationship", payload)
  ).data.data,
};
