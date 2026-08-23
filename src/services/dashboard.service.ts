export type ImplementationStage = "COMPLETED" | "IN_PROGRESS" | "PENDING" | "BLOCKED";

export type ReconciliationDashboard = {
  client: { legalName: string; document: string; branches: number; registrationComplete: number };
  products: { imported: number; validated: number; pending: number; rejected: number };
  taxation: { imported: number; validated: number; divergent: number };
  extraction: { method: string; connectorStatus: "ONLINE" | "OFFLINE"; lastSyncAt: string; frequency: string };
  monitoring: { apiEnabled: boolean; directDatabaseEnabled: boolean; automaticCollection: boolean; openAlerts: number; lastRunAt: string };
  sped: { eventDriven: boolean; lastFile: string; lastStatus: "PROCESSED" | "PROCESSING" | "FAILED"; processedFiles: number; generatedAlerts: number };
  services: Array<{ code: string; name: string; enabled: boolean; stage: ImplementationStage }>;
};

export const dashboardService = {
  summary: async (): Promise<ReconciliationDashboard> => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return {
      client: { legalName: "Cliente selecionado", document: "CNPJ cadastrado", branches: 4, registrationComplete: 82 },
      products: { imported: 18452, validated: 16980, pending: 1327, rejected: 145 },
      taxation: { imported: 17640, validated: 16211, divergent: 1429 },
      extraction: { method: "Connector local / consulta SQL", connectorStatus: "ONLINE", lastSyncAt: "2026-08-23T18:45:00-03:00", frequency: "A cada 6 horas" },
      monitoring: { apiEnabled: true, directDatabaseEnabled: true, automaticCollection: true, openAlerts: 18, lastRunAt: "2026-08-23T18:45:00-03:00" },
      sped: { eventDriven: true, lastFile: "SPED_FISCAL_2026_07.txt", lastStatus: "PROCESSED", processedFiles: 12, generatedAlerts: 7 },
      services: [
        { code: "fiscal_registration_reconciliation", name: "Conciliação de cadastro fiscal", enabled: true, stage: "IN_PROGRESS" },
        { code: "product_import", name: "Importação de produtos", enabled: true, stage: "COMPLETED" },
        { code: "tax_import", name: "Importação de tributação", enabled: true, stage: "IN_PROGRESS" },
        { code: "fiscal_monitoring", name: "Monitoramento fiscal", enabled: false, stage: "PENDING" },
        { code: "sped_processing", name: "Processamento automático de SPED", enabled: true, stage: "IN_PROGRESS" },
        { code: "implementation_xml_load", name: "Carga de XML para implantação", enabled: true, stage: "PENDING" },
      ],
    };
  },
};
