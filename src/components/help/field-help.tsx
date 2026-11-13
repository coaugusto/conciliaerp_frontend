"use client";

// Botão "?" ao lado de um campo ou indicador. O texto vem da documentação da tela no backend
// (src/help-assistant/docs/<tela>.ts, lista `fields`), nunca escrito aqui: assim a ajuda do campo,
// o tour e as respostas do assistente não divergem. O teste help-assistant.coverage.spec.ts do
// backend confere que todo <FieldHelp screen field> existe na documentação — use valores literais.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { CircleHelp, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { helpService, openHelpTopic } from "@/services/help.service";

const POPOVER_WIDTH = 288;

export function useHelpDoc(screen: string) {
  return useQuery({ queryKey: ["help-doc", screen], queryFn: () => helpService.doc(screen), staleTime: Infinity, gcTime: Infinity, retry: 1 });
}

export function FieldHelp({ screen, field, className }: { screen: string; field: string; className?: string }) {
  const doc = useHelpDoc(screen);
  const info = doc.data?.fields.find((item) => item.id === field);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const close = useCallback(() => setPosition(null), []);

  const toggle = () => {
    if (position) { close(); return; }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12));
    const top = window.innerHeight - rect.bottom > 200 ? rect.bottom + 8 : Math.max(12, rect.top - 8 - 180);
    setPosition({ top, left });
  };

  // Fecha ao clicar fora, com Esc, ao rolar ou redimensionar (a posição é fixa na tela).
  useEffect(() => {
    if (!position) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!popoverRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { close(); buttonRef.current?.focus(); } };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [position, close]);

  if (!info) return null;
  return <>
    <button
      ref={buttonRef}
      type="button"
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggle(); }}
      aria-label={`O que é: ${info.label}`}
      aria-expanded={!!position}
      className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle text-slate-400 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600", className)}
    >
      <CircleHelp size={14} />
    </button>
    {position && createPortal(
      <div ref={popoverRef} role="dialog" aria-label={info.label} className="fixed z-[80] space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm font-normal normal-case tracking-normal text-slate-700 shadow-xl" style={{ top: position.top, left: position.left, width: Math.min(POPOVER_WIDTH, window.innerWidth - 24) }}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-slate-900">{info.label}</p>
          <button type="button" onClick={close} aria-label="Fechar" className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={14} /></button>
        </div>
        <p>{info.short}</p>
        {info.example && <p className="text-xs text-slate-500">{info.example}</p>}
        {info.topicId && <button type="button" onClick={() => { close(); openHelpTopic({ screen, topicId: info.topicId! }); }} className="text-xs font-semibold text-cyan-700 hover:underline">Saiba mais</button>}
      </div>,
      document.body,
    )}
  </>;
}
