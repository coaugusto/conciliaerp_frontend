"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { MailCheck, KeyRound } from "lucide-react";
import { Button } from "@/components/shared/ui";
import { api, getApiErrorMessage, type ApiResponse } from "@/services/api/client";

// A resposta é sempre a mesma, exista ou não a conta: a tela não confirma quais e-mails são clientes.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const request = useMutation({ mutationFn: async () => (await api.post<ApiResponse<{ message: string }>>("/auth/password/forgot", { email })).data.data });
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
    {request.isSuccess ? <>
      <div className="grid size-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><MailCheck size={22} /></div>
      <h1 className="mt-5 text-2xl font-bold">Confira seu e-mail</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">{request.data.message} O link vale por 30 minutos. Não chegou? Veja a caixa de spam ou peça de novo em alguns minutos.</p>
      <Link href="/login"><Button className="mt-6 h-11 w-full">Voltar ao login</Button></Link>
    </> : <form onSubmit={event => { event.preventDefault(); request.mutate(); }}>
      <div className="grid size-11 place-items-center rounded-xl bg-blue-100 text-blue-700"><KeyRound size={22} /></div>
      <h1 className="mt-5 text-2xl font-bold">Esqueci minha senha</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Informe o e-mail de acesso. Vamos enviar um link para você criar uma nova senha.</p>
      {request.isError && <p role="alert" className="mt-4 text-sm text-red-600">{getApiErrorMessage(request.error)}</p>}
      <label className="mt-5 block text-sm font-semibold">E-mail<input type="email" required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3" placeholder="voce@empresa.com.br" /></label>
      <Button disabled={!email || request.isPending} className="mt-6 h-11 w-full">{request.isPending ? "Enviando..." : "Enviar link"}</Button>
      <Link href="/login" className="mt-4 block text-center text-xs font-semibold text-slate-500 hover:underline">Voltar ao login</Link>
    </form>}
  </div></main>;
}
