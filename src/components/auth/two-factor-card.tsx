"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Smartphone } from "lucide-react";
import { Button, Card, ErrorState, PageLoader } from "@/components/shared/ui";
import { FieldHelp } from "@/components/help/field-help";
import { RecoveryCodes } from "@/components/auth/password-rules";
import { api, getApiErrorMessage, type ApiResponse } from "@/services/api/client";

type Me = { twoFactorEnabled: boolean; twoFactorRequired: boolean; twoFactorEnabledAt: string | null; recoveryCodesRemaining: number };
const storeToken = (token?: string) => { if (token) localStorage.setItem("concilia_token", token); };

// Verificação em duas etapas no Meu perfil: ativar (QR code), gerar novos códigos de recuperação e
// desativar — esta última só para quem não é obrigado (a equipe interna sempre é).
export function TwoFactorCard() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["auth-me"], queryFn: async () => (await api.get<ApiResponse<Me>>("/auth/me")).data.data });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["auth-me"] });
  const [setup, setSetup] = useState<{ qrCode: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState(""), [password, setPassword] = useState(""), [mode, setMode] = useState<"idle" | "recovery" | "disable">("idle");

  const start = useMutation({ mutationFn: async () => (await api.post<ApiResponse<{ qrCode: string; secret: string }>>("/auth/2fa/setup")).data.data, onSuccess: data => { setSetup(data); setCode(""); } });
  const confirm = useMutation({
    mutationFn: async () => (await api.post<ApiResponse<{ recoveryCodes: string[]; accessToken: string }>>("/auth/2fa/setup/confirm", { code })).data.data,
    onSuccess: data => { storeToken(data.accessToken); setCodes(data.recoveryCodes); setSetup(null); setCode(""); void refresh(); },
  });
  const regenerate = useMutation({ mutationFn: async () => (await api.post<ApiResponse<{ recoveryCodes: string[] }>>("/auth/2fa/recovery-codes", { code })).data.data, onSuccess: data => { setCodes(data.recoveryCodes); setMode("idle"); setCode(""); void refresh(); } });
  const disable = useMutation({ mutationFn: async () => (await api.post<ApiResponse<{ disabled: boolean }>>("/auth/2fa/disable", { password, code })).data.data, onSuccess: () => { setMode("idle"); setCode(""); setPassword(""); void refresh(); } });
  const error = start.error ?? confirm.error ?? regenerate.error ?? disable.error;
  const codeInput = <input value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" aria-label="Código de 6 dígitos do aplicativo" className="h-10 w-32 rounded-lg border border-slate-300 px-3 text-center font-mono tracking-[0.25em]" />;

  return <Card data-help="perfil-2fa" className="p-5 lg:col-span-2">
    <div className="flex items-center gap-2"><Smartphone size={20} className="text-blue-600" /><h2 className="font-bold text-slate-900">Verificação em duas etapas</h2><FieldHelp screen="portal" field="perfil-2fa" /></div>
    {me.isLoading && <PageLoader label="Carregando..." />}
    {me.data && <div className="mt-3 text-sm text-slate-600">
      {me.data.twoFactorEnabled
        ? <p className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-600" /><b className="text-emerald-700">Ativa</b>{me.data.twoFactorEnabledAt && <span>desde {new Date(me.data.twoFactorEnabledAt).toLocaleDateString("pt-BR")}</span>}<span>· {me.data.recoveryCodesRemaining} código(s) de recuperação restantes</span></p>
        : <p>Desativada.{me.data.twoFactorRequired ? " Obrigatória para o seu perfil: ela será pedida no próximo login." : " Recomendado: protege a conta mesmo se a senha vazar."}</p>}
    </div>}
    {error && <div className="mt-3"><ErrorState message={getApiErrorMessage(error)} /></div>}

    {codes && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
      <p className="text-sm font-semibold text-slate-800">Códigos de recuperação: guarde agora, eles não serão mostrados de novo.</p>
      <RecoveryCodes codes={codes} />
      <Button variant="secondary" className="mt-3" onClick={() => setCodes(null)}>Já guardei</Button>
    </div>}

    {me.data && !me.data.twoFactorEnabled && !setup && <Button className="mt-4" disabled={start.isPending} onClick={() => start.mutate()}>{start.isPending ? "Gerando QR code..." : "Ativar com aplicativo autenticador"}</Button>}
    {setup && <div className="mt-4 flex flex-wrap items-start gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element -- QR em data URL gerado pela API */}
      <img src={setup.qrCode} alt="QR code para cadastrar o Concilia ERP no aplicativo autenticador" className="size-44 rounded-lg border border-slate-200 bg-white p-2" />
      <div className="max-w-sm text-sm text-slate-600">
        <p>1. Abra o Google Authenticator, Microsoft Authenticator ou Authy e leia o QR code.</p>
        <p className="mt-1 text-xs">Sem câmera? Chave: <span className="select-all break-all font-mono text-slate-800">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</span></p>
        <p className="mt-3">2. Digite o código que aparecer no aplicativo:</p>
        <div className="mt-2 flex gap-2">{codeInput}<Button disabled={code.length !== 6 || confirm.isPending} onClick={() => confirm.mutate()}>{confirm.isPending ? "Ativando..." : "Ativar"}</Button><Button variant="ghost" onClick={() => setSetup(null)}>Cancelar</Button></div>
      </div>
    </div>}

    {me.data?.twoFactorEnabled && mode === "idle" && <div className="mt-4 flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => { setMode("recovery"); setCode(""); }}>Gerar novos códigos de recuperação</Button>
      {!me.data.twoFactorRequired && <Button variant="ghost" onClick={() => { setMode("disable"); setCode(""); }}>Desativar</Button>}
    </div>}
    {mode === "recovery" && <div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><span>Código atual do aplicativo:</span>{codeInput}<Button disabled={code.length !== 6 || regenerate.isPending} onClick={() => regenerate.mutate()}>Gerar</Button><Button variant="ghost" onClick={() => setMode("idle")}>Cancelar</Button><span className="w-full text-xs text-slate-500">Os códigos antigos deixam de valer.</span></div>}
    {mode === "disable" && <div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Sua senha" autoComplete="current-password" aria-label="Sua senha" className="h-10 rounded-lg border border-slate-300 px-3" />{codeInput}<Button variant="danger" disabled={!password || code.length !== 6 || disable.isPending} onClick={() => disable.mutate()}>Desativar</Button><Button variant="ghost" onClick={() => setMode("idle")}>Cancelar</Button></div>}
  </Card>;
}
