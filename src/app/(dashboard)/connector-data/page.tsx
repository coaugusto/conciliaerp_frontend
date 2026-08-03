"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button, Card, ErrorState, PageHeader, StatusBadge } from "@/components/shared/ui";
import { connectorDataService, extractionTypes, type ExtractionRecord, type ExtractionType } from "@/services/connector-data.service";

const label = (type: string) => extractionTypes.find(([id]) => id === type)?.[1] ?? type;
const value = (payload: Record<string, unknown>, key: string) => payload[key] ?? payload[key.toUpperCase()] ?? payload[key.toLowerCase()];
const date = (raw: unknown) => raw ? new Date(String(raw)).toLocaleDateString("pt-BR") : "—";
const amount = (raw: unknown) => typeof raw === "number" || typeof raw === "string" && !Number.isNaN(Number(raw)) ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(raw)) : "—";
const escapeCsv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const cellValue = (value: unknown) => value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
const detailValue = (raw: unknown) => raw == null || raw === "" ? "—" : typeof raw === "object" ? <pre className="max-w-xl overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">{JSON.stringify(raw, null, 2)}</pre> : String(raw);
const download = (name: string, content: BlobPart, type: string) => { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); };

function exportRows(records: ExtractionRecord[], entityType: ExtractionType, format: "csv" | "xlsx") {
  const payloadKeys = [...new Set(records.flatMap(record => Object.keys(record.payload)))];
  const headers = ["Chave de origem", "Alteração no ERP", "Recebido em", ...payloadKeys];
  const rows = records.map(record => [record.sourceKey, record.sourceChangedAt ?? "", record.receivedAt, ...payloadKeys.map(key => cellValue(record.payload[key]))]);
  const suffix = entityType.toLowerCase();
  if (format === "csv") {
    download(`${suffix}.csv`, `\uFEFF${[headers, ...rows].map(row => row.map(escapeCsv).join(";")).join("\r\n")}`, "text/csv;charset=utf-8");
    return;
  }
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Dados importados");
  download(`${suffix}.xlsx`, XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

export default function ConnectorDataPage() {
  const [entityType, setEntityType] = useState<ExtractionType>("FINANCEIRO_TITULOS_V1");
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const summary = useQuery({ queryKey: ["connector-data-summary"], queryFn: connectorDataService.summary });
  const records = useQuery({ queryKey: ["connector-data", entityType], queryFn: () => connectorDataService.list(entityType) });
  const financial = entityType === "FINANCEIRO_TITULOS_V1";
  const payloadColumns = [...new Set(records.data?.items.flatMap(item => Object.keys(item.payload)) ?? [])].slice(0, 4);
  const exportData = async (format: "csv" | "xlsx") => {
    setExporting(format);
    try { exportRows(await connectorDataService.listAll(entityType), entityType, format); }
    finally { setExporting(null); }
  };

  return <>
    <PageHeader title="Dados extraídos do ERP" description="Dados recebidos pelo Connector, segregados por empresa e consulta." />
    {summary.isError ? <ErrorState message="Não foi possível carregar o resumo das extrações." /> : <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{summary.data?.map(item => <Card key={item.entityType} className="p-4"><p className="text-xs text-slate-500">{label(item.entityType)}</p><p className="mt-1 text-2xl font-semibold text-slate-800">{item.total.toLocaleString("pt-BR")}</p><p className="mt-2 text-xs text-slate-500">{item.lastReceivedAt ? `Recebido: ${new Date(item.lastReceivedAt).toLocaleString("pt-BR")}` : "Sem carga"}</p></Card>)}</div>}
    <Card className="overflow-x-auto p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="rounded border p-2 text-sm" value={entityType} onChange={event => { setEntityType(event.target.value as ExtractionType); setExpandedRecordId(null); }}>
          {extractionTypes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <StatusBadge value={records.isFetching ? "RUNNING" : "COMPLETED"} />
        <span className="text-sm text-slate-500">{records.data?.total ?? 0} registros</span>
        <div className="ml-auto flex gap-2"><Button variant="secondary" disabled={!records.data?.total || !!exporting} onClick={() => exportData("csv")}>{exporting === "csv" ? "Exportando..." : "Exportar CSV"}</Button><Button variant="secondary" disabled={!records.data?.total || !!exporting} onClick={() => exportData("xlsx")}>{exporting === "xlsx" ? "Exportando..." : "Exportar XLSX"}</Button></div>
      </div>
      {records.isError ? <ErrorState message="Não foi possível carregar os dados recebidos." /> : <table className="w-full min-w-max text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">{financial ? <><th className="p-3">Empresa</th><th className="p-3">Título</th><th className="p-3">Emissão</th><th className="p-3">Vencimento</th><th className="p-3 text-right">Valor original</th><th className="p-3 text-right">Em aberto</th></> : <>{payloadColumns.map(key => <th className="p-3" key={key}>{key.replaceAll("_", " ")}</th>)}<th className="p-3">Chave de origem</th></>}<th className="p-3">Recebido em</th><th className="p-3"><span className="sr-only">Detalhar registro</span></th></tr></thead><tbody>{records.data?.items.map(item => { const expanded = expandedRecordId === item.id; return <Fragment key={item.id}><tr className="border-b">{financial ? <><td className="p-3">{String(value(item.payload, "nroempresa") ?? "—")}</td><td className="p-3 font-mono text-xs">{String(value(item.payload, "nrotitulo") ?? "—")}</td><td className="p-3">{date(value(item.payload, "dtaemissao"))}</td><td className="p-3">{date(value(item.payload, "dtavencimento"))}</td><td className="p-3 text-right">{amount(value(item.payload, "vlroriginal"))}</td><td className="p-3 text-right">{amount(value(item.payload, "vlraberto"))}</td></> : <>{payloadColumns.map(key => <td className="max-w-52 truncate p-3" key={key} title={cellValue(item.payload[key])}>{cellValue(item.payload[key]) || "—"}</td>)}<td className="max-w-52 truncate p-3 font-mono text-xs" title={item.sourceKey}>{item.sourceKey}</td></>}<td className="p-3 whitespace-nowrap">{new Date(item.receivedAt).toLocaleString("pt-BR")}</td><td className="p-3"><Button variant="ghost" className="px-2" aria-expanded={expanded} aria-controls={`record-${item.id}`} onClick={() => setExpandedRecordId(expanded ? null : item.id)}>{expanded ? <><ChevronUp size={16} />Ocultar</> : <><ChevronDown size={16} />Detalhar</>}</Button></td></tr>{expanded && <tr id={`record-${item.id}`} className="border-b bg-slate-50"><td className="p-4" colSpan={financial ? 8 : payloadColumns.length + 3}><p className="mb-3 text-sm font-semibold text-slate-800">Dados completos do registro</p><div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500"><th className="p-3 text-left">Campo</th><th className="p-3 text-left">Valor</th></tr></thead><tbody><tr className="border-b border-slate-100"><td className="p-3 font-medium text-slate-600">Chave de origem</td><td className="p-3 font-mono text-xs">{item.sourceKey}</td></tr><tr className="border-b border-slate-100"><td className="p-3 font-medium text-slate-600">Alteração no ERP</td><td className="p-3">{item.sourceChangedAt ? new Date(item.sourceChangedAt).toLocaleString("pt-BR") : "—"}</td></tr>{Object.entries(item.payload).map(([key, raw]) => <tr className="border-b border-slate-100 last:border-0" key={key}><td className="p-3 align-top font-medium text-slate-600">{key}</td><td className="p-3 align-top">{detailValue(raw)}</td></tr>)}</tbody></table></div></td></tr>}</Fragment> })}</tbody></table>}
      {!records.isLoading && !records.data?.items.length && <p className="py-10 text-center text-sm text-slate-500">Nenhum lote desta consulta foi recebido ainda.</p>}
    </Card>
  </>;
}
