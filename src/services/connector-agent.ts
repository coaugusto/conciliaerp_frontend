export type ConnectorAgent = { connectorId: string; machineName?: string | null; environment?: string | null; version?: string | null; status?: string; lastHeartbeatAt?: string | null;
  // Estado da API local do ERP reportado pelo próprio Connector.
  erpApiOnline?: boolean | null; erpApiCheckedAt?: string | null; erpApiVersion?: string | null; erpApiUser?: string | null; erpApiCompany?: string | null; erpApiDetail?: string | null };
