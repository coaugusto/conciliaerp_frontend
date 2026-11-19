import type { Dataset, QueryResult, ViewDefinition } from "@/services/bi.service";
import { dimensionValue, filterLabel, periodLabel } from "./bi-format";

// Exporta a grade que já está na tela (matriz agregada, no máximo 10 mil células), com subtotais,
// total geral e os filtros usados. A exportação do detalhe completo (todas as linhas, PDF e XML)
// é assíncrona no servidor — fase 4 do plano (docs/bi-financeiro-mvp.md, seção 9).

type Sheet = { header: string[]; rows: Array<Array<string | number | null>> };

export function matrixToSheet(result: QueryResult): Sheet {
  const measures = result.measures;
  const rowHeader = result.rowDims.length ? result.rowDims.map((dim) => dim.label) : [""];
  const columnLabel = (key: string[]) => key.map((value, index) => dimensionValue(value, result.columnDims[index])).join(" · ");
  const header = [
    ...rowHeader,
    ...result.columns.flatMap((column) => measures.map((measure) => (measures.length > 1 ? `${columnLabel(column.key)} — ${measure.label}` : columnLabel(column.key)))),
    ...measures.map((measure) => (result.columns.length ? `Total — ${measure.label}` : measure.label)),
  ];
  const line = (labels: string[], cells: QueryResult["grandTotal"]["cells"], total: Array<number | null>) => [
    ...labels,
    ...result.columns.flatMap((column) => measures.map((_, index) => cells[column.id]?.[index] ?? null)),
    ...total,
  ];
  const rows = result.rows.map((row) => {
    const labels = rowHeader.map((_, index) => (index < row.level ? dimensionValue(row.key[index], result.rowDims[index]) : index === row.level ? "Subtotal" : ""));
    return line(labels, row.cells, row.total);
  });
  rows.push(line(rowHeader.map((_, index) => (index === 0 ? "Total geral" : "")), result.grandTotal.cells, result.grandTotal.total));
  return { header, rows };
}

function filtersSheet(dataset: Dataset | undefined, definition: ViewDefinition, result: QueryResult, companies: string[]): string[][] {
  return [
    ["Base", dataset?.label ?? definition.dataset],
    ...(result.regime ? [["Regime", result.regime === "CASH" ? "Caixa" : "Competência"]] : []),
    ["Empresas", companies.join(", ") || "Todas as empresas disponíveis"],
    ...definition.filters.map((filter) => ["Filtro", filterLabel(dataset, filter)]),
    ["Gerado em", new Date().toLocaleString("pt-BR")],
    ["Dados de", result.dataAsOf ? new Date(result.dataAsOf).toLocaleString("pt-BR") : "—"],
    ["Hoje considerado", periodLabel(result.today)],
  ];
}

const fileName = (name: string, extension: string) => `${name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "bi"}-${new Date().toISOString().slice(0, 10)}.${extension}`;

export async function exportXlsx(name: string, dataset: Dataset | undefined, definition: ViewDefinition, result: QueryResult, companies: string[]) {
  const XLSX = await import("xlsx");
  const { header, rows } = matrixToSheet(result);
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = header.map((label, index) => ({ wch: index < Math.max(1, result.rowDims.length) ? 32 : Math.max(14, Math.min(label.length + 2, 28)) }));
  XLSX.utils.book_append_sheet(workbook, sheet, "Visão");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(filtersSheet(dataset, definition, result, companies)), "Filtros");
  XLSX.writeFile(workbook, fileName(name, "xlsx"));
}

/** CSV para o Excel em português: UTF-8 com BOM, ";" como separador e vírgula decimal. */
export function exportCsv(name: string, result: QueryResult) {
  const { header, rows } = matrixToSheet(result);
  const cell = (value: string | number | null) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return String(Math.round(value * 100) / 100).replace(".", ",");
    return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  const text = [header, ...rows].map((row) => row.map(cell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName(name, "csv");
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
