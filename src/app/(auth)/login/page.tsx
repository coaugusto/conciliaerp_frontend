"use client";
import { Eye, EyeOff, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, type LoginStep } from "@/providers/providers";
import { api, getApiErrorMessage, type ApiResponse } from "@/services/api/client";
import { Button } from "@/components/shared/ui";
import { RecoveryCodes } from "@/components/auth/password-rules";

type Stage = { kind: "credentials" } | { kind: "code"; challengeToken: string } | { kind: "setup"; challengeToken: string; qrCode?: string; secret?: string } | { kind: "recovery"; codes: string[]; next: string };

// Login em etapas: senha → código do app autenticador (ou o cadastro dele, para quem é obrigado e
// ainda não tem) → códigos de recuperação, mostrados uma única vez logo depois do cadastro.
export default function LoginPage() {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [show, setShow] = useState(false);
  const [code, setCode] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "credentials" });
  const router = useRouter();
  const { login, verifyTwoFactor, confirmTwoFactorSetup } = useAuth();

  const run = async (action: () => Promise<void>) => { setError(""); setLoading(true); try { await action(); } catch (err) { setError(getApiErrorMessage(err)); } finally { setLoading(false); } };
  const advance = async (result: LoginStep) => {
    setCode("");
    if (result.step === "2fa") { setStage({ kind: "code", challengeToken: result.challengeToken }); return; }
    if (result.step !== "done") {
      const setup = (await api.post<ApiResponse<{ qrCode: string; secret: string }>>("/auth/2fa/setup/challenge", { challengeToken: result.challengeToken })).data.data;
      setStage({ kind: "setup", challengeToken: result.challengeToken, qrCode: setup.qrCode, secret: setup.secret });
      return;
    }
    const next = result.user.mustChangePassword ? "/change-password" : "/dashboard";
    if (result.recoveryCodes?.length) { setStage({ kind: "recovery", codes: result.recoveryCodes, next }); return; }
    if (result.recoveryCodesRemaining !== undefined && result.recoveryCodesRemaining <= 2) alert(`Você usou um código de recuperação. Restam ${result.recoveryCodesRemaining}. Gere novos em Meu perfil.`);
    router.replace(next);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (stage.kind === "credentials") void run(async () => advance(await login(email, password)));
    else if (stage.kind === "code") void run(async () => advance(await verifyTwoFactor(stage.challengeToken, code)));
    else if (stage.kind === "setup") void run(async () => advance(await confirmTwoFactorSetup(stage.challengeToken, code)));
  };
  const restart = () => { setStage({ kind: "credentials" }); setCode(""); setPassword(""); setError(""); };

  return <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.1fr_.9fr]">
    <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-lg font-bold">C</span><b>Concilia ERP</b></div><div className="my-auto max-w-lg"><p className="mb-4 text-sm font-semibold tracking-widest text-blue-400">AUDITORIA INTELIGENTE</p><h1 className="text-4xl font-bold leading-tight">Precisão fiscal em cada cadastro.</h1><p className="mt-5 text-lg leading-8 text-slate-400">Audite produtos, tributações e referências fiscais, identifique divergências e valide correções antes da integração com seu ERP.</p></div><div className="flex gap-3 text-sm text-slate-400"><ShieldCheck className="text-blue-400" /> Acesso seguro e rastreável</div></section>
    <section className="flex items-center justify-center p-6"><form onSubmit={submit} className="w-full max-w-sm">
      <div className="mb-10 lg:hidden"><b className="text-xl">Concilia ERP</b></div>
      {stage.kind === "credentials" && <>
        <p className="text-sm font-semibold text-blue-700">BEM-VINDO</p><h2 className="mt-1 text-3xl font-bold text-slate-900">Acesse sua conta</h2><p className="mt-2 text-sm text-slate-500">Use suas credenciais corporativas para continuar.</p>
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="mt-7 block text-sm font-semibold text-slate-700">E-mail<input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="username" required className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none ring-blue-500 focus:ring-2" placeholder="voce@empresa.com.br" /></label>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Senha<div className="relative mt-1.5"><input value={password} onChange={e => setPassword(e.target.value)} type={show ? "text" : "password"} autoComplete="current-password" required className="h-11 w-full rounded-lg border border-slate-300 px-3 pr-10 outline-none ring-blue-500 focus:ring-2" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-3 text-slate-400">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        <div className="mt-2 text-right"><Link href="/forgot-password" className="text-xs font-semibold text-blue-700 hover:underline">Esqueci minha senha</Link></div>
        <Button disabled={loading} className="mt-5 h-11 w-full">{loading ? "Validando acesso..." : "Entrar"}<LockKeyhole size={16} /></Button>
      </>}

      {stage.kind === "code" && <>
        <div className="grid size-11 place-items-center rounded-xl bg-blue-100 text-blue-700"><Smartphone size={22} /></div>
        <h2 className="mt-5 text-2xl font-bold text-slate-900">Verificação em duas etapas</h2>
        <p className="mt-2 text-sm text-slate-500">Digite o código de 6 dígitos do aplicativo autenticador. Sem o celular? Use um dos códigos de recuperação.</p>
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="mt-6 block text-sm font-semibold text-slate-700">Código<input value={code} onChange={e => setCode(e.target.value)} autoFocus inputMode="text" autoComplete="one-time-code" maxLength={12} required className="mt-1.5 h-12 w-full rounded-lg border border-slate-300 px-3 text-center font-mono text-xl tracking-[0.3em] outline-none ring-blue-500 focus:ring-2" placeholder="000000" /></label>
        <Button disabled={loading || code.replace(/\s/g, "").length < 6} className="mt-6 h-11 w-full">{loading ? "Verificando..." : "Confirmar"}</Button>
        <button type="button" onClick={restart} className="mt-4 w-full text-center text-xs font-semibold text-slate-500 hover:underline">Voltar e entrar com outra conta</button>
      </>}

      {stage.kind === "setup" && <>
        <div className="grid size-11 place-items-center rounded-xl bg-blue-100 text-blue-700"><ShieldCheck size={22} /></div>
        <h2 className="mt-5 text-2xl font-bold text-slate-900">Ative a verificação em duas etapas</h2>
        <p className="mt-2 text-sm text-slate-500">Obrigatória para o seu perfil. Instale o Google Authenticator, Microsoft Authenticator ou Authy, leia o QR code e digite o código que aparecer.</p>
        {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {/* eslint-disable-next-line @next/next/no-img-element -- QR em data URL gerado pela API, não passa pelo otimizador de imagens */}
        {stage.qrCode && <img src={stage.qrCode} alt="QR code para cadastrar o Concilia ERP no aplicativo autenticador" className="mx-auto mt-5 size-48 rounded-lg border border-slate-200 bg-white p-2" />}
        {stage.secret && <p className="mt-3 text-center text-xs text-slate-500">Sem câmera? Digite a chave no app:<br /><span className="select-all break-all font-mono text-sm text-slate-800">{stage.secret.replace(/(.{4})/g, "$1 ").trim()}</span></p>}
        <label className="mt-5 block text-sm font-semibold text-slate-700">Código do aplicativo<input value={code} onChange={e => setCode(e.target.value)} autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="mt-1.5 h-12 w-full rounded-lg border border-slate-300 px-3 text-center font-mono text-xl tracking-[0.3em] outline-none ring-blue-500 focus:ring-2" placeholder="000000" /></label>
        <Button disabled={loading || code.length !== 6} className="mt-6 h-11 w-full">{loading ? "Ativando..." : "Ativar e entrar"}</Button>
        <button type="button" onClick={restart} className="mt-4 w-full text-center text-xs font-semibold text-slate-500 hover:underline">Cancelar</button>
      </>}

      {stage.kind === "recovery" && <>
        <div className="grid size-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><ShieldCheck size={22} /></div>
        <h2 className="mt-5 text-2xl font-bold text-slate-900">Guarde seus códigos de recuperação</h2>
        <p className="mt-2 text-sm text-slate-500">Se perder o celular, cada código abaixo permite entrar uma única vez. Eles não serão mostrados de novo: guarde num gerenciador de senhas ou num local seguro.</p>
        <RecoveryCodes codes={stage.codes} />
        <Button type="button" onClick={() => router.replace(stage.next)} className="mt-6 h-11 w-full">Já guardei, continuar</Button>
      </>}
      <p className="mt-6 text-center text-xs text-slate-400">Ambiente protegido · Concilia ERP</p>
    </form></section>
  </main>;
}
