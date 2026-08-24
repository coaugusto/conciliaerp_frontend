"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronDown, FileCheck2, Search, ShieldCheck } from "lucide-react";
import { Button, Card, ErrorState, PageHeader } from "@/components/shared/ui";
import { validationRulesService, type ValidationRule } from "@/services/validation-rules.service";

const categories = { ALL: "Todas", CADASTRAL: "Cadastrais", FISCAL: "Fiscais", RELATIONSHIP: "Relacionamentos", DOCUMENT: "Documentos" } as const;
const categoryLabel: Record<ValidationRule["category"], string> = { CADASTRAL: "Cadastral", FISCAL: "Fiscal", RELATIONSHIP: "Relacionamento", DOCUMENT: "Documento" };
const severityLabel: Record<ValidationRule["severity"], string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" };

export default function ValidationRulesPage() {
  const rules = useQuery({ queryKey: ["validation-rules"], queryFn: validationRulesService.list });
  const [category, setCategory] = useState<keyof typeof categories>("ALL");
  const [search, setSearch] = useState("");
  const visible = useMemo(() => (rules.data ?? []).filter((rule) => (category === "ALL" || rule.category === category) && (!search.trim() || `${rule.name} ${rule.description} ${rule.appliesTo.join(" ")}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")))), [rules.data, category, search]);
  if (rules.isError) return <><PageHeader title="Regras de validação" description="Critérios utilizados nas análises cadastrais e fiscais." /><ErrorState /></>;

  return <>
    <PageHeader title="Regras de validação" description="Entenda o que o ConciliaERP verifica e quando cada pendência é gerada." />
    <Card className="mb-5 flex max-w-6xl flex-wrap items-center gap-3 p-4"><label className="flex h-10 min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3"><Search size={16} className="text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Pesquisar regra ou entidade" /></label><div className="flex flex-wrap gap-2">{Object.entries(categories).map(([value, label]) => <Button key={value} variant={category === value ? "primary" : "secondary"} onClick={() => setCategory(value as keyof typeof categories)}>{label}</Button>)}</div></Card>
    <div className="mb-5 grid max-w-6xl gap-3 sm:grid-cols-3"><Summary label="Regras cadastradas" value={rules.data?.length ?? 0} icon="shield" /><Summary label="Regras ativas" value={rules.data?.filter((rule) => rule.active).length ?? 0} icon="check" /><Summary label="Críticas ou altas" value={rules.data?.filter((rule) => rule.severity === "CRITICAL" || rule.severity === "HIGH").length ?? 0} icon="alert" /></div>
    {rules.isLoading ? <div className="max-w-6xl space-y-3">{[1,2,3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-slate-100" />)}</div> : <div className="max-w-6xl space-y-3">{visible.map((rule, index) => <RuleCard key={rule.id} rule={rule} defaultOpen={index === 0} />)}{!visible.length && <Card className="p-10 text-center text-sm text-slate-500">Nenhuma regra corresponde aos filtros.</Card>}</div>}
  </>;
}

function RuleCard({ rule, defaultOpen }: { rule: ValidationRule; defaultOpen: boolean }) { return <details open={defaultOpen || undefined} className="group overflow-hidden rounded-xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-start gap-4 p-5 marker:hidden"><span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg ${rule.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><FileCheck2 size={20} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-900">{rule.name}</h2><span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700">{categoryLabel[rule.category]}</span><span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{severityLabel[rule.severity]}</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${rule.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{rule.active ? "Ativa" : "Planejada"}</span></div><p className="mt-1 text-sm text-slate-500">{rule.description}</p><p className="mt-2 text-xs text-slate-500">Aplica-se a: {rule.appliesTo.join(" · ")}</p></div><ChevronDown size={20} className="mt-2 shrink-0 text-slate-500 transition-transform group-open:rotate-180" /></summary><div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-5 md:grid-cols-3"><Explanation title="O que é validado" text={rule.validation} tone="blue" /><Explanation title="Quando gera alerta" text={rule.alertCondition} tone="amber" /><Explanation title="Resultado esperado" text={rule.expectedResult} tone="emerald" /></div></details>; }
function Explanation({ title, text, tone }: { title: string; text: string; tone: "blue" | "amber" | "emerald" }) { const styles = { blue: "border-blue-200 bg-blue-50 text-blue-800", amber: "border-amber-200 bg-amber-50 text-amber-800", emerald: "border-emerald-200 bg-emerald-50 text-emerald-800" }; return <div className={`rounded-lg border p-4 ${styles[tone]}`}><strong className="text-xs uppercase tracking-wide">{title}</strong><p className="mt-2 text-sm leading-6 text-slate-700">{text}</p></div>; }
function Summary({ label, value, icon }: { label: string; value: number; icon: "shield" | "check" | "alert" }) { return <Card className="flex items-center gap-3 p-4">{icon === "shield" ? <ShieldCheck className="text-cyan-700" /> : icon === "check" ? <CheckCircle2 className="text-emerald-600" /> : <AlertTriangle className="text-amber-600" />}<div><strong className="block text-xl text-slate-900">{value}</strong><span className="text-sm text-slate-500">{label}</span></div></Card>; }
