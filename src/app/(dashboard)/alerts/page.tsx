"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Check, CheckCircle2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Download, Edit3, FileText, FileWarning, Layers3, LoaderCircle, PackageSearch, Search, ShieldAlert, ShieldCheck, Upload } from "lucide-react";
import { Button, Card, ErrorState, PageHeader, PageLoader, money } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { fiscalComplianceService, DOCUMENT_ITEM_DETAIL_RULES, type DocumentItemsGroup } from "@/services/fiscal-compliance.service";
import { useTabSearchParams } from "@/providers/tabs-provider";
import { fiscalAlertsService, type FiscalAlertEntity, type FiscalAlertGroup, type FiscalAlertItem, type FiscalAlertSeverity, type FiscalSuggestionReference, type SpedAlertContext } from "@/services/fiscal-alerts.service";
import { exportAlertsWorkbook } from "./export";
import { readAlertsWorkbook } from "./import";
import { FiscalInconsistenciesCard } from "@/components/fiscal-inconsistencies-card";

const entityLabel:Record<FiscalAlertEntity,string>={PRODUCT:"Produtos",TAXATION:"Tributações",FAMILY:"Famílias",SUPPLIER:"Fornecedores",SPED:"SPED",DOCUMENT:"Notas fiscais"};
const severityLabel:Record<FiscalAlertSeverity,string>={CRITICAL:"Crítica",HIGH:"Alta",MEDIUM:"Média",LOW:"Baixa"};
const severityStyle:Record<FiscalAlertSeverity,string>={CRITICAL:"border-red-300 bg-red-50 text-red-800",HIGH:"border-orange-300 bg-orange-50 text-orange-800",MEDIUM:"border-amber-300 bg-amber-50 text-amber-800",LOW:"border-blue-300 bg-blue-50 text-blue-800"};

export default function FiscalAlertsPage(){
  const importInput=useRef<HTMLInputElement>(null);
  // gcTime alto o bastante pra sobreviver a uma navegação pra outra tela enquanto o cálculo do
  // cache frio ainda está rodando (ver background-completion-notifier.tsx) — sem isso, o
  // React Query poderia descartar a consulta antes dela terminar e a aba nunca piscaria.
  const alerts=useQuery({queryKey:["fiscal-alerts","summary"],queryFn:fiscalAlertsService.summary,gcTime:30*60*1000});
  // O resumo abre com o último resultado em cache (recalculado em segundo plano quando vence);
  // "Gerar alertas fiscais" força o recálculo da validação antes de recarregar os cards.
  const validation=useMutation({mutationFn:async()=>{await fiscalComplianceService.refreshProducts();return fiscalAlertsService.scanCatalog();},onSuccess:async()=>{await alerts.refetch();}});
  const exportWorkbook=useMutation({mutationFn:()=>exportAlertsWorkbook(alerts.data??[])});
  const importWorkbook=useMutation({
    mutationFn:async(file:File)=>{
      const {rows,sheetsRead,sheetsSkipped}=await readAlertsWorkbook(file);
      if(!rows.length)throw new Error(sheetsRead.length?"Nenhuma linha com correção preenchida foi encontrada nas abas lidas.":"Nenhuma aba com o layout do \"Baixar\" foi encontrada neste arquivo.");
      if(!confirm(`${rows.length} produto(s) serão corrigidos no cadastro a partir de ${sheetsRead.length} aba(s)${sheetsSkipped.length?` (${sheetsSkipped.length} aba(s) ignorada(s), sem o layout esperado)`:""}. Confirmar importação?`))throw new Error("__cancelled__");
      return fiscalComplianceService.bulkCorrect(rows);
    },
    onSuccess:async()=>{await alerts.refetch();},
  });
  // ?group=<id> (atalho do Painel de Conciliação) abre a Central já com aquele card selecionado.
  const searchParams=useTabSearchParams();
  const initialGroup=searchParams.get("group")??undefined;
  const [selectedId,setSelectedId]=useState<string|undefined>(initialGroup);
  const detailRef=useRef<HTMLDivElement>(null);
  const hasData=Boolean(alerts.data);
  useEffect(()=>{if(initialGroup&&hasData)detailRef.current?.scrollIntoView({behavior:"smooth",block:"start"});},[initialGroup,hasData]);
  const [entity,setEntity]=useState<FiscalAlertEntity|"ALL">("ALL");
  const [search,setSearch]=useState("");
  const visible=useMemo(()=>(alerts.data??[]).filter(group=>entity==="ALL"||group.entity===entity),[alerts.data,entity]);
  const selected=(alerts.data??[]).find(group=>group.id===selectedId)??visible[0];
  if(alerts.isError)return <><PageHeader title="Central de Alertas" description="Pendências cadastrais e fiscais do cliente."/><ErrorState message={getApiErrorMessage(alerts.error)}/></>;
  return <>
    <PageHeader title="Central de Alertas" description="Pendências identificadas nos produtos, tributações e cadastros do cliente." action={<div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={()=>exportWorkbook.mutate()} disabled={exportWorkbook.isPending||!alerts.data?.length}>{exportWorkbook.isPending?<LoaderCircle size={16} className="animate-spin"/>:<Download size={16}/>} {exportWorkbook.isPending?"Gerando planilha...":"Baixar"}</Button>
      <input ref={importInput} type="file" accept=".xlsx,.xls" className="hidden" onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)importWorkbook.mutate(file);}}/>
      <Button variant="secondary" onClick={()=>importInput.current?.click()} disabled={importWorkbook.isPending}>{importWorkbook.isPending?<LoaderCircle size={16} className="animate-spin"/>:<Upload size={16}/>} {importWorkbook.isPending?"Importando...":"Importar"}</Button>
      <Button onClick={()=>validation.mutate()} disabled={validation.isPending}>{validation.isPending?<LoaderCircle size={16} className="animate-spin"/>:<ShieldAlert size={16}/>} {validation.isPending?"Validando...":"Gerar alertas fiscais"}</Button>
    </div>}/>
    {exportWorkbook.isError&&<div role="alert" className="mb-5"><ErrorState message={getApiErrorMessage(exportWorkbook.error)}/></div>}
    {importWorkbook.isError&&getApiErrorMessage(importWorkbook.error)!=="__cancelled__"&&<div role="alert" className="mb-5"><ErrorState message={getApiErrorMessage(importWorkbook.error)}/></div>}
    {importWorkbook.isSuccess&&<div role="status" className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800"><CheckCircle2 size={17}/>{importWorkbook.data.updated} produto(s) corrigido(s).{importWorkbook.data.notFound.length>0&&` ${importWorkbook.data.notFound.length} código(s) não encontrado(s) no cadastro atual.`}{importWorkbook.data.skipped>0&&` ${importWorkbook.data.skipped} linha(s) sem alteração a aplicar.`}</div>}
    {validation.isSuccess&&<div role="status" className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800"><CheckCircle2 size={17}/>Validação concluída. Os alertas persistidos foram atualizados.</div>}
    {validation.isError&&<div role="alert" className="mb-5"><ErrorState message={getApiErrorMessage(validation.error)}/></div>}
    <FiscalInconsistenciesCard/>
    <div className="mb-5 flex max-w-5xl flex-wrap gap-2">{(["ALL","PRODUCT","TAXATION","DOCUMENT","SPED","FAMILY","SUPPLIER"] as const).map(value=><Button key={value} variant={entity===value?"primary":"secondary"} onClick={()=>{setEntity(value);setSelectedId(undefined);}}>{value==="ALL"?"Todas":entityLabel[value]}</Button>)}</div>
    {alerts.isLoading?<PageLoader/>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(group=><AlertCard key={group.id} group={group} selected={selected?.id===group.id} select={()=>setSelectedId(group.id)}/>)}</div>}
    {selected&&<div ref={detailRef} className="scroll-mt-4"><Card className="mt-6 overflow-visible">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">{entityLabel[selected.entity]} · {selected.field}</p><h2 className="mt-1 text-lg font-bold text-slate-900">{selected.title}</h2><p className="mt-1 text-sm text-slate-500">{selected.kind==="COMPLIANCE"?"Produtos que cumprem a regra, com a evidência encontrada nas notas fiscais.":"Comparação da situação atual com a sugestão de correção."}</p></div><label className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3"><Search size={16} className="text-slate-400"/><input value={search} onChange={event=>setSearch(event.target.value)} className="min-w-48 bg-transparent text-sm outline-none" placeholder="Pesquisar nesta pendência"/></label></div>
      <AlertItems group={selected} search={search}/>
    </Card></div>}
  </>;
}

function AlertCard({group,selected,select}:{group:FiscalAlertGroup;selected:boolean;select:()=>void}){
  if(group.kind==="COMPLIANCE")return <button type="button" onClick={select} className="text-left"><Card className={`h-full border-emerald-200 bg-emerald-50/60 p-5 transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md ${selected?"border-emerald-600 ring-2 ring-emerald-100":""}`}><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700"><ShieldCheck size={20}/></span><span className="rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-800">Em conformidade</span></div><strong className="mt-4 block text-slate-900">{group.title}</strong><p className="mt-1 min-h-10 text-sm text-slate-600">{group.description}</p><div className="mt-4 flex items-end justify-between"><span><b className="block text-2xl text-emerald-800">{group.affected}</b><small className="text-slate-500">produtos em conformidade</small></span><span className="text-xs font-semibold text-emerald-700">Ver produtos →</span></div></Card></button>;
  return <button type="button" onClick={select} className="text-left"><Card className={`h-full p-5 transition hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md ${selected?"border-cyan-600 ring-2 ring-cyan-100":""}`}><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-lg bg-cyan-50 text-cyan-700"><EntityIcon entity={group.entity}/></span><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${severityStyle[group.severity]}`}>{severityLabel[group.severity]}</span></div><strong className="mt-4 block text-slate-900">{group.title}</strong><p className="mt-1 min-h-10 text-sm text-slate-500">{group.description}</p>{!!group.estimatedImpact&&<p className="mt-2 text-sm font-semibold text-red-700">Impacto estimado: {money(group.estimatedImpact)}</p>}{!!group.highlight&&<p className="mt-2 text-sm font-semibold text-amber-800">{group.highlight.label}: {money(group.highlight.value)}</p>}<div className="mt-4 flex items-end justify-between"><span><b className="block text-2xl text-slate-900">{group.affected}</b><small className="text-slate-500">registros afetados</small></span><span className="text-xs font-semibold text-cyan-700">Ver De/Para →</span></div></Card></button>}
/** Findings com sugestão determinística e centenas/milhares de registros (LC 224/2025 etc.) — revisar
 * item a item não é viável. Lista compacta pra conferência visual rápida rolando a tela, mais o botão
 * de aprovar tudo de uma vez (backend reprocessa a finding inteira, não só os `group.items` — que vêm
 * limitados a 100 pra não pesar a tela). */
function BulkApproveBar({group,onDone}:{group:FiscalAlertGroup;onDone:()=>void}){
  const bulk=useMutation({mutationFn:()=>fiscalAlertsService.bulkQueueRegistration(group.bulkQueueCode!)});
  // Some da pendência assim que o lote é aceito — não espera o próximo refetch/expirar o cache
  // pra sumir da tela, senão pareceria que "aprovar todos" não fez nada até recarregar a página.
  useEffect(()=>{if(bulk.isSuccess)onDone();},[bulk.isSuccess,onDone]);
  const confirmAndRun=()=>{if(confirm(`Aprovar a sugestão para os ${group.affected} registro(s) desta pendência? Cada um ainda precisa da confirmação do usuário logado no Connector antes de gravar no ERP.`))bulk.mutate();};
  if(bulk.isSuccess)return <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800"><CheckCircle2 size={17}/>{bulk.data.queued} de {bulk.data.total} enviado(s) para a fila de integração.{bulk.data.skipped.length>0&&` ${bulk.data.skipped.length} pulado(s) (cadastro incompleto).`}</div>;
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3">
    <p className="text-sm text-cyan-900">São {group.affected} registros — revisão item a item não é prática aqui. Confira a lista abaixo e aprove tudo de uma vez.</p>
    <Button onClick={confirmAndRun} disabled={bulk.isPending}>{bulk.isPending?<LoaderCircle size={16} className="animate-spin"/>:<Check size={16}/>} {bulk.isPending?"Enviando...":`Aprovar todos (${group.affected})`}</Button>
    {bulk.isError&&<p role="alert" className="w-full text-sm text-red-700">{getApiErrorMessage(bulk.error)}</p>}
  </div>;
}
/** Linha da lista compacta — um padrão único pra todo card de /alerts (cadastro, Cosmos, SPED,
 * conformidade), pensado pra rolar rápido quando o volume é grande (centenas/milhares de itens),
 * em vez do card grande antigo por item. Cada linha resolve sozinha sua ação (aprovar, editar valor,
 * abrir Cosmos, ver detalhes) sem afetar as demais. */
function AlertRow({group,item,onSent}:{group:FiscalAlertGroup;item:FiscalAlertItem;onSent:(id:string)=>void}){
  const isCompliance=group.kind==="COMPLIANCE";
  // BARCODE_MISSING/BARCODE_INVALID_CHECK_DIGIT chegam com actionable:false (o backend, ao
  // enriquecer com o Cosmos, desliga o fluxo antigo de digitar às cegas) — mas erpField continua
  // presente, e o Cosmos já traz candidatos como referência. Continuam acionáveis aqui: o analista
  // confere o(s) candidato(s) (link Cosmos) e digita o GTIN escolhido, igual a NCM/CEST.
  const isNewBarcode=group.id==="BARCODE_MISSING";
  const nonActionable=item.actionable===false&&!item.erpField;
  // Cadastro sem sugestão pronta (NCM/CEST) ou código de barras (o valor sugerido do Cosmos é uma
  // lista de candidatos pra conferência, não um GTIN pronto pra gravar) — a linha já abre em edição.
  const needsManualValue=Boolean(item.erpField)&&(!item.suggestedValue||item.erpField==="BARCODE");
  const [editing,setEditing]=useState(needsManualValue);
  const [value,setValue]=useState(needsManualValue?"":item.suggestedValue);
  const queue=useMutation({mutationFn:async()=>isNewBarcode
    ?fiscalComplianceService.addAccessCode(item.productId??item.code,value.trim())
    :item.erpField
    ?fiscalAlertsService.queueRegistration({productId:item.productId??item.code,field:item.erpField,currentValue:item.currentValue,newValue:value.trim(),groupId:group.id})
    :fiscalAlertsService.queueAdjustment({groupId:group.id,itemId:item.id,field:group.field,value:value.trim(),decision:editing?"EDITED":"ACCEPTED"})});
  // Some da pendência assim que o envio é aceito — sem esperar o próximo refetch da lista inteira,
  // senão o item continuaria aparecendo como pendente mesmo já enviado (individual ou em massa).
  useEffect(()=>{if(queue.isSuccess)onSent(item.id);},[queue.isSuccess,item.id,onSent]);
  const cosmosUrl=item.suggestionReference?.sourceUrl?.startsWith("https://cosmos.bluesoft.com.br/pesquisar?q=")?item.suggestionReference.sourceUrl:undefined;
  const catalogId=item.productId??item.maintenanceId;
  const rawHref=item.href??(catalogId?`/catalog-review?productId=${encodeURIComponent(catalogId)}&code=${encodeURIComponent(item.code)}`:null);
  const href=rawHref?`${rawHref}${rawHref.includes("?")?"&":"?"}from=alerts`:null;
  const hasTooltip=Boolean(item.suggestionReference)||Boolean(item.spedContext);
  // DOCUMENT_ITEM_DETAIL_RULES: pendências item-a-item cujo finding só cita "N de M item(ns)..." —
  // "Ver notas" abre o detalhe completo (cabeçalho + itens da nota), pra não deixar essas sempre
  // "Não acionável" sem nenhum jeito de inspecionar quais documentos/itens reais geraram a pendência.
  const canShowDocuments=(DOCUMENT_ITEM_DETAIL_RULES as readonly string[]).includes(group.id);
  const [showDocuments,setShowDocuments]=useState(false);
  return <tr className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50">
    <td className="p-3"><strong className="block text-slate-900">{item.description}</strong><span className="font-mono text-xs text-slate-500">{item.code}</span></td>
    <td className="p-3 font-mono text-xs text-slate-700">{item.ncm||"—"}</td>
    <td className="max-w-xs p-3 text-red-700">{item.currentValue}</td>
    <td className="max-w-xs p-3">
      {editing&&!queue.isSuccess
        ?<div><input autoFocus value={value} onChange={event=>setValue(event.target.value)} placeholder="Novo valor" className="h-8 w-full min-w-28 rounded-lg border border-slate-300 px-2 text-xs outline-none focus:border-cyan-600"/>
          {item.erpField==="BARCODE"&&item.suggestedValue&&<p className="mt-1 text-[11px] text-slate-500">Cosmos: {item.suggestedValue}</p>}
        </div>
        :<span tabIndex={hasTooltip?0:undefined} aria-describedby={hasTooltip?`sugg-${item.id}`:undefined} className={`${hasTooltip?"group relative outline-none":""} font-semibold text-emerald-700`}>{value||item.suggestedValue||"—"}{hasTooltip&&<SuggestionDetails id={`sugg-${item.id}`} source={item.source} reference={item.suggestionReference} spedContext={item.spedContext}/>}</span>}
    </td>
    <td className="p-3 text-right">
      {isCompliance?<span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><ShieldCheck size={14}/>Conforme</span>
       :queue.isSuccess?<span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14}/>Enviado</span>
       :nonActionable?<div className="inline-flex flex-col items-end gap-1"><span className="text-xs text-slate-500" title={item.nonActionableReason}>Não acionável</span>{canShowDocuments&&<Button variant="secondary" onClick={()=>setShowDocuments(true)} className="h-7 px-2 text-xs"><FileText size={12}/>Ver notas</Button>}{showDocuments&&<DocumentItemsModal productId={item.code} rule={group.id} subtitle={`${group.title} — ${item.description}`} close={()=>setShowDocuments(false)}/>}</div>
       :<div className="inline-flex flex-col items-end gap-1">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {cosmosUrl&&<a href={cosmosUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-cyan-300 px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50" title="Consultar no Cosmos — confira marca, sabor, peso e embalagem">Cosmos ↗</a>}
            {href&&<Link href={href} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"><Edit3 size={13}/>Detalhes</Link>}
            {!needsManualValue&&!editing&&<Button variant="secondary" onClick={()=>setEditing(true)} className="h-8 px-2.5 text-xs"><Edit3 size={13}/>Editar</Button>}
            <Button onClick={()=>queue.mutate()} disabled={queue.isPending||!value.trim()} className="h-8 px-2.5 text-xs">{queue.isPending?<LoaderCircle size={13} className="animate-spin"/>:<Check size={13}/>}{editing?"Enviar":"Aprovar"}</Button>
          </div>
          {queue.isError&&<span className="max-w-56 text-right text-[11px] text-red-700">{getApiErrorMessage(queue.error)}</span>}
        </div>}
    </td>
  </tr>;
}
function AlertItemsTable({group,search}:{group:FiscalAlertGroup;search:string}){
  // Itens enviados (individual ou "Aprovar todos") somem da lista na hora — sem isso, a pendência
  // continuaria mostrando algo já resolvido até o próximo refetch/expirar o cache do resumo inteiro.
  const [sentIds,setSentIds]=useState<Set<string>>(new Set());
  const markSent=(id:string)=>setSentIds(previous=>previous.has(id)?previous:new Set(previous).add(id));
  const term=search.trim().toLocaleLowerCase("pt-BR");
  const filtered=group.items.filter(item=>!sentIds.has(item.id)&&(!term||`${item.code} ${item.description} ${item.ncm??""} ${item.currentValue} ${item.suggestedValue} ${item.source} ${Object.values(item.suggestionReference??{}).join(" ")}`.toLocaleLowerCase("pt-BR").includes(term)));
  // Reseta a página (e os itens marcados como enviados) quando o grupo ou a busca mudam — ajuste de
  // estado durante a renderização (em vez de useEffect+setState) pra não disparar uma renderização
  // em cascata desnecessária.
  const resetKey=`${group.id}:${term}`;
  const [pageState,setPageState]=useState({page:1,key:resetKey});
  if(pageState.key!==resetKey){setPageState({page:1,key:resetKey});if(sentIds.size)setSentIds(new Set());}
  const page=pageState.page;
  const setPage=(nextPage:number)=>setPageState({page:nextPage,key:resetKey});
  const pageSize=50;
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
  const currentPage=Math.min(page,pageCount);
  const items=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  // "Aprovar todos" cobre a pendência inteira no backend (não só os itens carregados aqui) — some
  // com tudo que está na tela de uma vez.
  const markAllSent=()=>setSentIds(new Set(group.items.map(item=>item.id)));
  return <div>
    {group.bulkQueueCode&&!!filtered.length&&<div className="p-5 pb-0"><BulkApproveBar group={group} onDone={markAllSent}/></div>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><th className="p-3">Produto</th><th className="p-3">NCM</th><th className="p-3">De</th><th className="p-3">Para</th><th className="p-3">Ações</th></tr></thead>
      <tbody>{items.map(item=><AlertRow key={item.id} group={group} item={item} onSent={markSent}/>)}</tbody>
    </table>{!items.length&&<p className="p-8 text-center text-sm text-slate-500">{sentIds.size?"Todos os registros carregados aqui já foram enviados.":"Nenhum registro corresponde à pesquisa."}</p>}</div>
    {filtered.length>pageSize&&<AlertItemsPagination page={currentPage} pageCount={pageCount} total={filtered.length} setPage={setPage}/>}
    {group.affected>group.items.length&&<p className="border-t border-slate-100 p-3 text-center text-xs text-slate-500">Mostrando {group.items.length} de {group.affected} registros{group.bulkQueueCode?" — o botão \"Aprovar todos\" acima cobre todos, não só os listados aqui.":" — a planilha \"Baixar\" traz a lista completa."}</p>}
  </div>;
}
function AlertItems({group,search}:{group:FiscalAlertGroup;search:string}){
  return <AlertItemsTable group={group} search={search}/>;
}
function AlertItemsPagination({page,pageCount,total,setPage}:{page:number;pageCount:number;total:number;setPage:(page:number)=>void}){
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4">
    <p className="text-xs text-slate-500">Página {page} de {pageCount} · {total} registro(s)</p>
    <div className="flex items-center gap-1">
      <Button variant="secondary" onClick={()=>setPage(1)} disabled={page<=1} title="Primeira página"><ChevronsLeft size={16}/></Button>
      <Button variant="secondary" onClick={()=>setPage(page-1)} disabled={page<=1} title="Página anterior"><ChevronLeft size={16}/></Button>
      <Button variant="secondary" onClick={()=>setPage(page+1)} disabled={page>=pageCount} title="Próxima página"><ChevronRight size={16}/></Button>
      <Button variant="secondary" onClick={()=>setPage(pageCount)} disabled={page>=pageCount} title="Última página"><ChevronsRight size={16}/></Button>
    </div>
  </div>;
}
function SuggestionDetails({id,source,reference,spedContext}:{id:string;source:string;reference?:FiscalSuggestionReference;spedContext?:SpedAlertContext}){
  const rows=[["Tabela de referência",reference?.table],["Origem",reference?.origin??source],["Estado do cliente",reference?.clientState],["Regra aplicada",reference?.rule],["Motivo",reference?.reason]];
  if(spedContext)rows.push(["Escrituração",spedContext.bookkeeping==="EFD_CONTRIBUTIONS"?"EFD-Contribuições":"EFD ICMS/IPI"],["Registro",[spedContext.record,spedContext.parentRecord&&`pai ${spedContext.parentRecord}`,spedContext.line&&`linha ${spedContext.line}`].filter(Boolean).join(" · ")||undefined],["Registros relacionados",spedContext.relatedRecords.join(", ")||undefined],["Arquivo",spedContext.sourceFile]);
  return <div id={id} role="tooltip" className="pointer-events-none invisible absolute bottom-[calc(100%+8px)] left-0 z-20 w-72 translate-y-1 rounded-lg bg-slate-900 p-4 text-left normal-case text-white opacity-0 shadow-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus:visible group-focus:translate-y-0 group-focus:opacity-100"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-cyan-300">Referência da sugestão</p><dl className="grid gap-2">{rows.map(([label,value])=><div key={label}><dt className="text-[11px] text-slate-400">{label}</dt><dd className="text-xs font-medium">{value||"Não informado pela regra"}</dd></div>)}</dl><span className="absolute -bottom-1 left-6 size-2 rotate-45 bg-slate-900"/></div>;
}
// "2026-04-15" ou "2026-04-15T00:00:00.000Z" (Oracle DATE extraído vira timestamp ISO) — sempre os
// 10 primeiros caracteres são a data; reformata por string em vez de `new Date(...)`, que em fuso
// negativo (Brasil) mostraria o dia anterior pra uma data-only sem horário.
const formatDate=(value:string)=>{const [y,m,d]=value.slice(0,10).split("-");return y&&m&&d?`${d}/${m}/${y}`:value||"—";};
const taxCell=(cst:string|null,base:number|null,rate:number|null,value:number|null)=>base==null&&rate==null&&value==null?"—":<>{cst&&<span className="text-slate-500">CST {cst} · </span>}{money(base??0)} × {rate??0}% = <strong>{money(value??0)}</strong></>;
/** Cabeçalho + itens de UMA nota — uma pendência item-a-item pode ter vários itens do mesmo produto
 * na mesma nota (ex.: lançamento duplicado, devolução parcial), por isso agrupado por documento em
 * vez de uma lista plana de itens. */
function DocumentGroupCard({document}:{document:DocumentItemsGroup}){
  const operationLabel=document.operationType==="S"?"Saída":document.operationType==="E"?"Entrada":document.operationType||"—";
  return <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 text-sm">
      <div><strong className="block text-slate-900">Nota {document.documentNumber??"—"}{document.documentSeries?` · série ${document.documentSeries}`:""}</strong><span className="font-mono text-xs text-slate-500">{document.documentKey}</span></div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600"><span>Emissão {formatDate(document.issueDate)}</span><span>{operationLabel}</span><span>CGO {document.cgo||"—"}</span>{document.documentTotal!=null&&<span className="font-semibold text-slate-900">{money(document.documentTotal)}</span>}</div>
    </div>
    <div className="overflow-x-auto"><table className="w-full text-left text-xs">
      <thead><tr className="border-b border-slate-100 text-slate-500"><th className="p-2">Item</th><th className="p-2">CFOP</th><th className="p-2">NCM</th><th className="p-2">ICMS</th><th className="p-2">PIS</th><th className="p-2">Cofins</th><th className="p-2">IPI/CBS/IBS</th></tr></thead>
      <tbody>{document.items.map(item=><tr key={item.item_number} className="border-b border-slate-50 last:border-0">
        <td className="p-2 font-mono">{item.item_number}</td>
        <td className="p-2">{item.cfop||"—"}</td>
        <td className="p-2">{item.ncm||"—"}</td>
        <td className="p-2">{taxCell(item.icms_cst,item.icms_base,item.icms_rate,item.icms_value)}</td>
        <td className="p-2">{taxCell(item.pis_cst,item.pis_base,item.pis_rate,item.pis_value)}{item.pis_cofins_zero_rate_expected_cst&&item.pis_cst!==item.pis_cofins_zero_rate_expected_cst&&<span className="ml-1 text-red-600">(esperado {item.pis_cofins_zero_rate_expected_cst})</span>}</td>
        <td className="p-2">{taxCell(item.cofins_cst,item.cofins_base,item.cofins_rate,item.cofins_value)}{item.pis_cofins_zero_rate_expected_cst&&item.cofins_cst!==item.pis_cofins_zero_rate_expected_cst&&<span className="ml-1 text-red-600">(esperado {item.pis_cofins_zero_rate_expected_cst})</span>}</td>
        <td className="p-2">{[item.ipi_value!=null&&`IPI ${money(item.ipi_value)}`,item.cbs_value!=null&&`CBS ${money(item.cbs_value)}`,item.ibs_value!=null&&`IBS ${money(item.ibs_value)}`].filter(Boolean).join(" · ")||"—"}</td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}
/** Abre sob demanda (sem cache entre aberturas — useQuery já cuida disso pela queryKey) a lista
 * completa de itens de nota fiscal de uma pendência, paginada por documento. */
function DocumentItemsModal({productId,rule,subtitle,close}:{productId:string;rule:string;subtitle:string;close:()=>void}){
  const [page,setPage]=useState(1);
  const query=useQuery({queryKey:["fiscal-compliance","document-items",productId,rule,page],queryFn:()=>fiscalComplianceService.documentItems(productId,rule,page)});
  const data=query.data;
  const totalPages=data?Math.max(1,Math.ceil(data.totalCount/data.pageSize)):1;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onClick={close}>
    <div role="dialog" aria-modal="true" aria-labelledby="document-items-title" className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={event=>event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div><h2 id="document-items-title" className="text-lg font-bold text-slate-900">Itens de nota fiscal</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>
        <Button variant="ghost" onClick={close}>Fechar</Button>
      </div>
      {query.isLoading&&<PageLoader label="Consultando itens de nota fiscal..."/>}
      {query.isError&&<div className="mt-4"><ErrorState message={getApiErrorMessage(query.error)}/></div>}
      {data&&!data.documents.length&&<p className="mt-4 text-sm text-slate-500">Nenhum item encontrado para esta pendência.</p>}
      {data?.documents.map(document=><DocumentGroupCard key={document.documentKey} document={document}/>)}
      {data&&data.totalCount>data.pageSize&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
        <span>{data.totalCount} item(ns) no total</span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={()=>setPage(previous=>Math.max(1,previous-1))} disabled={page<=1} className="h-8 px-2"><ChevronLeft size={14}/></Button>
          <span>Página {page} de {totalPages}</span>
          <Button variant="secondary" onClick={()=>setPage(previous=>Math.min(totalPages,previous+1))} disabled={page>=totalPages} className="h-8 px-2"><ChevronRight size={14}/></Button>
        </div>
      </div>}
    </div>
  </div>;
}
function EntityIcon({entity}:{entity:FiscalAlertEntity}){if(entity==="PRODUCT")return <PackageSearch size={20}/>;if(entity==="TAXATION")return <ShieldAlert size={20}/>;if(entity==="SPED")return <FileWarning size={20}/>;if(entity==="DOCUMENT")return <FileText size={20}/>;if(entity==="FAMILY")return <Layers3 size={20}/>;return <Building2 size={20}/>}
