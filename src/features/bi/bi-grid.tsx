"use client";

// Grade pivotada. Números, subtotais e totais vêm prontos do servidor. Clicar em um valor abre o
// detalhe daquele cruzamento (linha × coluna); o total da linha ou da coluna também detalha.
// Matrizes grandes (até 10 mil células) aparecem em blocos de 300 linhas.

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";
import type { QueryResult } from "@/services/bi.service";
import { KEY_SEPARATOR, dimensionValue, formatMeasure } from "./bi-format";

export type CellRef = { rowKey: string[]; columnKey: string[]; label: string; values: Array<number | null> };
const PAGE = 300;

export function PivotGrid({ result, onDrill }: { result: QueryResult; onDrill: (cell: CellRef) => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(PAGE);
  const M = result.measures.length;
  const R = result.rowDims.length;
  const hasColumns = result.columns.length > 0;

  const shownRows = useMemo(() => {
    if (!collapsed.size) return result.rows;
    return result.rows.filter((row) => {
      for (let level = 1; level < row.level; level++) if (collapsed.has(row.key.slice(0, level).join(KEY_SEPARATOR))) return false;
      return true;
    });
  }, [result.rows, collapsed]);

  const rowLabel = (key: string[]) => key.map((value, index) => dimensionValue(value, result.rowDims[index])).join(" › ");
  const columnLabel = (key: string[]) => key.map((value, index) => dimensionValue(value, result.columnDims[index])).join(" · ");
  const toggle = (key: string[]) => setCollapsed((set) => { const next = new Set(set); const id = key.join(KEY_SEPARATOR); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  // Cabeçalho das colunas: uma linha por campo de coluna, juntando valores iguais e vizinhos.
  const headerRows = result.columnDims.map((_, level) => {
    const groups: Array<{ label: string; span: number }> = [];
    result.columns.forEach((column, index) => {
      const prefix = column.key.slice(0, level + 1).join(KEY_SEPARATOR);
      const previous = index > 0 ? result.columns[index - 1].key.slice(0, level + 1).join(KEY_SEPARATOR) : null;
      if (prefix === previous) groups[groups.length - 1].span += M;
      else groups.push({ label: dimensionValue(column.key[level], result.columnDims[level]), span: M });
    });
    return groups;
  });

  // O tour abre o detalhe clicando no total geral (sempre existe quando há dados).
  const prepareIndex = result.grandTotal.total.findIndex((value) => value !== null);
  const cell = (values: Array<number | null> | undefined, rowKey: string[], columnKey: string[], label: string, strong = false) => result.measures.map((measure, index) => {
    const value = values?.[index] ?? null;
    const prepare = !rowKey.length && !columnKey.length && index === prepareIndex ? "bi-abrir-detalhe" : undefined;
    return <td key={`${columnKey.join(KEY_SEPARATOR)}-${index}`} className={cn("whitespace-nowrap border-l border-slate-100 px-2 py-1 text-right tabular-nums", strong && "font-semibold")}>
      {value === null ? <span className="text-slate-300">—</span>
        : <button type="button" data-help-prepare={prepare} onClick={() => onDrill({ rowKey, columnKey, label, values: values ?? [] })} title="Ver os títulos deste valor"
            className={cn("rounded px-1 hover:bg-cyan-50 hover:text-cyan-800 hover:underline", value < 0 && "text-red-700")}>{formatMeasure(value, measure.format)}</button>}
    </td>;
  });

  const valueColumns = (values: { cells: QueryResult["grandTotal"]["cells"]; total: Array<number | null> }, rowKey: string[], label: string, strong = false) => <>
    {result.columns.map((column) => <Fragment key={column.id}>{cell(values.cells[column.id], rowKey, column.key, `${label} · ${columnLabel(column.key)}`, strong)}</Fragment>)}
    {cell(values.total, rowKey, [], hasColumns ? `${label} · Total` : label, true)}
  </>;

  return <div className="max-h-[70vh] overflow-auto">
    <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
      <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-600">
        {headerRows.map((groups, level) => <tr key={level}>
          {level === 0 && <th rowSpan={headerRows.length + (M > 1 ? 1 : 0)} className="sticky left-0 z-20 border-b border-slate-200 bg-slate-50 px-2 py-2 text-left font-semibold">{result.rowDims.map((dim) => dim.label).join(" › ") || " "}</th>}
          {groups.map((group, index) => <th key={index} colSpan={group.span} className="border-b border-l border-slate-200 px-2 py-1.5 text-center font-semibold">{group.label}</th>)}
          {level === 0 && <th rowSpan={headerRows.length} colSpan={M} className="border-b border-l border-slate-200 bg-slate-100 px-2 py-1.5 text-center font-semibold">Total</th>}
        </tr>)}
        {(M > 1 || !hasColumns) && <tr>
          {!hasColumns && <th className="sticky left-0 z-20 border-b border-slate-200 bg-slate-50 px-2 py-2 text-left font-semibold">{result.rowDims.map((dim) => dim.label).join(" › ") || " "}</th>}
          {[...result.columns.map((column) => column.id), "__total"].flatMap((id) => result.measures.map((measure, index) => <th key={`${id}-${index}`} className={cn("whitespace-nowrap border-b border-l border-slate-200 px-2 py-1.5 text-right font-semibold", id === "__total" && hasColumns && "bg-slate-100")}>{measure.label}</th>))}
        </tr>}
      </thead>
      <tbody>
        {shownRows.slice(0, visible).map((row) => {
          const subtotal = row.level < R;
          const id = row.key.join(KEY_SEPARATOR);
          return <tr key={`${row.level}:${id}`} className={cn("hover:bg-slate-50", subtotal && "bg-slate-50/70")}>
            <th scope="row" className={cn("sticky left-0 z-[1] max-w-[22rem] truncate border-b border-slate-100 bg-white px-2 py-1 text-left font-normal text-slate-800", subtotal && "bg-slate-50 font-semibold")} style={{ paddingLeft: 8 + (row.level - 1) * 16 }} title={rowLabel(row.key)}>
              {subtotal
                ? <button type="button" onClick={() => toggle(row.key)} className="inline-flex items-center gap-1" aria-expanded={!collapsed.has(id)}>{collapsed.has(id) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}{dimensionValue(row.key[row.level - 1], result.rowDims[row.level - 1])}</button>
                : dimensionValue(row.key[row.level - 1], result.rowDims[row.level - 1])}
            </th>
            {valueColumns(row, row.key, rowLabel(row.key), subtotal)}
          </tr>;
        })}
        <tr className="bg-slate-100 font-semibold">
          <th scope="row" className="sticky bottom-0 left-0 z-[1] border-t border-slate-300 bg-slate-100 px-2 py-1.5 text-left">Total geral</th>
          {valueColumns(result.grandTotal, [], "Total geral", true)}
        </tr>
      </tbody>
    </table>
    {shownRows.length > visible && <div className="p-3 text-center"><button type="button" onClick={() => setVisible(visible + PAGE)} className="text-sm font-semibold text-cyan-700 hover:underline">Mostrar mais {Math.min(PAGE, shownRows.length - visible).toLocaleString("pt-BR")} linhas (de {shownRows.length.toLocaleString("pt-BR")})</button></div>}
  </div>;
}
