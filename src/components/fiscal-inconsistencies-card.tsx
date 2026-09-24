"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Card, ErrorState, PageLoader } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { fiscalInconsistenciesService } from "@/services/fiscal-inconsistencies.service";

// Fase 1: só a contagem por tipo (PKG_RFINTEGRACAONF/RF_INCONSISTENC, ver
// FISCAL_INCONSISTENCIES_V1 em consinco-query-catalog.ts) — sem abrir nota nem item ainda, por
// pedido explícito do cliente. Reaproveitado em /alerts e /adherence-plan.
export function FiscalInconsistenciesCard() {
  const summary = useQuery({ queryKey: ["fiscal-inconsistencies-summary"], queryFn: fiscalInconsistenciesService.summary });
  if (summary.isLoading) return <Card className="mb-5 p-4"><PageLoader label="Consultando inconsistências..." /></Card>;
  if (summary.isError) return <Card className="mb-5 p-4"><ErrorState message={getApiErrorMessage(summary.error)} /></Card>;
  if (!summary.data?.total) return null;
  return <Card className="mb-5 overflow-hidden border-amber-200 print:hidden">
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <h3 className="font-bold text-slate-900">Inconsistências fiscais abertas</h3>
          <p className="mt-0.5 text-sm text-slate-500">Integração Comercial × Fiscal (PKG_RFINTEGRACAONF) — quantidade de notas/itens por tipo de problema.</p>
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">{summary.data.total}</span>
    </div>
    <ul className="divide-y divide-slate-100 border-t border-slate-200">
      {summary.data.types.map((type) => <li key={type.code} className="flex items-center justify-between gap-3 p-3 text-sm">
        <span className="text-slate-700">{type.description}</span>
        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">{type.count}</span>
      </li>)}
    </ul>
  </Card>;
}
