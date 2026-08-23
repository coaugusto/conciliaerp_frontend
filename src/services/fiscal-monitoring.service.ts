import { api, type ApiResponse } from "./api/client";

export type FiscalMonitoringStatus = {
  enabled: boolean;
  sources: Array<{ type: "API" | "DIRECT_DATABASE"; enabled: boolean; status: "ONLINE" | "OFFLINE"; lastReceivedAt: string | null }>;
  openAlerts: number;
  lastRunAt: string | null;
};

export type SpedProcessingEvent = {
  transmissionId: string;
  fileName: string;
  status: "RECEIVED" | "PROCESSING" | "PROCESSED" | "FAILED";
  receivedAt: string;
  processedAt: string | null;
  generatedAlerts: number;
};

export const fiscalMonitoringService = {
  status: async () => (await api.get<ApiResponse<FiscalMonitoringStatus>>("/fiscal-monitoring/status")).data.data,
  spedEvents: async () => (await api.get<ApiResponse<SpedProcessingEvent[]>>("/fiscal-monitoring/sped-events")).data.data,
};
