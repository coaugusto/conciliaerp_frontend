"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Copy, Download, KeyRound, Settings2, ShieldCheck } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card, ErrorState, PageHeader } from "@/components/shared/ui";
import { commercialService, type ClientServiceFlag } from "@/services/commercial.service";
import { connectorDesktopService } from "@/services/connector-desktop.service";
import { api, type ApiResponse } from "@/services/api/client";
import { useAuth } from "@/providers/providers";
import { ClientUsersCard } from "@/components/commercial/client-users-card";

type ClientTenant = { id: string; name: string; cncCode: string };

function maskKey(value: string) {
  return `${value.slice(0, 8)}${"•".repeat(Math.max(12, value.length - 12))}${value.slice(-4)}`;
}

export default function CommercialPortal() {
  const { user } = useAuth();
  const canInstallConnector = user?.role === "ADMIN" || user?.role === "COMPANY_ADMIN";
  const connectorRelease = useQuery({ queryKey: ["connector-desktop-release"], queryFn: connectorDesktopService.release, enabled: canInstallConnector });
  const [key, setKey] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [tenantId, setTenantId] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("concilia_tenant_id") ?? "");
  const [tenantName, setTenantName] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("concilia_tenant_name") ?? "");
  const [editingName, setEditingName] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("concilia_tenant_name") ?? "");
  const [cncCode, setCncCode] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("concilia_cnc_code") ?? "");
  const [tenants, setTenants] = useState<ClientTenant[]>([]);
  const [newClientName, setNewClientName] = useState("");
  const [activeTab, setActiveTab] = useState<"registration" | "parameters" | "connector">("registration");
  useEffect(() => { const refresh = () => { const name = localStorage.getItem("concilia_tenant_name") ?? ""; setTenantId(localStorage.getItem("concilia_tenant_id") ?? ""); setTenantName(name); setEditingName(name); setCncCode(localStorage.getItem("concilia_cnc_code") ?? ""); }; window.addEventListener("concilia:tenant-changed", refresh); return () => window.removeEventListener("concilia:tenant-changed", refresh); }, []);
  useEffect(() => { api.get<ApiResponse<ClientTenant[]>>("/auth/tenants").then(response => setTenants(response.data.data)).catch(() => setTenants([])); }, []);
  const selectClient = async (id: string) => { try { const response = await api.post<ApiResponse<{ accessToken: string; tenant: ClientTenant }>>("/auth/select-tenant", { tenantId: id }); const selected = response.data.data; localStorage.setItem("concilia_token", selected.accessToken); localStorage.setItem("concilia_tenant_id", selected.tenant.id); localStorage.setItem("concilia_tenant_name", selected.tenant.name); localStorage.setItem("concilia_cnc_code", selected.tenant.cncCode); setTenantId(selected.tenant.id); setTenantName(selected.tenant.name); setEditingName(selected.tenant.name); setCncCode(selected.tenant.cncCode); window.dispatchEvent(new Event("concilia:tenant-changed")); } catch { /* A tela mantém o cliente atual caso a seleção seja recusada. */ } };
  const createClient = useMutation({ mutationFn: async () => { const created = (await api.post<ApiResponse<ClientTenant & { slug?: string }>>("/tenants", { name: newClientName })).data.data; return { ...created, cncCode: created.cncCode ?? created.slug ?? "" }; }, onSuccess: async client => { setTenants(current => [...current, client].sort((a, b) => (a.cncCode ?? "").localeCompare(b.cncCode ?? ""))); setNewClientName(""); await selectClient(client.id); } });
  const renameClient = useMutation({ mutationFn: async () => (await api.patch<ApiResponse<ClientTenant>>(`/tenants/${tenantId}`, { name: editingName })).data.data, onSuccess: client => { setTenantName(client.name); setEditingName(client.name); localStorage.setItem("concilia_tenant_name", client.name); setTenants(current => current.map(item => item.id === client.id ? client : item)); window.dispatchEvent(new Event("concilia:tenant-changed")); } });
  const deleteClient = useMutation({ mutationFn: async () => (await api.delete<ApiResponse<{ deleted: boolean }>>(`/tenants/${tenantId}`)).data.data, onSuccess: () => { setTenants(current => current.filter(item => item.id !== tenantId)); localStorage.removeItem("concilia_tenant_id"); localStorage.removeItem("concilia_tenant_name"); localStorage.removeItem("concilia_cnc_code"); localStorage.removeItem("concilia_token"); setTenantId(""); setTenantName(""); setEditingName(""); setCncCode(""); window.dispatchEvent(new Event("concilia:tenant-changed")); } });
  const createKey = useMutation({
    mutationFn: () => commercialService.createApiKey(`Ativação Connector ${new Date().toISOString()}`, ["connector:activate"]),
    onSuccess: (result) => {
      setKey(result.key);
      setCopied(false);
    },
  });
  const copyKey = async () => {
    if (!key) return;
    await navigator.clipboard.writeText(key);
    setCopied(true);
  };

  return <>
    <PageHeader title="Portal do Cliente" description="Baixe o agente local, configure os serviços e gere sua chave de ativação." />
    <div role="tablist" aria-label="Áreas do Portal do Cliente" className="mb-6 flex max-w-5xl gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1.5">{[["registration", "Cadastros"], ["parameters", "Parâmetros"], ["connector", "Connector"]].map(([value, label]) => <button key={value} role="tab" aria-selected={activeTab === value} onClick={() => setActiveTab(value as typeof activeTab)} className={`min-w-32 flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${activeTab === value ? "bg-white text-cyan-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-white/70 hover:text-slate-800"}`}>{label}</button>)}</div>
    {activeTab === "registration" && <div role="tabpanel" className="max-w-5xl">
    <TabDropdown title="Cadastro do cliente" description="Crie um cliente e gere seu CNC_CODE." defaultOpen>
    <Card className="mb-5 max-w-3xl p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Cadastro de cliente</p><h2 className="mt-1 text-lg font-bold text-slate-900">Criar cliente e CNC_CODE</h2><p className="mt-1 text-sm text-slate-500">Informe o nome. O CNC_CODE exclusivo será gerado automaticamente, gravado na API e selecionado para seu usuário.</p></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Nome do cliente<input value={newClientName} onChange={event => setNewClientName(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" placeholder="Razão social ou nome fantasia" /></label><div className="text-sm font-semibold text-slate-700">CNC_CODE<div className="mt-1.5 flex h-11 items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 font-mono text-sm font-normal text-slate-500">Gerado automaticamente</div></div></div><Button className="mt-5" onClick={() => createClient.mutate()} disabled={createClient.isPending || !newClientName.trim()}>{createClient.isPending ? "Criando cliente..." : "Criar cliente"}</Button>{createClient.isError && <ErrorState message="Não foi possível criar o cliente." />}</Card>
    </TabDropdown>
    {tenantId && user?.role === "ADMIN" && <TabDropdown title="Usuários do cliente" description="Cadastre, edite e reenvie convites de acesso."><ClientUsersCard tenantId={tenantId} /></TabDropdown>}
    </div>}
    {activeTab === "parameters" && <div role="tabpanel" className="max-w-5xl"><TabDropdown title="Serviços contratados" description="Defina as rotinas autorizadas para o cliente." defaultOpen>{tenantId && canInstallConnector ? <ClientServicesCard /> : <Card className="p-6 text-sm text-amber-700">Selecione um cliente e confirme seu perfil de administrador para configurar os serviços contratados.</Card>}</TabDropdown></div>}
    {activeTab === "connector" && <div role="tabpanel" className="max-w-5xl">
    {canInstallConnector &&
    <TabDropdown title="Instalação do Connector" description="Baixe o agente local para o ambiente do cliente." defaultOpen>
    <Card className="mb-5 max-w-3xl p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-cyan-700" size={24} /><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Agente local</p><h2 className="mt-1 text-lg font-bold text-slate-900">Concilia ERP Connector para Windows</h2><p className="mt-1 max-w-xl text-sm text-slate-500">Instale no servidor ou computador que possui acesso ao ERP. Depois, gere a chave abaixo e use-a no primeiro acesso para vincular o agente ao cliente selecionado.</p>{connectorRelease.data?.available && <p className="mt-3 break-all text-xs text-slate-500">Versão {connectorRelease.data.version} · Windows {connectorRelease.data.architecture}{connectorRelease.data.sha256 ? ` · SHA-256 ${connectorRelease.data.sha256}` : ""}</p>}{connectorRelease.data && !connectorRelease.data.available && <p className="mt-3 text-sm text-amber-700">{connectorRelease.data.message}</p>}</div></div>
        {connectorRelease.data?.downloadUrl && <a href={connectorRelease.data.downloadUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-[#075d70] px-4 text-sm font-semibold text-white transition hover:bg-[#064e5e]"><Download size={16} />Baixar instalador</a>}
      </div>
      {connectorRelease.isLoading && <p className="mt-4 text-sm text-slate-500">Consultando a versão disponível...</p>}
      {connectorRelease.isError && <div className="mt-4"><ErrorState message="O instalador ainda não foi publicado. Solicite a publicação ao administrador do Concilia ERP." /></div>}
    </Card>
    </TabDropdown>
    }
    <TabDropdown title="Ativação do Connector" description="Selecione o cliente e gere uma chave de ativação.">
    <Card className="max-w-3xl p-5">
      <div className="flex items-start gap-3"><KeyRound className="mt-0.5 text-blue-600" size={22} /><div><h2 className="font-bold text-slate-900">Chave de ativação do Connector</h2><p className="mt-1 text-sm text-slate-500">A chave completa fica disponível apenas nesta sessão e é consumida no primeiro registro bem-sucedido do agente.</p></div></div>
      {tenantId && <div className="mt-5 grid gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Nome do cliente</p><strong className="mt-1 block text-base text-slate-900">{tenantName || "Cliente sem nome"}</strong></div><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">CNC_CODE</p><strong className="mt-1 block break-all font-mono text-base text-slate-900">{cncCode || tenantId}</strong></div></div>}
      {tenantId && <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-semibold text-slate-700">Editar nome do cliente<input value={editingName} onChange={event => setEditingName(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal" /></label><Button variant="secondary" onClick={() => renameClient.mutate()} disabled={renameClient.isPending || !editingName.trim() || editingName.trim() === tenantName}>{renameClient.isPending ? "Salvando..." : "Salvar nome"}</Button><Button variant="danger" onClick={() => { if (window.confirm("Excluir este cliente? Isso só é permitido se não houver movimentações, integrações ou chaves de API.")) deleteClient.mutate(); }} disabled={deleteClient.isPending}>{deleteClient.isPending ? "Excluindo..." : "Excluir cliente"}</Button></div>}
      {renameClient.isError && <ErrorState message="Não foi possível atualizar o nome do cliente." />}
      {deleteClient.isError && <ErrorState message="Não foi possível excluir o cliente: existem movimentações, integrações ou chaves associadas." />}
      {tenants.length > 0 && <label className="mt-5 block text-sm font-semibold text-slate-700">Selecionar cliente pelo CNC_CODE<select value={tenantId} onChange={event => selectClient(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-800"><option value="" disabled>Selecione um cliente</option>{tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.cncCode} · {tenant.name}</option>)}</select></label>}
      {!tenantId && <p className="mt-4 text-sm text-amber-700">Selecione ou cadastre um cliente antes de gerar uma chave de API.</p>}
      <Button className="mt-5" onClick={() => createKey.mutate()} disabled={createKey.isPending || !tenantId}>{createKey.isPending ? "Gerando..." : "Gerar chave de ativação"}</Button>
      {createKey.isError && <ErrorState message="Não foi possível gerar a chave de API." />}
      {key && <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Chave gerada</p><p className="mt-2 break-all font-mono text-sm text-slate-700" aria-label="Chave de API mascarada">{maskKey(key)}</p><Button variant="secondary" className="mt-4" onClick={copyKey}><Copy size={16} />{copied ? "Copiada" : "Copiar chave"}</Button></div>}
    </Card>
    </TabDropdown>
    </div>}
  </>;
}

function TabDropdown({ title, description, defaultOpen = false, children }: { title: string; description: string; defaultOpen?: boolean; children: React.ReactNode }) { return <details open={defaultOpen || undefined} className="group mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 marker:hidden"><div className="min-w-0 flex-1"><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-0.5 text-sm text-slate-500">{description}</p></div><ChevronDown size={20} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" /></summary><div className="border-t border-slate-200 bg-slate-50 p-4 [&>section]:mb-0 [&>section]:max-w-none">{children}</div></details>; }

type ServiceDefinition = ClientServiceFlag & { description: string; input: string; output: string; implementation: boolean };
const defaultClientServices: ServiceDefinition[] = [
  { code: "fiscal_registration_reconciliation", name: "Conciliação de cadastro fiscal", description: "Compara o cadastro extraído com as regras e referências fiscais.", input: "Cadastros fiscais extraídos", output: "Sugestões de correção", enabled: false, inputEnabled: true, outputEnabled: true, implementation: true },
  { code: "product_import", name: "Produtos", description: "Importa produtos para saneamento e validação cadastral.", input: "Produtos do ERP", output: "Resultado da análise e ajustes", enabled: false, inputEnabled: true, outputEnabled: true, implementation: true },
  { code: "family_import", name: "Famílias", description: "Importa a estrutura de famílias e classificações comerciais.", input: "Famílias do ERP", output: "Famílias conciliadas", enabled: false, inputEnabled: true, outputEnabled: true, implementation: true },
  { code: "tax_import", name: "Tributação", description: "Valida regras, CST, CFOP, NCM, CEST e alíquotas.", input: "Tributação cadastrada", output: "Divergências e sugestões fiscais", enabled: false, inputEnabled: true, outputEnabled: true, implementation: true },
  { code: "tax_table_import", name: "Pauta fiscal", description: "Importa e confere pautas e valores de referência.", input: "Pautas vigentes", output: "Pautas validadas", enabled: false, inputEnabled: true, outputEnabled: true, implementation: true },
  { code: "supplier_import", name: "Fornecedores", description: "Relaciona fornecedores aos produtos e valida seus cadastros.", input: "Fornecedores e vínculos", output: "Pendências cadastrais", enabled: false, inputEnabled: true, outputEnabled: true, implementation: true },
  { code: "initial_registration_validation", name: "Validação inicial", description: "Executa a primeira conciliação completa durante a implantação.", input: "Cadastros do pacote", output: "Diagnóstico inicial", enabled: false, inputEnabled: true, outputEnabled: true, implementation: true },
  { code: "implementation_xml_load", name: "XML simulado para implantação", description: "Gera notas de venda simuladas dos fornecedores para testar a importação do cliente.", input: "Fornecedores, produtos e tributação", output: "Arquivos XML de teste", enabled: false, inputEnabled: true, outputEnabled: true, implementation: true },
  { code: "fiscal_monitoring", name: "Monitoramento fiscal", description: "Serviço contínuo e independente para clientes já implantados.", input: "Extrações por API ou banco", output: "Alertas e sugestões de ajuste", enabled: false, inputEnabled: true, outputEnabled: true, implementation: false },
  { code: "sped_processing", name: "Processamento automático de SPED", description: "Analisa cada novo SPED recebido pelo Connector.", input: "Arquivo SPED", output: "Propostas e alertas fiscais", enabled: false, inputEnabled: true, outputEnabled: true, implementation: false },
];

function ClientServicesCard() {
  const services = useQuery({ queryKey: ["commercial", "client-services"], queryFn: commercialService.clientServices, retry: false });
  const [draft, setDraft] = useState<ClientServiceFlag[] | null>(null);
  const source = draft ?? services.data;
  const currentServices = defaultClientServices.map((definition) => ({ ...definition, ...source?.find((service) => service.code === definition.code), name: definition.name, inputEnabled: source?.find((service) => service.code === definition.code)?.inputEnabled ?? definition.inputEnabled, outputEnabled: source?.find((service) => service.code === definition.code)?.outputEnabled ?? definition.outputEnabled }));
  const implementationCodes = defaultClientServices.filter((service) => service.implementation).map((service) => service.code);
  const implementationEnabled = implementationCodes.every((code) => currentServices.find((service) => service.code === code)?.enabled);
  const save = useMutation({ mutationFn: () => commercialService.updateClientServices(currentServices), onSuccess: (result) => setDraft(result) });
  const update = (code: ClientServiceFlag["code"], changes: Partial<ClientServiceFlag>) => setDraft(currentServices.map((service) => service.code === code ? { ...service, ...changes } : service));
  const toggleImplementation = () => setDraft(currentServices.map((service) => implementationCodes.includes(service.code) ? { ...service, enabled: !implementationEnabled, inputEnabled: true, outputEnabled: true } : service));
  return <Card className="mb-5 p-5"><div className="flex items-start gap-3"><Settings2 className="mt-0.5 shrink-0 text-cyan-700" size={23} /><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Parâmetros do Connector</p><h2 className="mt-1 text-lg font-bold text-slate-900">Serviços, entradas e saídas</h2><p className="mt-1 text-sm text-slate-500">Defina o que o Connector recebe e quais resultados o cliente poderá exportar após a análise.</p></div></div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-violet-300 bg-slate-50 p-4"><div><strong className="text-slate-900">Pacote Implantação</strong><p className="mt-1 max-w-2xl text-sm text-slate-600">Ativa produtos, famílias, tributação, pauta, fornecedores, conciliação cadastral, validação inicial e XML simulado. Não inclui monitoramento fiscal.</p></div><label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-5 accent-violet-700" checked={implementationEnabled} onChange={toggleImplementation} />{implementationEnabled ? "Pacote habilitado" : "Habilitar pacote"}</label></div>
    <div className="mt-5 grid gap-3">{currentServices.map((service) => <div key={service.code} className={`rounded-xl border p-4 ${service.enabled ? "border-cyan-300 bg-cyan-50/50" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{service.name}</strong>{service.implementation && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">Implantação</span>}</div><p className="mt-1 text-sm text-slate-500">{service.description}</p><code className="text-xs text-slate-400">{service.code}</code></div><input type="checkbox" aria-label={`Habilitar ${service.name}`} className="size-5 shrink-0 accent-cyan-700" checked={service.enabled} onChange={() => update(service.code, { enabled: !service.enabled })} /></div>{service.enabled && <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2"><FlowOption label="Entrada" description={service.input} checked={service.inputEnabled} change={(checked) => update(service.code, { inputEnabled: checked })} /><FlowOption label="Saída" description={service.output} checked={service.outputEnabled} change={(checked) => update(service.code, { outputEnabled: checked })} /></div>}</div>)}</div>
    {services.isError && <p className="mt-3 text-sm text-amber-700">O backend ainda não disponibilizou o contrato completo de serviços. Os valores exibidos são o modelo inicial.</p>}{save.isError && <div className="mt-3"><ErrorState message="Não foi possível salvar os serviços contratados no backend." /></div>}<div className="mt-4 flex items-center gap-3"><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar parâmetros"}</Button>{save.isSuccess && <span className="text-sm font-medium text-emerald-700">Parâmetros salvos.</span>}</div></Card>;
}

function FlowOption({ label, description, checked, change }: { label: string; description: string; checked: boolean; change: (checked: boolean) => void }) { return <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3"><input type="checkbox" className="mt-0.5 size-4 accent-cyan-700" checked={checked} onChange={(event) => change(event.target.checked)} /><span><strong className="block text-xs uppercase tracking-wide text-cyan-700">{label}</strong><span className="mt-1 block text-sm text-slate-700">{description}</span></span></label>; }
