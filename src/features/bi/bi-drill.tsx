"use client";

// Detalhe de uma célula: os títulos (ou lançamentos) que formam o valor clicado, de 50 em 50 por
// cursor. O topo mostra a quantidade e a soma recalculadas no servidor, que conferem com a célula.

import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { Button, ErrorState, InlineLoader } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { biService, type QueryResult, type ViewDefinition } from "@/services/bi.service";
import { formatDate, formatMeasure } from "./bi-format";
import type { CellRef } from "./bi-grid";

export function DrillPanel({ definition, result, cell, onClose }: { definition: ViewDefinition; result: QueryResult; cell: CellRef; onClose: () => void }) {
  const detail = useInfiniteQuery({
    queryKey: ["bi", "drill", definition, cell.rowKey, cell.columnKey],
    queryFn: ({ pageParam }) => biService.drill({ definition, rowKey: cell.rowKey, columnKey: cell.columnKey, cursor: pageParam, pageSize: 50 }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  const first = detail.data?.pages[0];
  const columns = first?.columns ?? [];
  const items = detail.data?.pages.flatMap((page) => page.items) ?? [];
  // Saldo acumulado não é a soma da célula: a conferência só vale para as demais medidas.
  const checks = result.measures.map((measure, index) => ({ measure, expected: cell.values[index], actual: first?.total?.measures[index] ?? null, comparable: !measure.key.endsWith(":cumsum") }));
  const matches = checks.every((check) => !check.comparable || check.expected === null || check.actual === null || Math.abs((check.expected ?? 0) - (check.actual ?? 0)) < 0.005);
  return <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/30" onClick={onClose}>
    <aside data-help="bi-detalhe" role="dialog" aria-label="Detalhe do valor" onClick={(event) => event.stopPropagation()} className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Detalhe</p>
          <h2 className="truncate text-lg font-semibold text-slate-900" title={cell.label}>{cell.label}</h2>
          {first?.total && <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <span>{first.total.count.toLocaleString("pt-BR")} registro{first.total.count === 1 ? "" : "s"}</span>
            {checks.filter((check) => check.comparable).map((check) => <span key={check.measure.key}>{check.measure.label}: <b className="text-slate-900">{formatMeasure(check.actual, check.measure.format)}</b></span>)}
            {matches
              ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} />confere com o valor clicado</span>
              : <span className="inline-flex items-center gap-1 text-amber-700"><CircleAlert size={14} />os dados mudaram desde a consulta; atualize a grade</span>}
          </p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar detalhe" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-auto">
        {detail.isLoading ? <div className="p-6"><InlineLoader label="Carregando os registros..." /></div>
          : detail.isError ? <div className="p-4"><ErrorState message={getApiErrorMessage(detail.error)} /></div>
          : <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600"><tr>{columns.map((column) => <th key={column.id} className={`whitespace-nowrap px-3 py-2 font-semibold ${column.format === "money" || column.format === "number" ? "text-right" : "text-left"}`}>{column.label}</th>)}</tr></thead>
            <tbody>{items.map((item, index) => <tr key={index} className="border-t border-slate-100">
              {columns.map((column) => <td key={column.id} className={`whitespace-nowrap px-3 py-1.5 ${column.format === "money" || column.format === "number" ? "text-right tabular-nums" : ""}`}>
                {column.format === "date" ? formatDate(item[column.id]) : column.format === "money" ? formatMeasure(item[column.id] as number | null, "money") : column.format === "number" ? formatMeasure(item[column.id] as number | null, "number") : String(item[column.id] ?? "—")}
              </td>)}
            </tr>)}</tbody>
          </table>}
        {!detail.isLoading && !items.length && !detail.isError && <p className="p-6 text-sm text-slate-500">Nenhum registro.</p>}
      </div>
      {detail.hasNextPage && <div className="border-t border-slate-200 p-3 text-center"><Button variant="secondary" disabled={detail.isFetchingNextPage} onClick={() => detail.fetchNextPage()}>{detail.isFetchingNextPage ? "Carregando..." : `Carregar mais (${items.length.toLocaleString("pt-BR")} de ${first?.total?.count.toLocaleString("pt-BR") ?? "?"})`}</Button></div>}
    </aside>
  </div>;
}
