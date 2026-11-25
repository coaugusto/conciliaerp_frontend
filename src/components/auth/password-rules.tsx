import { Check } from "lucide-react";

// Mesmas regras de backend/src/auth/security/password-policy.ts. Aqui só orientam quem digita; a
// recusa de senhas comuns e de senhas com o nome/e-mail é feita pelo servidor, que diz o motivo.
export const PASSWORD_MIN_LENGTH = 12;
const kinds = (password: string) => [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(pattern => pattern.test(password)).length;

export function passwordChecks(password: string) {
  return [
    { label: `Ao menos ${PASSWORD_MIN_LENGTH} caracteres`, ok: password.length >= PASSWORD_MIN_LENGTH },
    { label: "Misture 3 tipos: minúsculas, maiúsculas, números, símbolos (ou use 16+ caracteres)", ok: password.length >= 16 || kinds(password) >= 3 },
  ];
}

export const passwordLooksStrong = (password: string) => passwordChecks(password).every(check => check.ok);

export function PasswordRules({ password }: { password: string }) {
  return <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
    <p className="mb-2 font-semibold">Requisitos da senha</p>
    {passwordChecks(password).map(check => <p key={check.label} className="flex gap-2 py-0.5"><Check size={14} className={`shrink-0 ${check.ok ? "text-emerald-600" : "text-slate-300"}`} />{check.label}</p>)}
    <p className="mt-2 text-slate-500">Dica: uma frase com 3 ou 4 palavras é longa e fácil de lembrar. Senhas comuns ou com o seu nome são recusadas.</p>
  </div>;
}

/** Exibe os códigos de recuperação do 2FA (mostrados uma única vez) com opção de copiar e baixar. */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const text = codes.join("\n");
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Concilia ERP — códigos de recuperação do 2FA\nCada código vale uma vez.\n\n${text}\n`], { type: "text/plain" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "concilia-erp-codigos-de-recuperacao.txt" });
    link.click(); URL.revokeObjectURL(url);
  };
  return <div className="mt-4">
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-800">{codes.map(code => <span key={code}>{code}</span>)}</div>
    <div className="mt-2 flex gap-2 text-xs">
      <button type="button" onClick={() => void navigator.clipboard.writeText(text)} className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50">Copiar</button>
      <button type="button" onClick={download} className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50">Baixar .txt</button>
    </div>
  </div>;
}
