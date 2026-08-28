"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Barcode, Boxes, Database, FileText, Pencil, Percent, PackageSearch, Save, Truck, X } from "lucide-react";
import { Button, Card, ErrorState, PageHeader, SeverityBadge, dateTime } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { fiscalComplianceService, type ImportedRecord, type TaxationOperationGroup } from "@/services/fiscal-compliance.service";
import { consincoField } from "@/services/consinco-field-map";

export default function InitialLoadProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const id = decodeURIComponent(productId);
  const detail = useQuery({ queryKey: ["fiscal-compliance-product", id], queryFn: () => fiscalComplianceService.product(id), enabled: Boolean(id), retry: false });

  if (detail.isLoading) return <div className="space-y-4"><div className="h-24 animate-pulse rounded-xl bg-slate-100" /><div className="h-72 animate-pulse rounded-xl bg-slate-100" /></div>;
  if (detail.isError || !detail.data) return <><PageHeader title="Detalhes do produto" description="Cadastro recebido pela carga inicial do Connector." /><ErrorState message={detail.isError ? getApiErrorMessage(detail.error) : "A API respondeu sem os dados do produto."} /><Link href="/connector-data" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:underline"><ArrowLeft size={16} />Voltar aos cadastros importados</Link></>;

  const data = detail.data;
  const product = data.product.payload;
  const description = text(product, "PRODUCT_DESCRIPTION") || data.product.sourceKey;

  return <>
    <PageHeader title="Detalhes do produto" description="Cadastro e tributação recebidos pela carga inicial do Connector." action={<Link href="/connector-data" className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><ArrowLeft size={16} />Voltar</Link>} />
    <Card className="mb-5 border-cyan-200 bg-cyan-50/50 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><PackageSearch className="mt-0.5 text-cyan-700" /><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Produto — {data.product.origin.query}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{description}</h2><p className="mt-1 font-mono text-xs text-slate-500">Chave {data.product.sourceKey} · recebido {data.product.receivedAt ? dateTime(data.product.receivedAt) : "—"}</p></div></div></div></Card>

    {data.findings.length > 0 && <Card className="mb-5 overflow-hidden"><div className="border-b border-slate-200 p-4"><h2 className="font-bold text-slate-900">Pendências identificadas</h2></div><div className="grid gap-3 p-4">{data.findings.map(finding => <div key={finding.code} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center gap-2"><SeverityBadge value={finding.severity} /><strong className="text-sm text-slate-900">{finding.reason}</strong></div><p className="mt-1 text-sm text-slate-600">{finding.observation}</p><code className="mt-1 block text-xs text-slate-400">{finding.code}</code></div>)}</div></Card>}
    {!data.findings.length && <p className="mb-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Nenhuma pendência identificada para este produto.</p>}

    <div className="grid gap-5 xl:grid-cols-2">
      <DetailCard recordId={data.product.id} title="Cadastro do produto" entityType="MASTER_PRODUCTS_V1" fields={product} keys={["PRODUCT_DESCRIPTION", "NCM", "CEST", "FAMILY_DESCRIPTION", "FISCAL_PRODUCT_CODE"]} labels={{ PRODUCT_DESCRIPTION: "Descrição", NCM: "NCM", CEST: "CEST", FAMILY_DESCRIPTION: "Família", FISCAL_PRODUCT_CODE: "Código fiscal" }} queryId={id} />
      <DetailCard recordId={data.product.id} title="Tributação (PIS/COFINS/IPI)" entityType="MASTER_PRODUCTS_V1" fields={product} keys={["PIS_CST", "COFINS_CST", "IPI_CST"]} labels={{ PIS_CST: "CST PIS", COFINS_CST: "CST COFINS", IPI_CST: "CST IPI" }} queryId={id} />
    </div>

    <RecordSection icon={<Barcode size={19} className="text-cyan-700" />} title="Códigos de acesso (GTIN/EAN)" entityType="PRODUCT_ACCESS_CODES_V1" records={data.accessCodes} empty="Nenhum código de acesso do tipo EAN utilizado para venda foi recebido para este produto." queryId={id} />
    <RecordSection icon={<Boxes size={19} className="text-cyan-700" />} title="Classificação da família" entityType="FAMILY_DIVISION_CATEGORY_V1" records={data.family.classification} empty="Nenhum registro de classificação recebido para esta família." queryId={id} />
    <RecordSection icon={<Percent size={19} className="text-cyan-700" />} title="Perfil tributário da família" entityType="FAMILY_TAX_PROFILE_V1" records={data.taxation.profiles} empty="Nenhum perfil tributário recebido para esta família." queryId={id} />
    <TaxationByOperationSection groups={data.taxation.byOperation} queryId={id} />
    <RecordSection icon={<Percent size={19} className="text-cyan-700" />} title="Alíquotas padrão por UF" entityType="FAMILY_UF_DEFAULT_RATE_V1" records={data.taxation.defaultRates} empty="Nenhuma alíquota padrão recebida." queryId={id} />
    <RecordSection icon={<Database size={19} className="text-cyan-700" />} title="Embalagens" entityType="FAMILY_PACKAGING_V1" records={data.packaging} empty="Nenhuma embalagem recebida para esta família." queryId={id} />
    <RecordSection icon={<Truck size={19} className="text-cyan-700" />} title="Fornecedores" entityType="FAMILY_SUPPLIERS_V1" records={data.suppliers} empty="Nenhum fornecedor recebido para esta família." queryId={id} />
    <RecordSection icon={<FileText size={19} className="text-cyan-700" />} title="Itens de nota fiscal (CST efetivamente declarado)" entityType="FISCAL_DOCUMENT_ITEMS_V1" records={data.documentItems} empty="Nenhum item de nota fiscal recebido ainda para este produto." queryId={id} />

    {data.family.relatedProducts.length > 0 && <Card className="mt-5 overflow-hidden"><div className="border-b border-slate-200 p-4"><h2 className="font-bold text-slate-900">Outros produtos da mesma família</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Produto</th><th className="p-3">NCM</th></tr></thead><tbody>{data.family.relatedProducts.map(related => <tr key={related.productId} className="border-b border-slate-100"><td className="p-3"><Link href={`/connector-data/initial-load/products/${encodeURIComponent(related.productId)}`} className="text-blue-700 hover:underline">{related.description || related.productId}</Link></td><td className="p-3">{related.ncm || "—"}</td></tr>)}</tbody></table></div></Card>}
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

function RecordSection({ icon, title, entityType, records, empty, queryId }: { icon: React.ReactNode; title: string; entityType: string; records: ImportedRecord[]; empty: string; queryId: string }) {
  return <Card className="mt-5 overflow-hidden"><div className="flex items-center gap-2 border-b border-slate-200 p-4"><span>{icon}</span><h2 className="font-bold text-slate-900">{title}</h2><span className="ml-auto text-xs text-slate-500">{records.length} registro(s)</span></div>
    {!records.length ? <p className="p-5 text-sm text-slate-500">{empty}</p> : <div className="divide-y divide-slate-100">{records.map(record => <RecordRow key={record.id} entityType={entityType} record={record} queryId={queryId} />)}</div>}
  </Card>;
}

const directionLabel: Record<string, string> = { ENTRADA: "Entrada", SAIDA: "Saída" };

function TaxationByOperationSection({ groups, queryId }: { groups: TaxationOperationGroup[]; queryId: string }) {
  const sorted = [...groups].sort((a, b) => (a.direction ?? "").localeCompare(b.direction ?? "") || a.profileLabel.localeCompare(b.profileLabel));
  return <Card className="mt-5 overflow-hidden">
    <div className="flex items-center gap-2 border-b border-slate-200 p-4"><Percent size={19} className="text-cyan-700" /><h2 className="font-bold text-slate-900">Tributação por operação (entrada/saída × UF)</h2><span className="ml-auto text-xs text-slate-500">{groups.length} tipo(s)</span></div>
    {!sorted.length ? <p className="p-5 text-sm text-slate-500">Nenhuma regra de tributação por UF recebida.</p> : <div className="divide-y divide-slate-100">{sorted.map(group => <div key={group.code} className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800">{group.direction ? directionLabel[group.direction] : "Direção desconhecida"}</span><strong className="text-sm text-slate-900">{group.profileLabel}</strong><code className="text-xs text-slate-400">{group.code}</code></div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Mesma UF da empresa {!group.internal.length && "— nenhuma regra encontrada"}</p>
      {group.internal.length > 0 && <div className="mb-4 divide-y divide-slate-100 rounded-lg border border-emerald-200">{group.internal.map(record => <RecordRow key={record.id} entityType="TAXATION_UF_V1" record={record} queryId={queryId} />)}</div>}
      {group.interstate.length > 0 && <details><summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Outras UFs (exceções interestaduais) · {group.interstate.length}</summary><div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">{group.interstate.map(record => <RecordRow key={record.id} entityType="TAXATION_UF_V1" record={record} queryId={queryId} />)}</div></details>}
    </div>)}</div>}
  </Card>;
}

function RecordRow({ entityType, record, queryId }: { entityType: string; record: ImportedRecord; queryId: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const correct = useCorrectRecord(queryId);
  const entries = Object.entries(record.payload).filter(([key]) => !key.startsWith("_") && !key.startsWith("$"));

  const startEdit = () => { setDraft(Object.fromEntries(entries.map(([key, value]) => [key, formatValue(value) === "—" ? "" : formatValue(value)]))); setEditing(true); };
  const cancel = () => { setEditing(false); correct.reset(); };
  const save = () => correct.mutate({ recordId: record.id, payload: { ...record.payload, ...draft } }, { onSuccess: () => setEditing(false) });

  return <details className="group" open={editing}>
    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 marker:hidden">
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600">{record.sourceKey}</span>
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
