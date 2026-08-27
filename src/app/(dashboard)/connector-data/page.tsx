"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Braces, Eye, FileText } from "lucide-react";
import { Button, Card, ErrorState, PageHeader } from "@/components/shared/ui";
import { connectorTransmissionsService, type ConnectorTransmission, type TransmissionPage, type TransmissionSummary, type ValidatedProduct } from "@/services/connector-transmissions.service";
import { extractionTypes, type ExtractionType } from "@/services/connector-data.service";

const issueLabels: Record<string, string> = { all: "Todos os itens", ok: "Itens sem pendência", ncm: "Itens com NCM pendente", cest: "Itens com CEST pendente", cst: "Itens com CST ICMS pendente", cfop: "Itens com CFOP pendente" };
type OriginFilter = "ALL" | "API" | "SPED";
type QueryFilter = "ALL" | ExtractionType;

export default function ConnectorDataPage() {
  const [fileFilter, setFileFilter] = useState("");
  const [transmissionPage, setTransmissionPage] = useState(1);
  const [origin, setOrigin] = useState<OriginFilter>("ALL");
  const [queryCode, setQueryCode] = useState<QueryFilter>("ALL");
  const [issue, setIssue] = useState("");
  const filters={...(origin==="ALL"?{}:{origin}),...(queryCode==="ALL"?{}:{queryCode})};
  const transmissions = useQuery({ queryKey: ["connector-transmissions", transmissionPage, fileFilter, origin, queryCode], queryFn: () => connectorTransmissionsService.list({ page: transmissionPage, file: fileFilter, ...filters }) });
  const summary = useQuery({ queryKey: ["connector-transmission-summary", origin, queryCode], queryFn: () => connectorTransmissionsService.summary(filters) });
  const validationProducts = useQuery({ queryKey: ["connector-validation-products", issue, origin, queryCode], queryFn: () => connectorTransmissionsService.products(issue, filters), enabled: Boolean(issue) });
  const proposals = useQuery({ queryKey: ["sped-fiscal-proposals"], queryFn: connectorTransmissionsService.spedProposals });

  return <>
    <PageHeader title="Cadastro fiscal importado" description="Selecione um status para consultar os produtos recebidos e suas pendências de cadastro." />
    <DataFilters origin={origin} queryCode={queryCode} setOrigin={(value)=>{setOrigin(value);setIssue("");setTransmissionPage(1);}} setQueryCode={(value)=>{setQueryCode(value);setIssue("");setTransmissionPage(1);}} />
    {summary.isError ? <ErrorState message="Não foi possível carregar o resumo dos produtos importados." /> : <TransmissionSummaryCards summary={summary.data} loading={summary.isLoading} selectedIssue={issue} origin={origin} queryCode={queryCode} select={setIssue} />}
    {origin!=="API"&&(queryCode==="ALL"||queryCode==="FISCAL_DOCUMENT_ITEMS_V1")&&proposals.data?.items.length ? <SpedProposals items={proposals.data.items} total={proposals.data.total} /> : null}
    <ValidationProducts issue={issue} loading={validationProducts.isLoading} error={validationProducts.isError} items={validationProducts.data} />
    {transmissions.isError ? <ErrorState message="Não foi possível carregar os lotes enviados pelo Connector." /> : <TransmissionList data={transmissions.data} loading={transmissions.isLoading} file={fileFilter} origin={origin} queryCode={queryCode} setFile={(value) => { setFileFilter(value); setTransmissionPage(1); }} setPage={setTransmissionPage} />}
  </>;
}

function DataFilters({origin,queryCode,setOrigin,setQueryCode}:{origin:OriginFilter;queryCode:QueryFilter;setOrigin:(value:OriginFilter)=>void;setQueryCode:(value:QueryFilter)=>void}){
  return <Card className="mb-5 grid gap-4 p-4 xl:grid-cols-[1fr_auto]"><div><b className="text-sm text-slate-800">Base de extração</b><p className="mt-1 text-xs text-slate-500">Os indicadores e registros abaixo seguem os filtros selecionados.</p><div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar dados por base de extração">{(["ALL","API","SPED"] as const).map(value=><Button key={value} variant={origin===value?"primary":"secondary"} aria-pressed={origin===value} onClick={()=>setOrigin(value)}>{value==="API"?<Braces size={15}/>:value==="SPED"?<FileText size={15}/>:null}{value==="ALL"?"Todas as origens":value==="API"?"Via API":"Arquivo SPED"}</Button>)}</div></div><label className="grid min-w-72 content-end gap-1 text-sm font-semibold text-slate-700">Consulta / tipo de dado<select value={queryCode} onChange={event=>setQueryCode(event.target.value as QueryFilter)} className="h-9 rounded-md border border-slate-300 bg-white px-3 font-normal outline-none focus:border-cyan-600"><option value="ALL">Todas as consultas</option>{extractionTypes.map(([code,label])=><option key={code} value={code}>{label} · {code}</option>)}</select></label></Card>;
}

function SpedProposals({ items, total }: { items: Awaited<ReturnType<typeof connectorTransmissionsService.spedProposals>>["items"]; total: number }) { return <Card className="mb-5 overflow-hidden"><div className="border-b p-4"><b className="text-slate-800">Propostas fiscais geradas do SPED</b><span className="ml-2 text-sm text-slate-500">{total} pendente(s) de revisão</span></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead><tr className="bg-slate-50 text-xs uppercase text-slate-500"><th className="p-3 text-left">Produto / família sugerida</th><th className="p-3 text-left">NCM / CEST</th><th className="p-3 text-left">CST / CFOP observados</th><th className="p-3 text-left">Alíquota efetiva</th><th className="p-3 text-left">Regras</th></tr></thead><tbody>{items.map(item => <tr key={item.id} className="border-t border-slate-100"><td className="p-3"><b className="block">{item.canonicalDescription}</b><small className="text-slate-500">{item.productCode} · {item.familyName || item.familyKey || "Família a definir"}</small></td><td className="p-3">{item.ncm || "—"} / {item.cest || "—"}</td><td className="p-3">{item.taxation.cstIcms || "—"} / {item.taxation.cfop || "—"}</td><td className="p-3">ICMS {item.evidence.effectiveIcmsRate ?? "—"}% · IPI {item.evidence.effectiveIpiRate ?? "—"}%</td><td className="p-3">{item.validation.error ? "Validação indisponível" : `${item.validation.matchedRules?.length ?? 0} regra(s) encontrada(s)`}</td></tr>)}</tbody></table></div></Card>; }

function TransmissionSummaryCards({ summary, loading, selectedIssue, origin, queryCode, select }: { summary?: TransmissionSummary; loading: boolean; selectedIssue: string; origin: OriginFilter; queryCode: QueryFilter; select: (issue: string) => void }) {
  const cards = [["Total de itens", summary?.totalItems ?? summary?.products ?? 0, "all"], ["Sem pendência", summary?.withoutPending ?? 0, "ok"], ["NCM pendente", summary?.missingNcm ?? 0, "ncm"], ["CEST pendente", summary?.missingCest ?? 0, "cest"], ["CST ICMS pendente", summary?.missingCstIcms ?? 0, "cst"], ["CFOP pendente", summary?.missingCfop ?? 0, "cfop"]];
  const originLabel=origin==="API"?"via API":origin==="SPED"?"do SPED":"de todas as origens";
  const queryLabel=queryCode==="ALL"?"Todas as consultas":extractionTypes.find(([code])=>code===queryCode)?.[1]??queryCode;
  return <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label={`Resumo de dados importados ${originLabel} em ${queryLabel}`}>{cards.map(([label, total, issue]) => <button key={String(issue)} type="button" onClick={() => select(String(issue))} aria-pressed={selectedIssue === issue} className="rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500"><Card className={`h-full p-4 transition hover:border-blue-300 hover:shadow-sm ${selectedIssue === issue ? "border-blue-500 bg-blue-50" : ""}`}><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{loading ? "—" : total}</p><p className="mt-1 truncate text-[11px] text-slate-500" title={`${queryLabel} · ${originLabel}`}>{queryLabel} · {originLabel}</p><p className="mt-2 text-xs text-blue-700">Ver registros</p></Card></button>)}</section>;
}

function ValidationProducts({ issue, loading, error, items }: { issue: string; loading: boolean; error: boolean; items?: ValidatedProduct[] }) {
  if (!issue) return null;
  if (error) return <ErrorState message="Não foi possível carregar os produtos deste status." />;
  return <Card className="mb-5 overflow-x-auto"><div className="border-b p-4"><b className="text-slate-800">{issueLabels[issue] ?? "Produtos importados"}</b><span className="ml-2 text-sm text-slate-500">{loading ? "Carregando..." : `${items?.length ?? 0} item(ns)`}</span></div>{loading ? <p className="p-5 text-sm text-slate-500">Carregando produtos...</p> : <><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500"><th className="p-3 text-left">Produto</th><th className="p-3 text-left">NCM / CEST</th><th className="p-3 text-left">CST / CFOP</th><th className="p-3 text-left">Arquivos SPED de origem</th><th className="p-3 text-right"><span className="sr-only">Ações</span></th></tr></thead><tbody>{items?.map(item => <tr key={item.code} className="border-t border-slate-100"><td className="p-3"><b className="block text-slate-800">{item.description}</b><small className="font-mono text-slate-500">{item.code}</small></td><td className="p-3">{item.ncm || "—"} / {item.cest || "—"}</td><td className="p-3">{item.cstIcms || "—"} / {item.cfop || "—"}</td><td className="p-3">{item.files.join(", ") || "—"}</td><td className="p-3 text-right"><Link href={`/connector-data/products/${encodeURIComponent(item.code)}`} className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"><Eye size={14} />Detalhes</Link></td></tr>)}</tbody></table>{!items?.length && <p className="p-8 text-center text-sm text-slate-500">Nenhum produto encontrado para este status.</p>}</>}</Card>;
}

function transmissionOrigin(item: ConnectorTransmission): Exclude<OriginFilter,"ALL"> {
  const type=(item.inputType??"").toUpperCase();
  const name=(item.sourceName??"").toLowerCase();
  const spedFile=name.startsWith("[sped]")||/\.(txt|sped)(?:\b|[\s·-])/.test(name);
  return type.includes("SPED")||spedFile?"SPED":"API";
}

function TransmissionList({ data, loading, file, origin, queryCode, setFile, setPage }: { data?: TransmissionPage; loading: boolean; file: string; origin: OriginFilter; queryCode: QueryFilter; setFile: (value: string) => void; setPage: (page: number) => void }) {
  const items = (data?.items ?? []).filter(item=>(origin==="ALL"||transmissionOrigin(item)===origin)&&(queryCode==="ALL"||item.queryCode===queryCode));
  const page = data?.page ?? 1;
  const pages = Math.max(1, data?.totalPages ?? 1);
  return <Card className="mb-5 overflow-hidden"><div className="flex flex-wrap items-center gap-3 border-b bg-slate-50 px-5 py-4"><b className="mr-auto text-sm text-slate-800">Lotes recebidos do Connector</b><input className="rounded border border-slate-300 px-2 py-1 text-sm" value={file} onChange={event => setFile(event.target.value)} placeholder="Filtrar pelo nome da origem" /></div>{loading ? <p className="p-5 text-sm text-slate-500">Carregando lotes...</p> : !items.length ? <p className="p-5 text-sm text-slate-500">Nenhum lote encontrado para esta origem.</p> : <><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Origem</th><th className="p-3">Arquivo / identificação</th><th className="p-3">Registros</th><th className="p-3">Produto</th><th className="p-3">NCM</th><th className="p-3">CST / CFOP</th></tr></thead><tbody>{items.map(item => {const itemOrigin=transmissionOrigin(item);return <tr className="border-b border-slate-100" key={item.id}><td className="p-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${itemOrigin==="SPED"?"bg-violet-100 text-violet-800":"bg-cyan-100 text-cyan-800"}`}>{itemOrigin==="SPED"?<FileText size={13}/>:<Braces size={13}/>} {itemOrigin==="SPED"?"SPED":"API"}</span></td><td className="p-3"><b>{item.sourceName || (itemOrigin==="API"?"Integração via API":"Arquivo SPED")}</b><small className="block">{item.status}{item.sourceSize != null ? ` · ${new Intl.NumberFormat("pt-BR", { style: "unit", unit: "byte", unitDisplay: "narrow" }).format(item.sourceSize)}` : ""}</small></td><td className="p-3">{item.processedRows}/{item.totalRows}</td><td className="p-3">{item.records[0] ? <Link className="text-blue-700 hover:underline" href={`/connector-data/products/${item.records[0].id}?source=connector`}>{item.records[0].canonicalDescription}</Link> : "—"}</td><td className="p-3">{item.records[0]?.ncm || "—"}</td><td className="p-3">{String(item.records[0]?.rawData?.cstIcms ?? "—")} / {String(item.records[0]?.rawData?.cfop ?? "—")}</td></tr>})}</tbody></table></div><div className="flex items-center justify-between p-3 text-sm"><span>{origin==="ALL"?(data?.total??0):items.length} lote(s) · página {page}/{pages}</span><div className="flex gap-2"><button className="rounded border px-2 py-1 disabled:opacity-50" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><button className="rounded border px-2 py-1 disabled:opacity-50" disabled={page === pages} onClick={() => setPage(page + 1)}>Próxima</button></div></div></>}</Card>;
}
