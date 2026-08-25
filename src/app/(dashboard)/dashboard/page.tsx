"use client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Building2, CheckCircle2, CircleDot, Database, FileCheck2, FileClock, PackageCheck, PlugZap, ShieldCheck } from "lucide-react";
import { Card, ErrorState, PageHeader, dateTime } from "@/components/shared/ui";
import { dashboardService, type ImplementationStage } from "@/services/dashboard.service";

const stageLabel:Record<ImplementationStage,string>={COMPLETED:"Concluído",IN_PROGRESS:"Em andamento",PENDING:"Pendente",BLOCKED:"Bloqueado"};
const stageStyle:Record<ImplementationStage,string>={COMPLETED:"bg-emerald-100 text-emerald-800",IN_PROGRESS:"bg-blue-100 text-blue-800",PENDING:"bg-amber-100 text-amber-800",BLOCKED:"bg-red-100 text-red-800"};

export default function Dashboard(){
  const summary=useQuery({queryKey:["dashboard","implementation-summary"],queryFn:dashboardService.summary});
  const identity=useQuery({queryKey:["dashboard","client-identity"],queryFn:dashboardService.clientIdentity});
  const {refetch:refetchIdentity}=identity;
  useEffect(()=>{const refresh=()=>refetchIdentity();window.addEventListener("concilia:tenant-changed",refresh);window.addEventListener("concilia:company-changed",refresh);return()=>{window.removeEventListener("concilia:tenant-changed",refresh);window.removeEventListener("concilia:company-changed",refresh);};},[refetchIdentity]);
  if(summary.isLoading||identity.isLoading)return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(item=><div key={item} className="h-32 animate-pulse rounded-xl bg-slate-200"/>)}</div>;
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
    <div className="mt-5 grid gap-5 xl:grid-cols-3">
      <Card className="p-5"><SectionTitle icon={<Database/>} title="Qualidade dos dados importados" detail="Produtos e tributação recebidos pelo Connector"/><DataProgress label="Produtos validados" value={data.products.validated} total={data.products.imported}/><DataProgress label="Tributações validadas" value={data.taxation.validated} total={data.taxation.imported}/><div className="mt-4 grid grid-cols-3 gap-3 text-center"><Summary label="Pendentes" value={data.products.pending}/><Summary label="Rejeitados" value={data.products.rejected}/><Summary label="Divergências" value={data.taxation.divergent}/></div></Card>
      <Card className="p-5"><SectionTitle icon={<BellRing/>} title="Automações fiscais" detail="Coleta contínua e processamento por evento"/><Automation label="Monitoramento via API" active={data.monitoring.apiEnabled}/><Automation label="Conexão direta ao banco" active={data.monitoring.directDatabaseEnabled}/><Automation label="Novo arquivo SPED" active={data.sped.eventDriven} file/><div className="mt-4 rounded-lg bg-amber-50 p-3"><p className="text-xs font-semibold uppercase text-amber-800">Alertas gerados</p><strong className="text-2xl text-amber-950">{data.monitoring.openAlerts+data.sped.generatedAlerts}</strong></div></Card>
      <Card className="overflow-hidden"><div className="border-b p-5"><SectionTitle icon={<FileCheck2/>} title="Serviços contratados e implantação" detail="Escopo das rotinas do Connector"/></div><div className="divide-y">{data.services.map(service=><div key={service.code} className="flex items-center justify-between gap-3 p-4"><div className="flex items-center gap-3">{service.enabled?<CheckCircle2 size={18} className="text-emerald-600"/>:<CircleDot size={18} className="text-slate-300"/>}<p className="text-sm font-semibold">{service.name}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stageStyle[service.stage]}`}>{stageLabel[service.stage]}</span></div>)}</div></Card>
    </div>
  </>;
}

function formatCnpj(value:string){const digits=value.replace(/\D/g,"");return digits.length===14?digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5"):value}
function SectionTitle({icon,title,detail}:{icon:React.ReactNode;title:string;detail:string}){return <div className="mb-5 flex items-center gap-3"><span className="text-cyan-700">{icon}</span><div><h2 className="font-bold text-slate-900">{title}</h2><p className="text-sm text-slate-500">{detail}</p></div></div>}
function DataProgress({label,value,total}:{label:string;value:number;total:number}){const percentage=total?Math.round(value/total*100):0;return <div className="mb-4"><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{label}</span><span>{percentage}%</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width:`${percentage}%`}}/></div><p className="mt-1 text-xs text-slate-500">{value.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}</p></div>}
function Summary({label,value}:{label:string;value:number}){return <div className="rounded-lg bg-slate-50 p-3"><strong className="block text-lg">{value.toLocaleString("pt-BR")}</strong><span className="text-xs text-slate-500">{label}</span></div>}
function Automation({label,active,file}:{label:string;active:boolean;file?:boolean}){const Icon=file?FileClock:PlugZap;return <div className="mb-3 flex items-center gap-3 rounded-lg border p-3"><Icon size={18} className={active?"text-emerald-600":"text-slate-400"}/><p className="text-sm font-semibold">{label}</p><span className={`ml-auto rounded-full px-2 py-0.5 text-xs ${active?"bg-emerald-100 text-emerald-800":"bg-slate-100"}`}>{active?"Ativo":"Inativo"}</span></div>}
