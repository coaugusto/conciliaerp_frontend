"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, ErrorState, PageHeader, StatusBadge } from "@/components/shared/ui";
import { connectorQueriesService, type ConnectorQuery } from "@/services/connector-queries.service";

export default function Page() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<ConnectorQuery | null>(null);
  const [scheduling, setScheduling] = useState<ConnectorQuery | null>(null);
  const queries = useQuery({ queryKey: ["connector-queries"], queryFn: connectorQueriesService.list });
  const toggle = useMutation({ mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => connectorQueriesService.setEnabled(id, enabled), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["connector-queries"] }) });
  if (queries.isLoading) return <Card className="p-8">Carregando consultas...</Card>;
  if (queries.isError) return <ErrorState message="Não foi possível carregar o catálogo." />;
  return <>
    <PageHeader title="Consultas do Connector" description="Consultas versionadas, somente leitura e auditáveis." action={<Button onClick={() => setCreating(true)}>Nova consulta</Button>} />
    <Card className="overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left">Código</th><th>Versão</th><th>Descrição</th><th>Status</th><th /></tr></thead><tbody>{queries.data?.map((item) => <tr className="border-t" key={item.id}><td className="p-3 font-mono text-xs">{item.code}</td><td>v{item.version}</td><td>{item.description}</td><td><button onClick={() => toggle.mutate({ id: item.id, enabled: !item.enabled })}><StatusBadge value={item.enabled ? "ACTIVE" : "INACTIVE"} /></button></td><td className="flex gap-1 py-1"><Button variant="ghost" onClick={() => setSelected(item)}>SQL</Button><Button disabled={!item.enabled} variant="secondary" onClick={() => setScheduling(item)}>Agendar</Button></td></tr>)}</tbody></table></Card>
    {selected && <Card className="mt-4 p-4"><b>{selected.code} v{selected.version}</b><pre className="mt-3 max-h-80 overflow-auto rounded bg-slate-950 p-4 text-xs text-white">{selected.sqlPreview}</pre><p className="mt-2 text-xs text-slate-500">SHA-256: {selected.sha256}</p></Card>}
    {creating && <DefinitionForm close={() => setCreating(false)} refresh={() => queryClient.invalidateQueries({ queryKey: ["connector-queries"] })} />}
    {scheduling && <ScheduleForm query={scheduling} close={() => setScheduling(null)} />}
  </>;
}

function DefinitionForm({ close, refresh }: { close: () => void; refresh: () => void }) {
  const [code, setCode] = useState(""); const [description, setDescription] = useState(""); const [sqlPreview, setSql] = useState("SELECT\n  ...\nFROM CONSINCO...");
  const create = useMutation({ mutationFn: () => connectorQueriesService.create({ code, description, sqlPreview, parameters: [], timeoutSeconds: 60, maxRows: 10000, batchSize: 500 }), onSuccess: () => { refresh(); close(); } });
  return <Card className="mt-4 grid gap-3 p-4"><input className="rounded border p-2 font-mono" placeholder="FISCAL_DOCUMENTS" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /><input className="rounded border p-2" placeholder="Descrição" value={description} onChange={(event) => setDescription(event.target.value)} /><textarea className="min-h-52 rounded border p-3 font-mono text-xs" value={sqlPreview} onChange={(event) => setSql(event.target.value)} /><div><Button disabled={!code || !description || create.isPending} onClick={() => create.mutate()}>Publicar versão</Button><Button className="ml-2" variant="secondary" onClick={close}>Cancelar</Button></div></Card>;
}

function ScheduleForm({ query, close }: { query: ConnectorQuery; close: () => void }) {
  const targets = useQuery({ queryKey: ["connector-targets"], queryFn: connectorQueriesService.listConnectors });
  const [connectorId, setConnectorId] = useState("");
  const schedule = useMutation({ mutationFn: () => connectorQueriesService.schedule(query.id, connectorId), onSuccess: close });
  return <Card className="mt-4 grid gap-3 p-4"><p className="font-medium">Agendar {query.code} v{query.version}</p><select className="rounded border p-2" value={connectorId} onChange={(event) => setConnectorId(event.target.value)}><option value="">Selecione o Connector</option>{targets.data?.map((target) => <option key={target.connectorId} value={target.connectorId}>{target.machineName || target.connectorId} {target.environment ? `(${target.environment})` : ""}</option>)}</select>{targets.data?.length === 0 && <p className="text-sm text-amber-700">Nenhum Connector ativo reportou presença para esta empresa.</p>}<div><Button disabled={!connectorId || schedule.isPending} onClick={() => schedule.mutate()}>Enviar para fila</Button><Button className="ml-2" variant="secondary" onClick={close}>Cancelar</Button></div></Card>;
}
