"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, ScrollText } from "lucide-react";
import { Button, Card, ErrorState, PageHeader, PageLoader } from "@/components/shared/ui";
import { auditLogsService, type AuditLogExport } from "@/services/audit-logs.service";

export default function AuditLogsPage() {
  const [tab, setTab] = useState<"trail" | "exports">("trail");
  return <>
    <PageHeader title="Auditoria" description="Toda alteração, extração e importação de dados feita na plataforma, com o usuário responsável." />
    <div className="mb-5 flex gap-2">
      <Button variant={tab === "trail" ? "primary" : "secondary"} onClick={() => setTab("trail")}>Trilha de auditoria</Button>
      <Button variant={tab === "exports" ? "primary" : "secondary"} onClick={() => setTab("exports")}>Exportações (retenção vencida)</Button>
    </div>
    {tab === "trail" ? <AuditTrailTable /> : <AuditExportsTable />}
  </>;
}

function AuditTrailTable() {
  const [page, setPage] = useState(1);
  const logs = useQuery({ queryKey: ["audit-logs", page], queryFn: () => auditLogsService.list(page) });
  if (logs.isError) return <ErrorState message="Não foi possível carregar a trilha de auditoria." />;
  const pages = Math.max(1, logs.data?.totalPages ?? 1);
  return <Card className="overflow-hidden">
    <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Quando</th><th className="p-3">Usuário</th><th className="p-3">Ação</th><th className="p-3">Entidade</th><th className="p-3">IP</th></tr></thead><tbody>
      {logs.data?.items.map((entry) => <tr key={entry.id} className="border-t border-slate-100 align-top">
        <td className="p-3 whitespace-nowrap text-slate-600">{new Date(entry.createdAt).toLocaleString("pt-BR")}</td>
        <td className="p-3">{entry.user ? <><b className="block text-slate-800">{entry.user.name}</b><span className="text-slate-500">{entry.user.email}</span></> : <span className="text-slate-400">Sistema</span>}</td>
        <td className="p-3 font-mono text-xs text-slate-700">{entry.action}</td>
        <td className="p-3 text-slate-600">{entry.entity}{entry.entityId && <code className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-xs">{entry.entityId}</code>}</td>
        <td className="p-3 text-slate-500">{entry.ipAddress ?? "—"}</td>
      </tr>)}
    </tbody></table>
    {logs.isLoading && <PageLoader label="Carregando trilha de auditoria..." />}
    {!logs.isLoading && !logs.data?.items.length && <p className="p-8 text-center text-sm text-slate-500">Nenhum registro de auditoria encontrado.</p>}
    </div>
    <div className="flex items-center justify-between border-t border-slate-100 p-3 text-sm text-slate-600"><span>Página {page}/{pages}</span><div className="flex gap-2"><Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</Button></div></div>
  </Card>;
}

function AuditExportsTable() {
  const [page, setPage] = useState(1);
  const exports = useQuery({ queryKey: ["audit-log-exports", page], queryFn: () => auditLogsService.listExports(page) });
  const download = useMutation({ mutationFn: (item: AuditLogExport) => auditLogsService.downloadExport(item) });
  if (exports.isError) return <ErrorState message="Não foi possível carregar as exportações de auditoria." />;
  const pages = Math.max(1, exports.data?.totalPages ?? 1);
  const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return <>
    <Card className="mb-4 flex items-start gap-3 p-4"><ScrollText className="mt-0.5 shrink-0 text-cyan-700" size={20} /><p className="text-sm text-slate-600">Quando um registro de auditoria atinge o prazo de retenção configurado (aba Parâmetros do Portal do Cliente), ele é removido da trilha ativa e um arquivo comprimido com o conteúdo fica disponível aqui para download.</p></Card>
    <Card className="overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Período</th><th className="p-3">Registros</th><th className="p-3">Tamanho</th><th className="p-3">Gerado em</th><th className="p-3 text-right">Ações</th></tr></thead><tbody>
        {exports.data?.items.map((item) => <tr key={item.id} className="border-t border-slate-100">
          <td className="p-3 text-slate-700">{new Date(item.periodFrom).toLocaleDateString("pt-BR")} – {new Date(item.periodTo).toLocaleDateString("pt-BR")}</td>
          <td className="p-3 text-slate-600">{item.recordCount.toLocaleString("pt-BR")}</td>
          <td className="p-3 text-slate-600">{formatSize(item.sizeBytes)}</td>
          <td className="p-3 text-slate-600">{new Date(item.createdAt).toLocaleString("pt-BR")}</td>
          <td className="p-3 text-right"><Button variant="ghost" title="Baixar" onClick={() => download.mutate(item)} disabled={download.isPending}><Download size={16} /></Button></td>
        </tr>)}
      </tbody></table>
      {exports.isLoading && <PageLoader label="Carregando exportações..." />}
      {!exports.isLoading && !exports.data?.items.length && <p className="p-8 text-center text-sm text-slate-500">Nenhuma exportação gerada até agora.</p>}
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 p-3 text-sm text-slate-600"><span>Página {page}/{pages}</span><div className="flex gap-2"><Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</Button></div></div>
    </Card>
    {download.isError && <div className="mt-3"><ErrorState message="Não foi possível baixar a exportação." /></div>}
  </>;
}
