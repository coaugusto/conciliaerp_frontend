"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { TabLink } from "@/components/layout/tab-link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Barcode, Boxes, Database, FileText, Pencil, Percent, PackageSearch, Save, Truck, X } from "lucide-react";
import { Button, Card, ErrorState, PageHeader, PageLoader, SeverityBadge, dateTime, money } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { fiscalComplianceService, type ImportedRecord, type TaxationOperationGroup } from "@/services/fiscal-compliance.service";
import { consincoField } from "@/services/consinco-field-map";
import { useTabParams, useTabSearchParams } from "@/providers/tabs-provider";

export default function InitialLoadProductDetailPage() {
  const { productId } = useTabParams<{ productId: string }>();
  const searchParams = useTabSearchParams();
  const id = decodeURIComponent(productId);
  const fromAlerts = searchParams.get("from") === "alerts";
  const backHref = fromAlerts ? "/alerts" : "/connector-data";
  const backLabel = fromAlerts ? "Voltar aos alertas" : "Voltar aos cadastros importados";
  const detail = useQuery({ queryKey: ["fiscal-compliance-product", id], queryFn: () => fiscalComplianceService.product(id), enabled: Boolean(id), retry: false });

  if (detail.isLoading) return <PageLoader label="Carregando cadastro do produto..." />;
  if (detail.isError || !detail.data) return <><PageHeader title="Detalhes do produto" description="Cadastro recebido pela carga inicial do Connector." /><ErrorState message={detail.isError ? getApiErrorMessage(detail.error) : "A API respondeu sem os dados do produto."} /><Link href={backHref} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:underline"><ArrowLeft size={16} />{backLabel}</Link></>;

  const data = detail.data;
  const product = data.product.payload;
  const description = text(product, "PRODUCT_DESCRIPTION") || data.product.sourceKey;

  return <>
    <PageHeader title="Detalhes do produto" description="Cadastro e tributação recebidos pela carga inicial do Connector." action={<Link href={backHref} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><ArrowLeft size={16} />{fromAlerts ? "Voltar aos alertas" : "Voltar"}</Link>} />
    <Card className="mb-5 border-cyan-200 bg-cyan-50/50 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><PackageSearch className="mt-0.5 text-cyan-700" /><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Produto — {data.product.origin.query}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{description}</h2><p className="mt-1 font-mono text-xs text-slate-500">Chave {data.product.sourceKey} · recebido {data.product.receivedAt ? dateTime(data.product.receivedAt) : "—"}</p></div></div></div></Card>

    {data.findings.length > 0 && <Card className="mb-5 overflow-hidden"><div className="border-b border-slate-200 p-4"><h2 className="font-bold text-slate-900">Pendências identificadas</h2></div><div className="grid gap-3 p-4">{data.findings.map(finding => <div key={finding.code} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center gap-2"><SeverityBadge value={finding.severity} /><strong className="text-sm text-slate-900">{finding.reason}</strong>{!!finding.estimatedOverpayment && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">{money(finding.estimatedOverpayment)} pagos a mais (estimado)</span>}</div><p className="mt-1 text-sm text-slate-600">{finding.observation}</p><code className="mt-1 block text-xs text-slate-400">{finding.code}</code></div>)}</div></Card>}
    {!data.findings.length && <p className="mb-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Nenhuma pendência identificada para este produto.</p>}
    {!!data.compliance?.length && <Card className="mb-5 overflow-hidden border-emerald-200"><div className="border-b border-emerald-200 bg-emerald-50 p-4"><h2 className="font-bold text-emerald-900">Regras em conformidade</h2></div><div className="grid gap-3 p-4">{data.compliance.map(check => <div key={check.code} className="rounded-lg border border-emerald-200 p-3"><strong className="text-sm text-slate-900">{check.reason}</strong><p className="mt-1 text-sm text-slate-600">{check.observation}</p><code className="mt-1 block text-xs text-slate-400">{check.code}</code></div>)}</div></Card>}

    <div className="grid gap-5 xl:grid-cols-2">
      <DetailCard recordId={data.product.id} title="Cadastro do produto" entityType="MASTER_PRODUCTS_V1" fields={product} keys={["PRODUCT_DESCRIPTION", "NCM", "CEST", "FAMILY_DESCRIPTION", "FISCAL_PRODUCT_CODE"]} labels={{ PRODUCT_DESCRIPTION: "Descrição", NCM: "NCM", CEST: "CEST", FAMILY_DESCRIPTION: "Família", FISCAL_PRODUCT_CODE: "Código fiscal" }} queryId={id} />
      <DetailCard recordId={data.product.id} title="Tributação (PIS/COFINS/IPI)" entityType="MASTER_PRODUCTS_V1" fields={product} keys={["PIS_CST", "PIS_CST_OUT", "COFINS_CST", "COFINS_CST_OUT", "IPI_CST"]} labels={{ PIS_CST: "CST PIS (Entrada)", PIS_CST_OUT: "CST PIS (Saída)", COFINS_CST: "CST COFINS (Entrada)", COFINS_CST_OUT: "CST COFINS (Saída)", IPI_CST: "CST IPI" }} queryId={id} />
    </div>

    <AccessCodesSection productId={id} records={data.accessCodes} queryId={id} />
    <FamilyClassificationSection records={data.family.classification} queryId={id} />
    <RecordSection icon={<Percent size={19} className="text-cyan-700" />} title="Perfil tributário da família" entityType="FAMILY_TAX_PROFILE_V1" records={data.taxation.profiles} empty="Nenhum perfil tributário recebido para esta família." queryId={id} summaryLabel={record => <span className="truncate text-sm font-medium text-slate-800">{taxProfileDisplayLabel(record)}</span>} />
    <TaxationByOperationSection groups={data.taxation.byOperation} queryId={id} />
    <RecordSection icon={<Percent size={19} className="text-cyan-700" />} title="Alíquotas padrão por UF" entityType="FAMILY_UF_DEFAULT_RATE_V1" records={data.taxation.defaultRates} empty="Nenhuma alíquota padrão recebida." queryId={id} />
    <RecordSection icon={<Database size={19} className="text-cyan-700" />} title="Embalagens" entityType="FAMILY_PACKAGING_V1" records={data.packaging} empty="Nenhuma embalagem recebida para esta família." queryId={id} />
    <RecordSection icon={<Truck size={19} className="text-cyan-700" />} title="Fornecedores" entityType="FAMILY_SUPPLIERS_V1" records={data.suppliers} empty="Nenhum fornecedor recebido para esta família." queryId={id} />
    <RecordSection icon={<FileText size={19} className="text-cyan-700" />} title="Itens de nota fiscal (CST efetivamente declarado)" entityType="FISCAL_DOCUMENT_ITEMS_V1" records={data.documentItems} empty="Nenhum item de nota fiscal recebido ainda para este produto." queryId={id} />

    {data.family.relatedProducts.length > 0 && <Card className="mt-5 overflow-hidden"><div className="border-b border-slate-200 p-4"><h2 className="font-bold text-slate-900">Outros produtos da mesma família</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Produto</th><th className="p-3">NCM</th></tr></thead><tbody>{data.family.relatedProducts.map(related => <tr key={related.productId} className="border-b border-slate-100"><td className="p-3"><TabLink href={`/connector-data/initial-load/products/${encodeURIComponent(related.productId)}${fromAlerts ? "?from=alerts" : ""}`} className="text-blue-700 hover:underline">{related.description || related.productId}</TabLink></td><td className="p-3">{related.ncm || "—"}</td></tr>)}</tbody></table></div></Card>}
  </>;
}

function useCorrectRecord(queryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, payload }: { recordId: string; payload: Record<string, unknown> }) => fiscalComplianceService.correct(recordId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fiscal-compliance-product", queryId] }),
  });
}

function DetailCard({ recordId, title, entityType, fields, keys, labels, queryId }: { recordId: string; title: string; entityType: string; fields: Record<string, unknown>; keys: string[]; labels: Record<string, string>; queryId: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const correct = useCorrectRecord(queryId);

  const startEdit = () => { setDraft(Object.fromEntries(keys.map(key => [key, text(fields, key)]))); setEditing(true); };
  const cancel = () => { setEditing(false); correct.reset(); };
  const save = () => correct.mutate({ recordId, payload: { ...fields, ...draft } }, { onSuccess: () => setEditing(false) });

  return <Card className="overflow-hidden">
    <div className="flex items-center gap-2 border-b border-slate-200 p-4">
      <Database size={19} className="text-cyan-700" /><h2 className="font-bold text-slate-900">{title}</h2>
      <div className="ml-auto flex items-center gap-2">
        {editing ? <>
          <Button variant="secondary" onClick={cancel} disabled={correct.isPending}><X size={15} />Cancelar</Button>
          <Button onClick={save} disabled={correct.isPending}><Save size={15} />{correct.isPending ? "Salvando…" : "Salvar correção"}</Button>
        </> : <Button variant="secondary" onClick={startEdit}><Pencil size={15} />Corrigir</Button>}
      </div>
    </div>
    {correct.isError && <p className="border-b border-red-100 bg-red-50 p-3 text-sm text-red-700">{getApiErrorMessage(correct.error)}</p>}
    <dl className="grid gap-x-5 sm:grid-cols-2">{keys.map(key => {
      const source = consincoField(entityType, key);
      return <div key={key} className="border-b border-slate-100 p-4">
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{labels[key]}{source && <span className="ml-2 font-mono normal-case text-cyan-700">· {source}</span>}</dt>
        {editing ? <input value={draft[key] ?? ""} onChange={event => setDraft(previous => ({ ...previous, [key]: event.target.value }))} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm" /> : <dd className="mt-1 text-sm font-medium text-slate-800">{text(fields, key) || "Não informado"}</dd>}
      </div>;
    })}</dl>
  </Card>;
}

function RecordSection({ icon, title, entityType, records, empty, queryId, summaryLabel }: { icon: React.ReactNode; title: string; entityType: string; records: ImportedRecord[]; empty: string; queryId: string; summaryLabel?: (record: ImportedRecord) => React.ReactNode }) {
  return <Card className="mt-5 overflow-hidden"><div className="flex items-center gap-2 border-b border-slate-200 p-4"><span>{icon}</span><h2 className="font-bold text-slate-900">{title}</h2><span className="ml-auto text-xs text-slate-500">{records.length} registro(s)</span></div>
    {!records.length ? <p className="p-5 text-sm text-slate-500">{empty}</p> : <div className="divide-y divide-slate-100">{records.map(record => <RecordRow key={record.id} entityType={entityType} record={record} queryId={queryId} summaryLabel={summaryLabel?.(record)} />)}</div>}
  </Card>;
}

// MAP_TRIBUTACAO.DESCAPLICACAO já é a descrição pensada pra leitura humana no próprio ERP —
// inclusive carrega observações como "(PAUTA REFRIGERANTE)" quando é o caso — por isso é
// preferida à TRIBUTACAO (código mais curto), usada só como complemento/fallback.
function taxProfileDisplayLabel(record: ImportedRecord): string {
  const application = text(record.payload, "TAXATION_APPLICATION");
  const name = text(record.payload, "TAXATION_NAME");
  return application || name || record.sourceKey;
}

/** Diferente de RecordSection: quando não há nenhum código de acesso, correctImportedRecord()
 * não serve (só edita um registro que já existe) — por isso este bloco tem seu próprio botão
 * "Adicionar", que chama addAccessCode() (cria um PRODUCT_ACCESS_CODES_V1 novo, marcado como
 * adicionado manualmente). */
function AccessCodesSection({ productId, records, queryId }: { productId: string; records: ImportedRecord[]; queryId: string }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const add = useMutation({
    mutationFn: () => fiscalComplianceService.addAccessCode(productId, code),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["fiscal-compliance-product", queryId] }); setAdding(false); setCode(""); },
  });
  return <Card className="mt-5 overflow-hidden">
    <div className="flex items-center gap-2 border-b border-slate-200 p-4">
      <Barcode size={19} className="text-cyan-700" /><h2 className="font-bold text-slate-900">Códigos de acesso (GTIN/EAN)</h2>
      <span className="ml-auto text-xs text-slate-500">{records.length} registro(s)</span>
      {!adding && <Button variant="secondary" onClick={() => setAdding(true)}><Barcode size={15} />Adicionar</Button>}
    </div>
    {adding && (
      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm font-medium text-slate-700">Código de barras (EAN/GTIN)<input value={code} onChange={event => setCode(event.target.value)} placeholder="Ex.: 7891000100103" className="h-9 w-56 rounded-md border border-slate-300 px-2 text-sm font-normal" /></label>
          <Button onClick={() => add.mutate()} disabled={!code.trim() || add.isPending}>{add.isPending ? "Salvando…" : "Salvar"}</Button>
          <Button variant="secondary" onClick={() => { setAdding(false); setCode(""); add.reset(); }} disabled={add.isPending}><X size={15} />Cancelar</Button>
        </div>
        {add.isError && <p className="mt-2 text-sm text-red-700">{getApiErrorMessage(add.error)}</p>}
      </div>
    )}
    {!records.length ? <p className="p-5 text-sm text-slate-500">Nenhum código de acesso do tipo EAN utilizado para venda foi recebido para este produto.</p>
      : <div className="divide-y divide-slate-100">{records.map(record => <RecordRow key={record.id} entityType="PRODUCT_ACCESS_CODES_V1" record={record} queryId={queryId} />)}</div>}
  </Card>;
}

/** A extração traz uma linha FAMILY_DIVISION_CATEGORY_V1 por nível da hierarquia mercadológica
 * (divisão -> categoria nível 1 -> ... -> a categoria ligada à família), então a família aparecia
 * repetida uma vez por nível. Mostra só o caminho até o último nível (o mais específico), igual
 * ao Catálogo Central: "BEBIDAS FRIAS › REFRIGERANTES › PET". O clique continua abrindo o mesmo
 * detalhe/edição de sempre, só que da linha da folha (a mais específica). */
function buildCategoryBreadcrumb(records: ImportedRecord[]): { path: string[]; leaf: ImportedRecord } | null {
  if (!records.length) return null;
  const key = (divisionId: string, categoryId: string) => `${divisionId}:${categoryId}`;
  const byKey = new Map<string, ImportedRecord>();
  for (const record of records) { const categoryId = text(record.payload, "CATEGORY_ID"); const divisionId = text(record.payload, "DIVISION_ID"); if (categoryId) byKey.set(key(divisionId, categoryId), record); }
  const leaf = [...records].sort((a, b) => (Number(text(b.payload, "CATEGORY_LEVEL")) || 0) - (Number(text(a.payload, "CATEGORY_LEVEL")) || 0))[0];
  const divisionId = text(leaf.payload, "DIVISION_ID");
  const divisionDescription = text(leaf.payload, "DIVISION_DESCRIPTION");
  const path: string[] = [];
  const visited = new Set<string>();
  let cursorId = text(leaf.payload, "CATEGORY_ID");
  while (cursorId && !visited.has(key(divisionId, cursorId))) {
    visited.add(key(divisionId, cursorId));
    const record = byKey.get(key(divisionId, cursorId));
    path.unshift(record ? text(record.payload, "CATEGORY_DESCRIPTION") || `Categoria ${cursorId}` : `Categoria ${cursorId}`);
    cursorId = record ? text(record.payload, "PARENT_CATEGORY_ID") : "";
  }
  if (divisionDescription) path.unshift(divisionDescription);
  return { path, leaf };
}

function FamilyClassificationSection({ records, queryId }: { records: ImportedRecord[]; queryId: string }) {
  const result = buildCategoryBreadcrumb(records);
  return <Card className="mt-5 overflow-hidden">
    <div className="flex items-center gap-2 border-b border-slate-200 p-4"><Boxes size={19} className="text-cyan-700" /><h2 className="font-bold text-slate-900">Divisão e categoria</h2>{result && <span className="ml-auto text-xs text-slate-500">{records.length} registro(s) na hierarquia</span>}</div>
    {!result ? <p className="p-5 text-sm text-slate-500">Nenhum registro de classificação recebido para esta família.</p>
      : <RecordRow entityType="FAMILY_DIVISION_CATEGORY_V1" record={result.leaf} queryId={queryId} summaryLabel={<span className="truncate text-sm font-medium text-slate-800">{result.path.join(" › ")}</span>} />}
  </Card>;
}

const directionLabel: Record<string, string> = { ENTRADA: "Entrada", SAIDA: "Saída" };

// Mesma navegação do Catálogo Central (marketplace/products/[id]): abas de regime tributário
// primeiro (Normal × regimes especiais mudam o que faz sentido comparar) e, dentro dele, abas por
// tipo de operação (entrada/saída × perfil). Sem opção "Todos": misturar os regimes repetia a
// mesma UF várias vezes na lista.
const SAIDA_ORDER = ["SN", "SC", "SM", "SI", "SD"];
type RegimeRecord = { record: ImportedRecord; internal: boolean };
type RegimeOperation = { code: string; direction: TaxationOperationGroup["direction"]; profileLabel: string; internal: ImportedRecord[]; interstate: ImportedRecord[] };

function operationOrder(operation: { code: string; direction: TaxationOperationGroup["direction"] }) {
  if (operation.direction === "SAIDA") { const index = SAIDA_ORDER.indexOf(operation.code); return index < 0 ? SAIDA_ORDER.length : index; }
  return operation.direction === "ENTRADA" ? 10 : 20;
}

function TaxationByOperationSection({ groups, queryId }: { groups: TaxationOperationGroup[]; queryId: string }) {
  const [activeRegime, setActiveRegime] = useState<string | undefined>(undefined);
  const [activeCode, setActiveCode] = useState<string | undefined>(undefined);
  const regimes = new Map<string, { label: string; operations: Map<string, RegimeOperation>; count: number }>();
  for (const group of groups) {
    const tagged: RegimeRecord[] = [...group.internal.map(record => ({ record, internal: true })), ...group.interstate.map(record => ({ record, internal: false }))];
    for (const { record, internal } of tagged) {
      const regimeId = text(record.payload, "TAX_REGIME_ID");
      const label = text(record.payload, "TAX_REGIME_DESCRIPTION") || (regimeId ? `Regime ${regimeId}` : "Sem regime");
      if (!regimes.has(regimeId)) regimes.set(regimeId, { label, operations: new Map(), count: 0 });
      const regime = regimes.get(regimeId)!;
      regime.count += 1;
      if (!regime.operations.has(group.code)) regime.operations.set(group.code, { code: group.code, direction: group.direction, profileLabel: group.profileLabel, internal: [], interstate: [] });
      regime.operations.get(group.code)![internal ? "internal" : "interstate"].push(record);
    }
  }
  // Padrão: o regime "normal" (o mesmo que a reconciliação do Catálogo Central usa); sem ele, o mais frequente.
  const regimeIds = [...regimes.keys()].sort((a, b) => regimes.get(b)!.count - regimes.get(a)!.count);
  const normalRegime = regimeIds.find(id => regimes.get(id)!.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().includes("NORMAL"));
  const effectiveRegime = activeRegime !== undefined && regimes.has(activeRegime) ? activeRegime : (normalRegime ?? regimeIds[0]);
  const operations = [...(regimes.get(effectiveRegime)?.operations.values() ?? [])].sort((a, b) => operationOrder(a) - operationOrder(b) || a.profileLabel.localeCompare(b.profileLabel));
  const effectiveCode = activeCode !== undefined && operations.some(operation => operation.code === activeCode) ? activeCode : operations[0]?.code;
  const operation = operations.find(item => item.code === effectiveCode);
  return <Card className="mt-5 overflow-hidden">
    <div className="flex items-center gap-2 border-b border-slate-200 p-4"><Percent size={19} className="text-cyan-700" /><h2 className="font-bold text-slate-900">Tributação por operação (entrada/saída × UF)</h2><span className="ml-auto text-xs text-slate-500">{regimeIds.length} regime(s) · {groups.length} tipo(s)</span></div>
    {!regimeIds.length ? <p className="p-5 text-sm text-slate-500">Nenhuma regra de tributação por UF recebida.</p> : <>
      <div role="tablist" aria-label="Regime tributário" className="flex flex-wrap items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 p-2">
        <span className="shrink-0 px-2 text-[11px] font-semibold uppercase text-slate-400">Regime:</span>
        {regimeIds.map(regimeId => <button key={regimeId || "sem-regime"} type="button" role="tab" aria-selected={effectiveRegime === regimeId} onClick={() => { setActiveRegime(regimeId); setActiveCode(undefined); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${effectiveRegime === regimeId ? "bg-white text-cyan-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-white/70 hover:text-slate-800"}`}>{regimes.get(regimeId)!.label} ({regimes.get(regimeId)!.count})</button>)}
      </div>
      <div role="tablist" aria-label="Tipo de operação" className="flex flex-wrap items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white p-2">
        <span className="shrink-0 px-2 text-[11px] font-semibold uppercase text-slate-400">Tipo:</span>
        {operations.map(item => <button key={item.code || "sem-tipo"} type="button" role="tab" aria-selected={effectiveCode === item.code} onClick={() => setActiveCode(item.code)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${effectiveCode === item.code ? (item.direction === "SAIDA" ? "bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200") : "text-slate-500 hover:bg-slate-50"}`}>{item.profileLabel} ({item.internal.length + item.interstate.length})</button>)}
      </div>
      {operation && <div role="tabpanel" className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${operation.direction === "SAIDA" ? "bg-cyan-50 text-cyan-800" : "bg-amber-50 text-amber-800"}`}>{operation.direction ? directionLabel[operation.direction] : "Direção desconhecida"}</span><strong className="text-sm text-slate-900">{operation.profileLabel}</strong><code className="text-xs text-slate-400">{operation.code}</code><span className="text-xs text-slate-500">· {regimes.get(effectiveRegime)!.label}</span></div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Mesma UF da empresa {!operation.internal.length && "— nenhuma regra encontrada neste regime"}</p>
        {operation.internal.length > 0 && <div className="mb-4 rounded-lg border border-emerald-200"><TaxationTable records={operation.internal} operationLabel={operation.profileLabel} regimeLabel={regimes.get(effectiveRegime)!.label} queryId={queryId} /></div>}
        {operation.interstate.length > 0 && <details><summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Outras UFs (exceções interestaduais) · {operation.interstate.length}</summary><div className="mt-2 rounded-lg border border-slate-200"><TaxationTable records={operation.interstate} operationLabel={operation.profileLabel} regimeLabel={regimes.get(effectiveRegime)!.label} queryId={queryId} /></div></details>}
      </div>}
    </>}
  </Card>;
}

// Mesmo layout da tabela de tributação do Catálogo Central (marketplace/products/[id]): uma linha por
// regra de UF, com "Corrigir" abrindo a correção do registro importado logo abaixo da linha.
function TaxationTable({ records, operationLabel, regimeLabel, queryId }: { records: ImportedRecord[]; operationLabel: string; regimeLabel: string; queryId: string }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const value = (payload: Record<string, unknown>, name: string) => text(payload, name) || "—";
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[1080px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Nome</th><th className="p-3">Nº Tributação</th><th className="p-3">Tipo</th><th className="p-3">Regime</th><th className="p-3">UF origem → destino</th><th className="p-3">CST ICMS/IPI/PIS/COFINS</th><th className="p-3">ICMS / ST / MVA</th><th className="p-3">FCP / DIFAL</th><th className="p-3 text-right">Ação</th></tr></thead>
      <tbody>
        {records.map(record => { const payload = record.payload; return <Fragment key={record.id}>
          <tr className="border-t border-slate-100">
            <td className="p-3 font-medium">{value(payload, "TAXATION_NAME")}</td>
            <td className="p-3 font-mono text-xs">{value(payload, "TAXATION_ID")}</td>
            <td className="p-3 text-xs text-slate-600">{operationLabel}</td>
            <td className="p-3 text-xs text-slate-600">{text(payload, "TAX_REGIME_DESCRIPTION") || regimeLabel}</td>
            <td className="p-3">{value(payload, "COMPANY_STATE")} → {value(payload, "COUNTERPARTY_STATE")}</td>
            <td className="p-3 font-mono text-xs">{value(payload, "ICMS_CST")} / {value(payload, "IPI_CST")} / {value(payload, "PIS_CST")} / {value(payload, "COFINS_CST")}</td>
            <td className="p-3">{value(payload, "ICMS_RATE")}% / {value(payload, "ICMS_ST_RATE")}% / {value(payload, "ICMS_ST_MVA_PCT")}%</td>
            <td className="p-3">{value(payload, "FCP_RATE")}% / {value(payload, "DIFAL_RATE")}%</td>
            <td className="p-3 text-right"><Button variant="secondary" onClick={() => setEditingId(editingId === record.id ? null : record.id)}><Pencil size={14} />{editingId === record.id ? "Fechar" : "Corrigir"}</Button></td>
          </tr>
          {editingId === record.id && <tr><td colSpan={9} className="border-t border-slate-100 p-0"><RecordRow entityType="TAXATION_UF_V1" record={record} queryId={queryId} startEditing onDone={() => setEditingId(null)} /></td></tr>}
        </Fragment>; })}
      </tbody>
    </table>
  </div>;
}

function RecordRow({ entityType, record, queryId, summaryLabel, startEditing = false, onDone }: { entityType: string; record: ImportedRecord; queryId: string; summaryLabel?: React.ReactNode; startEditing?: boolean; onDone?: () => void }) {
  const entries = Object.entries(record.payload).filter(([key]) => !key.startsWith("_") && !key.startsWith("$"));
  const draftFromRecord = () => Object.fromEntries(entries.map(([key, value]) => [key, formatValue(value) === "—" ? "" : formatValue(value)]));
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState<Record<string, string>>(() => (startEditing ? draftFromRecord() : {}));
  const correct = useCorrectRecord(queryId);

  const startEdit = () => { setDraft(draftFromRecord()); setEditing(true); };
  const cancel = () => { setEditing(false); correct.reset(); onDone?.(); };
  const save = () => correct.mutate({ recordId: record.id, payload: { ...record.payload, ...draft } }, { onSuccess: () => { setEditing(false); onDone?.(); } });

  return <details className="group" open={editing}>
    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 marker:hidden">
      <span className="min-w-0 flex-1 truncate">{summaryLabel ?? <span className="font-mono text-xs text-slate-600">{record.sourceKey}</span>}</span>
      <span className="shrink-0 text-xs text-slate-400">{record.origin.query}</span>
      {!editing && <button type="button" onClick={event => { event.preventDefault(); startEdit(); }} className="shrink-0 inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Pencil size={13} />Corrigir</button>}
    </summary>
    <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
      {editing ? <>
        {correct.isError && <p className="mb-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{getApiErrorMessage(correct.error)}</p>}
        <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">{entries.map(([key]) => { const source = consincoField(entityType, key); return <div key={key}><dt className="font-mono text-[11px] uppercase text-slate-400">{key}{source && <span className="ml-1.5 normal-case text-cyan-700">· {source}</span>}</dt><input value={draft[key] ?? ""} onChange={event => setDraft(previous => ({ ...previous, [key]: event.target.value }))} className="mt-1 h-8 w-full rounded-md border border-slate-300 px-2 text-sm" /></div>; })}</dl>
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={save} disabled={correct.isPending}><Save size={15} />{correct.isPending ? "Salvando…" : "Salvar correção"}</Button>
          <Button variant="secondary" onClick={cancel} disabled={correct.isPending}><X size={15} />Cancelar</Button>
        </div>
      </> : <PayloadTable entityType={entityType} payload={record.payload} />}
    </div>
  </details>;
}

function PayloadTable({ entityType, payload }: { entityType: string; payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(([key]) => !key.startsWith("_") && !key.startsWith("$"));
  if (!entries.length) return <p className="text-sm text-slate-500">Sem campos.</p>;
  return <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-2">{entries.map(([key, fieldValue]) => { const source = consincoField(entityType, key); return <div key={key}><dt className="font-mono text-[11px] uppercase text-slate-400">{key}{source && <span className="ml-1.5 normal-case text-cyan-700">· {source}</span>}</dt><dd className="text-sm text-slate-800">{formatValue(fieldValue)}</dd></div>; })}</dl>;
}

function formatValue(fieldValue: unknown): string {
  if (fieldValue === null || fieldValue === undefined || fieldValue === "") return "—";
  if (typeof fieldValue === "object") return JSON.stringify(fieldValue);
  return String(fieldValue);
}

function text(payload: Record<string, unknown>, name: string): string {
  const value = payload[name] ?? payload[name.toUpperCase()] ?? payload[name.toLowerCase()];
  return value === null || value === undefined ? "" : String(value).trim();
}
