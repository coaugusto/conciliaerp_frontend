"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, ShieldCheck } from "lucide-react";
import { PasswordRules, passwordLooksStrong } from "@/components/auth/password-rules";
import Link from "next/link";
import { Button, ErrorState, PageLoader } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { invitationService } from "@/services/invitation.service";

export default function AcceptInvitePage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-slate-50"><PageLoader /></main>}><AcceptInviteForm /></Suspense>;
}

function AcceptInviteForm() {
  const token = useSearchParams().get("token") ?? "";
  const preview = useQuery({ queryKey: ["invitation-preview", token], queryFn: () => invitationService.preview(token), enabled: !!token, retry: false });
  const [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const valid = passwordLooksStrong(password);
  const accept = useMutation({ mutationFn: () => invitationService.accept(token, password) });

  if (!token) return <Shell><ErrorState message="Link de convite inválido — faltou o token na URL." /></Shell>;
  if (preview.isLoading) return <main className="grid min-h-screen place-items-center bg-slate-50"><PageLoader label="Verificando convite..." /></main>;
  if (preview.isError) return <Shell><ErrorState message={getApiErrorMessage(preview.error)} /></Shell>;
  if (accept.isSuccess) return <Shell>
    <div className="grid size-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><ShieldCheck size={22} /></div>
    <h1 className="mt-5 text-2xl font-bold">Acesso ativado</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">Sua senha foi definida. Você já pode entrar no ConciliaERP com {accept.data?.email}.</p>
    <Link href="/login"><Button className="mt-6 h-11 w-full">Ir para o login</Button></Link>
  </Shell>;

  return <Shell>
    <div className="grid size-11 place-items-center rounded-xl bg-blue-100 text-blue-700"><KeyRound size={22} /></div>
    <h1 className="mt-5 text-2xl font-bold">Bem-vindo(a), {preview.data?.name}</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">Defina sua senha para ativar o acesso de <b>{preview.data?.email}</b> ao ConciliaERP.</p>
    {accept.isError && <p className="mt-4 text-sm text-red-600">{getApiErrorMessage(accept.error)}</p>}
    <form onSubmit={e => { e.preventDefault(); if (valid && password === confirm) accept.mutate(); }}>
      <label className="mt-5 block text-sm font-semibold">Nova senha<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>
      <label className="mt-4 block text-sm font-semibold">Confirmar senha<input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>
      {confirm && password !== confirm && <p className="mt-2 text-xs text-red-600">As senhas não coincidem.</p>}
      <PasswordRules password={password} />
      <Button disabled={!valid || password !== confirm || accept.isPending} className="mt-6 h-11 w-full">{accept.isPending ? "Ativando..." : "Ativar acesso"}</Button>
    </form>
  </Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{children}</div></main>;
}
