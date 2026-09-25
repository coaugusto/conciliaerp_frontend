"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ClipboardList, Download, FileText, History, Image as ImageIcon, LoaderCircle, Printer, Search, Send, Trash2 } from "lucide-react";
import { Button, Card, ErrorState, PageHeader, PageLoader, dateTime } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { adherencePlanService, type AdherencePlanAccountingModel, type AdherencePlanBankAccountGap, type AdherencePlanBudgetModel, type AdherencePlanCgoGap, type AdherencePlanCgoModel, type AdherencePlanItem, type AdherencePlanReportVersion, type AdherencePlanSection, type AdherencePlanSpeciesGap, type AdherencePlanSpeciesModel, type GapSectionCode } from "@/services/adherence-plan.service";
import { FiscalInconsistenciesCard } from "@/components/fiscal-inconsistencies-card";

const POSITIVE = new Set(["OK", "SIM", "CONFIGURADO"]);
const NEGATIVE = new Set(["PENDENTE", "NAO", "NÃO"]);

function itemTone(value: string): "positive" | "negative" | "neutral" {
  const normalized = value.trim().toUpperCase();
  if (POSITIVE.has(normalized)) return "positive";
  if (NEGATIVE.has(normalized) || normalized === "0") return "negative";
  return "neutral";
}
function sectionHasGap(section: AdherencePlanSection) {
  return section.items.length === 0 || section.items.some((item) => itemTone(item.value) === "negative");
}
type OperationGroup = { operationCode: string; operationDescription: string | null; species: { code: string; description: string | null }[] };
// Usado tanto para accountingGaps (sem contabilização) quanto accountingModels (com
// contabilização) — mesmo shape espécie×operação, só a origem muda.
function groupByOperation(rows: AdherencePlanAccountingModel[]): OperationGroup[] {
  const map = new Map<string, OperationGroup>();
  for (const row of rows) {
    if (!map.has(row.operationCode)) map.set(row.operationCode, { operationCode: row.operationCode, operationDescription: row.operationDescription, species: [] });
    map.get(row.operationCode)!.species.push({ code: row.speciesCode, description: row.speciesDescription });
  }
  return [...map.values()].sort((a, b) => a.operationCode.localeCompare(b.operationCode));
}

export default function AdherencePlanPage() {
  const [search, setSearch] = useState("");
  const result = useQuery({ queryKey: ["adherence-plan"], queryFn: adherencePlanService.get });
  const sections = result.data?.sections ?? [];
  const cgoGaps = result.data?.cgoGaps ?? [];
  const accountingGaps = result.data?.accountingGaps ?? [];
  const speciesAccountGaps = result.data?.speciesAccountGaps ?? [];
  const bankAccountGaps = result.data?.bankAccountGaps ?? [];
  const cgoModels = result.data?.cgoModels ?? [];
  const speciesModels = result.data?.speciesModels ?? [];
  const accountingModels = result.data?.accountingModels ?? [];
  const budgetModels = result.data?.budgetModels ?? [];
  const operationGroups = useMemo(() => groupByOperation(accountingGaps), [accountingGaps]);
  const operationModelGroups = useMemo(() => groupByOperation(accountingModels), [accountingModels]);
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const visibleSections = useMemo(() => !term ? sections : sections.filter((section) =>
    `${section.code} ${section.title}`.toLocaleLowerCase("pt-BR").includes(term) ||
    section.items.some((item) => `${item.label} ${item.value}`.toLocaleLowerCase("pt-BR").includes(term))
  ), [sections, term]);
  const gaps = sections.filter(sectionHasGap).length;
  const hasAnyData = sections.length > 0 || cgoGaps.length > 0 || accountingGaps.length > 0 || speciesAccountGaps.length > 0 || bankAccountGaps.length > 0 || cgoModels.length > 0 || speciesModels.length > 0 || accountingModels.length > 0 || budgetModels.length > 0;
  const hasPrintableGaps = cgoGaps.length > 0 || accountingGaps.length > 0 || bankAccountGaps.length > 0 || speciesAccountGaps.length > 0 || cgoModels.length > 0 || speciesModels.length > 0 || accountingModels.length > 0 || budgetModels.length > 0;

  return <>
    <PageHeader title="Plano de Aderência" description="Processos do ERP configurados na base do cliente — use antes do go-live e em reuniões de status." action={hasPrintableGaps ? <Button variant="secondary" onClick={() => window.print()} className="print:hidden"><Printer size={16} />Imprimir lacunas</Button> : undefined} />
    {result.isError && <ErrorState message={getApiErrorMessage(result.error)} />}
    {!result.isError && <>
      <RecipientsCard />
      <FiscalInconsistenciesCard />
      <div className="mb-5 grid gap-3 sm:grid-cols-3 print:hidden">
        <Metric label="Processos verificados" value={sections.length} />
        <Metric label="Com pendência ou sem uso" value={gaps} tone="amber" />
        <div className="border-l-4 border-cyan-600 bg-white px-4 py-3"><p className="text-xs font-semibold uppercase text-slate-500">Última sincronização</p><p className="mt-1 text-sm font-semibold text-slate-900">{result.data?.lastSyncedAt ? dateTime(result.data.lastSyncedAt) : "Nunca sincronizado"}</p></div>
      </div>
      <p className="mb-5 hidden text-sm text-slate-500 print:block">Lacunas de configuração — {result.data?.lastSyncedAt ? `sincronizado em ${dateTime(result.data.lastSyncedAt)}` : "sem sincronização"}</p>

      <GapListSection code="CGO_GAPS" title="CGOs sem modelo contábil" description="Códigos Gerais de Operação usados em notas, mas sem modelo cadastrado (ABAM_FILTROMODELO)." total={cgoGaps.length}>
        {cgoGaps.map((gap) => <CgoGapRow key={gap.cgo} gap={gap} />)}
      </GapListSection>
      <GapListSection code="ACCOUNTING_GAPS" title="Operações sem contabilização" description="Operações usadas em notas com espécies sem modelo configurado para o motor contábil." total={operationGroups.length}>
        {operationGroups.map((group) => <OperationGroupRow key={group.operationCode} group={group} />)}
      </GapListSection>
      <GapListSection code="SPECIES_ACCOUNT_GAPS" title="Espécies sem conta contábil" description="Espécies financeiras ativas sem conta contábil vinculada." total={speciesAccountGaps.length}>
        {speciesAccountGaps.map((gap) => <SpeciesGapRow key={gap.speciesCode} gap={gap} />)}
      </GapListSection>
      <GapListSection code="BANK_ACCOUNT_GAPS" title="Contas correntes sem parâmetro contábil" description="Contas correntes ativas sem vínculo contábil (ABAM_FINANCEIROCONF)." total={bankAccountGaps.length}>
        {bankAccountGaps.map((gap) => <BankAccountGapRow key={gap.accountId} gap={gap} />)}
      </GapListSection>

      <GapListSection code="CGO_MODELS" tone="emerald" title="CGOs com modelo configurado" description="Códigos Gerais de Operação já com modelo cadastrado no motor contábil." total={cgoModels.length}>
        {cgoModels.map((model, index) => <CgoModelRow key={index} model={model} />)}
      </GapListSection>
      <GapListSection code="SPECIES_MODELS" tone="emerald" title="Espécies com modelo configurado" description="Espécies financeiras já com modelo cadastrado no motor contábil." total={speciesModels.length}>
        {speciesModels.map((model, index) => <SpeciesModelRow key={index} model={model} />)}
      </GapListSection>
      <GapListSection code="ACCOUNTING_MODELS" tone="emerald" title="Operações com contabilização" description="Operações usadas em notas com espécies JÁ com modelo configurado para o motor contábil — contraparte de 'Operações sem contabilização'." total={operationModelGroups.length}>
        {operationModelGroups.map((group) => <OperationGroupRow key={group.operationCode} group={group} />)}
      </GapListSection>
      <GapListSection code="BUDGET_MODELS" tone="emerald" title="Orçamento: naturezas com modelo configurado" description="Naturezas de despesa orçamentária já com modelo cadastrado no motor contábil." total={budgetModels.length}>
        {budgetModels.map((model, index) => <BudgetModelRow key={index} model={model} />)}
      </GapListSection>

      <label className="mb-5 flex h-10 w-full max-w-md items-center gap-2 rounded-lg border border-slate-300 px-3 print:hidden"><Search size={16} className="text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Buscar por processo ou item" /></label>
      <div className="print:hidden">
        {result.isLoading ? <PageLoader/> : !hasAnyData ? <EmptyPlan /> : !sections.length ? null : !visibleSections.length ? <p className="p-10 text-center text-sm text-slate-500">Nenhum processo corresponde à busca.</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleSections.map((section) => <SectionCard key={section.code} section={section} />)}</div>}
      </div>
    </>}
  </>;
}

function Metric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "amber" }) {
  return <div className={`border-l-4 bg-white px-4 py-3 ${tone === "amber" ? "border-amber-500" : "border-cyan-600"}`}><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div>;
}

function EmptyPlan() {
  return <Card className="p-10 text-center"><ClipboardList size={28} className="mx-auto text-slate-400" /><p className="mt-3 font-semibold text-slate-800">Nenhuma sincronização de aderência ainda</p><p className="mt-1 text-sm text-slate-500">Execute a consulta ADHERENCE_PLAN_V1 em /connector-queries para este cliente.</p></Card>;
}

// Fase 1 do relatório periódico: cadastro de destinatários (um grupo só por tenant — o Plano de
// Aderência é um checklist vivo, não um documento por versão), PDF com o detalhe completo e envio
// manual de teste. Agendamento recorrente (diário/semanal/mensal) fica para depois, em cima disto.
function RecipientsCard() {
  const qc = useQueryClient();
  const recipients = useQuery({ queryKey: ["adherence-plan-recipients"], queryFn: adherencePlanService.listRecipients });
  const versions = useQuery({ queryKey: ["adherence-plan-versions"], queryFn: adherencePlanService.listVersions });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["adherence-plan-recipients"] });
  const add = useMutation({ mutationFn: () => adherencePlanService.addRecipient(email.trim(), name.trim() || undefined), onSuccess: () => { setEmail(""); setName(""); invalidate(); } });
  const remove = useMutation({ mutationFn: (id: string) => adherencePlanService.removeRecipient(id), onSuccess: invalidate });
  const download = useMutation({ mutationFn: () => adherencePlanService.downloadPdf() });
  const openInfographic = useMutation({ mutationFn: () => adherencePlanService.openInfographic() });
  const send = useMutation({ mutationFn: () => adherencePlanService.sendNow(), onSuccess: () => qc.invalidateQueries({ queryKey: ["adherence-plan-versions"] }) });
  const createVersion = useMutation({ mutationFn: () => adherencePlanService.createVersion(), onSuccess: () => qc.invalidateQueries({ queryKey: ["adherence-plan-versions"] }) });
  return <Card className="mb-5 p-4 print:hidden">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-bold text-slate-900">Relatório por e-mail</h3><p className="mt-0.5 text-sm max-w-xl text-slate-500">Cadastre quem recebe o Plano de Aderência — cards com os tópicos no corpo do e-mail, infográfico e detalhes completos no PDF anexado.</p></div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant="secondary" onClick={() => openInfographic.mutate()} disabled={openInfographic.isPending}><ImageIcon size={16} />{openInfographic.isPending ? "Abrindo..." : "Ver infográfico"}</Button>
        <Button variant="secondary" onClick={() => download.mutate()} disabled={download.isPending}><Download size={16} />{download.isPending ? "Gerando..." : "Baixar PDF"}</Button>
        <Button variant="secondary" onClick={() => createVersion.mutate()} disabled={createVersion.isPending}><History size={16} />{createVersion.isPending ? "Gerando..." : "Gerar versão"}</Button>
        <Button onClick={() => send.mutate()} disabled={send.isPending || !recipients.data?.length}><Send size={16} />{send.isPending ? "Enviando..." : "Enviar agora"}</Button>
      </div>
    </div>
    {send.isSuccess && <p className="mt-3 rounded bg-emerald-50 p-2 text-sm text-emerald-800">Relatório enviado para {send.data.sent} destinatário(s) e registrado no histórico de versões.</p>}
    {createVersion.isSuccess && <p className="mt-3 rounded bg-emerald-50 p-2 text-sm text-emerald-800">Versão registrada no histórico.</p>}
    {send.isError && <div className="mt-3"><ErrorState message={getApiErrorMessage(send.error)} /></div>}
    {download.isError && <div className="mt-3"><ErrorState message={getApiErrorMessage(download.error)} /></div>}
    {openInfographic.isError && <div className="mt-3"><ErrorState message={getApiErrorMessage(openInfographic.error)} /></div>}
    {createVersion.isError && <div className="mt-3"><ErrorState message={getApiErrorMessage(createVersion.error)} /></div>}
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-sm font-semibold text-slate-700">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-10 w-64 rounded border border-slate-300 px-3 text-sm font-normal" placeholder="nome@cliente.com.br" /></label>
      <label className="text-sm font-semibold text-slate-700">Nome (opcional)<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-10 w-48 rounded border border-slate-300 px-3 text-sm font-normal" /></label>
      <Button variant="secondary" onClick={() => add.mutate()} disabled={!email.trim() || add.isPending}>{add.isPending ? "Adicionando..." : "Adicionar"}</Button>
    </div>
    {add.isError && <div className="mt-2"><ErrorState message={getApiErrorMessage(add.error)} /></div>}
    <ul className="mt-3 divide-y divide-slate-100">
      {recipients.data?.map((recipient) => <li key={recipient.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{recipient.email}{recipient.name ? ` — ${recipient.name}` : ""}</span><Button variant="ghost" onClick={() => remove.mutate(recipient.id)} disabled={remove.isPending}><Trash2 size={14} /></Button></li>)}
      {!recipients.data?.length && <p className="py-2 text-sm text-slate-500">Nenhum destinatário cadastrado ainda.</p>}
    </ul>
    {Boolean(versions.data?.length) && <div className="mt-4 border-t border-slate-200 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Histórico de versões — acompanhamento do início do projeto até o go-live</p>
      <ul className="divide-y divide-slate-100">
        {versions.data!.map((version) => <VersionRow key={version.id} version={version} />)}
      </ul>
    </div>}
  </Card>;
}

function VersionRow({ version }: { version: AdherencePlanReportVersion }) {
  const download = useMutation({ mutationFn: () => adherencePlanService.downloadVersionPdf(version.id, version.pdfFileName) });
  const openPng = useMutation({ mutationFn: () => adherencePlanService.openVersionPng(version.id) });
  const healthPercent = version.sectionsTotal ? Math.round(((version.sectionsTotal - version.sectionsWithGap) / version.sectionsTotal) * 100) : 0;
  const tone = healthPercent >= 80 ? "text-emerald-700 bg-emerald-100" : healthPercent >= 50 ? "text-amber-700 bg-amber-100" : "text-red-700 bg-red-100";
  return <li className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
    <div className="flex items-center gap-3">
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{healthPercent}%</span>
      <span className="text-slate-700">{dateTime(version.generatedAt)}</span>
      <span className="text-xs text-slate-500">{version.sectionsWithGap} pendência(s) de {version.sectionsTotal} processo(s)</span>
    </div>
    <div className="flex gap-2">
      <Button variant="ghost" onClick={() => openPng.mutate()} disabled={openPng.isPending}><ImageIcon size={14} />Imagem</Button>
      <Button variant="ghost" onClick={() => download.mutate()} disabled={download.isPending}><Download size={14} />PDF</Button>
    </div>
  </li>;
}

/** Lista expansível com o total sempre visível (mesmo fechada) — cada uma das 4 consultas de
 * lacuna (CGO, operação×espécie, espécie sem conta, conta corrente sem parâmetro) usa este
 * mesmo componente. Some da tela quando não há nenhuma pendência dessa lista. O conteúdo fica
 * sempre no DOM (visibilidade controlada por classe, não por render condicional) para que
 * print:!block force tudo visível na impressão, independente do que está aberto na tela. */
function GapListSection({ code, title, description, total, tone = "amber", children }: { code: GapSectionCode; title: string; description: string; total: number; tone?: "amber" | "emerald"; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!total) return null;
  const badgeClass = tone === "amber" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
  return <Card className={`mb-5 overflow-hidden print:break-inside-avoid ${tone === "amber" ? "border-amber-200" : "border-emerald-200"}`}>
    <div className="flex items-center justify-between gap-3 p-4">
      <div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-0.5 text-sm text-slate-500">{description}</p></div>
      <div className="flex shrink-0 items-center gap-2">
        <ExportSectionPdfButton code={code} title={title} />
        <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-3 print:hidden" aria-expanded={open}>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${badgeClass}`}>{total}</span>
          <ChevronDown size={18} className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <span className={`hidden rounded-full px-3 py-1 text-sm font-bold print:inline-block ${badgeClass}`}>{total}</span>
      </div>
    </div>
    <div className={`border-t border-slate-200 ${open ? "" : "hidden"} print:!block`}>
      <ul className="divide-y divide-slate-100">{children}</ul>
      <div className="border-t border-slate-100 p-3 text-right print:hidden"><button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-cyan-700 hover:underline">Fechar</button></div>
    </div>
  </Card>;
}
// Baixa só esta lista em PDF (GET /adherence-plan/gap-sections/:code/pdf) — sem precisar gerar o
// relatório inteiro pra conferir/compartilhar uma pendência específica.
function ExportSectionPdfButton({ code, title }: { code: GapSectionCode; title: string }) {
  const fileName = `plano-aderencia-${title.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  const download = useMutation({ mutationFn: () => adherencePlanService.downloadGapSectionPdf(code, fileName) });
  return <button type="button" onClick={(event) => { event.stopPropagation(); download.mutate(); }} disabled={download.isPending} title={`Exportar "${title}" em PDF`} className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 print:hidden">
    {download.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <FileText size={14} />}
    PDF
  </button>;
}

function OperationGroupRow({ group }: { group: OperationGroup }) {
  const [open, setOpen] = useState(false);
  return <li className="p-3">
    <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left print:hidden" aria-expanded={open}>
      <span className="font-mono text-sm text-slate-700">OP {group.operationCode}{group.operationDescription ? ` · ${group.operationDescription}` : ""}</span>
      <span className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{group.species.length}</span><ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} /></span>
    </button>
    <p className="hidden font-mono text-sm font-semibold text-slate-700 print:block">OP {group.operationCode}{group.operationDescription ? ` · ${group.operationDescription}` : ""} — {group.species.length} espécie(s)</p>
    <ul className={`${open ? "" : "hidden"} print:!block mt-2 space-y-1 border-l-2 border-amber-100 pl-3`}>
      {group.species.map((species, index) => <li key={index} className="text-xs text-slate-600">ESP {species.code}{species.description ? ` · ${species.description}` : ""}</li>)}
    </ul>
    {open && <button type="button" onClick={() => setOpen(false)} className="mt-2 text-xs font-semibold text-cyan-700 hover:underline print:hidden">Fechar</button>}
  </li>;
}

function CgoGapRow({ gap }: { gap: AdherencePlanCgoGap }) {
  return <li className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
    <div><span className="font-mono font-semibold text-slate-800">CGO {gap.cgo}</span>{gap.name && <span className="ml-2 text-slate-700">{gap.name}</span>}{gap.description && <p className="mt-0.5 text-xs text-slate-500">{gap.description}</p>}</div>
    <div className="flex shrink-0 items-center gap-2">{gap.direction && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${gap.direction === "ENTRADA" ? "bg-cyan-100 text-cyan-800" : "bg-violet-100 text-violet-800"}`}>{gap.direction === "ENTRADA" ? "Entrada" : "Saída"}</span>}<span className="text-xs text-slate-500">{gap.noteCount} nota(s)</span></div>
  </li>;
}
function SpeciesGapRow({ gap }: { gap: AdherencePlanSpeciesGap }) {
  return <li className="flex items-center gap-3 p-3 text-sm"><span className="font-mono font-semibold text-slate-800">{gap.speciesCode}</span>{gap.speciesDescription && <span className="text-slate-700">{gap.speciesDescription}</span>}</li>;
}
function BankAccountGapRow({ gap }: { gap: AdherencePlanBankAccountGap }) {
  return <li className="flex items-center gap-3 p-3 text-sm">{gap.companyNumber && <span className="font-mono text-xs text-slate-500">EMP {gap.companyNumber}</span>}<span className="text-slate-700">{gap.accountDescription || `Conta ${gap.accountId}`}</span></li>;
}
function CgoModelRow({ model }: { model: AdherencePlanCgoModel }) {
  return <li className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
    <span className="font-mono text-xs text-slate-500">Modelo {model.modelId}{model.modelDescription ? ` · ${model.modelDescription}` : ""}</span>
    <span><span className="font-mono font-semibold text-slate-800">CGO {model.cgo}</span>{model.cgoDescription && <span className="ml-2 text-slate-700">{model.cgoDescription}</span>}</span>
  </li>;
}
function SpeciesModelRow({ model }: { model: AdherencePlanSpeciesModel }) {
  return <li className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
    <span className="font-mono text-xs text-slate-500">Modelo {model.modelId}{model.modelDescription ? ` · ${model.modelDescription}` : ""}</span>
    <span><span className="font-mono font-semibold text-slate-800">{model.speciesCode}</span>{model.speciesDescription && <span className="ml-2 text-slate-700">{model.speciesDescription}</span>}</span>
  </li>;
}
function BudgetModelRow({ model }: { model: AdherencePlanBudgetModel }) {
  return <li className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
    <span className="font-mono text-xs text-slate-500">Modelo {model.modelId}{model.modelDescription ? ` · ${model.modelDescription}` : ""}</span>
    <span><span className="font-mono font-semibold text-slate-800">ND {model.expenseNatureId}</span>{model.expenseNatureDescription && <span className="ml-2 text-slate-700">{model.expenseNatureDescription}</span>}</span>
  </li>;
}

function SectionCard({ section }: { section: AdherencePlanSection }) {
  const gap = sectionHasGap(section);
  return <Card className={`p-4 ${gap ? "border-amber-200" : "border-emerald-200"}`}>
    <div className="mb-3 flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-semibold text-cyan-700">{section.code}</p><h3 className="mt-0.5 font-bold text-slate-900">{section.title}</h3></div>{gap && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">Verificar</span>}</div>
    {section.items.length ? <ul className="space-y-1.5">{section.items.map((item, index) => <ItemRow key={index} item={item} />)}</ul> : <p className="text-sm text-slate-500">Sem detalhamento retornado pela consulta.</p>}
  </Card>;
}

function ItemRow({ item }: { item: AdherencePlanItem }) {
  const tone = itemTone(item.value);
  const toneClass = tone === "positive" ? "bg-emerald-100 text-emerald-800" : tone === "negative" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
  return <li className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-600">{item.label}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass}`}>{item.value || "—"}</span></li>;
}
