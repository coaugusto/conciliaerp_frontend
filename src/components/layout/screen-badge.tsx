"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Database, X } from "lucide-react";
import { useAuth } from "@/providers/providers";
import { SCREENS, type ScreenCode } from "./screen-catalog";

// Código da tela ativa como uma aba fixa à direita da barra de abas (fora da área da página, para
// nunca cobrir os botões dela). Ao clicar, mostra o nome
// da tela e as tabelas principais (só para a equipe interna; o cliente vê apenas o código, que
// basta para abrir um chamado).
export function ScreenBadge({ code, path }: { code: ScreenCode; path: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const screen = SCREENS[code];
  const internal = user?.role === "ADMIN" || user?.role === "ANALYST";

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (box.current && !box.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  const copy = async () => {
    const text = [`Tela ${code} · ${screen.name}`, `Endereço: ${path}`, internal && screen.tables.length ? `Tabelas: ${screen.tables.join(", ")}` : ""].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sem permissão de área de transferência: o texto continua visível */ }
  };

  return <div ref={box} data-help="codigo-tela" className="relative z-20 mr-2 shrink-0 self-end lg:mr-5">
    {open && <div role="dialog" aria-label={`Tela ${code}`} className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-mono text-sm font-bold text-[#283456]">{code}</p><p className="font-medium text-slate-800">{screen.name}</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={14} /></button>
      </div>
      <p className="mt-2 break-all font-mono text-[11px] text-slate-500">{path}</p>
      {internal && <div className="mt-2 border-t border-slate-100 pt-2">
        <p className="mb-1 flex items-center gap-1 font-semibold uppercase tracking-wide text-slate-500"><Database size={12} />Tabelas principais</p>
        {screen.tables.length ? <ul className="space-y-0.5">{screen.tables.map((table) => <li key={table} className="font-mono text-slate-800">{table}</li>)}</ul> : <p>Sem tabela: conteúdo fixo da aplicação.</p>}
      </div>}
      <p className="mt-2 text-slate-500">Ao reportar um erro, informe este código.</p>
      <button type="button" onClick={copy} className="mt-2 inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-50">{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copiado" : "Copiar dados da tela"}</button>
    </div>}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} title={`Tela ${code} · ${screen.name}`}
      className="-mb-px flex items-center gap-1.5 rounded-t-md border border-b-0 border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800"><span className="text-[10px] uppercase tracking-wide text-slate-400">Tela</span><span className="font-mono font-semibold text-[#283456]">{code}</span></button>
  </div>;
}
