"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button, ErrorState, PageLoader } from "@/components/shared/ui";
import { PasswordRules, passwordLooksStrong } from "@/components/auth/password-rules";
import { api, getApiErrorMessage, type ApiResponse } from "@/services/api/client";

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-slate-50"><PageLoader /></main>}><ResetPasswordForm /></Suspense>;
}

// Link do e-mail de "Esqueci minha senha": uso único, vale 30 minutos. Ao salvar, todas as sessões
// abertas desta conta são encerradas.
function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const reset = useMutation({ mutationFn: async () => (await api.post<ApiResponse<{ message: string }>>("/auth/password/reset", { token, newPassword: password })).data.data });
  const shell = (children: React.ReactNode) => <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{children}</div></main>;

  if (!token) return shell(<><ErrorState message="Link inválido: faltou o código na URL. Peça um novo em Esqueci minha senha." /><Link href="/forgot-password"><Button className="mt-4 w-full">Pedir novo link</Button></Link></>);
  if (reset.isSuccess) return shell(<>
    <div className="grid size-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><ShieldCheck size={22} /></div>
    <h1 className="mt-5 text-2xl font-bold">Senha redefinida</h1>
    <p className="mt-2 text-sm leading-6 text-slate-500">{reset.data.message} Por segurança, as sessões abertas em outros dispositivos foram encerradas.</p>
    <Link href="/login"><Button className="mt-6 h-11 w-full">Ir para o login</Button></Link>
  </>);
  return shell(<form onSubmit={event => { event.preventDefault(); if (passwordLooksStrong(password) && password === confirm) reset.mutate(); }}>
    <div className="grid size-11 place-items-center rounded-xl bg-blue-100 text-blue-700"><KeyRound size={22} /></div>
    <h1 className="mt-5 text-2xl font-bold">Criar nova senha</h1>
    {reset.isError && <p role="alert" className="mt-4 text-sm text-red-600">{getApiErrorMessage(reset.error)}</p>}
    <label className="mt-5 block text-sm font-semibold">Nova senha<input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>
    <label className="mt-4 block text-sm font-semibold">Confirmar nova senha<input type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3" /></label>
    {confirm && password !== confirm && <p className="mt-2 text-xs text-red-600">As senhas não coincidem.</p>}
    <PasswordRules password={password} />
    <Button disabled={!passwordLooksStrong(password) || password !== confirm || reset.isPending} className="mt-6 h-11 w-full">{reset.isPending ? "Salvando..." : "Salvar nova senha"}</Button>
  </form>);
}
