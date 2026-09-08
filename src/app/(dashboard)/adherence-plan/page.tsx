"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Search } from "lucide-react";
import { Card, ErrorState, PageHeader, dateTime } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { adherencePlanService, type AdherencePlanItem, type AdherencePlanSection } from "@/services/adherence-plan.service";

const POSITIVE = new Set(["OK", "SIM", "CONFIGURADO"]);
const NEGATIVE = new Set(["PENDENTE", "NAO", "NÃO"]);

function itemTone(value: string): "positive" | "negative" | "neutral" {
  const normalized = value.trim().toUpperCase();
  if (POSITIVE.has(normalized)) return "positive";
  if (NEGATIVE.has(normalized) || normalized === "0") return "negative";
  return "neutral";
}
function sectionHasGap(section: AdherencePlanSection) {
  return section.items.length === 0 || section.items.some((item) => itemTone(item.value) === "negative");
}

export default function AdherencePlanPage() {
  const [search, setSearch] = useState("");
  const result = useQuery({ queryKey: ["adherence-plan"], queryFn: adherencePlanService.get });
  const sections = result.data?.sections ?? [];
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const visibleSections = useMemo(() => !term ? sections : sections.filter((section) =>
    `${section.code} ${section.title}`.toLocaleLowerCase("pt-BR").includes(term) ||
    section.items.some((item) => `${item.label} ${item.value}`.toLocaleLowerCase("pt-BR").includes(term))
  ), [sections, term]);
  const gaps = sections.filter(sectionHasGap).length;

  return <>
    <PageHeader title="Plano de Aderência" description="Processos do ERP configurados na base do cliente — use antes do go-live e em reuniões de status." />
    {result.isError && <ErrorState message={getApiErrorMessage(result.error)} />}
    {!result.isError && <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Processos verificados" value={sections.length} />
        <Metric label="Com pendência ou sem uso" value={gaps} tone="amber" />
        <div className="border-l-4 border-cyan-600 bg-white px-4 py-3"><p className="text-xs font-semibold uppercase text-slate-500">Última sincronização</p><p className="mt-1 text-sm font-semibold text-slate-900">{result.data?.lastSyncedAt ? dateTime(result.data.lastSyncedAt) : "Nunca sincronizado"}</p></div>
      </div>
      <label className="mb-5 flex h-10 w-full max-w-md items-center gap-2 rounded-lg border border-slate-300 px-3"><Search size={16} className="text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Buscar por processo ou item" /></label>
      {result.isLoading ? <p className="text-sm text-slate-500">Carregando...</p> : !sections.length ? <EmptyPlan /> : !visibleSections.length ? <p className="p-10 text-center text-sm text-slate-500">Nenhum processo corresponde à busca.</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleSections.map((section) => <SectionCard key={section.code} section={section} />)}</div>}
    </>}
  </>;
}

function Metric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "amber" }) {
  return <div className={`border-l-4 bg-white px-4 py-3 ${tone === "amber" ? "border-amber-500" : "border-cyan-600"}`}><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div>;
}

function EmptyPlan() {
  return <Card className="p-10 text-center"><ClipboardList size={28} className="mx-auto text-slate-400" /><p className="mt-3 font-semibold text-slate-800">Nenhuma sincronização de aderência ainda</p><p className="mt-1 text-sm text-slate-500">Execute a consulta ADHERENCE_PLAN_V1 em /connector-queries para este cliente.</p></Card>;
}

function SectionCard({ section }: { section: AdherencePlanSection }) {
  const gap = sectionHasGap(section);
  return <Card className={`p-4 ${gap ? "border-amber-200" : "border-emerald-200"}`}>
    <div className="mb-3 flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-semibold text-cyan-700">{section.code}</p><h3 className="mt-0.5 font-bold text-slate-900">{section.title}</h3></div>{gap && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">Verificar</span>}</div>
    {section.items.length ? <ul className="space-y-1.5">{section.items.map((item, index) => <ItemRow key={index} item={item} />)}</ul> : <p className="text-sm text-slate-500">Sem detalhamento retornado pela consulta.</p>}
  </Card>;
}

function ItemRow({ item }: { item: AdherencePlanItem }) {
  const tone = itemTone(item.value);
  const toneClass = tone === "positive" ? "bg-emerald-100 text-emerald-800" : tone === "negative" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
  return <li className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-600">{item.label}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass}`}>{item.value || "—"}</span></li>;
}
