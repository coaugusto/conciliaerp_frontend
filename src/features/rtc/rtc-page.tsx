"use client";

// Reforma Tributária (docs/reforma-tributaria-validacao.md no backend). Tela enxuta por decisão do
// usuário: resumo + tabela paginada; motivo, sugestão e anexo ficam no painel de detalhe.
// Ajuda da tela: backend src/help-assistant/docs/rtc.ts.

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Play, Search } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button, Card, EmptyState, ErrorState, InlineLoader, Notice, PageHeader, PageLoader, dateTime } from "@/components/shared/ui";
import { FieldHelp } from "@/components/help/field-help";
import { getApiErrorMessage } from "@/services/api/client";
import { rtcService, type RtcRule, type RtcSeverity } from "@/services/rtc.service";
import { RtcDetailPanel } from "./rtc-detail";
import { RtcReferencePanel } from "./rtc-reference";
import { SEVERITY, formatNcm } from "./rtc-format";

const ORDER: RtcSeverity[] = ["HIGH", "MEDIUM", "INFO", "OK"];
const PAGE_SIZE = 25;
const number = (value: number) => value.toLocaleString("pt-BR");

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return debounced;
}

export function RtcPage() {
  const client = useQueryClient();
  const [tab, setTab] = useState<"cadastro" | "base">("cadastro");
  const [severity, setSeverity] = useState<RtcSeverity | undefined>();
  const [problem, setProblem] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const term = useDebounced(search.trim(), 350);

  const rules = useQuery({ queryKey: ["rtc", "rules"], queryFn: rtcService.rules, staleTime: Infinity });
  const status = useQuery({
    queryKey: ["rtc", "status"], queryFn: rtcService.status,
    // Enquanto a análise roda no servidor, acompanha a cada 3 s.
    refetchInterval: (query) => (["PENDING", "RUNNING"].includes(query.state.data?.run?.status ?? "") ? 3000 : false),
  });
  const running = ["PENDING", "RUNNING"].includes(status.data?.run?.status ?? "");
  const completedAt = status.data?.lastCompleted?.finishedAt;
  const items = useQuery({
    queryKey: ["rtc", "items", completedAt, severity, problem, term, page],
    queryFn: () => rtcService.items({ severity, problem: problem || undefined, search: term || undefined, page, pageSize: PAGE_SIZE }),
    enabled: !!completedAt, placeholderData: keepPreviousData,
  });
  const start = useMutation({ mutationFn: rtcService.start, onSuccess: () => client.invalidateQueries({ queryKey: ["rtc", "status"] }) });

  // Trocar de cliente no topo muda as empresas visíveis.
  useEffect(() => {
    const refresh = () => client.invalidateQueries({ queryKey: ["rtc"] });
    window.addEventListener("concilia:company-changed", refresh);
    window.addEventListener("concilia:tenant-changed", refresh);
    return () => { window.removeEventListener("concilia:company-changed", refresh); window.removeEventListener("concilia:tenant-changed", refresh); };
  }, [client]);

  const ruleByCode = useMemo(() => new Map((rules.data ?? []).map((rule) => [rule.code, rule])), [rules.data]);
  const stats = status.data?.stats;
  const pages = items.data ? Math.max(1, Math.ceil(items.data.total / PAGE_SIZE)) : 1;

  const action = <div className="flex flex-col items-end gap-1">
    <div className="flex items-center gap-1">
      <Button data-help="rtc-analisar" onClick={() => start.mutate()} disabled={running || start.isPending}><Play size={14} />{running ? "Analisando..." : "Analisar agora"}</Button>
      <FieldHelp screen="rtc" field="analisar" />
    </div>
    {completedAt && !running && <span className="text-xs text-slate-500">Última análise: {dateTime(completedAt)}</span>}
  </div>;

  return <>
    <PageHeader title="Reforma Tributária" description="IBS e CBS conferidos com a base oficial da Receita Federal." action={action} />

    <div data-help="rtc-abas" className="mb-4 flex gap-1 border-b border-slate-200">
      {([["cadastro", "Cadastro"], ["base", "Base oficial"]] as const).map(([id, label]) =>
        <button key={id} type="button" onClick={() => setTab(id)} className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-semibold", tab === id ? "border-[#075d70] text-[#075d70]" : "border-transparent text-slate-500 hover:text-slate-800")}>{label}</button>)}
      <span className="cursor-not-allowed px-4 py-2 text-sm text-slate-400" title="Próxima etapa: impacto em R$ por período, recalculado com o motor oficial.">Cenário (em breve)</span>
    </div>

    {start.isError && <div className="mb-3"><ErrorState message={getApiErrorMessage(start.error)} /></div>}
    {status.data?.run?.status === "FAILED" && <div className="mb-3"><ErrorState message={`A última análise falhou: ${status.data.run.error ?? "erro desconhecido"}`} /></div>}
    {status.data?.outdated && !running && <div className="mb-3"><Notice>A base oficial foi atualizada depois da última análise. Clique em Analisar agora para conferir com a versão nova.</Notice></div>}

    {tab === "base" ? <RtcReferencePanel /> : status.isLoading ? <PageLoader /> : status.isError ? <ErrorState message={getApiErrorMessage(status.error)} />
      : !completedAt ? <Card className="p-8 text-center">
          {running ? <InlineLoader label="Analisando as notas de saída..." /> : <>
            <p className="font-semibold text-slate-800">Nenhuma análise ainda</p>
            <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">A análise lê as notas de saída desde 01/01/2026 e confere cada combinação de produto, NCM, CST e cClassTrib uma única vez com a tabela oficial.</p>
            <Button className="mt-4" onClick={() => start.mutate()} disabled={start.isPending}><Play size={14} />Analisar agora</Button>
          </>}
        </Card>
      : <>
        <div data-help="rtc-resumo" className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ORDER.map((key) => <button key={key} type="button" aria-pressed={severity === key} onClick={() => { setSeverity(severity === key ? undefined : key); setProblem(""); setPage(1); }}
            className={cn("rounded-xl border p-3 text-left transition", SEVERITY[key].card, severity === key ? "ring-2 ring-[#075d70]" : "hover:brightness-95")}>
            <span className="text-xs font-semibold uppercase tracking-wide">{SEVERITY[key].label}</span>
            <span className="mt-1 block text-2xl font-bold">{number(stats?.bySeverity[key] ?? 0)}</span>
          </button>)}
        </div>
        <p className="mb-3 flex items-center gap-1 text-xs text-slate-500">
          {number(stats?.combinations ?? 0)} combinações de {number(stats?.products ?? 0)} produtos, em {number(stats?.items ?? 0)} itens de nota de saída. Cada combinação é conferida uma vez.
          <FieldHelp screen="rtc" field="combinacao" />
          {running && <InlineLoader label="Atualizando..." />}
        </p>

        <Card className="overflow-hidden">
          <div data-help="rtc-filtros" className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-2">
            <label className="relative">
              <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} maxLength={80} placeholder="Produto, NCM ou cClassTrib" aria-label="Buscar" className="h-8 w-64 rounded-md border border-slate-300 pl-7 pr-2 text-sm" />
            </label>
            <select value={problem} onChange={(event) => { setProblem(event.target.value); setSeverity(undefined); setPage(1); }} aria-label="Problema" className="h-8 rounded-md border border-slate-300 px-2 text-sm">
              <option value="">Todos os problemas</option>
              {(rules.data ?? []).map((rule) => <option key={rule.code} value={rule.code}>{rule.title}{stats?.byProblem[rule.code] ? ` (${number(stats.byProblem[rule.code])})` : ""}</option>)}
            </select>
            {(severity || problem || search) && <Button variant="ghost" onClick={() => { setSeverity(undefined); setProblem(""); setSearch(""); setPage(1); }}>Limpar</Button>}
            {items.isFetching && <InlineLoader label="" />}
          </div>

          <div data-help="rtc-tabela" className="overflow-x-auto">
            {items.isError ? <div className="p-3"><ErrorState message={getApiErrorMessage(items.error)} /></div>
              : !items.data ? <PageLoader />
              : !items.data.rows.length ? <EmptyState title="Nada encontrado" description="Ajuste a busca ou os filtros." />
              : <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>
                  <th className="p-2 pl-3">Produto</th><th className="p-2">NCM</th><th className="p-2">CST · cClassTrib</th><th className="p-2">Situação</th><th className="p-2 text-right pr-3">Itens</th>
                </tr></thead>
                <tbody>{items.data.rows.map((row, index) => <tr key={row.id} onClick={() => setOpenId(row.id)} className="cursor-pointer border-t border-slate-100 hover:bg-cyan-50/50">
                  <td className="p-2 pl-3"><button type="button" data-help-prepare={index === 0 ? "rtc-abrir-detalhe" : undefined} onClick={(event) => { event.stopPropagation(); setOpenId(row.id); }} className="text-left">
                    <span className="block font-medium text-slate-800">{row.productName ?? `Produto ${row.productId}`}</span>
                    <span className="text-xs text-slate-500">Cód. {row.productId}</span>
                  </button></td>
                  <td className="p-2 font-mono text-xs">{formatNcm(row.ncm)}</td>
                  <td className="p-2 font-mono text-xs">{row.cst || "—"} · {row.classCode || "—"}</td>
                  <td className="p-2"><ProblemLabel row={row} ruleByCode={ruleByCode} /></td>
                  <td className="p-2 pr-3 text-right tabular-nums">{number(row.itemCount)}</td>
                </tr>)}</tbody>
              </table>}
          </div>

          {items.data && items.data.total > PAGE_SIZE && <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-2 text-sm text-slate-600">
            <span>{number(items.data.total)} combinações · página {page} de {number(pages)}</span>
            <Button variant="secondary" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /></Button>
            <Button variant="secondary" aria-label="Próxima página" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={14} /></Button>
          </div>}
        </Card>
      </>}

    {openId && <RtcDetailPanel id={openId} onClose={() => setOpenId(null)} />}
  </>;
}

function ProblemLabel({ row, ruleByCode }: { row: { severity: RtcSeverity; problems: string[] }; ruleByCode: Map<string, RtcRule> }) {
  const first = row.problems[0];
  return <span className="inline-flex items-center gap-1.5">
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", SEVERITY[row.severity].badge)}>{SEVERITY[row.severity].label}</span>
    {first && <span className="text-slate-700">{ruleByCode.get(first)?.title ?? first}</span>}
    {row.problems.length > 1 && <span className="text-xs text-slate-500">+{row.problems.length - 1}</span>}
  </span>;
}
