"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Mail, Receipt, RefreshCw, Settings2 } from "lucide-react";
import { Button, Card, ErrorState, PageLoader } from "@/components/shared/ui";
import { FieldHelp } from "@/components/help/field-help";
import { getApiErrorMessage } from "@/services/api/client";
import { billingService, type BillingContract, type BillingInvoice, type BillingInvoiceStatus } from "@/services/billing.service";

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (value: string) => value.slice(0, 10).split("-").reverse().join("/");
const monthLabel = (reference: string) => reference.split("-").reverse().join("/");
const STATUS: Record<BillingInvoiceStatus, { label: string; className: string }> = {
  PENDING: { label: "Em aberto", className: "bg-sky-100 text-sky-800" },
  PAID: { label: "Pago", className: "bg-emerald-100 text-emerald-800" },
  OVERDUE: { label: "Em atraso", className: "bg-red-100 text-red-800" },
  CANCELED: { label: "Cancelado", className: "bg-slate-100 text-slate-600" },
  FAILED: { label: "Falhou", className: "bg-amber-100 text-amber-800" },
};

// Aba "Financeiro" do Portal do Cliente. A equipe interna (ADMIN) configura a mensalidade e gera
// boletos; o administrador do cliente vê as faturas e abre o boleto.
export function BillingCard({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const summary = useQuery({ queryKey: ["billing"], queryFn: billingService.summary });
  const [editing, setEditing] = useState(false);
  const refreshList = () => queryClient.invalidateQueries({ queryKey: ["billing"] });
  const issue = useMutation({ mutationFn: (reference?: string) => billingService.issue(reference), onSuccess: refreshList });
  const refresh = useMutation({ mutationFn: billingService.refresh, onSuccess: refreshList });
  const resend = useMutation({ mutationFn: billingService.resendEmail, onSuccess: refreshList });
  const actionError = issue.error ?? refresh.error ?? resend.error;

  if (summary.isLoading) return <Card className="p-8"><PageLoader label="Carregando cobrança..." /></Card>;
  if (summary.isError) return <ErrorState message={getApiErrorMessage(summary.error)} />;
  const { contract, nextDue, invoices } = summary.data!;
  const overdue = invoices.filter(invoice => invoice.status === "OVERDUE");

  return <Card className="overflow-hidden">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5">
      <div className="flex items-start gap-3"><Receipt className="mt-0.5 text-cyan-700" size={22} /><div>
        <h2 className="font-bold text-slate-900">Mensalidade e boletos</h2>
        {contract ? <p data-help="cobranca-resumo" className="mt-1 text-sm text-slate-600">{money(contract.monthlyAmountCents)} por mês · vence todo dia {contract.dueDay} · boleto gerado {contract.issueDaysBefore} dias antes e enviado para {contract.payerEmails.join(", ")}{!contract.active && <b className="ml-1 text-amber-700">(cobrança desativada)</b>}</p>
          : <p className="mt-1 text-sm text-slate-500">{canManage ? "Cobrança ainda não configurada para este cliente." : "Nenhuma cobrança configurada."}</p>}
        {contract?.active && nextDue && <p className="mt-1 text-xs text-slate-500">Próximo vencimento: {brDate(nextDue.dueDate)} (referência {monthLabel(nextDue.reference)})</p>}
      </div></div>
      {canManage && <div className="flex flex-wrap gap-2">
        <Button variant="secondary" data-help="cobranca-configurar" onClick={() => setEditing(true)}><Settings2 size={16} />{contract ? "Editar cobrança" : "Configurar cobrança"}</Button>
        {contract?.active && <Button data-help="cobranca-gerar" disabled={issue.isPending} onClick={() => { if (confirm(`Gerar o boleto de ${nextDue ? monthLabel(nextDue.reference) : "próximo vencimento"} agora e enviar por e-mail?`)) issue.mutate(undefined); }}>{issue.isPending ? "Gerando..." : "Gerar boleto do próximo vencimento"}</Button>}
      </div>}
    </div>
    {overdue.length > 0 && <p className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800">{overdue.length} fatura(s) em atraso: {overdue.map(invoice => `${monthLabel(invoice.reference)} (${money(invoice.amountCents)})`).join(", ")}. O acesso do cliente continua liberado; a decisão é manual.</p>}
    {actionError && <div className="p-4"><ErrorState message={getApiErrorMessage(actionError)} /></div>}
    <div className="overflow-x-auto" data-help="cobranca-faturas">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Referência</th><th className="p-3">Vencimento</th><th className="p-3">Valor</th><th className="p-3">Situação <FieldHelp screen="commercial" field="cobranca-situacao" /></th><th className="p-3 text-right">Ações</th></tr></thead>
        <tbody>{invoices.map(invoice => <InvoiceRow key={invoice.id} invoice={invoice} canManage={canManage} busy={issue.isPending || refresh.isPending || resend.isPending}
          onRefresh={() => refresh.mutate(invoice.id)} onResend={() => resend.mutate(invoice.id)} onReissue={() => { if (confirm(`Gerar um novo boleto para ${monthLabel(invoice.reference)}?`)) issue.mutate(invoice.reference); }} />)}</tbody>
      </table>
      {!invoices.length && <p className="p-6 text-center text-sm text-slate-500">Nenhum boleto gerado ainda.</p>}
    </div>
    {editing && <ContractDialog initial={contract} close={() => setEditing(false)} saved={() => { setEditing(false); void refreshList(); }} />}
  </Card>;
}

function InvoiceRow({ invoice, canManage, busy, onRefresh, onResend, onReissue }: { invoice: BillingInvoice; canManage: boolean; busy: boolean; onRefresh: () => void; onResend: () => void; onReissue: () => void }) {
  const status = STATUS[invoice.status];
  return <tr className="border-t border-slate-100 align-top">
    <td className="p-3 font-semibold text-slate-800">{monthLabel(invoice.reference)}</td>
    <td className="p-3">{brDate(invoice.dueDate)}</td>
    <td className="p-3 tabular-nums">{money(invoice.amountCents)}</td>
    <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
      {invoice.paidAt && <small className="mt-1 block text-slate-500">Pago em {new Date(invoice.paidAt).toLocaleDateString("pt-BR")}</small>}
      {invoice.lastError && invoice.status === "FAILED" && <small className="mt-1 block max-w-xs text-amber-700">{invoice.lastError}</small>}
      {invoice.emailSentAt && <small className="mt-1 block text-slate-400">E-mail enviado em {new Date(invoice.emailSentAt).toLocaleDateString("pt-BR")}</small>}</td>
    <td className="p-3 text-right"><div className="flex flex-wrap justify-end gap-1">
      {invoice.boletoUrl && invoice.status !== "CANCELED" && <a href={invoice.boletoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-cyan-800 hover:bg-slate-50"><ExternalLink size={13} />Boleto</a>}
      {invoice.boletoUrl && ["PENDING", "OVERDUE"].includes(invoice.status) && <Button variant="ghost" title="Conferir pagamento no Mercado Pago" disabled={busy} onClick={onRefresh}><RefreshCw size={15} /></Button>}
      {canManage && invoice.boletoUrl && invoice.status === "PENDING" && <Button variant="ghost" title="Reenviar o boleto por e-mail" disabled={busy} onClick={onResend}><Mail size={15} /></Button>}
      {canManage && ["OVERDUE", "FAILED", "CANCELED"].includes(invoice.status) && <Button variant="secondary" disabled={busy} onClick={onReissue}>Novo boleto</Button>}
    </div></td>
  </tr>;
}

const EMPTY: BillingContract = { active: true, monthlyAmountCents: 0, dueDay: 10, issueDaysBefore: 10, description: "Mensalidade Concilia ERP", payerName: "", payerDocument: "", payerEmails: [], zipCode: "", streetName: "", streetNumber: "", neighborhood: "", city: "", federalUnit: "" };

function ContractDialog({ initial, close, saved }: { initial: BillingContract | null; close: () => void; saved: () => void }) {
  const [form, setForm] = useState<BillingContract>(initial ?? EMPTY);
  const [amount, setAmount] = useState(initial ? (initial.monthlyAmountCents / 100).toFixed(2).replace(".", ",") : "");
  const [emails, setEmails] = useState((initial?.payerEmails ?? []).join(", "));
  const set = <K extends keyof BillingContract>(key: K, value: BillingContract[K]) => setForm(current => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: () => billingService.saveContract({ ...form, monthlyAmountCents: Math.round(Number(amount.replace(/\./g, "").replace(",", ".")) * 100), payerEmails: emails.split(/[,;\s]+/).map(item => item.trim()).filter(Boolean) }),
    onSuccess: saved,
  });
  const text = (key: keyof BillingContract, label: string, className = "") => <label className={`grid gap-1 text-xs font-semibold text-slate-700 ${className}`}><span>{label}</span><input className="h-9 rounded border border-slate-300 px-2 text-sm font-normal" value={String(form[key] ?? "")} onChange={event => set(key, event.target.value as never)} /></label>;
  // O "?" vai como elemento pronto (screen/field literais): o teste de cobertura da ajuda procura
  // <FieldHelp screen="..." field="..."> no código-fonte.
  const number = (key: "dueDay" | "issueDaysBefore", label: string, min: number, max: number, help: React.ReactNode) => <label className="grid gap-1 text-xs font-semibold text-slate-700"><span>{label}{help}</span><input type="number" min={min} max={max} className="h-9 rounded border border-slate-300 px-2 text-sm font-normal" value={form[key]} onChange={event => set(key, Number(event.target.value))} /></label>;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="billing-contract" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3"><div><h2 id="billing-contract" className="text-lg font-bold text-slate-900">Cobrança do cliente</h2><p className="mt-1 text-sm text-slate-500">Boleto mensal pelo Mercado Pago. O pagador precisa de CPF/CNPJ e endereço completo.</p></div><Button variant="ghost" onClick={close}>Fechar</Button></div>
      <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Mensalidade</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-xs font-semibold text-slate-700"><span>Valor mensal (R$)<FieldHelp screen="commercial" field="cobranca-valor" /></span><input inputMode="decimal" className="h-9 rounded border border-slate-300 px-2 text-sm font-normal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="499,00" /></label>
        {number("dueDay", "Dia do vencimento", 1, 28, <FieldHelp screen="commercial" field="cobranca-vencimento" />)}
        {number("issueDaysBefore", "Gerar quantos dias antes", 3, 25, <FieldHelp screen="commercial" field="cobranca-antecedencia" />)}
        {text("description", "Descrição no boleto", "sm:col-span-3")}
      </div>
      <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Pagador</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {text("payerName", "Razão social", "sm:col-span-2")}
        {text("payerDocument", "CNPJ ou CPF")}
        <label className="grid gap-1 text-xs font-semibold text-slate-700 sm:col-span-3"><span>E-mails que recebem o boleto<FieldHelp screen="commercial" field="cobranca-emails" /></span><input className="h-9 rounded border border-slate-300 px-2 text-sm font-normal" value={emails} onChange={event => setEmails(event.target.value)} placeholder="financeiro@cliente.com.br, contas@cliente.com.br" /></label>
        {text("zipCode", "CEP")}
        {text("streetName", "Logradouro", "sm:col-span-2")}
        {text("streetNumber", "Número")}
        {text("neighborhood", "Bairro")}
        {text("city", "Cidade")}
        {text("federalUnit", "UF")}
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-cyan-700" checked={form.active} onChange={event => set("active", event.target.checked)} />Cobrança ativa (gera os boletos automaticamente)</label>
      {save.isError && <div className="mt-3"><ErrorState message={getApiErrorMessage(save.error)} /></div>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={close}>Cancelar</Button><Button onClick={() => save.mutate()} disabled={save.isPending || !amount}>{save.isPending ? "Salvando..." : "Salvar"}</Button></div>
    </div>
  </div>;
}
