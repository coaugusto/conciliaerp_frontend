"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useParams, useSearchParams } from "next/navigation";
import { matchRoute, type TabRouteEntry } from "@/components/layout/tab-registry";

export type OpenTab = { key: string; path: string; title: string; params: Record<string, string>; search: URLSearchParams; entry: TabRouteEntry };

type TabsContextValue = {
  tabs: OpenTab[];
  activeKey: string | null;
  openTab: (path: string, options?: { title?: string; activate?: boolean }) => void;
  closeTab: (key: string) => void;
  activateTab: (key: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);
export const TabRouteContext = createContext<{ params: Record<string, string>; search: URLSearchParams } | null>(null);

const STORAGE_KEY = "concilia_tabs_v1";

// `path` é o href completo, com querystring (ex.: "/connector-data/products/123?source=connector")
// — casa a rota só pelo trecho antes do "?" e guarda o restante como search desta aba.
function makeTab(path: string, titleOverride?: string): OpenTab | null {
  const [pathname, queryString = ""] = path.split("?");
  const matched = matchRoute(pathname);
  if (!matched) return null;
  const { entry, params } = matched;
  return { key: path, path, params, search: new URLSearchParams(queryString), entry, title: titleOverride ?? entry.title(params) };
}

function toHref(pathname: string, search: URLSearchParams): string {
  const queryString = search.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

// Abas mantêm cada tela montada (só ocultas com `hidden`) em vez de deixar o Next trocar
// `children` a cada navegação — é isso que preserva filtro/scroll/estado local ao alternar entre
// abas. O roteamento do Next (router.push) continua rodando a cada troca só para manter
// usePathname() em dia, do qual dependem o destaque do menu e o guard de acesso por papel em
// app-shell.tsx — eles não precisam de nenhuma mudança.
export function TabsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsReal = useSearchParams();

  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  // Carrega da sessionStorage (se existir) ou abre a rota atual como primeira aba.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    let restored: { tabs: { path: string; title: string }[]; activeIndex: number } | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) restored = JSON.parse(raw);
    } catch {
      // sessionStorage indisponível (modo privado) ou conteúdo corrompido — recomeça do zero.
    }
    const initial = (restored?.tabs ?? [])
      .map((saved) => makeTab(saved.path, saved.title))
      .filter((tab): tab is OpenTab => tab !== null);
    if (initial.length) {
      setTabs(initial);
      setActiveKey(initial[Math.min(restored?.activeIndex ?? 0, initial.length - 1)].key);
    } else {
      const current = makeTab(toHref(pathname, searchParamsReal));
      if (current) { setTabs([current]); setActiveKey(current.key); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs: tabs.map((tab) => ({ path: tab.path, title: tab.title })), activeIndex: tabs.findIndex((tab) => tab.key === activeKey) }));
    } catch {
      // idem — ignora falha ao persistir (quota, modo privado etc.)
    }
  }, [tabs, activeKey]);

  // Rede de segurança: sincroniza quando a URL muda por fora do nosso controle (voltar/avançar do
  // navegador, um <Link> ainda não convertido em TabLink, URL digitada direto).
  useEffect(() => {
    if (!hydratedRef.current) return;
    const key = toHref(pathname, searchParamsReal);
    setTabs((current) => {
      if (current.some((tab) => tab.key === key)) return current;
      const tab = makeTab(key);
      return tab ? [...current, tab] : current;
    });
    setActiveKey((current) => (matchRoute(pathname) ? key : current));
  }, [pathname, searchParamsReal]);

  const openTab = useCallback((path: string, options?: { title?: string; activate?: boolean }) => {
    const activate = options?.activate ?? true;
    setTabs((current) => {
      if (current.some((tab) => tab.key === path)) return current;
      const tab = makeTab(path, options?.title);
      return tab ? [...current, tab] : current;
    });
    if (activate) {
      setActiveKey(path);
      if (path !== pathname) router.push(path);
    }
  }, [pathname, router]);

  const activateTab = useCallback((key: string) => {
    const tab = tabs.find((item) => item.key === key);
    if (!tab) return;
    setActiveKey(key);
    if (tab.path !== pathname) router.push(tab.path);
  }, [tabs, pathname, router]);

  const closeTab = useCallback((key: string) => {
    const index = tabs.findIndex((tab) => tab.key === key);
    if (index === -1) return;
    const next = tabs.filter((tab) => tab.key !== key);
    setTabs(next);
    if (activeKey !== key) return;
    const fallback = next[index] ?? next[index - 1] ?? null;
    if (fallback) { setActiveKey(fallback.key); if (fallback.path !== pathname) router.push(fallback.path); }
    else { setActiveKey(null); router.push("/dashboard"); }
  }, [tabs, activeKey, pathname, router]);

  const value = useMemo(() => ({ tabs, activeKey, openTab, closeTab, activateTab }), [tabs, activeKey, openTab, closeTab, activateTab]);
  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

export function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useTabs deve ser usado dentro de TabsProvider");
  return ctx;
}

// Usados pelas páginas com segmento dinâmico no lugar de useParams()/useSearchParams() do
// next/navigation — lêem da aba que está renderizando; fora do sistema de abas (ou antes dele
// montar), caem para os hooks reais do Next.
export function useTabParams<T extends Record<string, string>>(): T {
  const ctx = useContext(TabRouteContext);
  const real = useParams<T>();
  return (ctx?.params as T | undefined) ?? real;
}

export function useTabSearchParams(): URLSearchParams {
  const ctx = useContext(TabRouteContext);
  const real = useSearchParams();
  return ctx?.search ?? real;
}
