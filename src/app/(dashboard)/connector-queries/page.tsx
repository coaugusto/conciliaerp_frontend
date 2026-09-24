"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, ErrorState, PageHeader, PageLoader, StatusBadge } from "@/components/shared/ui";
import { connectorQueriesService, jobScopeLabel, type ConnectorJob, type ConnectorMonitoring, type ConnectorQuery } from "@/services/connector-queries.service";
import { connectorInitialLoadsService } from "@/services/connector-initial-loads.service";
import { getApiErrorMessage } from "@/services/api/client";
import { useAuth } from "@/providers/providers";
import { useMyAccessPermissions } from "@/hooks/use-my-access-permissions";

const displayName = (code: string) => code.replace(/_V\d+$/i, "");

// A tela reúne 3 responsabilidades que antes ficavam empilhadas na mesma página, sem separação
// visual: operação do dia a dia (status do Connector, disparar execução, acompanhar/cancelar
// jobs), catálogo de consultas (versões, ativar/desativar, publicar) e carga inicial (fluxo raro,
// só na primeira ativação de um Connector). Virou abas para não misturar o que se mexe todo dia
// com o que é configuração pontual.
type Tab = "operacao" | "catalogo" | "carga";
export default function Page() {
  const { user } = useAuth();
  // Analista vê e ativa consultas (aba Catálogo), mas não opera cargas/jobs nem vê o texto do
  // SELECT (know-how de extração) — mesmo escopo já aplicado no backend
  // (connector-query.controller.ts: list() omite sqlPreview, setEnabled/activate-latest liberados).
  const isAnalyst = user?.role === "ANALYST";
  // Concessão pontual (ver /commercial → Usuários do cliente → "Permissões especiais") libera o
  // que normalmente fica restrito ao papel ANALYST aqui — mesma ideia do commercial/page.tsx.
  const myPermissions = useMyAccessPermissions();
  const canSeeOperation = !isAnalyst || myPermissions.has("CONNECTOR_QUERIES_OPERATION_TAB");
  const canSeeInitialLoad = !isAnalyst || myPermissions.has("CONNECTOR_QUERIES_INITIAL_LOAD_TAB");
  const canViewSql = !isAnalyst || myPermissions.has("CONNECTOR_QUERIES_VIEW_SQL");
  const canPublishCatalog = !isAnalyst || myPermissions.has("CONNECTOR_QUERIES_PUBLISH_CATALOG");
  const canDeleteVersions = !isAnalyst || myPermissions.has("CONNECTOR_QUERIES_DELETE_VERSIONS");
  const qc=useQueryClient(), [form,setForm]=useState<ConnectorQuery|null>(null), [sql,setSql]=useState<ConnectorQuery|null>(null);
  const [tab,setTab]=useState<Tab>(isAnalyst?"catalogo":"operacao");
  const queries=useQuery({queryKey:["connector-queries"],queryFn:connectorQueriesService.list});
  const monitor=useQuery({queryKey:["connector-monitoring"],queryFn:connectorQueriesService.monitoring,refetchInterval:15000});
  const refresh=()=>Promise.all([qc.invalidateQueries({queryKey:["connector-queries"]}),qc.invalidateQueries({queryKey:["connector-monitoring"]})]);
  const toggle=useMutation({mutationFn:({id,enabled}:{id:string;enabled:boolean})=>connectorQueriesService.setEnabled(id,enabled),onSuccess:refresh});
  const remove=useMutation({mutationFn:(id:string)=>connectorQueriesService.remove(id),onSuccess:refresh,onError:e=>alert(getApiErrorMessage(e))});
  // Publica no tenant as consultas da versão que está no código (mesmo efeito do seed pelo
  // terminal). Só cria o que falta e nasce desativada — ativar continua sendo um passo à parte.
  const publishCatalog=useMutation({mutationFn:()=>connectorQueriesService.publishCatalog(),onSuccess:(result)=>{refresh();alert(result.created?`Catálogo v${result.version} publicado: ${result.created} consulta(s) nova(s) (${result.codes.join(", ")}). Ative-as para o Connector passar a usá-las.`:`Catálogo v${result.version} já estava publicado — nenhuma consulta nova.`)},onError:e=>alert(getApiErrorMessage(e))});
  const activateLatest=useMutation({mutationFn:()=>connectorQueriesService.activateLatest(),onSuccess:(result)=>{refresh();alert(`${result.activated} consulta(s) ativada(s) na versão mais recente.`)},onError:e=>alert(getApiErrorMessage(e))});
  const deletePrevious=useMutation({mutationFn:()=>connectorQueriesService.deletePreviousVersions(),onSuccess:(result)=>{refresh();alert(`${result.deleted} versão(ões) anterior(es) excluída(s).`)},onError:e=>alert(getApiErrorMessage(e))});
  if(queries.isLoading)return <Card className="p-8"><PageLoader/></Card>;
  if(queries.isError)return <ErrorState message={getApiErrorMessage(queries.error)}/>;
  const allTabs: Array<{ id: Tab; label: string }> = [{ id: "operacao", label: "Operação do dia a dia" }, { id: "catalogo", label: "Catálogo de consultas" }, { id: "carga", label: "Carga inicial" }];
  const tabs = allTabs.filter(t => t.id === "catalogo" || (t.id === "operacao" && canSeeOperation) || (t.id === "carga" && canSeeInitialLoad));
  const effectiveTab = tabs.some(t=>t.id===tab) ? tab : tabs[0].id;
  return <><PageHeader title="Consultas do Connector" description="Extrações, agendamentos e situação dos envios."/>
    <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">{tabs.map(t=><Button key={t.id} variant={effectiveTab===t.id?"primary":"ghost"} onClick={()=>setTab(t.id)}>{t.label}</Button>)}</div>
    {effectiveTab==="operacao"&&<><Operations data={monitor.data} queries={queries.data??[]} configure={setForm} refresh={refresh}/>{monitor.isError&&<ErrorState message={getApiErrorMessage(monitor.error)}/>}</>}
    {effectiveTab==="catalogo"&&<>
      <div className="mb-3 flex flex-wrap gap-2">
        {canPublishCatalog&&<Button disabled={publishCatalog.isPending} onClick={()=>{if(confirm("Publicar neste cliente as consultas da versão atual do catálogo? Consultas já publicadas não são alteradas; as novas entram desativadas."))publishCatalog.mutate()}}>{publishCatalog.isPending?"Publicando...":"Publicar catálogo de consultas"}</Button>}
        <Button variant="secondary" disabled={activateLatest.isPending} onClick={()=>{if(confirm("Ativar todas as consultas na versão mais recente? Isso desativa qualquer versão anterior de cada código."))activateLatest.mutate()}}>{activateLatest.isPending?"Ativando...":"Ativar todas na versão mais recente"}</Button>
        {canDeleteVersions&&<Button variant="danger" disabled={deletePrevious.isPending} onClick={()=>{if(confirm("Excluir todas as versões anteriores (não habilitadas) de cada consulta? Esta ação não pode ser desfeita."))deletePrevious.mutate()}}>{deletePrevious.isPending?"Excluindo...":"Excluir versões anteriores"}</Button>}
      </div>
      <Card className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr><th className="p-3 text-left">Consulta</th><th>Versão</th><th>Descrição</th><th>Envio</th><th/></tr></thead><tbody>{queries.data?.map(q=><tr className="border-t" key={q.id}><td className="p-3 font-mono text-xs">{displayName(q.code)}</td><td>v{q.version}</td><td>{q.description}</td><td><StatusBadge value={q.enabled?"ACTIVE":"INACTIVE"}/></td><td className="flex gap-1 py-2">{canViewSql&&<Button variant="ghost" onClick={()=>setSql(q)}>SELECT</Button>}<Button variant={q.enabled?"danger":"secondary"} onClick={()=>toggle.mutate({id:q.id,enabled:!q.enabled})}>{q.enabled?"Desativar":"Ativar"}</Button>{canSeeOperation&&<Button variant="secondary" disabled={!q.enabled} onClick={()=>setForm(q)}>Configurar</Button>}{!isAnalyst&&!q.enabled&&<Button variant="danger" disabled={remove.isPending} onClick={()=>{if(confirm(`Apagar ${displayName(q.code)} v${q.version}? Esta ação não pode ser desfeita.`))remove.mutate(q.id)}}>Apagar</Button>}</td></tr>)}</tbody></table></Card>
      {sql&&<Card className="mt-4 p-4"><div className="flex justify-between"><b>{displayName(sql.code)} v{sql.version}</b><Button variant="ghost" onClick={()=>setSql(null)}>Fechar</Button></div><pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre rounded bg-slate-950 p-4 text-xs text-white">{sql.sqlPreview}</pre></Card>}
    </>}
    {effectiveTab==="carga"&&<InitialLoadPanel/>}
    {form&&<ScheduleForm query={form} jobs={monitor.data?.jobs??[]} close={()=>{setForm(null);void refresh()}}/>}
  </>;
}

function Operations({data,queries,configure,refresh}:{data?:ConnectorMonitoring;queries:ConnectorQuery[];configure:(q:ConnectorQuery)=>void;refresh:()=>void}){
  const [id,setId]=useState(""); const connector=data?.connectors[0]; const online=connector?.lastHeartbeatAt?Date.now()-new Date(connector.lastHeartbeatAt).getTime()<180000:false;
  const syncActive=Boolean(data?.schedules.some(s=>s.active));
  const lastExecution=data?.lastExecution;
  const toggle=useMutation({mutationFn:({id,active}:{id:string;active:boolean})=>connectorQueriesService.setScheduleActive(id,active),onSuccess:refresh});
  // Só PENDING (ainda não buscado pelo Connector) e DISPATCHED (entregue, extração local ainda não
  // começou a subir lotes) podem ser interrompidos de verdade — a partir de UPLOADING o Connector já
  // está transmitindo e não há como abortar (o backend recusa, ver connector-query.controller.ts).
  const cancellable=(status:string)=>status==="PENDING"||status==="DISPATCHED";
  const cancel=useMutation({mutationFn:(jobId:string)=>connectorQueriesService.cancelJob(jobId),onSuccess:refresh,onError:(e:unknown)=>alert(getApiErrorMessage(e))});
  return <Card className="mb-4 border-cyan-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">Agendamento e envio de dados</h2><p className="text-sm text-slate-600">Configure e acompanhe a extração diretamente no portal.</p></div><div className="flex gap-2"><StatusBadge value={online?"ONLINE":"OFFLINE"}/></div></div><div className="mt-4 grid gap-3 md:grid-cols-3"><Info title="Connector" value={connector?(connector.machineName||"Connector")+" — "+connector.connectorId:"Não conectado"} detail={connector?.lastHeartbeatAt?`Contato: ${new Date(connector.lastHeartbeatAt).toLocaleString("pt-BR")}`:"Sem heartbeat"}/><label className="grid gap-2 rounded border bg-slate-50 p-3 text-sm"><span className="text-xs uppercase text-slate-500">Nova execução</span><select className="rounded border p-2" value={id} onChange={e=>setId(e.target.value)}><option value="">Selecione</option>{queries.filter(q=>q.enabled).map(q=><option key={q.id} value={q.id}>{displayName(q.code)} v{q.version}</option>)}</select><Button variant="secondary" disabled={!id} onClick={()=>{const q=queries.find(x=>x.id===id);if(q)configure(q)}}>Configurar</Button></label><Info title="Jobs" value={`${data?.jobs.filter(j=>j.status==="PENDING").length??0} pendentes`} detail={`${data?.jobs.filter(j=>j.status==="FAILED").length??0} com falha`}/></div>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <div className="flex items-center gap-3 rounded border bg-slate-50 p-3 text-sm"><span className={`inline-block size-2.5 shrink-0 rounded-full ${syncActive?"bg-emerald-500":"bg-slate-300"}`} aria-hidden /><div><p className="text-xs uppercase text-slate-500">Sincronismo automático</p><b>{syncActive?"Ativo":"Inativo"}</b><p className="text-xs text-slate-500">{data?.schedules.filter(s=>s.active).length??0} agendamento(s) ativo(s) de {data?.schedules.length??0}</p></div></div>
      <div className="rounded border bg-slate-50 p-3 text-sm"><p className="text-xs uppercase text-slate-500">Última execução geral</p>{lastExecution?<><b>{lastExecution.recordCount.toLocaleString("pt-BR")} registro(s) trafegado(s)</b><p className="text-xs text-slate-500">{displayName(lastExecution.queryCode)} v{lastExecution.queryVersion} · {new Date(lastExecution.completedAt).toLocaleString("pt-BR")}</p></>:<p className="text-slate-500">Nenhuma execução concluída ainda.</p>}</div>
    </div>
    {data?.schedules.map(s=><div key={s.id} className="mt-3 flex items-center justify-between rounded border p-3 text-sm"><div><b className="font-mono text-xs">{displayName(s.queryCode)} v{s.queryVersion}</b><p className="text-xs text-slate-500">{s.frequency==="MINUTES"?`A cada ${s.intervalMinutes} min`:s.frequency==="HOURLY"?"A cada hora":"Diário"} · próxima {new Date(s.nextRunAt).toLocaleString("pt-BR")}</p></div><Button variant={s.active?"danger":"secondary"} onClick={()=>toggle.mutate({id:s.id,active:!s.active})}>{s.active?"Pausar":"Ativar"}</Button></div>)}<h3 className="mt-4 text-sm font-semibold">Últimos jobs</h3>{data?.jobs.length?<div className="overflow-x-auto"><table className="mt-2 w-full min-w-[680px] text-xs"><tbody>{data.jobs.slice(0,8).map(j=><tr className="border-t" key={j.id}><td className="p-2 font-mono">{displayName(j.queryCode)} v{j.queryVersion}{jobScopeLabel(j.parameters)&&<p className="font-sans text-[11px] font-normal text-slate-500">{jobScopeLabel(j.parameters)}</p>}</td><td><StatusBadge value={j.status}/></td><td className="p-2 text-right tabular-nums">{j.recordCount.toLocaleString("pt-BR")} reg.</td><td>{new Date(j.requestedAt).toLocaleString("pt-BR")}</td><td>{j.errorMessage||(j.status==="PENDING"?(online?"Aguardando busca automática":"Connector offline"):"—")}</td><td>{cancellable(j.status)&&<Button variant="danger" disabled={cancel.isPending} onClick={()=>{if(confirm(`Interromper ${displayName(j.queryCode)} v${j.queryVersion}? Isso só é possível antes de o Connector começar a subir os lotes.`))cancel.mutate(j.id)}}>Interromper</Button>}</td></tr>)}</tbody></table></div>:<p className="mt-2 text-sm text-slate-500">Nenhum job para o cliente selecionado.</p>}</Card>;
}
function Info({title,value,detail}:{title:string;value:string;detail:string}){return <div className="rounded border bg-slate-50 p-3 text-sm"><p className="text-xs uppercase text-slate-500">{title}</p><b>{value}</b><p className="mt-1 text-xs text-slate-500">{detail}</p></div>}

function Targets({value,set}:{value:string;set:(v:string)=>void}){const q=useQuery({queryKey:["connector-targets"],queryFn:connectorQueriesService.listConnectors});useEffect(()=>{if(!value&&q.data?.length===1)set(q.data[0].connectorId)},[value,q.data,set]);return <select className="rounded border p-2" value={value} onChange={e=>set(e.target.value)}><option value="">Selecione o Connector</option>{q.data?.map(x=><option key={x.connectorId} value={x.connectorId}>{x.machineName||"Connector"} — {x.connectorId}</option>)}</select>}

// Único lugar pra iniciar/acompanhar cargas: antes existia uma versão simplificada aqui (só
// "escolha o Connector e clique Iniciar", sem status nem histórico) e uma versão completa
// duplicada em /commercial → Connector ("Cargas e jobs do Connector") — a mesma chamada de API
// em dois lugares diferentes da tela. Ficou só esta, mais completa.
const STATUS_CARDS: Array<{ key: "PENDING"|"RUNNING"|"COMPLETED"|"FAILED"; label: string }> = [
  { key: "PENDING", label: "Pendentes" }, { key: "RUNNING", label: "Executando" },
  { key: "COMPLETED", label: "Concluídos" }, { key: "FAILED", label: "Falhos" },
];
function InitialLoadPanel(){
  const companyId=typeof window==="undefined"?"":localStorage.getItem("concilia_company_id")??"";
  const tenantId=typeof window==="undefined"?"":localStorage.getItem("concilia_tenant_id")??"";
  const [statusFilter,setStatusFilter]=useState<"PENDING"|"RUNNING"|"COMPLETED"|"FAILED"|undefined>(undefined);
  const panel=useQuery({queryKey:["connector-initial-loads",tenantId,companyId,statusFilter],queryFn:()=>connectorInitialLoadsService.list({companyId:companyId||undefined,status:statusFilter}),refetchInterval:query=>(query.state.data?.summary.pending??0)>0?3000:10000,refetchIntervalInBackground:true});
  const [connectorId,setConnectorId]=useState("");
  const [selectedCompanyId,setSelectedCompanyId]=useState(companyId);
  const refresh=()=>panel.refetch();
  const start=useMutation({mutationFn:()=>connectorInitialLoadsService.start(connectorId,selectedCompanyId),onSuccess:refresh});
  const bootstrap=useMutation({mutationFn:()=>connectorInitialLoadsService.bootstrap(connectorId),onSuccess:()=>{void refresh()}});
  const resume=useMutation({mutationFn:(loadId:string)=>connectorInitialLoadsService.resume(loadId),onSuccess:refresh});
  const retry=useMutation({mutationFn:(jobId:string)=>connectorInitialLoadsService.retryJob(jobId),onSuccess:refresh});
  const approve=useMutation({mutationFn:(loadId:string)=>connectorInitialLoadsService.approve(loadId),onSuccess:refresh});
  const reject=useMutation({mutationFn:({loadId,reason}:{loadId:string;reason?:string})=>connectorInitialLoadsService.reject(loadId,reason),onSuccess:refresh});
  const [resetOpen,setResetOpen]=useState(false);
  const [resetPassword,setResetPassword]=useState("");
  const [resetReason,setResetReason]=useState("");
  const reset=useMutation({mutationFn:(loadId:string)=>connectorInitialLoadsService.reset(loadId,resetPassword,resetReason.trim()||undefined),onSuccess:()=>{setResetPassword("");setResetOpen(false);refresh()}});
  if(panel.isLoading)return <Card className="p-8"><PageLoader/></Card>;
  if(panel.isError)return <ErrorState message={getApiErrorMessage(panel.error)}/>;
  if(!panel.data)return <ErrorState message="A API respondeu sem os dados de cargas do Connector."/>;
  const data=panel.data;
  const effectiveCompanyId=selectedCompanyId||data.selectedCompanyId||"";
  const activeLoad=data.loads[0];
  return <>
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Execução da carga inicial</h2><p className="text-sm text-slate-600">Os jobs ficam na API até o Connector solicitar a próxima execução.</p></div><Button variant="secondary" onClick={refresh} disabled={panel.isFetching}>{panel.isFetching?"Atualizando...":"Atualizar"}</Button></div>
    <div className="mb-4 grid gap-3 sm:grid-cols-5">
      {STATUS_CARDS.map(({key,label})=><button key={key} type="button" onClick={()=>setStatusFilter(current=>current===key?undefined:key)} className={`rounded border p-3 text-left transition ${statusFilter===key?"border-cyan-600 bg-cyan-50":"border-slate-200 bg-slate-50 hover:bg-slate-100"}`}><span className="text-xs uppercase text-slate-500">{label}</span><strong className="mt-1 block text-xl text-slate-900">{data.summary[key.toLowerCase() as "pending"|"running"|"completed"|"failed"]}</strong></button>)}
      <div className="rounded border border-slate-200 bg-slate-50 p-3"><span className="text-xs uppercase text-slate-500">Total</span><strong className="mt-1 block text-xl text-slate-900">{data.summary.total}</strong></div>
    </div>
    <Card className="mb-4 border-cyan-200 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Connector<select className="mt-1.5 h-10 w-full rounded border p-2 font-mono text-sm font-normal" value={connectorId} onChange={e=>setConnectorId(e.target.value)}><option value="">Selecione o Connector</option>{data.connectors.map(c=><option key={c.connectorId} value={c.connectorId}>{c.machineName||"Connector"} — {c.connectorId}{c.environment?` (${c.environment})`:""}</option>)}</select></label>
        {data.companies.length>0&&<label className="text-sm font-semibold text-slate-700">Empresa extraída<select className="mt-1.5 h-10 w-full rounded border p-2 text-sm font-normal" value={effectiveCompanyId} onChange={e=>setSelectedCompanyId(e.target.value)}><option value="">Selecione a empresa</option>{data.companies.map(c=><option key={c.id} value={c.id}>{c.tradeName||c.legalName} — {c.document}</option>)}</select></label>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant={data.companies.length===0?"primary":"secondary"} onClick={()=>bootstrap.mutate()} disabled={!connectorId||bootstrap.isPending}>{bootstrap.isPending?"Solicitando ao Connector...":data.companies.length===0?"Atualizar / tentar novamente":"Atualizar empresas do Consinco"}</Button>
        {data.companies.length>0&&<Button onClick={()=>start.mutate()} disabled={!connectorId||!effectiveCompanyId||start.isPending}>{start.isPending?"Iniciando...":"Iniciar carga"}</Button>}
        {activeLoad&&!["APPROVED","PENDING_VALIDATION"].includes(activeLoad.status)&&<Button variant="secondary" onClick={()=>resume.mutate(activeLoad.id)} disabled={resume.isPending}>{resume.isPending?"Retomando...":"Retomar carga"}</Button>}
        {activeLoad&&activeLoad.status==="PENDING_VALIDATION"&&<><Button onClick={()=>approve.mutate(activeLoad.id)} disabled={approve.isPending}>{approve.isPending?"Aprovando...":"Aprovar carga"}</Button><Button variant="secondary" onClick={()=>{const reason=window.prompt("Motivo da rejeição (opcional, mas recomendado):");if(reason===null)return;reject.mutate({loadId:activeLoad.id,reason:reason.trim()||undefined})}} disabled={reject.isPending}>{reject.isPending?"Rejeitando...":"Rejeitar carga"}</Button></>}
        {activeLoad&&<Button variant="danger" onClick={()=>setResetOpen(o=>!o)}>Zerar carga</Button>}
      </div>
      {activeLoad&&activeLoad.status==="PENDING_VALIDATION"&&<p className="mt-3 rounded bg-cyan-50 p-3 text-sm text-cyan-800">Todos os jobs desta carga terminaram e aguardam validação. Aprove (ou rejeite) para liberar uma nova execução — inclusive se novas consultas foram adicionadas depois desta carga, elas só entram após aprovar e clicar em &ldquo;Iniciar carga&rdquo; de novo.</p>}
      {resetOpen&&activeLoad&&<div className="mt-3 rounded border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-800">Zerar a carga inicial de {data.companies.find(c=>c.id===activeLoad.companyId)?.tradeName||"empresa selecionada"}</p>
        <p className="mt-1 text-sm text-red-700">Isso apaga os registros importados, lotes e jobs desta carga e volta o status para NÃO INICIADA. Use quando os dados foram transmitidos por uma versão anterior e precisam ser recarregados do zero. Não afeta outras cargas nem outros clientes.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-red-800">Sua senha de login<input type="password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} className="mt-1.5 h-10 w-full rounded border border-red-300 bg-white px-3 text-sm font-normal" autoComplete="current-password"/></label>
          <label className="text-sm font-semibold text-red-800">Motivo (opcional)<input value={resetReason} onChange={e=>setResetReason(e.target.value)} className="mt-1.5 h-10 w-full rounded border border-red-300 bg-white px-3 text-sm font-normal" placeholder="Ex.: carga transmitida em versão anterior"/></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="danger" onClick={()=>reset.mutate(activeLoad.id)} disabled={!resetPassword||reset.isPending}>{reset.isPending?"Zerando...":"Confirmar exclusão"}</Button>
          <Button variant="secondary" onClick={()=>{setResetOpen(false);setResetPassword("");setResetReason("")}} disabled={reset.isPending}>Cancelar</Button>
        </div>
        {reset.isError&&<ErrorState message={getApiErrorMessage(reset.error)}/>}
      </div>}
      {reset.isSuccess&&<p className="mt-3 rounded bg-emerald-50 p-3 text-sm text-emerald-800">Carga zerada: {reset.data.deleted.records} registro(s), {reset.data.deleted.batches} lote(s) e {reset.data.deleted.jobs} job(s) removidos. Clique em &ldquo;Iniciar carga&rdquo; para gerar tudo de novo.</p>}
      {bootstrap.isSuccess&&<p className="mt-3 rounded bg-cyan-50 p-3 text-sm text-cyan-800">Solicitação enviada. O Connector busca automaticamente a consulta de empresas, mesmo sem empresa ou carga inicial cadastrada. Esta tela será atualizada durante o processamento.</p>}
      {data.companies.length===0&&<p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-800">O ambiente está selecionado, mas nenhuma empresa jurídica foi importada ainda. Execute &ldquo;Atualizar empresas do Consinco&rdquo;; após o Connector processar MAX_EMPRESA_V1, a empresa aparecerá aqui automaticamente.</p>}
      {(start.isError||bootstrap.isError||resume.isError||retry.isError||approve.isError||reject.isError)&&<ErrorState message="A operação não foi concluída. Verifique consultas ativas, serviço de banco habilitado e estado da carga."/>}
    </Card>
    <Card className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr>{["Consulta","Versão","Recorte","Status","Solicitado","Erro","Ação"].map(l=><th key={l} className="border-b p-3 text-xs uppercase text-slate-500">{l}</th>)}</tr></thead><tbody>{data.jobs.slice(0,50).map(job=><tr className="border-t" key={job.id}><td className="p-3 font-mono text-xs">{displayName(job.queryCode)}</td><td>v{job.queryVersion}</td><td className="text-xs text-slate-600">{jobScopeLabel(job.parameters)||"—"}</td><td><StatusBadge value={job.status}/></td><td className="whitespace-nowrap">{new Date(job.requestedAt).toLocaleString("pt-BR")}</td><td className="max-w-xs truncate text-red-700" title={job.errorMessage||""}>{job.errorMessage||"—"}</td><td>{["FAILED","EXPIRED"].includes(job.status)?<Button variant="secondary" onClick={()=>retry.mutate(job.id)} disabled={retry.isPending}>Reenfileirar</Button>:"—"}</td></tr>)}</tbody></table>{!data.jobs.length&&<p className="p-6 text-center text-sm text-slate-500">Nenhum job encontrado{statusFilter?" para este status":""}. Selecione o Connector e clique em Iniciar carga.</p>}</Card>
  </>;
}

// Parâmetros declarados pela consulta, além de updatedAfter (sempre com default automático de
// sincronismo incremental — não faz sentido o operador digitar isso na mão). Deixados em branco,
// cada um usa o default da consulta (geralmente "sem filtro"); preenchidos, viram um recorte —
// ex.: postingFrom/postingTo + companyNumber pra importar uma empresa por período menor, em vez
// de puxar tudo de uma vez.
function customParameters(query: ConnectorQuery) { return query.parameters.filter(p => p.name.toLowerCase() !== "updatedafter"); }
function ParameterInputs({ parameters, values, setValues }: { parameters: ConnectorQuery["parameters"]; values: Record<string, string>; setValues: (values: Record<string, string>) => void }) {
  if (!parameters.length) return null;
  return <div className="grid gap-3 rounded border bg-slate-50 p-3 md:grid-cols-3">
    <p className="col-span-full text-xs uppercase text-slate-500">Filtros opcionais desta consulta — deixe em branco para não filtrar</p>
    {parameters.map(param => <label key={param.name} className="grid gap-1 text-xs font-semibold text-slate-700">
      {param.name}
      <input
        type={param.type === "datetime" ? "date" : param.type === "number" ? "number" : "text"}
        className="h-9 rounded border border-slate-300 px-2 font-normal"
        value={values[param.name] ?? ""}
        onChange={e => setValues({ ...values, [param.name]: e.target.value })}
        placeholder={param.required ? "obrigatório" : "sem filtro"}
      />
    </label>)}
  </div>;
}

// Já rodou hoje, na mesma versão? "Nova execução" não distinguia isso de rodar pela primeira
// vez — fácil disparar duas cargas do mesmo período sem perceber. Só considera jobs que de fato
// chegaram a algum lugar (não os cancelados manualmente, que não contam como "já rodou hoje").
function ranToday(jobs: ConnectorJob[], code: string, version: number) {
  const today = new Date().toDateString();
  return jobs.some(j => j.queryCode === code && j.queryVersion === version && j.errorCode !== "MANUALLY_CANCELLED" && new Date(j.requestedAt).toDateString() === today);
}
function ScheduleForm({query,jobs,close}:{query:ConnectorQuery;jobs:ConnectorJob[];close:()=>void}){const [connectorId,setConnectorId]=useState(""),[repeat,setRepeat]=useState(false),[frequency,setFrequency]=useState<"DAILY"|"HOURLY"|"MINUTES">("DAILY"),[minutes,setMinutes]=useState(60),[paramValues,setParamValues]=useState<Record<string,string>>({});const [start,setStart]=useState(()=>{const d=new Date(Date.now()+300000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});const companyId=typeof window==="undefined"?"":localStorage.getItem("concilia_company_id")??"";const parameters=Object.fromEntries(Object.entries(paramValues).filter(([,value])=>value.trim()!==""));const save=useMutation({mutationFn:()=>repeat?connectorQueriesService.createRecurringSchedule(query.id,{connectorId,companyId,startAt:new Date(start).toISOString(),frequency,parameters,...(frequency==="MINUTES"?{intervalMinutes:minutes}:{})}):connectorQueriesService.schedule(query.id,connectorId,companyId,parameters),onSuccess:close});return <Card className="mt-4 grid gap-3 border-cyan-200 p-4"><b>{displayName(query.code)} v{query.version}</b><Targets value={connectorId} set={setConnectorId}/><ParameterInputs parameters={customParameters(query)} values={paramValues} setValues={setParamValues}/><label className="flex gap-2 text-sm"><input type="checkbox" checked={repeat} onChange={e=>setRepeat(e.target.checked)}/> Repetir automaticamente</label>{repeat&&<div className="grid gap-3 md:grid-cols-3"><input type="datetime-local" className="rounded border p-2" value={start} onChange={e=>setStart(e.target.value)}/><select className="rounded border p-2" value={frequency} onChange={e=>setFrequency(e.target.value as typeof frequency)}><option value="DAILY">Diária</option><option value="HOURLY">A cada hora</option><option value="MINUTES">Em minutos</option></select>{frequency==="MINUTES"&&<input type="number" min={1} max={1440} className="rounded border p-2" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/>}</div>}{save.isError&&<ErrorState message={getApiErrorMessage(save.error)}/>}<div><Button disabled={!connectorId||!companyId||save.isPending} onClick={()=>{if(!repeat&&ranToday(jobs,query.code,query.version)&&!confirm(`${displayName(query.code)} v${query.version} já foi executada hoje. Quer executar de novo?`))return;save.mutate()}}>{repeat?"Salvar agendamento":"Executar uma vez"}</Button><Button className="ml-2" variant="secondary" onClick={close}>Cancelar</Button></div></Card>}
