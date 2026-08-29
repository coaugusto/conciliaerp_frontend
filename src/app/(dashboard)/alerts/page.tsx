"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, Check, CheckCircle2, Download, Edit3, FileWarning, Info, Layers3, LoaderCircle, PackageSearch, Search, Send, ShieldAlert, Upload, X } from "lucide-react";
import { Button, Card, ErrorState, PageHeader, money } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { fiscalComplianceService } from "@/services/fiscal-compliance.service";
import { fiscalAlertsService, type FiscalAlertEntity, type FiscalAlertGroup, type FiscalAlertItem, type FiscalAlertSeverity, type FiscalSuggestionReference } from "@/services/fiscal-alerts.service";
import { exportAlertsWorkbook } from "./export";
import { readAlertsWorkbook } from "./import";

const entityLabel:Record<FiscalAlertEntity,string>={PRODUCT:"Produtos",TAXATION:"Tributações",FAMILY:"Famílias",SUPPLIER:"Fornecedores",SPED:"SPED"};
const severityLabel:Record<FiscalAlertSeverity,string>={CRITICAL:"Crítica",HIGH:"Alta",MEDIUM:"Média",LOW:"Baixa"};
const severityStyle:Record<FiscalAlertSeverity,string>={CRITICAL:"border-red-300 bg-red-50 text-red-800",HIGH:"border-orange-300 bg-orange-50 text-orange-800",MEDIUM:"border-amber-300 bg-amber-50 text-amber-800",LOW:"border-blue-300 bg-blue-50 text-blue-800"};

export default function FiscalAlertsPage(){
  const importInput=useRef<HTMLInputElement>(null);
  const alerts=useQuery({queryKey:["fiscal-alerts","summary"],queryFn:fiscalAlertsService.summary});
  const validation=useMutation({mutationFn:fiscalAlertsService.scanCatalog,onSuccess:async()=>{await alerts.refetch();}});
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
  const [selectedId,setSelectedId]=useState<string>();
  const [entity,setEntity]=useState<FiscalAlertEntity|"ALL">("ALL");
  const [search,setSearch]=useState("");
  const visible=useMemo(()=>(alerts.data??[]).filter(group=>entity==="ALL"||group.entity===entity),[alerts.data,entity]);
  const selected=(alerts.data??[]).find(group=>group.id===selectedId)??visible[0];
  if(alerts.isError)return <><PageHeader title="Central de Alertas" description="Pendências cadastrais e fiscais do cliente."/><ErrorState/></>;
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
    <div className="mb-5 flex max-w-5xl flex-wrap gap-2">{(["ALL","PRODUCT","TAXATION","SPED","FAMILY","SUPPLIER"] as const).map(value=><Button key={value} variant={entity===value?"primary":"secondary"} onClick={()=>{setEntity(value);setSelectedId(undefined);}}>{value==="ALL"?"Todas":entityLabel[value]}</Button>)}</div>
    {alerts.isLoading?<LoadingCards/>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(group=><AlertCard key={group.id} group={group} selected={selected?.id===group.id} select={()=>setSelectedId(group.id)}/>)}</div>}
    {selected&&<Card className="mt-6 overflow-visible">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">{entityLabel[selected.entity]} · {selected.field}</p><h2 className="mt-1 text-lg font-bold text-slate-900">{selected.title}</h2><p className="mt-1 text-sm text-slate-500">Comparação da situação atual com a sugestão de correção.</p></div><label className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3"><Search size={16} className="text-slate-400"/><input value={search} onChange={event=>setSearch(event.target.value)} className="min-w-48 bg-transparent text-sm outline-none" placeholder="Pesquisar nesta pendência"/></label></div>
      <AlertItems group={selected} search={search}/>
    </Card>}
  </>;
}

function LoadingCards(){return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1,2,3].map(item=><div key={item} className="h-40 animate-pulse rounded-xl bg-slate-100"/>)}</div>}
function AlertCard({group,selected,select}:{group:FiscalAlertGroup;selected:boolean;select:()=>void}){return <button type="button" onClick={select} className="text-left"><Card className={`h-full p-5 transition hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md ${selected?"border-cyan-600 ring-2 ring-cyan-100":""}`}><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-lg bg-cyan-50 text-cyan-700"><EntityIcon entity={group.entity}/></span><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${severityStyle[group.severity]}`}>{severityLabel[group.severity]}</span></div><strong className="mt-4 block text-slate-900">{group.title}</strong><p className="mt-1 min-h-10 text-sm text-slate-500">{group.description}</p>{!!group.estimatedImpact&&<p className="mt-2 text-sm font-semibold text-red-700">Impacto estimado: {money(group.estimatedImpact)}</p>}<div className="mt-4 flex items-end justify-between"><span><b className="block text-2xl text-slate-900">{group.affected}</b><small className="text-slate-500">registros afetados</small></span><span className="text-xs font-semibold text-cyan-700">Ver De/Para →</span></div></Card></button>}
function AlertItems({group,search}:{group:FiscalAlertGroup;search:string}){
  const term=search.trim().toLocaleLowerCase("pt-BR");
  const items=group.items.filter(item=>!term||`${item.code} ${item.description} ${item.currentValue} ${item.suggestedValue} ${item.source} ${Object.values(item.suggestionReference??{}).join(" ")}`.toLocaleLowerCase("pt-BR").includes(term));
  return <div>{items.map(item=>{
    const catalogId=item.productId??item.maintenanceId;
    const href=item.href??(catalogId?`/catalog-review?productId=${encodeURIComponent(catalogId)}&code=${encodeURIComponent(item.code)}&from=alerts`:null);
    return <div key={item.id} className="border-b border-slate-100 p-5 last:border-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><strong className="text-slate-900">{item.description}</strong><p className="font-mono text-xs text-slate-500">{item.code}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{item.confidence}% de confiança</span>{href?<Link href={href} className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800"><Edit3 size={15}/>Abrir manutenção</Link>:<span title="Este item ainda não está disponível na tela de manutenção" className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-medium text-slate-500"><Edit3 size={15}/>Sem manutenção disponível</span>}</div></div>
      <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]"><Comparison label="De · situação atual" value={item.currentValue} tone="current"/><span className="grid place-items-center text-cyan-600"><ArrowRight size={20}/></span><SuggestionComparison item={item}/></div>
      {item.spedContext&&<div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><b>{item.spedContext.bookkeeping==="EFD_CONTRIBUTIONS"?"EFD-Contribuições":"EFD ICMS/IPI"}</b><span className="ml-2">Registro {item.spedContext.record||"não identificado"}{item.spedContext.parentRecord?` · pai ${item.spedContext.parentRecord}`:""}{item.spedContext.line?` · linha ${item.spedContext.line}`:""}</span><p className="mt-1 text-xs">Registros relacionados: {item.spedContext.relatedRecords.join(", ")||"consultar registro de origem"}</p>{item.spedContext.sourceFile&&<p className="mt-1 font-mono text-xs">{item.spedContext.sourceFile}</p>}</div>}
      {item.actionable===false?<p className="mt-3 text-xs text-slate-500">{item.nonActionableReason??"A correção deve ser realizada na origem da escrituração e o arquivo SPED deve ser validado novamente."}</p>:<AdjustmentActions group={group} item={item}/>}
    </div>;
  })}{!items.length&&<p className="p-8 text-center text-sm text-slate-500">Nenhum registro corresponde à pesquisa.</p>}</div>;
}
function Comparison({label,value,tone}:{label:string;value:string;tone:"current"|"suggested"}){return <div className={`rounded-lg border p-4 ${tone==="current"?"border-red-200 bg-red-50":"border-emerald-200 bg-emerald-50"}`}><p className={`text-xs font-semibold uppercase tracking-wide ${tone==="current"?"text-red-700":"text-emerald-700"}`}>{label}</p><strong className="mt-1 block text-slate-900">{value}</strong></div>}
function SuggestionComparison({item}:{item:FiscalAlertItem}){
  return <div tabIndex={0} aria-describedby={`suggestion-${item.id}`} className="group relative rounded-lg border border-emerald-200 bg-emerald-50 p-4 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">Para · sugestão <Info size={14} aria-hidden="true"/></p><strong className="mt-1 block text-slate-900">{item.suggestedValue}</strong><span className="mt-2 block text-[11px] text-emerald-800">Passe o mouse para entender a sugestão</span>
    <SuggestionDetails id={`suggestion-${item.id}`} source={item.source} reference={item.suggestionReference}/>
  </div>;
}
function SuggestionDetails({id,source,reference}:{id:string;source:string;reference?:FiscalSuggestionReference}){
  const rows=[["Tabela de referência",reference?.table],["Origem",reference?.origin??source],["Estado do cliente",reference?.clientState],["Regra aplicada",reference?.rule],["Motivo",reference?.reason]];
  return <div id={id} role="tooltip" className="pointer-events-none invisible absolute bottom-[calc(100%+8px)] left-0 z-20 w-full min-w-72 translate-y-1 rounded-lg bg-slate-900 p-4 text-left normal-case text-white opacity-0 shadow-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus:visible group-focus:translate-y-0 group-focus:opacity-100"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-cyan-300">Referência da sugestão</p><dl className="grid gap-2">{rows.map(([label,value])=><div key={label}><dt className="text-[11px] text-slate-400">{label}</dt><dd className="text-xs font-medium">{value||"Não informado pela regra"}</dd></div>)}</dl><span className="absolute -bottom-1 left-6 size-2 rotate-45 bg-slate-900"/></div>;
}
function AdjustmentActions({group,item}:{group:FiscalAlertGroup;item:FiscalAlertItem}){
  const [mode,setMode]=useState<"ACCEPTED"|"EDITED"|null>(null);
  const [value,setValue]=useState(item.suggestedValue);
  const queue=useMutation({mutationFn:()=>fiscalAlertsService.queueAdjustment({groupId:group.id,itemId:item.id,field:group.field,value:value.trim(),decision:mode!}),onSuccess:()=>setMode(null)});
  if(queue.isSuccess)return <div role="status" className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800"><CheckCircle2 size={17}/>Ajuste enviado para a fila de integração.</div>;
  return <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
    {!mode?<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Qual decisão deve seguir para a integração?</p><div className="flex flex-wrap gap-2"><Button onClick={()=>{setValue(item.suggestedValue);setMode("ACCEPTED");}}><Check size={16}/>Acatar sugestão</Button><Button variant="secondary" onClick={()=>setMode("EDITED")}><Edit3 size={16}/>Editar informação</Button></div></div>:<div className="grid gap-3"><label className="grid gap-1 text-sm font-semibold text-slate-700">Valor que será integrado<input autoFocus={mode==="EDITED"} value={value} onChange={event=>{setValue(event.target.value);setMode("EDITED");}} readOnly={mode==="ACCEPTED"} className={`h-10 rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-cyan-600 ${mode==="ACCEPTED"?"bg-emerald-50":"bg-white"}`}/></label><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">{mode==="ACCEPTED"?"Sugestão acatada sem alterações.":"Valor ajustado manualmente pelo analista."}</span><div className="flex gap-2"><Button variant="ghost" onClick={()=>{setMode(null);setValue(item.suggestedValue);}} disabled={queue.isPending}><X size={15}/>Cancelar</Button><Button onClick={()=>queue.mutate()} disabled={queue.isPending||!value.trim()}><Send size={15}/>{queue.isPending?"Enviando...":"Enviar para integração"}</Button></div></div></div>}
    {queue.isError&&<p role="alert" className="mt-3 text-sm text-red-700">{getApiErrorMessage(queue.error)}</p>}
  </div>;
}
function EntityIcon({entity}:{entity:FiscalAlertEntity}){if(entity==="PRODUCT")return <PackageSearch size={20}/>;if(entity==="TAXATION")return <ShieldAlert size={20}/>;if(entity==="SPED")return <FileWarning size={20}/>;if(entity==="FAMILY")return <Layers3 size={20}/>;return <Building2 size={20}/>}
