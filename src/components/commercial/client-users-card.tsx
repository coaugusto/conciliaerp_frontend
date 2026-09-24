"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, MailPlus, RotateCw, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Button, Card, ErrorState, PageLoader } from "@/components/shared/ui";
import { clientUsersService, type ClientUser, type ClientUserRole } from "@/services/client-users.service";
import { accessPermissionsService } from "@/services/access-permissions.service";

const invitationLabels = { PENDING: "Convite pendente", ACCEPTED: "Acesso confirmado", EXPIRED: "Convite expirado" };

export function ClientUsersCard({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["client-users", tenantId];
  const users = useQuery({ queryKey, queryFn: () => clientUsersService.list(tenantId) });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ClientUserRole>("COMPANY_ADMIN");
  const [editing, setEditing] = useState<ClientUser | null>(null);
  const [managingPermissions, setManagingPermissions] = useState<ClientUser | null>(null);
  const create = useMutation({ mutationFn: () => clientUsersService.create(tenantId, { name: name.trim(), email: email.trim(), role }), onSuccess: () => { setName(""); setEmail(""); queryClient.invalidateQueries({ queryKey }); } });
  const update = useMutation({ mutationFn: (user: ClientUser) => clientUsersService.update(tenantId, user.id, { name: user.name.trim(), email: user.email.trim(), role: user.role, active: user.active }), onSuccess: () => { setEditing(null); queryClient.invalidateQueries({ queryKey }); } });
  const resend = useMutation({ mutationFn: (userId: string) => clientUsersService.resendInvitation(tenantId, userId), onSuccess: () => queryClient.invalidateQueries({ queryKey }) });

  return <Card className="mb-5 max-w-5xl overflow-hidden"><div className="border-b border-slate-200 p-5"><div className="flex items-start gap-3"><Users className="mt-0.5 text-cyan-700" size={23} /><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Acesso do cliente</p><h2 className="mt-1 text-lg font-bold text-slate-900">Usuários vinculados ao cliente</h2><p className="mt-1 text-sm text-slate-500">Cadastre um usuário para enviar o convite de acesso. No primeiro login, a troca de senha será obrigatória.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]"><Field label="Nome" value={name} setValue={setName} placeholder="Nome completo" /><Field label="E-mail" value={email} setValue={setEmail} placeholder="usuario@cliente.com.br" type="email" /><label className="text-sm font-semibold text-slate-700">Perfil<select value={role} onChange={(event) => setRole(event.target.value as ClientUserRole)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal"><option value="COMPANY_ADMIN">Administrador do cliente</option><option value="ANALYST">Analista</option></select></label><Button className="mt-auto h-10" onClick={() => create.mutate()} disabled={create.isPending || !name.trim() || !email.includes("@")}><UserPlus size={16} />{create.isPending ? "Enviando..." : "Cadastrar e convidar"}</Button></div>{create.isError && <div className="mt-4"><ErrorState message="Não foi possível cadastrar o usuário ou enviar o convite." /></div>}{create.isSuccess && <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700"><MailPlus size={16} />Usuário cadastrado e convite solicitado ao serviço de e-mail.</p>}</div>
    {users.isError ? <div className="p-5"><ErrorState message="Não foi possível carregar os usuários deste cliente." /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Usuário</th><th className="p-3">Perfil</th><th className="p-3">Convite</th><th className="p-3">Acesso</th><th className="p-3 text-right">Ações</th></tr></thead><tbody>{users.data?.map((user) => <tr key={user.id} className="border-t border-slate-100"><td className="p-3"><b className="block text-slate-800">{user.name}</b><span className="text-slate-500">{user.email}</span></td><td className="p-3">{user.role === "COMPANY_ADMIN" ? "Administrador do cliente" : "Analista"}</td><td className="p-3"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{invitationLabels[user.invitationStatus]}</span>{user.invitationStatus === "PENDING" && user.invitationEmailSentAt && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700" title={`Enviado em ${new Date(user.invitationEmailSentAt).toLocaleString("pt-BR")}`}><span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />E-mail enviado</span>}</div>{user.mustChangePassword && <small className="mt-1 block text-amber-700">Troca de senha obrigatória</small>}</td><td className="p-3">{user.active ? "Ativo" : "Inativo"}</td><td className="p-3 text-right"><Button variant="ghost" title="Editar usuário" onClick={() => setEditing(user)}><Edit3 size={16} /></Button>{user.role === "ANALYST" && <Button variant="ghost" title="Permissões especiais" onClick={() => setManagingPermissions(user)}><ShieldCheck size={16} /></Button>}{user.invitationStatus !== "ACCEPTED" && <Button variant="ghost" title="Reenviar convite" onClick={() => resend.mutate(user.id)} disabled={resend.isPending}><RotateCw size={16} /></Button>}</td></tr>)}</tbody></table>{users.isLoading && <PageLoader label="Carregando usuários..."/>}{!users.isLoading && !users.data?.length && <p className="p-8 text-center text-sm text-slate-500">Nenhum usuário vinculado a este cliente.</p>}</div>}
    {editing && <EditUserDialog user={editing} setUser={setEditing} close={() => setEditing(null)} save={() => update.mutate(editing)} saving={update.isPending} error={update.isError} />}
    {managingPermissions && <PermissionsDialog tenantId={tenantId} user={managingPermissions} close={() => setManagingPermissions(null)} />}
  </Card>;
}

function Field({ label, value, setValue, placeholder, type = "text" }: { label: string; value: string; setValue: (value: string) => void; placeholder: string; type?: string }) { return <label className="text-sm font-semibold text-slate-700">{label}<input type={type} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} autoComplete="off" data-1p-ignore="true" data-lpignore="true" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label>; }
function EditUserDialog({ user, setUser, close, save, saving, error }: { user: ClientUser; setUser: (user: ClientUser) => void; close: () => void; save: () => void; saving: boolean; error: boolean }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><div role="dialog" aria-modal="true" aria-labelledby="edit-client-user" className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"><h2 id="edit-client-user" className="text-lg font-bold text-slate-900">Editar usuário do cliente</h2><div className="mt-5 grid gap-4"><Field label="Nome" value={user.name} setValue={(name) => setUser({ ...user, name })} placeholder="Nome completo" /><Field label="E-mail" type="email" value={user.email} setValue={(email) => setUser({ ...user, email })} placeholder="usuario@cliente.com.br" /><label className="text-sm font-semibold text-slate-700">Perfil<select value={user.role} onChange={(event) => setUser({ ...user, role: event.target.value as ClientUserRole })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal"><option value="COMPANY_ADMIN">Administrador do cliente</option><option value="ANALYST">Analista</option></select></label><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={user.active} onChange={(event) => setUser({ ...user, active: event.target.checked })} className="size-4 accent-cyan-700" />Usuário ativo</label></div>{error && <div className="mt-4"><ErrorState message="Não foi possível atualizar o usuário." /></div>}<div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={close}>Cancelar</Button><Button onClick={save} disabled={saving || !user.name.trim() || !user.email.includes("@")} >{saving ? "Salvando..." : "Salvar alterações"}</Button></div></div></div>; }

// Só ANALYST tem restrições padrão pra abrir exceção — ADMIN/Administrador do cliente já veem tudo
// por papel, então o botão "Permissões especiais" nem aparece pra eles (ver a linha da tabela acima).
function PermissionsDialog({ tenantId, user, close }: { tenantId: string; user: ClientUser; close: () => void }) {
  const queryClient = useQueryClient();
  const queryKey = ["access-permissions", tenantId, user.id];
  const permissions = useQuery({ queryKey, queryFn: () => accessPermissionsService.list(tenantId, user.id) });
  const setGranted = useMutation({ mutationFn: ({ code, granted }: { code: string; granted: boolean }) => accessPermissionsService.setGranted(tenantId, user.id, code, granted), onSuccess: (data) => queryClient.setQueryData(queryKey, data) });
  const extend = useMutation({ mutationFn: (code: string) => accessPermissionsService.extendToAllTenants(tenantId, user.id, code), onSuccess: (data) => queryClient.setQueryData(queryKey, data) });

  const grouped: Array<[string, typeof permissions.data]> = [];
  for (const permission of permissions.data ?? []) {
    const group = grouped.find(([area]) => area === permission.area);
    if (group) group[1]!.push(permission); else grouped.push([permission.area, [permission]]);
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="user-permissions" className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="user-permissions" className="text-lg font-bold text-slate-900">Permissões especiais</h2>
          <p className="mt-1 text-sm text-slate-500">{user.name} — exceções pontuais às restrições padrão do Analista, só pra este cliente (a menos que você aplique a todos).</p>
        </div>
        <Button variant="ghost" onClick={close}>Fechar</Button>
      </div>
      {permissions.isLoading && <div className="mt-4"><PageLoader label="Carregando permissões..." /></div>}
      {permissions.isError && <div className="mt-4"><ErrorState message="Não foi possível carregar as permissões deste usuário." /></div>}
      <div className="mt-4 grid max-h-[60vh] gap-4 overflow-y-auto">
        {grouped.map(([area, items]) => <div key={area}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{area}</p>
          <div className="mt-2 grid gap-2">
            {items!.map(permission => <div key={permission.code} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <label className="flex flex-1 items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-cyan-700" checked={permission.granted} disabled={setGranted.isPending} onChange={(event) => setGranted.mutate({ code: permission.code, granted: event.target.checked })} />
                <span><b className="block text-slate-800">{permission.name}</b><span className="text-slate-500">{permission.description}</span></span>
              </label>
              {permission.granted && (permission.global
                ? <span className="shrink-0 rounded-full bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-800">Todos os tenants</span>
                : <Button variant="secondary" className="shrink-0" disabled={extend.isPending} onClick={() => { if (confirm(`Aplicar "${permission.name}" para ${user.name} em todos os clientes aos quais ele estiver vinculado?`)) extend.mutate(permission.code); }}>Aplicar a todos</Button>)}
            </div>)}
          </div>
        </div>)}
      </div>
    </div>
  </div>;
}
