"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, Layers3, PackageSearch, Search, ShieldAlert } from "lucide-react";
import { Button, Card, ErrorState, PageHeader } from "@/components/shared/ui";
import { fiscalAlertsService, type FiscalAlertEntity, type FiscalAlertGroup, type FiscalAlertSeverity } from "@/services/fiscal-alerts.service";

const entityLabel: Record<FiscalAlertEntity, string> = { PRODUCT: "Produtos", TAXATION: "Tributações", FAMILY: "Famílias", SUPPLIER: "Fornecedores" };
const severityLabel: Record<FiscalAlertSeverity, string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" };
const severityStyle: Record<FiscalAlertSeverity, string> = { CRITICAL: "border-red-300 bg-red-50 text-red-800", HIGH: "border-orange-300 bg-orange-50 text-orange-800", MEDIUM: "border-amber-300 bg-amber-50 text-amber-800", LOW: "border-blue-300 bg-blue-50 text-blue-800" };

export default function FiscalAlertsPage() {
  const alerts = useQuery({ queryKey: ["fiscal-alerts", "summary"], queryFn: fiscalAlertsService.summary });
  const [selectedId, setSelectedId] = useState<string>();
  const [entity, setEntity] = useState<FiscalAlertEntity | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const visible = useMemo(() => (alerts.data ?? []).filter((group) => entity === "ALL" || group.entity === entity), [alerts.data, entity]);
  const selected = (alerts.data ?? []).find((group) => group.id === selectedId) ?? visible[0];
  if (alerts.isError) return <><PageHeader title="Central de Alertas" description="Pendências cadastrais e fiscais do cliente." /><ErrorState /></>;

  return <>
    <PageHeader title="Central de Alertas" description="Pendências identificadas nos produtos, tributações e cadastros do cliente." />
    <div className="mb-5 flex max-w-5xl flex-wrap gap-2">{(["ALL", "PRODUCT", "TAXATION", "FAMILY", "SUPPLIER"] as const).map((value) => <Button key={value} variant={entity === value ? "primary" : "secondary"} onClick={() => { setEntity(value); setSelectedId(undefined); }}>{value === "ALL" ? "Todas" : entityLabel[value]}</Button>)}</div>
    {alerts.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl bg-slate-100" />)}</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((group) => <AlertCard key={group.id} group={group} selected={selected?.id === group.id} select={() => setSelectedId(group.id)} />)}</div>}
    {selected && <Card className="mt-6 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">{entityLabel[selected.entity]} · {selected.field}</p><h2 className="mt-1 text-lg font-bold text-slate-900">{selected.title}</h2><p className="mt-1 text-sm text-slate-500">Comparação da situação atual com a sugestão de correção.</p></div><label className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3"><Search size={16} className="text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-48 bg-transparent text-sm outline-none" placeholder="Pesquisar nesta pendência" /></label></div><AlertItems group={selected} search={search} /></Card>}
  </>;
}

function AlertCard({ group, selected, select }: { group: FiscalAlertGroup; selected: boolean; select: () => void }) { return <button type="button" onClick={select} className="text-left"><Card className={`h-full p-5 transition hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md ${selected ? "border-cyan-600 ring-2 ring-cyan-100" : ""}`}><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-lg bg-cyan-50 text-cyan-700"><EntityIcon entity={group.entity} /></span><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${severityStyle[group.severity]}`}>{severityLabel[group.severity]}</span></div><strong className="mt-4 block text-slate-900">{group.title}</strong><p className="mt-1 min-h-10 text-sm text-slate-500">{group.description}</p><div className="mt-4 flex items-end justify-between"><span><b className="block text-2xl text-slate-900">{group.affected}</b><small className="text-slate-500">registros afetados</small></span><span className="text-xs font-semibold text-cyan-700">Ver De/Para →</span></div></Card></button>; }

function AlertItems({ group, search }: { group: FiscalAlertGroup; search: string }) { const term = search.trim().toLocaleLowerCase("pt-BR"); const items = group.items.filter((item) => !term || `${item.code} ${item.description} ${item.currentValue} ${item.suggestedValue}`.toLocaleLowerCase("pt-BR").includes(term)); return <div>{items.map((item) => <div key={item.id} className="border-b border-slate-100 p-5 last:border-0"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><strong className="text-slate-900">{item.description}</strong><p className="font-mono text-xs text-slate-500">{item.code}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{item.confidence}% de confiança</span></div><div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]"><Comparison label="De · situação atual" value={item.currentValue} tone="current" /><span className="grid place-items-center text-cyan-600"><ArrowRight size={20} /></span><Comparison label="Para · sugestão" value={item.suggestedValue} tone="suggested" /></div><p className="mt-3 text-xs text-slate-500">Fonte da sugestão: {item.source}</p></div>)}{!items.length && <p className="p-8 text-center text-sm text-slate-500">Nenhum registro corresponde à pesquisa.</p>}</div>; }
function Comparison({ label, value, tone }: { label: string; value: string; tone: "current" | "suggested" }) { return <div className={`rounded-lg border p-4 ${tone === "current" ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}><p className={`text-xs font-semibold uppercase tracking-wide ${tone === "current" ? "text-red-700" : "text-emerald-700"}`}>{label}</p><strong className="mt-1 block text-slate-900">{value}</strong></div>; }
function EntityIcon({ entity }: { entity: FiscalAlertEntity }) { if (entity === "PRODUCT") return <PackageSearch size={20} />; if (entity === "TAXATION") return <ShieldAlert size={20} />; if (entity === "FAMILY") return <Layers3 size={20} />; return <Building2 size={20} />; }
