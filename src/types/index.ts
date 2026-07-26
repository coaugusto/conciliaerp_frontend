export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AlertStatus = "OPEN" | "IN_ANALYSIS" | "RESOLVED" | "IGNORED" | "REOPENED";
export type ExecutionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
export type Alert = { id: string; severity: Severity; status: AlertStatus; company: string; branch: string; document: string; person: string; rule: string; divergenceType: string; originValue: number; accountingValue: number; difference: number; createdAt: string; owner?: string };
export type Execution = { id: string; rule: string; status: ExecutionStatus; startedAt: string; endedAt?: string; analyzed: number; matched: number; divergent: number; amount: number; user: string };
