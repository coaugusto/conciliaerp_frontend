"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, ChevronDown, FileText, Printer, Trash2, X } from "lucide-react";
import { Button, Card, ErrorState, dateTime, money } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { adjustmentSuggestionsService, type AdjustmentCatalogItem, type AdjustmentOrigin, type AdjustmentProposalDetail, type AdjustmentProposalStatus } from "@/services/adjustment-suggestions.service";

const statusLabel: Record<AdjustmentProposalStatus, string> = { DRAFT: "Rascunho", SENT: "Enviada", ACCEPTED: "Aceita", REJECTED: "Rejeitada" };
const statusClass: Record<AdjustmentProposalStatus, string> = { DRAFT: "bg-slate-100 text-slate-700", SENT: "bg-cyan-50 text-cyan-700", ACCEPTED: "bg-emerald-50 text-emerald-700", REJECTED: "bg-red-50 text-red-700" };
type CartEntry = { item: AdjustmentCatalogItem; origin: AdjustmentOrigin; scheduledDate: string };

function suggestedDate(hours: number): string {
  const days = Math.max(1, Math.ceil(hours / 8));
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
function parseNumber(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function AdjustmentSuggestionsCard({ tenantId, companyId, tenantName, cncCode }: { tenantId: string; companyId?: string; tenantName: string; cncCode: string }) {
  const queryClient = useQueryClient();
  const catalog = useQuery({ queryKey: ["adjustment-catalog", tenantId], queryFn: adjustmentSuggestionsService.catalog });
  const proposals = useQuery({ queryKey: ["adjustment-proposals", tenantId], queryFn: adjustmentSuggestionsService.listProposals });
  const [openProposalId, setOpenProposalId] = useState<string | null>(null);
  const proposalDetail = useQuery({ queryKey: ["adjustment-proposal", openProposalId], queryFn: () => adjustmentSuggestionsService.getProposal(openProposalId as string), enabled: !!openProposalId });
  const [cart, setCart] = useState<Record<string, CartEntry>>({});

  const invalidateCatalog = () => queryClient.invalidateQueries({ queryKey: ["adjustment-catalog", tenantId] });
  const invalidateProposals = () => queryClient.invalidateQueries({ queryKey: ["adjustment-proposals", tenantId] });
  const savePricing = useMutation({ mutationFn: (input: { itemCode: string; estimatedHours: number; hourlyRate: number }) => adjustmentSuggestionsService.upsertPricing(input), onSuccess: invalidateCatalog });
  const createProposal = useMutation({
    mutationFn: () => adjustmentSuggestionsService.createProposal({ companyId, items: Object.values(cart).map(({ item, origin, scheduledDate }) => ({ itemCode: item.itemCode, title: item.title, origin, affected: item.affected, estimatedHours: item.estimatedHours ?? 0, hourlyRate: item.hourlyRate ?? 0, scheduledDate: scheduledDate || undefined })) }),
    onSuccess: (created) => { setCart({}); invalidateProposals(); setOpenProposalId(created.id); },
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdjustmentProposalStatus }) => adjustmentSuggestionsService.setProposalStatus(id, status),
    onSuccess: () => { invalidateProposals(); queryClient.invalidateQueries({ queryKey: ["adjustment-proposal", openProposalId] }); },
  });
  const removeProposal = useMutation({ mutationFn: (id: string) => adjustmentSuggestionsService.deleteProposal(id), onSuccess: () => { setOpenProposalId(null); invalidateProposals(); } });

  const toggleCart = (item: AdjustmentCatalogItem, origin: AdjustmentOrigin) => setCart((current) => {
    const next = { ...current };
    if (next[item.itemCode]) delete next[item.itemCode];
    else next[item.itemCode] = { item, origin, scheduledDate: item.estimatedHours ? suggestedDate(item.estimatedHours) : "" };
    return next;
  });
  const setCartDate = (itemCode: string, value: string) => setCart((current) => current[itemCode] ? { ...current, [itemCode]: { ...current[itemCode], scheduledDate: value } } : current);
  const removeFromCart = (itemCode: string) => setCart((current) => { const next = { ...current }; delete next[itemCode]; return next; });

  const cartEntries = Object.values(cart);
  const cartTotal = useMemo(() => cartEntries.reduce((sum, { item }) => sum + (item.totalCost ?? 0), 0), [cartEntries]);
  const cartHours = useMemo(() => cartEntries.reduce((sum, { item }) => sum + (item.estimatedHours ?? 0), 0), [cartEntries]);

  if (catalog.isError || proposals.isError) return <ErrorState message="Não foi possível carregar a sugestão de ajustes." />;

  return <>
    <div className="print:hidden">
      <Card className="mb-5 p-5">
        <h2 className="font-bold text-slate-900">Propostas de ajuste</h2>
        <p className="mt-1 text-sm text-slate-500">Orçamentos salvos com o cliente — abra um para revisar, mudar o status ou gerar o contrato.</p>
        {proposals.isLoading ? <p className="mt-4 text-sm text-slate-500">Carregando...</p> : !proposals.data?.length ? <p className="mt-4 text-sm text-slate-500">Nenhuma proposta criada ainda.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">{["Criada em", "Status", "Itens", "Horas", "Total", ""].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{proposals.data.map((proposal) => <tr key={proposal.id} className="border-t border-slate-100"><td className="p-3">{dateTime(proposal.createdAt)}</td><td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[proposal.status]}`}>{statusLabel[proposal.status]}</span></td><td className="p-3">{proposal.itemCount}</td><td className="p-3">{proposal.totalHours}h</td><td className="p-3 font-semibold">{money(proposal.totalCost)}</td><td className="p-3 text-right"><Button variant="secondary" onClick={() => setOpenProposalId(proposal.id)}>Abrir</Button></td></tr>)}</tbody></table></div>}
      </Card>

      <Card className="mb-5 p-5">
        <div className="flex items-start gap-3"><Calculator className="mt-0.5 text-cyan-700" size={22} /><div><h2 className="font-bold text-slate-900">Nova proposta</h2><p className="mt-1 text-sm text-slate-500">Configure horas e valor/hora de cada item, marque o que o cliente vai fechar agora e salve o orçamento.</p></div></div>
        <CatalogSection title="Alertas fiscais e cadastrais" items={catalog.data?.fiscalAlerts ?? []} origin="FISCAL_ALERT" cart={cart} onToggle={toggleCart} onSavePricing={(itemCode, estimatedHours, hourlyRate) => savePricing.mutate({ itemCode, estimatedHours, hourlyRate })} saving={savePricing.isPending} />
        <CatalogSection title="Plano de Aderência (processos não configurados)" items={catalog.data?.adherenceGaps ?? []} origin="ADHERENCE_GAP" cart={cart} onToggle={toggleCart} onSavePricing={(itemCode, estimatedHours, hourlyRate) => savePricing.mutate({ itemCode, estimatedHours, hourlyRate })} saving={savePricing.isPending} />
        {!!cartEntries.length && <div className="mt-5 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
          <h3 className="font-bold text-slate-900">Itens marcados ({cartEntries.length})</h3>
          <ul className="mt-3 divide-y divide-cyan-100">{cartEntries.map(({ item, scheduledDate }) => <li key={item.itemCode} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"><div><span className="font-semibold text-slate-800">{item.title}</span><span className="ml-2 text-slate-500">{item.estimatedHours}h × {money(item.hourlyRate ?? 0)} = {money(item.totalCost ?? 0)}</span></div><div className="flex items-center gap-2"><label className="text-xs text-slate-500">Data prevista<input type="date" value={scheduledDate} onChange={(event) => setCartDate(item.itemCode, event.target.value)} className="ml-2 h-8 rounded-md border border-slate-300 px-2 text-sm" /></label><button type="button" onClick={() => removeFromCart(item.itemCode)} aria-label={`Remover ${item.title}`} className="text-slate-400 hover:text-red-600"><X size={16} /></button></div></li>)}</ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-cyan-200 pt-3"><strong className="text-slate-900">Total: {cartHours}h · {money(cartTotal)}</strong><Button onClick={() => createProposal.mutate()} disabled={createProposal.isPending}>{createProposal.isPending ? "Salvando..." : "Salvar orçamento"}</Button></div>
          {createProposal.isError && <div className="mt-3"><ErrorState message={getApiErrorMessage(createProposal.error)} /></div>}
        </div>}
      </Card>
    </div>

    {openProposalId && proposalDetail.data && <ProposalDetail proposal={proposalDetail.data} tenantName={tenantName} cncCode={cncCode} onClose={() => setOpenProposalId(null)} onStatus={(status) => setStatus.mutate({ id: proposalDetail.data.id, status })} onDelete={() => removeProposal.mutate(proposalDetail.data.id)} statusPending={setStatus.isPending} deletePending={removeProposal.isPending} />}
  </>;
}

function CatalogSection({ title, items, origin, cart, onToggle, onSavePricing, saving }: { title: string; items: AdjustmentCatalogItem[]; origin: AdjustmentOrigin; cart: Record<string, CartEntry>; onToggle: (item: AdjustmentCatalogItem, origin: AdjustmentOrigin) => void; onSavePricing: (itemCode: string, hours: number, rate: number) => void; saving: boolean }) {
  const [open, setOpen] = useState(true);
  if (!items.length) return null;
  return <div className="mt-5 rounded-xl border border-slate-200">
    <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 p-4 text-left" aria-expanded={open}>
      <span className="font-bold text-slate-900">{title} <span className="ml-1 font-normal text-slate-500">({items.length})</span></span>
      <ChevronDown size={18} className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <ul className="divide-y divide-slate-100 border-t border-slate-200">{items.map((item) => <CatalogRow key={item.itemCode} item={item} checked={!!cart[item.itemCode]} onToggle={() => onToggle(item, origin)} onSavePricing={onSavePricing} saving={saving} />)}</ul>}
  </div>;
}

function CatalogRow({ item, checked, onToggle, onSavePricing, saving }: { item: AdjustmentCatalogItem; checked: boolean; onToggle: () => void; onSavePricing: (itemCode: string, hours: number, rate: number) => void; saving: boolean }) {
  const [hours, setHours] = useState(item.estimatedHours != null ? String(item.estimatedHours) : "");
  const [rate, setRate] = useState(item.hourlyRate != null ? String(item.hourlyRate) : "");
  const parsedHours = parseNumber(hours);
  const parsedRate = parseNumber(rate);
  const dirty = parsedHours !== item.estimatedHours || parsedRate !== item.hourlyRate;
  return <li className="flex flex-wrap items-center gap-3 p-3 text-sm">
    <input type="checkbox" checked={checked} onChange={onToggle} disabled={!item.configured} className="size-4 shrink-0 accent-cyan-700" aria-label={`Selecionar ${item.title}`} />
    <div className="min-w-48 flex-1"><span className="font-semibold text-slate-800">{item.title}</span><span className="ml-2 text-xs text-slate-500">{item.affected} pendente(s){item.severity ? ` · ${item.severity}` : ""}{item.estimatedImpact ? ` · impacto estimado ${money(item.estimatedImpact)}` : ""}</span></div>
    <label className="text-xs text-slate-500">Horas<input type="text" inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} className="ml-2 h-8 w-20 rounded-md border border-slate-300 px-2 text-sm" /></label>
    <label className="text-xs text-slate-500">Valor/hora<input type="text" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} className="ml-2 h-8 w-24 rounded-md border border-slate-300 px-2 text-sm" /></label>
    <span className="w-28 shrink-0 text-right font-semibold text-slate-700">{parsedHours != null && parsedRate != null ? money(parsedHours * parsedRate) : "—"}</span>
    {dirty && <Button variant="secondary" onClick={() => { if (parsedHours != null && parsedRate != null) onSavePricing(item.itemCode, parsedHours, parsedRate); }} disabled={saving || parsedHours == null || parsedRate == null}>{saving ? "Salvando..." : "Salvar"}</Button>}
    {!item.configured && !dirty && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Configurar horas/valor</span>}
  </li>;
}

function ProposalDetail({ proposal, tenantName, cncCode, onClose, onStatus, onDelete, statusPending, deletePending }: { proposal: AdjustmentProposalDetail; tenantName: string; cncCode: string; onClose: () => void; onStatus: (status: AdjustmentProposalStatus) => void; onDelete: () => void; statusPending: boolean; deletePending: boolean }) {
  const totalHours = proposal.items.reduce((sum, item) => sum + item.estimatedHours, 0);
  const totalCost = proposal.items.reduce((sum, item) => sum + item.totalCost, 0);
  return <Card className="mb-5 overflow-hidden print:break-inside-avoid">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5 print:hidden">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Proposta</p><h2 className="mt-1 text-lg font-bold text-slate-900">Contrato de serviço</h2></div>
      <div className="flex flex-wrap gap-2">
        {proposal.status === "DRAFT" && <Button variant="secondary" onClick={() => onStatus("SENT")} disabled={statusPending}>Marcar como enviada</Button>}
        {proposal.status === "SENT" && <><Button onClick={() => onStatus("ACCEPTED")} disabled={statusPending}>Marcar como aceita</Button><Button variant="secondary" onClick={() => onStatus("REJECTED")} disabled={statusPending}>Marcar como rejeitada</Button></>}
        {proposal.status === "DRAFT" && <Button variant="danger" onClick={onDelete} disabled={deletePending}><Trash2 size={16} />Excluir rascunho</Button>}
        <Button variant="secondary" onClick={() => window.print()}><Printer size={16} />Gerar contrato</Button>
        <Button variant="ghost" onClick={onClose} aria-label="Fechar"><X size={18} /></Button>
      </div>
    </div>
    <div className="p-5">
      <div className="mb-4 flex items-center gap-2 print:mb-6"><FileText className="text-cyan-700 print:hidden" size={20} /><div><h3 className="text-xl font-bold text-slate-900">Contrato de Serviço</h3><p className="text-sm text-slate-500">Cliente: {tenantName} ({cncCode}) · Proposta criada em {dateTime(proposal.createdAt)} · Status: {statusLabel[proposal.status]}</p></div></div>
      <table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-300 text-xs uppercase text-slate-500">{["Item", "Horas", "Valor/hora", "Total", "Data prevista"].map((label) => <th key={label} className="py-2">{label}</th>)}</tr></thead><tbody>{proposal.items.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="py-2">{item.title}</td><td className="py-2">{item.estimatedHours}h</td><td className="py-2">{money(item.hourlyRate)}</td><td className="py-2 font-semibold">{money(item.totalCost)}</td><td className="py-2">{item.scheduledDate ? dateTime(item.scheduledDate) : "A combinar"}</td></tr>)}</tbody></table>
      <div className="mt-4 flex justify-end"><strong className="text-lg text-slate-900">Total geral: {totalHours}h · {money(totalCost)}</strong></div>
    </div>
  </Card>;
}
