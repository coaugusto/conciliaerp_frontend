import type { Agg, Dataset, DatasetField, DimensionInfo, Granularity, QueryResult, ViewDefinition, ViewFilter } from "@/services/bi.service";

// Formatação e montagem da definição da visão no construtor. Nada aqui calcula número: totais e
// subtotais vêm prontos do servidor.

export const KEY_SEPARATOR = "\u001f";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export const GRANULARITY_LABEL: Record<Granularity, string> = { day: "Dia", week: "Semana", month: "Mês", quarter: "Trimestre", year: "Ano" };
export const AGG_LABEL: Record<Agg, string> = { sum: "Soma", avg: "Média", min: "Mínimo", max: "Máximo", count: "Quantidade", cumsum: "Acumulado" };

/** Rótulo de um valor de dimensão vindo do servidor ("2026-11" → "nov/2026"). */
export function dimensionValue(value: string, dim?: Pick<DimensionInfo, "kind" | "granularity">): string {
  if (!dim || dim.kind !== "date" || value === "(sem data)") return value;
  switch (dim.granularity) {
    case "day": return br(value);
    case "week": return `Semana de ${br(value).slice(0, 5)}/${value.slice(2, 4)}`;
    case "month": return `${MONTHS[Number(value.slice(5, 7)) - 1]}/${value.slice(0, 4)}`;
    case "quarter": return `${value.slice(-1)}º tri/${value.slice(0, 4)}`;
    default: return value;
  }
}

const moneyFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
export function formatMeasure(value: number | null | undefined, format: "money" | "number" | "days" | "text" | "date"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (format === "money") return moneyFormat.format(value);
  if (format === "days") return `${Math.round(value)} dia${Math.round(value) === 1 ? "" : "s"}`;
  return numberFormat.format(value);
}
export const formatDate = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? br(value) : value === null || value === undefined ? "—" : String(value));

export const fieldOf = (dataset: Dataset | undefined, key: string): DatasetField | undefined => dataset?.fields.find((field) => field.id === key.split(":")[0]);

export function dimensionLabel(dataset: Dataset | undefined, key: string): string {
  const [id, granularity] = key.split(":");
  const field = dataset?.fields.find((item) => item.id === id);
  if (!field) return id;
  return field.kind === "date" ? `${field.label} · ${GRANULARITY_LABEL[(granularity ?? "month") as Granularity].toLowerCase()}` : field.label;
}

export function measureLabel(dataset: Dataset | undefined, measure: { field: string; agg: Agg }): string {
  if (measure.field === "count") return dataset?.countLabel ?? "Quantidade";
  const field = dataset?.fields.find((item) => item.id === measure.field);
  return `${field?.label ?? measure.field}${measure.agg === "sum" ? "" : ` (${AGG_LABEL[measure.agg].toLowerCase()})`}`;
}

// ---------------------------------------------------------------- períodos relativos

export const PERIOD_PRESETS: Array<{ label: string; value: [string, string] }> = [
  { label: "Hoje", value: ["today", "today"] },
  { label: "Próximos 7 dias", value: ["today", "today+7d"] },
  { label: "Próximos 10 dias", value: ["today", "today+10d"] },
  { label: "Próximos 30 dias", value: ["today", "today+30d"] },
  { label: "Próximos 90 dias", value: ["today", "today+90d"] },
  { label: "Últimos 30 dias", value: ["today-30d", "today"] },
  { label: "Esta semana", value: ["startOfWeek", "endOfWeek"] },
  { label: "Este mês", value: ["startOfMonth", "endOfMonth"] },
  { label: "Mês passado", value: ["startOfMonth-1m", "endOfMonth-1m"] },
  { label: "Próximo mês", value: ["startOfMonth+1m", "endOfMonth+1m"] },
  { label: "Este ano", value: ["startOfYear", "endOfYear"] },
  { label: "Ano passado", value: ["startOfYear-1y", "endOfYear-1y"] },
  { label: "Últimos 30 + próximos 90 dias", value: ["today-30d", "today+90d"] },
];

export function periodLabel(value: unknown): string {
  const list = Array.isArray(value) ? value.map(String) : [String(value)];
  const preset = PERIOD_PRESETS.find((item) => item.value[0] === list[0] && item.value[1] === list[1]);
  if (preset) return preset.label;
  return list.map((item) => (/^\d{4}-\d{2}-\d{2}$/.test(item) ? br(item) : item)).join(" a ");
}

const OP_LABEL: Record<string, string> = { eq: "é", neq: "não é", in: "é um de", notIn: "não é nenhum de", contains: "contém", gte: "a partir de", lte: "até", between: "entre" };

export function filterLabel(dataset: Dataset | undefined, filter: ViewFilter): string {
  const field = dataset?.fields.find((item) => item.id === filter.field);
  const name = field?.label ?? filter.field;
  if (field?.kind === "date") return `${name}: ${filter.op === "between" ? periodLabel(filter.value) : `${OP_LABEL[filter.op]} ${periodLabel(filter.value)}`}`;
  const values = Array.isArray(filter.value) ? filter.value : [filter.value];
  if (field?.kind === "number") return `${name}: ${filter.op === "between" ? `${formatMeasure(Number(values[0]), field.format)} a ${formatMeasure(Number(values[1]), field.format)}` : `${OP_LABEL[filter.op]} ${formatMeasure(Number(values[0]), field.format)}`}`;
  const shown = values.length > 2 ? `${values.slice(0, 2).join(", ")} e mais ${values.length - 2}` : values.join(", ");
  return `${name} ${OP_LABEL[filter.op]} ${shown}`;
}

// ---------------------------------------------------------------- definição

export const emptyDefinition = (dataset: Dataset): ViewDefinition => {
  const firstMoney = dataset.fields.find((field) => field.kind === "number" && field.format === "money");
  return {
    dataset: dataset.id, ...(dataset.requiresRegime ? { regime: "COMPETENCE" as const } : {}),
    rows: [], columns: [], filters: [],
    measures: firstMoney ? [{ field: firstMoney.id, agg: "sum" }] : [{ field: "count", agg: "count" }],
  };
};

/** Remove um campo de linhas/colunas/valores/filtros, ajustando a ordenação que apontava para ele. */
export function withoutMeasure(definition: ViewDefinition, index: number): ViewDefinition {
  const measures = definition.measures.filter((_, i) => i !== index);
  let sort = definition.sort;
  if (sort?.by === "measure") {
    const current = sort.measure ?? 0;
    sort = current === index ? undefined : { ...sort, measure: current > index ? current - 1 : current };
  }
  return { ...definition, measures, sort };
}

export function isUsable(definition: ViewDefinition) {
  return definition.measures.length > 0;
}

/** Linhas de folha (sem subtotais), na ordem da grade. */
export const leafRows = (result: QueryResult) => result.rows.filter((row) => row.level === result.rowDims.length);
