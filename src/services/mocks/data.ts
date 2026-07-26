import type { Alert, Execution } from "@/types";
export const alerts: Alert[] = [
 { id:"ALT-1048", severity:"CRITICAL", status:"OPEN", company:"Grupo Atlas", branch:"Matriz", document:"NF 98451", person:"Metalúrgica Horizonte", rule:"Títulos sem contabilização", divergenceType:"MISSING_ACCOUNTING_ENTRY", originValue:128450, accountingValue:0, difference:128450, createdAt:"2026-07-24T09:20:00", owner:"" },
 { id:"ALT-1047", severity:"HIGH", status:"IN_ANALYSIS", company:"Grupo Atlas", branch:"Filial SP", document:"PAG 22089", person:"Logística Via Norte", rule:"Diferença de valores", divergenceType:"AMOUNT_DIFFERENCE", originValue:45200, accountingValue:43000, difference:2200, createdAt:"2026-07-23T14:10:00", owner:"Mariana Costa" },
 { id:"ALT-1046", severity:"MEDIUM", status:"OPEN", company:"Brava Serviços", branch:"Matriz", document:"NF 77102", person:"Papelaria Central", rule:"Títulos sem contabilização", divergenceType:"MISSING_ACCOUNTING_ENTRY", originValue:8980, accountingValue:0, difference:8980, createdAt:"2026-07-21T11:40:00" },
 { id:"ALT-1045", severity:"LOW", status:"RESOLVED", company:"Grupo Atlas", branch:"Filial RJ", document:"PAG 11934", person:"Soluções Fiscais", rule:"Diferença de valores", divergenceType:"AMOUNT_DIFFERENCE", originValue:1250, accountingValue:1210, difference:40, createdAt:"2026-07-19T08:00:00", owner:"Carlos Almeida" },
];
export const executions: Execution[] = [
 { id:"EXE-298", rule:"Títulos sem contabilização", status:"COMPLETED", startedAt:"2026-07-24T08:00:00", endedAt:"2026-07-24T08:04:32", analyzed:1284, matched:1215, divergent:69, amount:185430, user:"Carlos Almeida" },
 { id:"EXE-297", rule:"Diferença de valores", status:"RUNNING", startedAt:"2026-07-24T10:30:00", analyzed:754, matched:702, divergent:52, amount:26780, user:"Mariana Costa" },
 { id:"EXE-296", rule:"Títulos sem contabilização", status:"FAILED", startedAt:"2026-07-23T18:00:00", analyzed:0, matched:0, divergent:0, amount:0, user:"Carlos Almeida" },
];
export const connections = [
 { id:"con-1", name:"Connector Produção", connectorBaseUrl:"https://connector-producao.exemplo.local", connectorId:"con-1", connectorStatus:"ONLINE", connectorVersion:"1.0.0", apiKeyConfigured:true, active:true, lastHeartbeatAt:"2026-07-24T11:45:00.000Z" },
 { id:"con-2", name:"Connector Homologação", connectorBaseUrl:"https://connector-hml.exemplo.local", connectorId:"con-2", connectorStatus:"OFFLINE", connectorVersion:"1.0.0", apiKeyConfigured:true, active:false, lastHeartbeatAt:"2026-07-20T18:20:00.000Z" },
];
export type MockConnection = typeof connections[number];
const connectionStorageKey = "concilia_mock_connections";
export function listMockConnections(): MockConnection[] {
 if (typeof window === "undefined") return connections;
 const stored = localStorage.getItem(connectionStorageKey);
 try { return stored ? JSON.parse(stored) : connections; } catch { return connections; }
}
export function createMockConnection(input: Omit<MockConnection, "id" | "lastHeartbeatAt">): MockConnection {
 const record: MockConnection = { ...input, id: `con-${Date.now()}`, lastHeartbeatAt: new Date().toISOString() };
 const items = [record, ...listMockConnections()];
 localStorage.setItem(connectionStorageKey, JSON.stringify(items));
 return record;
}
