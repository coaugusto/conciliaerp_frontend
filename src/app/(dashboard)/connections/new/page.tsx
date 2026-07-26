"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button, Card, Notice, PageHeader } from "@/components/shared/ui";
import { connectionsService } from "@/services/connections.service";
import { getApiErrorMessage } from "@/services/api/client";

type Form = { name:string; connectorBaseUrl:string; connectorId:string; connectorApiKey:string };
const initialForm:Form={name:"",connectorBaseUrl:"https://connector.cliente.local:8443",connectorId:"",connectorApiKey:""};

export default function NewConnectionPage(){
  const [form,setForm]=useState<Form>(initialForm),[error,setError]=useState(""),[saving,setSaving]=useState(false); const router=useRouter();
  const update=(field:keyof Form)=>(e:React.ChangeEvent<HTMLInputElement>)=>setForm(current=>({...current,[field]:e.target.value}));
  const save=async()=>{if(Object.values(form).some(v=>!v.trim()))return setError("Informe nome, URL, ID e API Key do Connector.");setSaving(true);setError("");try{await connectionsService.create(form);router.push("/connections");}catch(e){setError(getApiErrorMessage(e));}finally{setSaving(false);}};
  return <><PageHeader title="Nova conexão ERP" description="Conecte o backend ao ConciliaERP Connector instalado no ambiente do cliente."/><Card className="max-w-3xl p-6"><h2 className="text-lg font-bold">ConciliaERP Connector</h2><p className="mt-1 text-sm text-slate-500">O backend não recebe credenciais Oracle e não abre conexões com o banco do cliente.</p><div className="mt-5 grid gap-4"><Field label="Nome da conexão" value={form.name} onChange={update("name")} placeholder="Ex.: ERP matriz"/><Field label="URL do Connector" value={form.connectorBaseUrl} onChange={update("connectorBaseUrl")} placeholder="https://connector.cliente.local:8443"/><Field label="ID do Connector" value={form.connectorId} onChange={update("connectorId")} placeholder="UUID informado pelo Connector"/><Field label="API Key" value={form.connectorApiKey} onChange={update("connectorApiKey")} placeholder="Chave de autenticação" type="password"/></div>{error&&<p className="mt-4 text-sm text-red-600">{error}</p>}<Notice>A chave é enviada somente ao backend por HTTPS, cifrada em repouso e nunca volta nesta tela. A URL deve estar autorizada em `CONNECTOR_ALLOWED_HOSTS`.</Notice><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={()=>router.back()}>Cancelar</Button><Button disabled={saving} onClick={save}><Save size={16}/>{saving?"Salvando...":"Salvar conexão"}</Button></div></Card></>;
}
function Field({label,value,onChange,placeholder,type="text"}:{label:string;value:string;onChange:(event:React.ChangeEvent<HTMLInputElement>)=>void;placeholder?:string;type?:string}){return <label className="text-sm font-semibold text-slate-700">{label}<input value={value} onChange={onChange} type={type} autoComplete={type==="password"?"new-password":undefined} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal" placeholder={placeholder}/></label>;}
