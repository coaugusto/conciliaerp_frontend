"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Database, FileText, PackageSearch } from "lucide-react";
import { Card, ErrorState, PageHeader, dateTime } from "@/components/shared/ui";
import { connectorTransmissionsService } from "@/services/connector-transmissions.service";

export default function ConnectorProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const recordId = decodeURIComponent(id);
  const record = useQuery({ queryKey: ["connector-transmission-record", recordId], queryFn: () => connectorTransmissionsService.record(recordId), enabled: Boolean(recordId), retry: false });

  if (record.isLoading) return <div className="space-y-4"><div className="h-24 animate-pulse rounded-xl bg-slate-100" /><div className="h-72 animate-pulse rounded-xl bg-slate-100" /></div>;
  if (record.isError || !record.data) return <><PageHeader title="Detalhes do produto importado" description="Registro recebido pelo Connector." /><ErrorState message="Não foi possível carregar este produto. O registro pode não existir ou não pertencer ao cliente selecionado." /><Link href="/connector-data" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:underline"><ArrowLeft size={16} />Voltar aos cadastros importados</Link></>;

  const item = record.data;
  const fiscal = [
    ["NCM", item.ncm], ["CEST", item.cest], ["CST ICMS", value(item.rawData.cstIcms)], ["CFOP", value(item.rawData.cfop)],
  ];
  const registration = [
    ["Descrição canônica", item.canonicalDescription], ["Descrição Consinco", item.consincoDescription], ["Descrição PDV", item.pdvDescription], ["GTIN / EAN", item.gtin], ["Marca", item.brand], ["Fabricante", item.manufacturer], ["Categoria", item.category], ["Unidade", item.unit],
  ];

  return <>
    <PageHeader title="Detalhes do produto importado" description="Cadastro recebido e analisado pelo Connector." action={<Link href="/connector-data" className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><ArrowLeft size={16} />Voltar</Link>} />
    <Card className="mb-5 border-cyan-200 bg-cyan-50/50 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><PackageSearch className="mt-0.5 text-cyan-700" /><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Produto importado</p><h2 className="mt-1 text-xl font-bold text-slate-900">{item.canonicalDescription}</h2><p className="mt-1 font-mono text-xs text-slate-500">Registro {item.id} · linha {item.rowNumber}</p></div></div><div className="rounded-lg bg-white px-4 py-2 text-right"><p className="text-xs uppercase text-slate-500">Confiança</p><strong className="text-lg text-slate-900">{Math.round(item.confidence * (item.confidence <= 1 ? 100 : 1))}%</strong></div></div></Card>
    <div className="grid gap-5 xl:grid-cols-2"><DetailCard icon="database" title="Cadastro do produto" rows={registration} /><DetailCard icon="file" title="Dados fiscais" rows={fiscal} /></div>
    <Card className="mt-5 overflow-hidden"><div className="border-b border-slate-200 p-4"><h2 className="font-bold text-slate-900">Origem da importação</h2></div><dl className="grid gap-4 p-5 text-sm md:grid-cols-2 xl:grid-cols-4"><Info label="Arquivo" value={item.execution.sourceName || "Carga local"} /><Info label="Tipo de entrada" value={item.execution.inputType} /><Info label="Status" value={item.execution.status} /><Info label="Recebido em" value={dateTime(item.execution.createdAt)} /></dl></Card>
    <details className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer px-5 py-4 font-semibold text-slate-800">Dados originais recebidos</summary><div className="overflow-x-auto border-t border-slate-200 bg-slate-50 p-5"><pre className="text-xs leading-6 text-slate-700">{JSON.stringify(item.rawData, null, 2)}</pre></div></details>
  </>;
}

function DetailCard({ title, rows, icon }: { title: string; rows: Array<Array<string | null>>; icon: "database" | "file" }) { const Icon = icon === "database" ? Database : FileText; return <Card className="overflow-hidden"><div className="flex items-center gap-2 border-b border-slate-200 p-4"><Icon size={19} className="text-cyan-700" /><h2 className="font-bold text-slate-900">{title}</h2></div><dl className="grid gap-x-5 sm:grid-cols-2">{rows.map(([label, fieldValue]) => <div key={label} className="border-b border-slate-100 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-800">{fieldValue || "Não informado"}</dd></div>)}</dl></Card>; }
function Info({ label, value: fieldValue }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-800">{fieldValue}</dd></div>; }
function value(fieldValue: unknown) { return fieldValue == null || fieldValue === "" ? null : String(fieldValue); }
