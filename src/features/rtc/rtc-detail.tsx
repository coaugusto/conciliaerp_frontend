"use client";

// Painel de detalhe de uma combinação: por que foi apontada, o que fazer, as sugestões com o item
// do anexo da LC 214/2025 e um item de nota de exemplo. Tudo vem pronto do servidor.

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button, ErrorState, PageLoader } from "@/components/shared/ui";
import { FieldHelp } from "@/components/help/field-help";
import { getApiErrorMessage } from "@/services/api/client";
import { rtcService, type RtcClassInfo } from "@/services/rtc.service";
import { SEVERITY, formatDay, formatNcm } from "./rtc-format";

const SAMPLE_LABELS: Record<string, string> = {
  DOCUMENT_NUMBER: "Nota", DOCUMENT_SERIES: "Série", ISSUE_DATE: "Emissão", ITEM_NUMBER: "Item", CFOP: "CFOP",
  CBS_CST: "CST", CCLASSTRIB: "cClassTrib", CBS_BASE: "Base CBS", CBS_RATE: "Alíq. CBS (%)", CBS_VALUE: "Valor CBS",
  IBS_BASE: "Base IBS", IBS_RATE: "Alíq. IBS (%)", IBS_VALUE: "Valor IBS",
};

export function RtcDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useQuery({ queryKey: ["rtc", "item", id], queryFn: () => rtcService.item(id) });
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  const item = detail.data;

  return <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/30" onClick={onClose}>
    <aside data-help="rtc-detalhe" role="dialog" aria-label="Detalhe da combinação" onClick={(event) => event.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-[#283456]">{item ? item.productName ?? `Produto ${item.productId}` : "Carregando..."}</h2>
          {item && <p className="text-xs text-slate-500">Cód. {item.productId} · NCM {formatNcm(item.ncm)}{item.ncmInfo ? ` — ${item.ncmInfo.description}` : ""}</p>}
        </div>
        <Button variant="ghost" aria-label="Fechar" onClick={onClose}><X size={16} /></Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {detail.isError ? <ErrorState message={getApiErrorMessage(detail.error)} /> : !item ? <PageLoader /> : <>
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Classificação praticada</h3>
            <div className="rounded-lg border border-slate-200 p-3">
              <p><span className="font-mono">CST {item.cst || "—"}</span>{item.cstInfo && <span className="text-slate-600"> — {item.cstInfo.description}</span>}</p>
              <p className="mt-1"><span className="font-mono">cClassTrib {item.classCode || "—"}</span>{item.current?.official && <span className="text-slate-600"> — {item.current.official.description}</span>}</p>
              <p className="mt-2 text-xs text-slate-500">{item.itemCount.toLocaleString("pt-BR")} itens de nota de saída, de {formatDay(item.firstIssue)} a {formatDay(item.lastIssue)}.</p>
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Situação</h3>
            {!item.rules.length ? <p className={cn("rounded-lg border p-3", SEVERITY.OK.card)}>Combinação de acordo com a tabela oficial.</p>
              : <ul className="space-y-2">{item.rules.map((rule) => <li key={rule.code} className={cn("rounded-lg border p-3", SEVERITY[rule.severity].card)}>
                <p className="font-semibold">{rule.title}</p>
                <p className="mt-1">{rule.explanation}</p>
                <p className="mt-1 font-medium">{rule.action}</p>
              </li>)}</ul>}
          </section>

          {item.suggestions.length > 0 && <section>
            <h3 className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-slate-500"><Lightbulb size={13} />cClassTrib sugeridos para o NCM <FieldHelp screen="rtc" field="sugestao" /></h3>
            <ul className="space-y-2">{item.suggestions.map((suggestion) => <Suggestion key={suggestion.code} info={suggestion} />)}</ul>
          </section>}

          {item.sample && <section>
            <h3 className="mb-1 text-xs font-semibold uppercase text-slate-500">Nota mais recente</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
              {Object.entries(item.sample).map(([key, value]) => <div key={key}>
                <dt className="text-xs text-slate-500">{SAMPLE_LABELS[key] ?? key}</dt>
                <dd className="font-mono text-xs">{key === "ISSUE_DATE" ? formatDay(String(value).slice(0, 10)) : String(value)}</dd>
              </div>)}
            </dl>
          </section>}
        </>}
      </div>
    </aside>
  </div>;
}

function Suggestion({ info }: { info: RtcClassInfo }) {
  return <li className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sky-950">
    <p><span className="font-mono font-semibold">{info.code}</span>{info.official && <span> — CST {info.official.cst} · {info.official.description}</span>}</p>
    {info.code === "000001" && !info.annex && <p className="mt-1 text-xs">Tributação integral, sem benefício: é a correta quando o produto não se enquadra em nenhum anexo de redução da LC 214/2025.</p>}
    {info.annex?.annexText && <p className="mt-1 text-xs">Anexo {info.annex.annexNumber}{info.annex.annexItem ? `, item ${info.annex.annexItem}` : ""} da LC 214/2025: {info.annex.annexText}</p>}
  </li>;
}
