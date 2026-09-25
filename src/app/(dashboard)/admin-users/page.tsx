"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, PlusCircle, Search, Users, XCircle } from "lucide-react";
import { Button, Card, ErrorState, PageHeader, PageLoader } from "@/components/shared/ui";
import { adminUsersService, type AdminUser } from "@/services/admin-users.service";

const membershipStatusLabel = { ACTIVE: "Ativo", INVITED: "Convite pendente", DISABLED: "Desativado" } as const;

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const queryKey = ["admin-users"];
  const users = useQuery({ queryKey, queryFn: adminUsersService.list });
  const tenants = useQuery({ queryKey: ["admin-users-tenants"], queryFn: adminUsersService.tenants });
  const [search, setSearch] = useState("");
  const [linking, setLinking] = useState<AdminUser | null>(null);

  const visible = (users.data ?? []).filter((user) => !search.trim() || `${user.name} ${user.email}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));

  if (users.isError) return <><PageHeader title="Usuários internos" description="Vincule analistas e administradores a mais de um cliente (tenant)." /><ErrorState /></>;

  return <>
    <PageHeader title="Usuários internos" description="Vincule analistas e administradores a mais de um cliente (tenant)." />
    <Card className="mb-5 max-w-5xl p-4"><label className="flex h-10 max-w-sm items-center gap-2 rounded-lg border border-slate-300 px-3"><Search size={16} className="text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Pesquisar por nome ou e-mail" /></label></Card>
    {users.isLoading ? <PageLoader /> : <Card className="max-w-5xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Usuário</th><th className="p-3">Perfil</th><th className="p-3">Clientes vinculados</th><th className="p-3 text-right">Ações</th></tr></thead><tbody>{visible.map((user) => <tr key={user.id} className="border-t border-slate-100 align-top"><td className="p-3"><b className="block text-slate-800">{user.name}</b><span className="text-slate-500">{user.email}</span></td><td className="p-3">{user.role}</td><td className="p-3"><div className="flex flex-wrap gap-1.5">{user.tenantMemberships.filter((membership) => membership.status !== "DISABLED").map((membership) => <span key={membership.tenant.id} className="rounded-full bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">{membership.tenant.name}</span>)}{!user.tenantMemberships.some((membership) => membership.status !== "DISABLED") && <span className="text-xs text-slate-400">Nenhum cliente vinculado</span>}</div></td><td className="p-3 text-right"><Button variant="ghost" title="Vincular a outro cliente" onClick={() => setLinking(user)}><PlusCircle size={16} />Vincular</Button></td></tr>)}</tbody></table>{!visible.length && <p className="p-8 text-center text-sm text-slate-500">Nenhum usuário corresponde à busca.</p>}</div></Card>}
    {linking && <LinkTenantDialog user={linking} tenants={tenants.data ?? []} close={() => setLinking(null)} onLinked={() => queryClient.invalidateQueries({ queryKey })} />}
  </>;
}

function LinkTenantDialog({ user, tenants, close, onLinked }: { user: AdminUser; tenants: { id: string; name: string; slug: string }[]; close: () => void; onLinked: () => void }) {
  const activeMemberships = user.tenantMemberships.filter((membership) => membership.status !== "DISABLED");
  const linkedIds = new Set(activeMemberships.map((membership) => membership.tenant.id));
  const options = tenants.filter((tenant) => !linkedIds.has(tenant.id));
  const [tenantId, setTenantId] = useState(options[0]?.id ?? "");
  const link = useMutation({ mutationFn: () => adminUsersService.linkTenant(user.id, tenantId), onSuccess: () => { onLinked(); close(); } });
  const unlink = useMutation({ mutationFn: (id: string) => adminUsersService.unlinkTenant(user.id, id), onSuccess: () => onLinked() });

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="link-tenant-title" className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
      <div className="flex items-start gap-3"><Users className="mt-0.5 text-cyan-700" size={22} /><div><h2 id="link-tenant-title" className="text-lg font-bold text-slate-900">Clientes de {user.name}</h2><p className="mt-1 text-sm text-slate-500">Um usuário pode atender mais de um cliente ao mesmo tempo.</p></div></div>
      <div className="mt-4 grid gap-2">
        {activeMemberships.map((membership) => <div key={membership.tenant.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><span className="flex items-center gap-2 text-sm"><Building2 size={16} className="text-slate-400" /><b className="text-slate-800">{membership.tenant.name}</b><span className="text-xs text-slate-500">{membershipStatusLabel[membership.status]}</span></span><Button variant="ghost" title="Remover vínculo" onClick={() => { if (confirm(`Remover o vínculo de ${user.name} com ${membership.tenant.name}?`)) unlink.mutate(membership.tenant.id); }} disabled={unlink.isPending}><XCircle size={16} /></Button></div>)}
        {!activeMemberships.length && <p className="text-sm text-slate-500">Nenhum cliente vinculado ainda.</p>}
      </div>
      {unlink.isError && <div className="mt-3"><ErrorState message="Não foi possível remover o vínculo." /></div>}
      <div className="mt-5 border-t border-slate-200 pt-4">
        {options.length ? <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><label className="text-sm font-semibold text-slate-700">Adicionar cliente<select value={tenantId} onChange={(event) => setTenantId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal">{options.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label><Button className="mt-auto h-10" onClick={() => link.mutate()} disabled={link.isPending || !tenantId}>{link.isPending ? "Vinculando..." : "Vincular"}</Button></div> : <p className="text-sm text-slate-500">Este usuário já está vinculado a todos os clientes ativos.</p>}
        {link.isError && <div className="mt-3"><ErrorState message="Não foi possível vincular o usuário a este cliente." /></div>}
      </div>
      <div className="mt-5 flex justify-end"><Button variant="secondary" onClick={close}>Fechar</Button></div>
    </div>
  </div>;
}
