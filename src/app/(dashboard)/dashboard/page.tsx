"use client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BellRing, Building2, CheckCircle2, CircleDot, Database, FileCheck2, FileClock, PackageCheck, PlugZap, ShieldAlert, ShieldCheck } from "lucide-react";
import { TabLink } from "@/components/layout/tab-link";
import { fiscalAlertsService, type FiscalAlertSeverity } from "@/services/fiscal-alerts.service";
import { Card, ErrorState, PageHeader, PageLoader, dateTime } from "@/components/shared/ui";
import { dashboardService, type ImplementationStage } from "@/services/dashboard.service";

const stageLabel:Record<ImplementationStage,string>={COMPLETED:"Concluído",IN_PROGRESS:"Em andamento",PENDING:"Pendente",BLOCKED:"Bloqueado"};
const stageStyle:Record<ImplementationStage,string>={COMPLETED:"bg-emerald-100 text-emerald-800",IN_PROGRESS:"bg-blue-100 text-blue-800",PENDING:"bg-amber-100 text-amber-800",BLOCKED:"bg-red-100 text-red-800"};

export default function Dashboard(){
  const summary=useQuery({queryKey:["dashboard","implementation-summary"],queryFn:dashboardService.summary});
  const identity=useQuery({queryKey:["dashboard","client-identity"],queryFn:dashboardService.clientIdentity});
  const {refetch:refetchIdentity}=identity;
  useEffect(()=>{const refresh=()=>refetchIdentity();window.addEventListener("concilia:tenant-changed",refresh);window.addEventListener("concilia:company-changed",refresh);return()=>{window.removeEventListener("concilia:tenant-changed",refresh);window.removeEventListener("concilia:company-changed",refresh);};},[refetchIdentity]);
  if(summary.isLoading||identity.isLoading)return <PageLoader/>;
  if(summary.isError||!summary.data||identity.isError||!identity.data)return <ErrorState/>;
  const data=summary.data,client=identity.data;
  const metrics=[
    {label:"Cadastro do cliente",value:`${data.client.registrationComplete}%`,detail:`${client.branches||data.client.branches} estabelecimentos`,icon:Building2},
    {label:"Produtos importados",value:data.products.imported.toLocaleString("pt-BR"),detail:`${data.products.validated.toLocaleString("pt-BR")} validados`,icon:PackageCheck},
    {label:"Tributações validadas",value:data.taxation.validated.toLocaleString("pt-BR"),detail:`${data.taxation.divergent.toLocaleString("pt-BR")} divergências`,icon:ShieldCheck},
    {label:"Método de extração",value:data.extraction.connectorStatus==="ONLINE"?"Online":"Offline",detail:data.extraction.method,icon:PlugZap},
  ];
  return <><PageHeader title="Painel de Conciliação" description="Visão cadastral, fiscal e operacional da implantação do cliente."/>
    <Card className="mb-5 flex flex-wrap items-center justify-between gap-4 border-cyan-200 bg-cyan-50/50 p-5">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Cliente selecionado</p><div className="mt-1 flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-slate-900">{client.name}</h2><span className="rounded-full border border-cyan-200 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-cyan-800">{client.cncCode}</span></div>{client.cnpj?<p className="mt-1 text-sm text-slate-600">CNPJ {formatCnpj(client.cnpj)}{client.tradeName||client.legalName?` · ${client.tradeName||client.legalName}`:""}</p>:<p className="mt-1 text-sm text-amber-700">CNPJ ainda não identificado nas importações do Connector ou SPED PIS/Cofins.</p>}</div>
      <div className="text-right text-sm text-slate-600"><p>Última sincronização</p><strong className="text-slate-900">{dateTime(data.extraction.lastSyncAt)}</strong><p>{data.extraction.frequency}</p></div>
    </Card>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{metrics.map(({label,value,detail,icon:Icon})=><Card key={label} className="p-5"><div className="mb-4 flex items-center justify-between"><span className="grid size-10 place-items-center rounded-lg bg-cyan-50 text-cyan-700"><Icon size={21}/></span><CircleDot size={16} className="text-emerald-500"/></div><p className="text-2xl font-bold text-slate-900">{value}</p><p className="mt-1 text-sm font-semibold text-slate-700">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></Card>)}</div>
    <FiscalPendingRanking/>
    <div className="mt-5 grid gap-5 xl:grid-cols-3">
      <Card className="p-5"><SectionTitle icon={<Database/>} title="Qualidade dos dados importados" detail="Produtos e tributação recebidos pelo Connector"/><DataProgress label="Produtos validados" value={data.products.validated} total={data.products.imported}/><DataProgress label="Tributações validadas" value={data.taxation.validated} total={data.taxation.imported}/><div className="mt-4 grid grid-cols-3 gap-3 text-center"><Summary label="Pendentes" value={data.products.pending}/><Summary label="Rejeitados" value={data.products.rejected}/><Summary label="Divergências" value={data.taxation.divergent}/></div></Card>
      <Card className="p-5"><SectionTitle icon={<BellRing/>} title="Automações fiscais" detail="Coleta contínua e processamento por evento"/><Automation label="Monitoramento via API" active={data.monitoring.apiEnabled}/><Automation label="Conexão direta ao banco" active={data.monitoring.directDatabaseEnabled}/><Automation label="Novo arquivo SPED" active={data.sped.eventDriven} file/><div className="mt-4 rounded-lg bg-amber-50 p-3"><p className="text-xs font-semibold uppercase text-amber-800">Alertas gerados</p><strong className="text-2xl text-amber-950">{data.monitoring.openAlerts+data.sped.generatedAlerts}</strong></div></Card>
      <Card className="overflow-hidden"><div className="border-b p-5"><SectionTitle icon={<FileCheck2/>} title="Serviços contratados e implantação" detail="Escopo das rotinas do Connector"/></div><div className="divide-y">{data.services.map(service=><div key={service.code} className="flex items-center justify-between gap-3 p-4"><div className="flex items-center gap-3">{service.enabled?<CheckCircle2 size={18} className="text-emerald-600"/>:<CircleDot size={18} className="text-slate-300"/>}<p className="text-sm font-semibold">{service.name}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stageStyle[service.stage]}`}>{stageLabel[service.stage]}</span></div>)}</div></Card>
    </div>
  </>;
}

const severityDot:Record<FiscalAlertSeverity,string>={CRITICAL:"bg-red-600",HIGH:"bg-orange-500",MEDIUM:"bg-amber-400",LOW:"bg-blue-400"};
const severityText:Record<FiscalAlertSeverity,string>={CRITICAL:"Crítica",HIGH:"Alta",MEDIUM:"Média",LOW:"Baixa"};
const RANKING_SIZE=8;
// Atalho para a Central de Alertas: pendências ordenadas por produtos afetados. Carrega à parte do
// restante do painel (o resumo fiscal pode levar alguns segundos no primeiro cálculo) e usa a mesma
// chave de consulta de /alerts, então abrir a Central depois não recalcula nada.
function FiscalPendingRanking(){
  const alerts=useQuery({queryKey:["fiscal-alerts","summary"],queryFn:fiscalAlertsService.summary,gcTime:30*60*1000});
  const groups=alerts.data??[];
  const issues=groups.filter(group=>group.kind!=="COMPLIANCE"&&group.affected>0).sort((a,b)=>b.affected-a.affected);
  const compliance=groups.filter(group=>group.kind==="COMPLIANCE"&&group.affected>0);
  const alertHref=(id:string)=>`/alerts?group=${encodeURIComponent(id)}`;
  return <Card className="mt-5 overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><SectionTitle icon={<ShieldAlert/>} title="Principais pendências fiscais" detail="Produtos afetados por regra — clique para abrir na Central de Alertas"/><TabLink href="/alerts" className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 hover:text-cyan-900">Ver todos os alertas <ArrowRight size={15}/></TabLink></div>
    {alerts.isLoading?<p className="p-5 text-sm text-slate-500">Calculando as pendências fiscais…</p>
    :alerts.isError?<div className="p-5"><ErrorState message="Não foi possível carregar as pendências fiscais."/></div>
    :!issues.length&&!compliance.length?<p className="p-5 text-sm text-emerald-800">Nenhuma pendência fiscal identificada.</p>
    :<div className="overflow-x-auto"><table className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-2 font-semibold">Card</th><th className="px-5 py-2 font-semibold">Severidade</th><th className="px-5 py-2 text-right font-semibold">Produtos</th></tr></thead>
      <tbody className="divide-y">
        {issues.slice(0,RANKING_SIZE).map(group=><tr key={group.id} className="hover:bg-cyan-50/50"><td className="px-5 py-2.5"><TabLink href={alertHref(group.id)} title={group.title} className="font-medium text-slate-900 hover:text-cyan-800 hover:underline">{group.title}</TabLink></td><td className="px-5 py-2.5"><span className="inline-flex items-center gap-2 text-slate-600"><span className={`size-2 rounded-full ${severityDot[group.severity]}`}/>{severityText[group.severity]}</span></td><td className="px-5 py-2.5 text-right font-semibold tabular-nums text-slate-900">{group.affected.toLocaleString("pt-BR")}</td></tr>)}
        {compliance.map(group=><tr key={group.id} className="bg-emerald-50/60 hover:bg-emerald-50"><td className="px-5 py-2.5"><TabLink href={alertHref(group.id)} title={group.title} className="inline-flex items-center gap-2 font-medium text-emerald-900 hover:underline"><ShieldCheck size={15}/>{group.title}</TabLink></td><td className="px-5 py-2.5 text-emerald-700">Em conformidade</td><td className="px-5 py-2.5 text-right font-semibold tabular-nums text-emerald-900">{group.affected.toLocaleString("pt-BR")}</td></tr>)}
      </tbody>
    </table>{issues.length>RANKING_SIZE&&<p className="border-t px-5 py-2 text-xs text-slate-500">Mostrando {RANKING_SIZE} de {issues.length} tipos de pendência.</p>}</div>}
  </Card>;
}

function formatCnpj(value:string){const digits=value.replace(/\D/g,"");return digits.length===14?digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5"):value}
function SectionTitle({icon,title,detail}:{icon:React.ReactNode;title:string;detail:string}){return <div className="mb-5 flex items-center gap-3"><span className="text-cyan-700">{icon}</span><div><h2 className="font-bold text-slate-900">{title}</h2><p className="text-sm text-slate-500">{detail}</p></div></div>}
function DataProgress({label,value,total}:{label:string;value:number;total:number}){const percentage=total?Math.round(value/total*100):0;return <div className="mb-4"><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{label}</span><span>{percentage}%</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width:`${percentage}%`}}/></div><p className="mt-1 text-xs text-slate-500">{value.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}</p></div>}
function Summary({label,value}:{label:string;value:number}){return <div className="rounded-lg bg-slate-50 p-3"><strong className="block text-lg">{value.toLocaleString("pt-BR")}</strong><span className="text-xs text-slate-500">{label}</span></div>}
function Automation({label,active,file}:{label:string;active:boolean;file?:boolean}){const Icon=file?FileClock:PlugZap;return <div className="mb-3 flex items-center gap-3 rounded-lg border p-3"><Icon size={18} className={active?"text-emerald-600":"text-slate-400"}/><p className="text-sm font-semibold">{label}</p><span className={`ml-auto rounded-full px-2 py-0.5 text-xs ${active?"bg-emerald-100 text-emerald-800":"bg-slate-100"}`}>{active?"Ativo":"Inativo"}</span></div>}
