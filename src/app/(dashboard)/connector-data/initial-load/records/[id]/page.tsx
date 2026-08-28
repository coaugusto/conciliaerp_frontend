"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Database } from "lucide-react";
import { Card, ErrorState, PageHeader, dateTime } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { connectorDataService, extractionTypes } from "@/services/connector-data.service";
import { consincoField } from "@/services/consinco-field-map";

export default function InitialLoadRecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const recordId = decodeURIComponent(id);
  const record = useQuery({ queryKey: ["connector-data-record", recordId], queryFn: () => connectorDataService.record(recordId), enabled: Boolean(recordId), retry: false });

  if (record.isLoading) return <div className="space-y-4"><div className="h-24 animate-pulse rounded-xl bg-slate-100" /><div className="h-72 animate-pulse rounded-xl bg-slate-100" /></div>;
  if (record.isError || !record.data) return <><PageHeader title="Detalhes do registro importado" description="Registro recebido pela carga inicial do Connector." /><ErrorState message={record.isError ? getApiErrorMessage(record.error) : "A API respondeu sem os dados do registro."} /><Link href="/connector-data" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:underline"><ArrowLeft size={16} />Voltar aos cadastros importados</Link></>;

  const item = record.data;
  const label = extractionTypes.find(([code]) => code === item.entityType)?.[1] ?? item.entityType;
  const entries = Object.entries(item.payload).filter(([key]) => !key.startsWith("_") && !key.startsWith("$"));

  return <>
    <PageHeader title="Detalhes do registro importado" description={`${label} · recebido pela carga inicial do Connector.`} action={<Link href="/connector-data" className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><ArrowLeft size={16} />Voltar</Link>} />
    <Card className="mb-5 border-cyan-200 bg-cyan-50/50 p-5"><div className="flex items-start gap-3"><Database className="mt-0.5 text-cyan-700" /><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">{item.entityType}</p><h2 className="mt-1 font-mono text-lg font-bold text-slate-900">{item.sourceKey}</h2><p className="mt-1 text-xs text-slate-500">Recebido {dateTime(item.receivedAt)}{item.sourceChangedAt ? ` · alterado na origem em ${dateTime(item.sourceChangedAt)}` : ""}</p></div></div></Card>
    <Card className="overflow-hidden"><div className="border-b border-slate-200 p-4"><h2 className="font-bold text-slate-900">Campos recebidos</h2></div>
      {!entries.length ? <p className="p-5 text-sm text-slate-500">Este registro não possui campos.</p> : <dl className="grid gap-x-5 sm:grid-cols-2">{entries.map(([key, fieldValue]) => { const source = consincoField(item.entityType, key); return <div key={key} className="border-b border-slate-100 p-4"><dt className="font-mono text-xs uppercase tracking-wide text-slate-500">{key}{source && <span className="ml-2 font-normal normal-case text-cyan-700">· {source}</span>}</dt><dd className="mt-1 text-sm font-medium text-slate-800">{formatValue(fieldValue)}</dd></div>; })}</dl>}
    </Card>
  </>;
}

function formatValue(fieldValue: unknown): string {
  if (fieldValue === null || fieldValue === undefined || fieldValue === "") return "Não informado";
  if (typeof fieldValue === "object") return JSON.stringify(fieldValue);
  return String(fieldValue);
}
