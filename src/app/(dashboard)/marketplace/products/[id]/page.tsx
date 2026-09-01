"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Database, Edit3, Link2, Receipt, Save, Search, Sparkles, X } from "lucide-react";
import { Button, Card, ErrorState, PageHeader } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { useAuth } from "@/providers/providers";
import { masterCatalogService, type MasterCatalogProductChanges, type MasterCatalogProductDetail, type MasterCatalogTaxationProfile, type MasterCatalogTaxationStatus, type TaxationSearchResult, type TaxationSuggestionCandidate } from "@/services/master-catalog.service";

const taxationStatusLabels: Record<MasterCatalogTaxationStatus, string> = { MISSING: "Sem tributação", NEW: "Nova do cadastro", REUSED: "Reaproveitada", NEEDS_CONFIRMATION: "Aguardando confirmação" };
const taxationStatusTone: Record<MasterCatalogTaxationStatus, string> = { MISSING: "bg-amber-100 text-amber-800", NEW: "bg-slate-100 text-slate-700", REUSED: "bg-emerald-100 text-emerald-800", NEEDS_CONFIRMATION: "bg-violet-100 text-violet-800" };
const linkSourceLabels: Record<MasterCatalogTaxationProfile["linkSource"], string> = { FROM_CADASTRO: "Do cadastro importado", REUSED_EXISTING: "Reaproveitada de outro produto", MANUAL: "Cadastrada manualmente" };

const editableFields: { key: keyof MasterCatalogProductChanges; label: string; type?: "number" }[] = [
  { key: "canonicalDescription", label: "Descrição canônica" }, { key: "originalDescription", label: "Descrição original" }, { key: "shortDescription", label: "Descrição curta" },
  { key: "gtin", label: "GTIN" }, { key: "ean", label: "EAN" }, { key: "brand", label: "Marca" }, { key: "manufacturer", label: "Fabricante" },
  { key: "category", label: "Categoria" }, { key: "subcategory", label: "Subcategoria" }, { key: "ncm", label: "NCM" }, { key: "cest", label: "CEST" },
  { key: "packaging", label: "Embalagem" }, { key: "contentUnit", label: "Unidade de conteúdo" }, { key: "content", label: "Conteúdo", type: "number" },
  { key: "grossWeight", label: "Peso bruto", type: "number" }, { key: "volume", label: "Volume", type: "number" },
  { key: "consincoDescription", label: "Descrição Consinco" }, { key: "pdvDescription", label: "Descrição PDV" }, { key: "imageUrl", label: "URL da imagem" },
];
type Draft = Record<string, string>;
const draftFrom = (item: MasterCatalogProductDetail): Draft => Object.fromEntries(editableFields.map(({ key }) => [key, item[key] == null ? "" : String(item[key])]));
const changesFrom = (draft: Draft, original: MasterCatalogProductDetail): MasterCatalogProductChanges => Object.fromEntries(editableFields.filter(({ key }) => draft[key] !== String(original[key] ?? "")).map(({ key, type }) => [key, type && draft[key] !== "" ? Number(draft[key]) : draft[key]]));

export default function MasterCatalogProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const productId = decodeURIComponent(id);
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const product = useQuery({ queryKey: ["master-catalog-product", productId], queryFn: () => masterCatalogService.get(productId), enabled: Boolean(productId), retry: false });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["master-catalog-product", productId] });
  const save = useMutation({ mutationFn: (changes: MasterCatalogProductChanges) => masterCatalogService.update(productId, changes), onSuccess: () => { setEditing(false); refresh(); } });
  const linkTaxation = useMutation({ mutationFn: (taxationId: string) => masterCatalogService.linkTaxation(productId, taxationId), onSuccess: refresh });

  if (product.isLoading) return <div className="space-y-4"><div className="h-24 animate-pulse rounded-xl bg-slate-100" /><div className="h-72 animate-pulse rounded-xl bg-slate-100" /></div>;
  if (product.isError || !product.data) return <><PageHeader title="Detalhes do produto" description="Produto do Catálogo Central." /><ErrorState message="Não foi possível carregar este produto." /><Link href="/marketplace" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:underline"><ArrowLeft size={16} />Voltar ao Catálogo Central</Link></>;

  const item = product.data;
  const startEditing = () => { setDraft(draftFrom(item)); setEditing(true); };
  const submit = () => { const changes = changesFrom(draft, item); if (Object.keys(changes).length) save.mutate(changes); else setEditing(false); };

  return <>
    <PageHeader title="Detalhes do produto" description="Cadastro e tributação registrados no Catálogo Central." action={<Link href="/marketplace" className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"><ArrowLeft size={16} />Voltar</Link>} />
    <Card className="mb-5 border-cyan-200 bg-cyan-50/50 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><Database className="mt-0.5 text-cyan-700" /><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Catálogo Central</p><h2 className="mt-1 text-xl font-bold text-slate-900">{item.canonicalDescription}</h2><p className="mt-1 font-mono text-xs text-slate-500">Produto {item.id} · versão {item.version}</p></div></div><div className="rounded-lg bg-white px-4 py-2 text-right"><p className="text-xs uppercase text-slate-500">Confiança</p><strong className="text-lg text-slate-900">{Math.round(Number(item.confidence) * 100)}%</strong></div></div></Card>

    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div className="flex items-center gap-2"><Database size={19} className="text-cyan-700" /><h2 className="font-bold text-slate-900">Cadastro do produto</h2></div>
        {isAdmin && (editing
          ? <div className="flex gap-2"><Button variant="secondary" onClick={() => setEditing(false)} disabled={save.isPending}><X size={15} />Cancelar</Button><Button onClick={submit} disabled={save.isPending}><Save size={15} />{save.isPending ? "Salvando..." : "Salvar"}</Button></div>
          : <Button variant="secondary" onClick={startEditing}><Edit3 size={15} />Editar</Button>)}
      </div>
      {save.isError && <div className="border-b border-slate-200 p-4"><ErrorState message={getApiErrorMessage(save.error)} /></div>}
      {editing
        ? <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">{editableFields.map(({ key, label, type }) => <label key={key} className="grid gap-1 text-sm font-medium text-slate-700">{label}<input type={type ?? "text"} value={draft[key] ?? ""} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className="h-9 rounded-md border border-slate-300 px-2 font-normal text-slate-800" /></label>)}</div>
        : <dl className="grid gap-x-5 sm:grid-cols-2">{editableFields.map(({ key, label }) => <div key={key} className="border-b border-slate-100 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-800">{item[key] || "Não informado"}</dd></div>)}</dl>}
    </Card>

    <Card className="mt-5 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div className="flex items-center gap-2"><Receipt size={19} className="text-cyan-700" /><h2 className="font-bold text-slate-900">Tributação</h2></div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${taxationStatusTone[item.taxation.status]}`}>{taxationStatusLabels[item.taxation.status]}</span>
      </div>
      {!item.taxation.profiles.length ? (
        <p className="p-5 text-sm text-slate-500">{item.taxation.otherTenantHasTaxation ? "Nenhuma tributação registrada pelo seu cliente para este produto (outro cliente já possui)." : "Nenhuma tributação registrada para este produto."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Nome</th><th className="p-3">UF origem → destino</th><th className="p-3">CST ICMS/IPI/PIS/COFINS</th><th className="p-3">CFOP</th><th className="p-3">ICMS / ST / MVA</th><th className="p-3">FCP / DIFAL</th><th className="p-3">Origem</th></tr></thead>
            <tbody>
              {item.taxation.profiles.map((profile) => <tr key={profile.id} className="border-t border-slate-100">
                <td className="p-3 font-medium">{profile.name ?? "—"}</td>
                <td className="p-3">{profile.companyState} → {profile.counterpartyState}</td>
                <td className="p-3 font-mono text-xs">{profile.cstIcms ?? "—"} / {profile.cstIpi ?? "—"} / {profile.cstPis ?? "—"} / {profile.cstCofins ?? "—"}</td>
                <td className="p-3">{profile.cfop ?? "—"}</td>
                <td className="p-3">{profile.icmsRate ?? "—"}% / {profile.icmsStRate ?? "—"}% / {profile.icmsStMvaPct ?? "—"}%</td>
                <td className="p-3">{profile.fcpRate ?? "—"}% / {profile.difalRate ?? "—"}%</td>
                <td className="p-3 text-xs text-slate-500">{linkSourceLabels[profile.linkSource]}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
      {isAdmin && item.taxation.status === "MISSING" && <TaxationSuggestions productId={productId} onAccept={refresh} />}
      {isAdmin && <TaxationLinkPicker linkedIds={item.taxation.profiles.map((profile) => profile.id)} onLink={(taxationId) => linkTaxation.mutate(taxationId)} linking={linkTaxation.isPending} error={linkTaxation.error} />}
    </Card>
  </>;
}

function TaxationSuggestions({ productId, onAccept }: { productId: string; onAccept: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const suggestions = useQuery({ queryKey: ["master-catalog-taxation-suggestions", productId], queryFn: () => masterCatalogService.taxationSuggestions(productId), enabled });
  const accept = useMutation({ mutationFn: (candidate: TaxationSuggestionCandidate) => masterCatalogService.acceptTaxationSuggestion(productId, candidate), onSuccess: onAccept });
  return (
    <div className="border-t border-slate-200 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Sparkles size={17} className="text-cyan-700" /><h3 className="font-semibold text-slate-800">Sugestão de tributação</h3></div>
        {!enabled && <Button variant="secondary" onClick={() => setEnabled(true)}><Sparkles size={15} />Gerar sugestão</Button>}
      </div>
      <p className="mt-1 text-xs text-slate-500">Busca produtos reais parecidos (mesmo NCM, prefixo de NCM ou categoria) já tributados no catálogo; só usa IA — para escolher entre tributações reais mais amplas, nunca para inventar uma — quando nada disso encontra nada. Nunca cria dado novo sem base real.</p>
      {enabled && suggestions.isLoading && <p className="mt-2 text-xs text-slate-500">Buscando sugestão...</p>}
      {enabled && suggestions.isError && <p className="mt-2 text-xs text-red-700">Não foi possível gerar sugestão.</p>}
      {enabled && !suggestions.isLoading && !suggestions.data?.length && <p className="mt-2 text-xs text-slate-500">Nenhuma sugestão disponível — não há nenhum produto parecido nem nenhuma tributação real no catálogo que a IA pudesse indicar. Nada foi inventado.</p>}
      {!!suggestions.data?.length && (
        <ul className="mt-3 space-y-3">
          {suggestions.data.map((candidate, index) => {
            const taxation = candidate.taxation as Record<string, unknown>;
            const isAiAssisted = candidate.method === "AI_ASSISTED_MATCH";
            return (
              <li key={index} className={`rounded-lg border p-3 text-sm ${isAiAssisted ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className={isAiAssisted ? "text-amber-900" : "text-slate-800"}>{String(taxation.name ?? "(sem nome)")}</b>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${isAiAssisted ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>{isAiAssisted ? "IA escolheu entre dados reais — revisar com atenção" : "Baseado em produto real"}</span>
                </div>
                <p className={`mt-1 text-xs ${isAiAssisted ? "text-amber-900" : "text-slate-500"}`}>
                  {isAiAssisted ? candidate.reasoning : `Baseado em ${candidate.basedOn.matchedProductCount} de ${candidate.basedOn.totalMatched} produto(s) com ${candidate.basedOn.field === "ncm" ? "o mesmo NCM" : candidate.basedOn.field === "ncmPrefix" ? "NCM parecido" : "a mesma categoria"}`}
                  {" · confiança "}{Math.round(candidate.confidence * 100)}%
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <div><dt className="text-slate-400">UF</dt><dd>{String(taxation.companyState)} → {String(taxation.counterpartyState)}</dd></div>
                  <div><dt className="text-slate-400">CST ICMS</dt><dd>{String(taxation.cstIcms ?? "—")}</dd></div>
                  <div><dt className="text-slate-400">CST PIS/COFINS</dt><dd>{String(taxation.cstPis ?? "—")} / {String(taxation.cstCofins ?? "—")}</dd></div>
                </dl>
                <div className="mt-3"><Button onClick={() => accept.mutate(candidate)} disabled={accept.isPending}>{accept.isPending ? "Aceitando..." : "Aceitar"}</Button></div>
              </li>
            );
          })}
        </ul>
      )}
      {accept.isError && <p className="mt-2 text-xs text-red-700">{getApiErrorMessage(accept.error)}</p>}
    </div>
  );
}

function TaxationLinkPicker({ linkedIds, onLink, linking, error }: { linkedIds: string[]; onLink: (taxationId: string) => void; linking: boolean; error: unknown }) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const results = useQuery({ queryKey: ["master-catalog-taxation-search", query], queryFn: () => masterCatalogService.searchTaxations(query), enabled: searched });
  const [selected, setSelected] = useState<TaxationSearchResult | null>(null);
  return (
    <div className="border-t border-slate-200 p-5">
      <div className="flex items-center gap-2"><Link2 size={17} className="text-cyan-700" /><h3 className="font-semibold text-slate-800">Vincular tributação existente</h3></div>
      <p className="mt-1 text-xs text-slate-500">Busque pelo nome da tributação (cadastro do cliente) e selecione para ver os dados antes de vincular.</p>
      <div className="mt-3 flex gap-2">
        <input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} placeholder="Nome da tributação, ex.: Venda dentro do Estado" className="h-9 flex-1 rounded-md border border-slate-300 px-2 text-sm" />
        <Button variant="secondary" onClick={() => setSearched(true)} disabled={!query.trim()}><Search size={15} />Buscar</Button>
      </div>
      {results.isFetching && <p className="mt-2 text-xs text-slate-500">Buscando...</p>}
      {results.isError && <p className="mt-2 text-xs text-red-700">Não foi possível buscar tributações.</p>}
      {searched && !results.isFetching && !results.data?.length && <p className="mt-2 text-xs text-slate-500">Nenhuma tributação encontrada para este nome.</p>}
      {!!results.data?.length && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {results.data.map((taxation) => {
            const alreadyLinked = linkedIds.includes(taxation.id);
            return <li key={taxation.id} className={`p-3 text-sm ${selected?.id === taxation.id ? "bg-blue-50" : ""}`}>
              <button type="button" className="w-full text-left" onClick={() => setSelected(taxation)}>
                <b className="text-slate-800">{taxation.name ?? "(sem nome)"}</b>
                <span className="ml-2 text-xs text-slate-500">{taxation.companyState} → {taxation.counterpartyState} · CST ICMS {taxation.cstIcms ?? "—"}</span>
              </button>
              {selected?.id === taxation.id && (
                <div className="mt-2 rounded-md bg-white p-3 text-xs">
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <div><dt className="text-slate-400">CFOP</dt><dd>{taxation.cfop ?? "—"}</dd></div>
                    <div><dt className="text-slate-400">CST PIS/COFINS</dt><dd>{taxation.cstPis ?? "—"} / {taxation.cstCofins ?? "—"}</dd></div>
                    <div><dt className="text-slate-400">CST IPI</dt><dd>{taxation.cstIpi ?? "—"}</dd></div>
                    <div><dt className="text-slate-400">ICMS</dt><dd>{taxation.icmsRate ?? "—"}%</dd></div>
                    <div><dt className="text-slate-400">ICMS ST / MVA</dt><dd>{taxation.icmsStRate ?? "—"}% / {taxation.icmsStMvaPct ?? "—"}%</dd></div>
                    <div><dt className="text-slate-400">FCP / DIFAL</dt><dd>{taxation.fcpRate ?? "—"}% / {taxation.difalRate ?? "—"}%</dd></div>
                  </dl>
                  <div className="mt-3 flex items-center gap-3">
                    <Button onClick={() => onLink(taxation.id)} disabled={alreadyLinked || linking}>{alreadyLinked ? "Já vinculada" : linking ? "Vinculando..." : "Vincular a este produto"}</Button>
                  </div>
                </div>
              )}
            </li>;
          })}
        </ul>
      )}
      {!!error && <p className="mt-2 text-xs text-red-700">{getApiErrorMessage(error)}</p>}
    </div>
  );
}
