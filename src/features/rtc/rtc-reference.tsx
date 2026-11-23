"use client";

// Aba "Base oficial": de onde vêm as regras (repositório da Receita, commit e versão da base).

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Card, ErrorState, Notice, PageLoader, dateTime } from "@/components/shared/ui";
import { FieldHelp } from "@/components/help/field-help";
import { getApiErrorMessage } from "@/services/api/client";
import { rtcService } from "@/services/rtc.service";
import { formatDay } from "./rtc-format";

const COUNTS: Array<[string, string]> = [["csts", "CST do IBS/CBS"], ["classifications", "Classificações (cClassTrib)"], ["ncms", "NCMs"], ["applicability", "Vínculos NCM × anexo"], ["exceptions", "Exceções de NCM"]];

export function RtcReferencePanel() {
  const reference = useQuery({ queryKey: ["rtc", "reference"], queryFn: rtcService.reference });
  if (reference.isLoading) return <PageLoader />;
  if (reference.isError) return <ErrorState message={getApiErrorMessage(reference.error)} />;
  const data = reference.data;
  if (!data) return <Notice>A base oficial ainda está sendo carregada no servidor. Tente de novo em instantes.</Notice>;
  return <Card data-help="rtc-base" className="p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">Versão da base <FieldHelp screen="rtc" field="base-oficial" /></p>
        <p className="text-2xl font-bold text-[#283456]">{data.dbVersion}</p>
        <p className="text-sm text-slate-600">Publicada pela Receita em {formatDay(data.dbDate)} · carregada em {dateTime(data.loadedAt)}</p>
      </div>
      <a href={`${data.source}/tree/${data.commit}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[#176a84] hover:underline">
        Calculadora de Tributos (Receita Federal) <ExternalLink size={13} />
      </a>
    </div>
    <dl className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {COUNTS.map(([key, label]) => <div key={key} className="rounded-lg bg-slate-50 p-3">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="text-lg font-semibold text-slate-800">{(data.counts[key] ?? 0).toLocaleString("pt-BR")}</dd>
      </div>)}
    </dl>
    <p className="mt-3 text-xs text-slate-500">Commit {data.commit.slice(0, 12)} · conferência sha256 {data.sha256.slice(0, 12)}… As tabelas vêm do repositório oficial publicado pela Portaria Cotec nº 342/2026 e só mudam numa atualização revisada do sistema.</p>
  </Card>;
}
