"use client";

// Modelos prontos e visões salvas. Uma visão guarda só a definição (campos, filtros, períodos
// relativos), nunca os números: ao abrir, ela é recalculada com os dados do dia.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, ChevronDown, Save, Share2, Trash2, X } from "lucide-react";
import { Button, InlineLoader } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { biService, type BiTemplate, type BiView, type ViewDefinition } from "@/services/bi.service";

export type OpenedView = { kind: "template"; id: string; name: string } | { kind: "view"; id: string; name: string; mine: boolean; shared: boolean } | null;

export function ViewsMenu({ onOpen }: { onOpen: (definition: ViewDefinition, opened: OpenedView) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  const templates = useQuery({ queryKey: ["bi", "templates"], queryFn: biService.templates, staleTime: Infinity });
  const views = useQuery({ queryKey: ["bi", "views"], queryFn: biService.views, enabled: open });
  const remove = useMutation({ mutationFn: biService.deleteView, onSuccess: () => client.invalidateQueries({ queryKey: ["bi", "views"] }) });
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const pick = (definition: ViewDefinition, opened: OpenedView) => { onOpen(definition, opened); setOpen(false); };
  const mine = views.data?.filter((view) => view.mine) ?? [];
  const shared = views.data?.filter((view) => !view.mine) ?? [];
  return <div ref={ref} className="relative" data-help="bi-visoes">
    <Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}><BookOpen size={15} />Modelos e visões<ChevronDown size={14} /></Button>
    {open && <div className="absolute right-0 top-full z-40 mt-1 max-h-[70vh] w-[min(26rem,90vw)] overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
      <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Modelos prontos</p>
      {templates.data?.map((template: BiTemplate) => <button key={template.id} type="button" onClick={() => pick(template.definition, { kind: "template", id: template.id, name: template.name })} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-cyan-50">
        <span className="block text-sm font-semibold text-slate-800">{template.name}</span>
        <span className="block text-xs text-slate-500">{template.question}</span>
      </button>)}
      <ViewGroup title="Minhas visões" views={mine} loading={views.isLoading} onPick={pick} onDelete={(id) => remove.mutate(id)} />
      <ViewGroup title="Compartilhadas com o cliente" views={shared} loading={views.isLoading} onPick={pick} />
      {remove.isError && <p className="px-2 text-xs text-red-700">{getApiErrorMessage(remove.error)}</p>}
    </div>}
  </div>;
}

function ViewGroup({ title, views, loading, onPick, onDelete }: { title: string; views: BiView[]; loading: boolean; onPick: (definition: ViewDefinition, opened: OpenedView) => void; onDelete?: (id: string) => void }) {
  return <>
    <p className="mt-2 border-t border-slate-100 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
    {loading ? <div className="px-2 py-1"><InlineLoader /></div> : !views.length ? <p className="px-2 py-1 text-xs text-slate-400">Nenhuma.</p>
      : views.map((view) => <div key={view.id} className="flex items-center gap-1 rounded-lg hover:bg-cyan-50">
        <button type="button" onClick={() => onPick(view.definition, { kind: "view", id: view.id, name: view.name, mine: view.mine, shared: view.shared })} className="min-w-0 flex-1 px-2 py-1.5 text-left">
          <span className="flex items-center gap-1 truncate text-sm font-semibold text-slate-800">{view.name}{view.shared && <Share2 size={12} className="shrink-0 text-cyan-700" />}</span>
          <span className="block text-xs text-slate-500">{view.mine ? "Sua" : `De ${view.ownerName ?? "outro usuário"}`} · {new Date(view.updatedAt).toLocaleDateString("pt-BR")}</span>
        </button>
        {onDelete && <button type="button" onClick={() => { if (window.confirm(`Excluir a visão "${view.name}"?`)) onDelete(view.id); }} aria-label={`Excluir ${view.name}`} className="mr-1 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"><Trash2 size={14} /></button>}
      </div>)}
  </>;
}

export function SaveViewDialog({ definition, opened, onSaved, onClose }: { definition: ViewDefinition; opened: OpenedView; onSaved: (opened: OpenedView) => void; onClose: () => void }) {
  const client = useQueryClient();
  const canOverwrite = opened?.kind === "view" && opened.mine;
  const [mode, setMode] = useState<"update" | "new">(canOverwrite ? "update" : "new");
  const [name, setName] = useState(opened ? (canOverwrite ? opened.name : `${opened.name} (cópia)`) : "");
  const [shared, setShared] = useState(opened?.kind === "view" ? opened.shared : false);
  const save = useMutation({
    mutationFn: () => mode === "update" && opened?.kind === "view" ? biService.updateView(opened.id, { name: name.trim(), definition, shared }) : biService.createView({ name: name.trim(), definition, shared }),
    onSuccess: (view) => { client.invalidateQueries({ queryKey: ["bi", "views"] }); onSaved({ kind: "view", id: view.id, name: view.name, mine: true, shared: view.shared }); },
  });
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
    <form onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); if (name.trim()) save.mutate(); }} className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Salvar visão</h2><button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={16} /></button></div>
      {canOverwrite && <div className="mb-3 flex gap-3 text-sm">
        <label className="flex items-center gap-1"><input type="radio" checked={mode === "update"} onChange={() => { setMode("update"); setName(opened.name); }} />Atualizar &quot;{opened.name}&quot;</label>
        <label className="flex items-center gap-1"><input type="radio" checked={mode === "new"} onChange={() => { setMode("new"); setName(`${opened.name} (cópia)`); }} />Salvar como nova</label>
      </div>}
      <label className="block text-sm font-semibold text-slate-700">Nome<input autoFocus value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 font-normal" placeholder="Ex.: A receber da semana por loja" /></label>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} />Compartilhar com todos os usuários do cliente</label>
      <p className="mt-2 text-xs text-slate-500">A visão guarda os campos e os filtros, não os números. Períodos como &quot;próximos 10 dias&quot; acompanham a data de hoje.</p>
      {save.isError && <p className="mt-2 text-sm text-red-700">{getApiErrorMessage(save.error)}</p>}
      <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={!name.trim() || save.isPending}><Save size={14} />{save.isPending ? "Salvando..." : "Salvar"}</Button></div>
    </form>
  </div>;
}
