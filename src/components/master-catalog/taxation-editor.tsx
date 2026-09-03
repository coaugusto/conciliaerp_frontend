"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
import { Button, ErrorState } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { masterCatalogService, type MasterCatalogTaxationProfile, type TaxationEditableChanges } from "@/services/master-catalog.service";

// companyState/counterpartyState não são "origem"/"destino" fixos — são sempre "UF da empresa
// (cliente)" e "UF da contraparte", independente da direção da operação (numa entrada a
// contraparte é a origem; numa saída é o destino). Por isso o rótulo do formulário de edição usa
// os nomes reais do campo (ver taxationRoute() em master-catalog.service.ts, usado só na EXIBIÇÃO
// direcional, não aqui).
export const taxationEditFields: { key: keyof TaxationEditableChanges; label: string; type?: "number" }[] = [
  { key: "name", label: "Nome" }, { key: "companyState", label: "UF Empresa (cliente)" }, { key: "counterpartyState", label: "UF Contraparte" }, { key: "taxationType", label: "Tipo (código)" },
  { key: "cstIcms", label: "CST ICMS" }, { key: "cstIpi", label: "CST IPI" }, { key: "cstPis", label: "CST PIS" }, { key: "cstCofins", label: "CST COFINS" }, { key: "cfop", label: "CFOP" },
  { key: "icmsRate", label: "ICMS %", type: "number" }, { key: "icmsStRate", label: "ICMS ST %", type: "number" }, { key: "icmsStMvaPct", label: "MVA %", type: "number" },
  { key: "fcpRate", label: "FCP %", type: "number" }, { key: "difalRate", label: "DIFAL %", type: "number" },
];

/** Formulário de edição de um perfil de tributação (GlobalCatalogTaxation) — a linha é
 * compartilhada entre produtos, então salvar aqui atualiza a tributação para todos os produtos
 * vinculados a ela, não só o que está sendo visto no momento. Usado tanto no detalhe do produto
 * (/marketplace/products/[id]) quanto na fila de revisão (/catalog-review). */
export function TaxationEditForm({ profile, onCancel, onSaved, className }: { profile: MasterCatalogTaxationProfile; onCancel: () => void; onSaved: () => void; className?: string }) {
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(taxationEditFields.map(({ key }) => [key, profile[key] == null ? "" : String(profile[key])])));
  const save = useMutation({
    mutationFn: () => {
      const changes: TaxationEditableChanges = Object.fromEntries(taxationEditFields.map(({ key, type }) => [key, draft[key] === "" ? null : type === "number" ? Number(draft[key]) : draft[key]]));
      return masterCatalogService.updateTaxation(profile.id, changes);
    },
    onSuccess: () => { onSaved(); onCancel(); },
  });
  return (
    <div className={className}>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {taxationEditFields.map(({ key, label, type }) => (
          <label key={key} className="grid gap-1 text-xs font-medium text-slate-600">
            {label}
            <input type={type ?? "text"} step={type === "number" ? "0.01" : undefined} value={draft[key] ?? ""} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className="h-9 rounded-md border border-slate-300 px-2 text-sm font-normal text-slate-800" />
          </label>
        ))}
      </div>
      {save.isError && <div className="mt-3"><ErrorState message={getApiErrorMessage(save.error)} /></div>}
      <div className="mt-3 flex gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}><Save size={15} />{save.isPending ? "Salvando..." : "Salvar"}</Button>
        <Button variant="secondary" onClick={onCancel} disabled={save.isPending}><X size={15} />Cancelar</Button>
      </div>
    </div>
  );
}
