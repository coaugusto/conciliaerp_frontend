import { createContext, useContext } from "react";

// Código fixo de cada tela, mostrado no selo do canto inferior esquerdo e em toda mensagem de
// erro (ErrorState). Serve para o usuário dizer ao suporte exatamente onde o erro apareceu.
//
// Regras:
// - o código nunca muda depois de publicado, mesmo que a tela mude de nome ou de lugar no menu;
// - tela nova ganha o próximo número do seu módulo (prefixo) e entra no TAB_REGISTRY com `screen`;
// - `tables` são as tabelas principais no Postgres (nomes dos models do Prisma), na ordem de
//   importância. Só a equipe interna (ADMIN/ANALYST) vê esta lista.
export const SCREENS = {
  "PNL-01": { name: "Painel de conciliações", tables: ["ReconciliationExecution", "ReconciliationAlert"] },
  "POR-01": { name: "Portal do Cliente", tables: ["Tenant", "Subscription", "CommercialPlan", "PublicApiKey", "ConnectorClient"] },
  "BI-01": { name: "BI Financeiro", tables: ["FinTitle", "FinTitleOperation", "BiView"] },
  "RTC-01": { name: "Reforma Tributária", tables: ["RtcItemProfile", "RtcAnalysisRun", "RtcClassification"] },
  "CAT-01": { name: "Catálogo mestre", tables: ["GlobalCatalogProduct"] },
  "CAT-02": { name: "Categorias do catálogo mestre", tables: ["GlobalCatalogCategory"] },
  "CAT-03": { name: "Produto do catálogo mestre", tables: ["GlobalCatalogProduct", "GlobalCatalogTaxation"] },
  "CAT-04": { name: "Revisão de cadastros", tables: ["GlobalCatalogProduct", "GlobalCatalogTaxation"] },
  "CAT-05": { name: "Portal do Fornecedor", tables: ["GlobalCatalogProduct"] },
  "ALE-01": { name: "Alertas", tables: ["ConnectorExtractRecord", "QueueMessage", "ReconciliationAlert"] },
  "REG-01": { name: "Regras", tables: ["Catálogo de regras no código (OFFICIAL_TAX_RULES)", "EntityHistory"] },
  "INT-01": { name: "Connectors instalados", tables: ["ErpConnection"] },
  "INT-02": { name: "Liberação por empresa", tables: ["CompanyIngestionSettings", "ConsincoConnection"] },
  "INT-03": { name: "Consultas do agente conector", tables: ["ConnectorQueryDefinition", "ConnectorSyncJob", "ConnectorQuerySchedule", "ConnectorInitialLoad"] },
  "INT-04": { name: "Cadastros importados", tables: ["ConnectorExtractRecord", "SanitizationExecution"] },
  "INT-05": { name: "Cadastro importado (validação)", tables: ["SanitizationRecord"] },
  "INT-06": { name: "Carga inicial · produto", tables: ["ConnectorExtractRecord"] },
  "INT-07": { name: "Carga inicial · registro", tables: ["ConnectorExtractRecord"] },
  "PA-01": { name: "Plano de aderência", tables: ["ConnectorExtractRecord", "AdherencePlanReportVersion"] },
  "SIM-01": { name: "Simulador de impacto tributário", tables: ["TaxImpactSimulation"] },
  "ADM-01": { name: "Usuários internos", tables: ["User", "TenantMembership"] },
  "ADM-02": { name: "Auditoria", tables: ["AuditLog"] },
  "ADM-03": { name: "Meu perfil", tables: ["User"] },
  "ADM-04": { name: "Documentação", tables: [] },
} as const satisfies Record<string, { name: string; tables: readonly string[] }>;

export type ScreenCode = keyof typeof SCREENS;

// Cada aba aberta fornece o código da sua tela; ErrorState e o selo leem daqui.
export const ScreenContext = createContext<ScreenCode | null>(null);
export const useScreenCode = () => useContext(ScreenContext);
