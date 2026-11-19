"use client";

// Configurações do BI que são escolha do cliente: a data de competência e o efeito de cada código de
// operação do ERP no caixa. Quem não é administrador vê, mas não altera (o servidor também recusa).

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { ErrorState, InlineLoader } from "@/components/shared/ui";
import { FieldHelp } from "@/components/help/field-help";
import { getApiErrorMessage } from "@/services/api/client";
import { biService, type CompetenceDate, type OperationKind } from "@/services/bi.service";

const COMPETENCE_OPTIONS: Array<{ value: CompetenceDate; label: string; detail: string }> = [
  { value: "ISSUE", label: "Emissão", detail: "Data de emissão do título." },
  { value: "ENTRY", label: "Lançamento", detail: "Data de lançamento/movimento do título no ERP." },
  { value: "ACCOUNTING", label: "Contabilização", detail: "Data contábil do título." },
  { value: "DUE", label: "Vencimento", detail: "Data de vencimento do título." },
];
const KIND_OPTIONS: Array<{ value: OperationKind; label: string }> = [
  { value: "SETTLEMENT", label: "Baixa (soma no caixa)" },
  { value: "INTEREST", label: "Juros/multa (soma)" },
  { value: "DISCOUNT", label: "Desconto (subtrai)" },
  { value: "REVERSAL", label: "Estorno (subtrai)" },
  { value: "IGNORE", label: "Não afeta o caixa" },
];

export function SettingsPanel({ canEdit, onClose }: { canEdit: boolean; onClose: () => void }) {
  const client = useQueryClient();
  const settings = useQuery({ queryKey: ["bi", "settings"], queryFn: biService.settings });
  const kinds = useQuery({ queryKey: ["bi", "operation-kinds"], queryFn: biService.operationKinds });
  // Mudar a competência ou o efeito de uma operação muda os números: recalcula as visões abertas.
  const refresh = () => { client.invalidateQueries({ queryKey: ["bi", "query"] }); client.invalidateQueries({ queryKey: ["bi", "status"] }); };
  const saveCompetence = useMutation({ mutationFn: biService.saveSettings, onSuccess: () => { client.invalidateQueries({ queryKey: ["bi", "settings"] }); refresh(); } });
  const saveKind = useMutation({ mutationFn: ({ code, kind }: { code: number; kind: OperationKind }) => biService.saveOperationKind(code, kind), onSuccess: () => { client.invalidateQueries({ queryKey: ["bi", "operation-kinds"] }); refresh(); } });
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  const pending = kinds.data?.filter((kind) => kind.source === "DEFAULT").length ?? 0;
  return <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/30" onClick={onClose}>
    <aside role="dialog" aria-label="Configurações do BI" onClick={(event) => event.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col overflow-auto bg-white p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Configurações do BI</h2><button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
      {!canEdit && <p className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Só o administrador do cliente altera estas configurações.</p>}

      <section className="mb-6">
        <h3 className="mb-1 flex items-center gap-1 font-semibold text-slate-800">Data de competência<FieldHelp screen="bi" field="data-competencia" /></h3>
        <p className="mb-2 text-sm text-slate-500">Usada nas despesas por competência e no campo Competência dos títulos.</p>
        {settings.isLoading ? <InlineLoader /> : <div className="grid gap-2 sm:grid-cols-2">
          {COMPETENCE_OPTIONS.map((option) => <label key={option.value} className={`flex cursor-pointer gap-2 rounded-lg border p-2 text-sm ${settings.data?.competenceDate === option.value ? "border-cyan-500 bg-cyan-50" : "border-slate-200"} ${!canEdit ? "cursor-not-allowed opacity-70" : ""}`}>
            <input type="radio" name="competence" disabled={!canEdit || saveCompetence.isPending} checked={settings.data?.competenceDate === option.value} onChange={() => saveCompetence.mutate(option.value)} />
            <span><b className="block text-slate-800">{option.label}</b><span className="text-xs text-slate-500">{option.detail}</span></span>
          </label>)}
        </div>}
        {saveCompetence.isError && <p className="mt-2 text-sm text-red-700">{getApiErrorMessage(saveCompetence.error)}</p>}
      </section>

      <section>
        <h3 className="mb-1 flex items-center gap-1 font-semibold text-slate-800">Efeito de cada operação no caixa<FieldHelp screen="bi" field="efeito-operacao" /></h3>
        <p className="mb-2 text-sm text-slate-500">O regime de caixa e o realizado do fluxo de caixa dependem desta tabela. {pending > 0 && <b className="text-amber-700">{pending} código{pending === 1 ? "" : "s"} ainda {pending === 1 ? "não foi conferido" : "não foram conferidos"}.</b>}</p>
        {kinds.isLoading ? <InlineLoader /> : kinds.isError ? <ErrorState message={getApiErrorMessage(kinds.error)} />
          : !kinds.data?.length ? <p className="text-sm text-slate-500">Nenhum código de operação recebido do ERP ainda.</p>
          : <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Descrição no ERP</th><th className="p-2 text-right">Movimentos</th><th className="p-2 text-left">Efeito</th></tr></thead>
            <tbody>{kinds.data.map((kind) => <tr key={kind.operationCode} className="border-t border-slate-100">
              <td className="p-2 font-mono text-xs">{kind.operationCode}</td>
              <td className="p-2">{kind.operationName ?? "—"}</td>
              <td className="p-2 text-right tabular-nums">{kind.operations.toLocaleString("pt-BR")}</td>
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <select aria-label={`Efeito da operação ${kind.operationCode}`} disabled={!canEdit || saveKind.isPending} value={kind.kind} onChange={(event) => saveKind.mutate({ code: kind.operationCode, kind: event.target.value as OperationKind })} className="h-8 rounded-md border border-slate-300 bg-white px-1 text-sm">
                    {KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  {kind.source === "DEFAULT" ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Sugerido</span> : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Conferido</span>}
                </div>
              </td>
            </tr>)}</tbody>
          </table>}
        {saveKind.isError && <p className="mt-2 text-sm text-red-700">{getApiErrorMessage(saveKind.error)}</p>}
      </section>
    </aside>
  </div>;
}
