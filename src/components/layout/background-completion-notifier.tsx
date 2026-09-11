"use client";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";

// Consultas conhecidas por demorar o bastante pra valer a pena avisar quando terminam em segundo
// plano (ex.: /alerts pode levar minutos num tenant grande — ver fiscal-alerts-summary.service.ts
// no backend). Adicionar aqui é o único passo pra estender o aviso a outra tela lenta.
const WATCHED_QUERIES: Array<{ matches: (key: QueryKey) => boolean; label: string }> = [
  { matches: (key) => key[0] === "fiscal-alerts" && key[1] === "summary", label: "Alertas fiscais prontos" },
];

/** Pisca o título da aba quando uma consulta lenta termina enquanto ninguém está olhando pra ela
 * — nem porque o usuário trocou de aba do navegador (document.visibilityState !== "visible"), nem
 * porque navegou pra outra tela do sistema (a página que disparou a consulta desmontou, então
 * getObserversCount() caiu a zero — o fetch em si continua rodando independente do componente,
 * só ninguém está inscrito pra receber o resultado na tela). Montado uma vez em Providers, então
 * sobrevive à navegação entre rotas (só um refresh da aba ou fechar o app derruba a inscrição). */
export function BackgroundCompletionNotifier() {
  const queryClient = useQueryClient();
  const originalTitleRef = useRef<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const stopFlashing = () => {
      if (flashTimerRef.current === null) return;
      window.clearInterval(flashTimerRef.current);
      flashTimerRef.current = null;
      if (originalTitleRef.current !== null) document.title = originalTitleRef.current;
      originalTitleRef.current = null;
    };
    const startFlashing = (label: string) => {
      if (flashTimerRef.current !== null) return;
      originalTitleRef.current = document.title;
      let showLabel = true;
      flashTimerRef.current = window.setInterval(() => {
        document.title = showLabel ? `🔔 ${label}` : (originalTitleRef.current ?? document.title);
        showLabel = !showLabel;
      }, 1000);
    };
    const onVisible = () => { if (document.visibilityState === "visible") stopFlashing(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success") return;
      const watched = WATCHED_QUERIES.find((entry) => entry.matches(event.query.queryKey));
      if (!watched) return;
      const inBackground = event.query.getObserversCount() === 0 || document.visibilityState === "hidden";
      if (inBackground) startFlashing(watched.label);
    });

    return () => {
      unsubscribe();
      stopFlashing();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [queryClient]);

  return null;
}
