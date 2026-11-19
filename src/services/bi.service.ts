import { api, type ApiResponse } from "./api/client";

// BI Financeiro (backend: src/bi). A agregação é sempre no servidor: a tela só manda a definição da
// visão e recebe a matriz pronta, com subtotais e totais.

export type DatasetId = "titles" | "cashflow" | "expenses";
export type Regime = "COMPETENCE" | "CASH";
export type Agg = "sum" | "avg" | "min" | "max" | "count" | "cumsum";
export type Granularity = "day" | "week" | "month" | "quarter" | "year";
export type CompetenceDate = "ISSUE" | "ENTRY" | "ACCOUNTING" | "DUE";
export type OperationKind = "SETTLEMENT" | "INTEREST" | "DISCOUNT" | "REVERSAL" | "IGNORE";

export type DatasetField =
  | { id: string; label: string; kind: "text"; values?: string[]; description?: string }
  | { id: string; label: string; kind: "date"; description?: string }
  | { id: string; label: string; kind: "number"; aggs: Agg[]; format: "money" | "number" | "days"; description?: string };
export type DetailColumn = { id: string; label: string; format: "text" | "date" | "money" | "number" };
export type Dataset = { id: DatasetId; label: string; description: string; requiresRegime: boolean; countLabel: string; fields: DatasetField[]; granularities: Granularity[]; detail: DetailColumn[] };

export type FilterOp = "eq" | "neq" | "in" | "notIn" | "contains" | "between" | "gte" | "lte";
export type ViewFilter = { field: string; op: FilterOp; value: string | number | Array<string | number> };
export type ViewDefinition = {
  dataset: DatasetId;
  regime?: Regime;
  rows: string[];
  columns: string[];
  measures: Array<{ field: string; agg: Agg }>;
  filters: ViewFilter[];
  sort?: { by: "label" | "measure"; measure?: number; dir: "asc" | "desc" };
  limit?: number;
  companyIds?: string[];
};

export type DimensionInfo = { key: string; label: string; kind: "text" | "date"; granularity?: Granularity };
export type Cells = Record<string, Array<number | null>>;
export type MatrixRow = { key: string[]; level: number; cells: Cells; total: Array<number | null> };
export type QueryResult = {
  dataset: DatasetId; regime: Regime | null; competenceDate: CompetenceDate; today: string; dataAsOf: string | null;
  rowDims: DimensionInfo[]; columnDims: DimensionInfo[];
  measures: Array<{ key: string; label: string; format: "money" | "number" | "days" }>;
  columns: Array<{ id: string; key: string[] }>;
  rows: MatrixRow[];
  grandTotal: { cells: Cells; total: Array<number | null> };
  leafRowCount: number;
  warnings: string[];
};
export type DrillResult = { columns: DetailColumn[]; items: Array<Record<string, string | number | null>>; nextCursor: string | null; total?: { count: number; measures: Array<number | null> } };
export type BiTemplate = { id: string; name: string; question: string; definition: ViewDefinition };
export type BiView = { id: string; name: string; dataset: DatasetId; definition: ViewDefinition; shared: boolean; ownerId: string; ownerName: string | null; mine: boolean; updatedAt: string };
export type BiStatus = { companies: Array<{ id: string; name: string; document: string }>; titles: number; operations: number; pendingOperationKinds: number; queriesPublished: boolean; dataAsOf: string | null; competenceDate: CompetenceDate };
export type OperationKindRow = { operationCode: number; operationName: string | null; kind: OperationKind; source: "DEFAULT" | "USER"; operations: number };

const data = <T,>(response: { data: ApiResponse<T> }) => response.data.data;

export const biService = {
  datasets: async () => data(await api.get<ApiResponse<Dataset[]>>("/bi/datasets")),
  templates: async () => data(await api.get<ApiResponse<BiTemplate[]>>("/bi/templates")),
  status: async () => data(await api.get<ApiResponse<BiStatus>>("/bi/status")),
  // A consulta tem timeout de 15 s no servidor; o front espera um pouco mais.
  query: async (definition: ViewDefinition) => data(await api.post<ApiResponse<QueryResult>>("/bi/query", definition, { timeout: 25_000 })),
  drill: async (body: { definition: ViewDefinition; rowKey: string[]; columnKey: string[]; cursor?: string | null; pageSize?: number }) => data(await api.post<ApiResponse<DrillResult>>("/bi/query/drill", { ...body, cursor: body.cursor ?? undefined }, { timeout: 25_000 })),
  values: async (params: { dataset: DatasetId; field: string; search?: string; regime?: Regime }) => data(await api.get<ApiResponse<Array<{ value: string; total: number }>>>("/bi/values", { params })),
  views: async () => data(await api.get<ApiResponse<BiView[]>>("/bi/views")),
  createView: async (body: { name: string; definition: ViewDefinition; shared: boolean }) => data(await api.post<ApiResponse<BiView>>("/bi/views", body)),
  updateView: async (id: string, body: { name?: string; definition?: ViewDefinition; shared?: boolean }) => data(await api.patch<ApiResponse<BiView>>(`/bi/views/${id}`, body)),
  deleteView: async (id: string) => { await api.delete(`/bi/views/${id}`); },
  settings: async () => data(await api.get<ApiResponse<{ competenceDate: CompetenceDate }>>("/bi/settings")),
  saveSettings: async (competenceDate: CompetenceDate) => data(await api.put<ApiResponse<{ competenceDate: CompetenceDate }>>("/bi/settings", { competenceDate })),
  operationKinds: async () => data(await api.get<ApiResponse<OperationKindRow[]>>("/bi/operation-kinds")),
  saveOperationKind: async (code: number, kind: OperationKind) => data(await api.put<ApiResponse<{ operationCode: number; kind: OperationKind }>>(`/bi/operation-kinds/${code}`, { kind })),
};
