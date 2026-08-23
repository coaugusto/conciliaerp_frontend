"use client";

import { useState } from "react";
import { KeyRound, Save, UserRound } from "lucide-react";
import { Button, Card, PageHeader } from "@/components/shared/ui";
import { useAuth } from "@/providers/providers";

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); setMessage(""); try { await updateProfile({ name, jobTitle: jobTitle || null, phone: phone || null }); setMessage("Dados atualizados com sucesso."); } catch { setMessage("Não foi possível atualizar seus dados."); } finally { setSaving(false); } };
  return <>
    <PageHeader title="Meu perfil" description="Atualize seus dados pessoais e a senha de acesso." />
    <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
      <Card className="p-5"><div className="flex items-center gap-2"><UserRound size={20} className="text-blue-600" /><h2 className="font-bold text-slate-900">Dados pessoais</h2></div><form onSubmit={save} className="mt-5 space-y-4"><label className="block text-sm font-medium">Nome<input required value={name} onChange={event => setName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3" /></label><label className="block text-sm font-medium">E-mail<input disabled value={user?.email ?? ""} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-500" /></label><label className="block text-sm font-medium">Cargo<input value={jobTitle} onChange={event => setJobTitle(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3" /></label><label className="block text-sm font-medium">Telefone<input value={phone} onChange={event => setPhone(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>{message && <p className={message.startsWith("Dados") ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message}</p>}<Button disabled={saving}><Save size={16} />{saving ? "Salvando..." : "Salvar dados"}</Button></form></Card>
      <Card className="p-5"><div className="flex items-center gap-2"><KeyRound size={20} className="text-blue-600" /><h2 className="font-bold text-slate-900">Senha</h2></div><p className="mt-3 text-sm leading-6 text-slate-500">Para alterar a senha, informe a senha atual e escolha uma nova credencial segura.</p><a href="/change-password" className="mt-5 inline-flex h-8 items-center rounded-md bg-[#075d70] px-3 text-sm font-semibold text-white hover:bg-[#064e5e]">Alterar senha</a></Card>
    </div>
  </>;
}
