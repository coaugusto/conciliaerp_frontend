"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { PageLoader } from "@/components/shared/ui";
import { cn } from "@/utils/cn";
import { TabRouteContext, useTabs } from "@/providers/tabs-provider";

// Isola um erro de renderização de uma aba sem derrubar as outras — várias páginas ficam
// montadas ao mesmo tempo (só ocultas), então o raio de explosão de um bug é maior que o normal.
class TabErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Erro ao renderizar aba:", error, info); }
  render() {
    if (this.state.error) return <div className="p-10 text-center text-sm text-red-700">Não foi possível carregar esta aba. Feche-a e abra novamente.</div>;
    return this.props.children;
  }
}

export function TabViewport() {
  const { tabs, activeKey, closeTab, activateTab, openTab } = useTabs();
  return <div className="flex min-h-[calc(100vh-72px)] flex-col">
    {!!tabs.length && <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 py-1.5">
      {tabs.map((tab) => (
        <div key={tab.key} className={cn("group flex shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-xs font-medium", tab.key === activeKey ? "border-slate-200 bg-white text-slate-800" : "border-transparent text-slate-500 hover:bg-slate-100")}>
          <button type="button" onClick={() => activateTab(tab.key)} className="max-w-[14rem] truncate" title={tab.title}>{tab.title}</button>
          <button type="button" onClick={() => closeTab(tab.key)} aria-label={`Fechar aba ${tab.title}`} className="rounded p-0.5 text-slate-400 opacity-0 hover:bg-slate-200 group-hover:opacity-100"><X size={12} /></button>
        </div>
      ))}
      <button type="button" onClick={() => openTab("/dashboard")} aria-label="Nova aba" className="ml-1 shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-100"><Plus size={14} /></button>
    </div>}
    <div className="flex-1 px-5 py-8 lg:px-10">
      {!tabs.length && <PageLoader />}
      {tabs.map((tab) => {
        const TabComponent = tab.entry.Component;
        return <div key={tab.key} hidden={tab.key !== activeKey}>
          <TabRouteContext.Provider value={{ params: tab.params, search: tab.search }}>
            <TabErrorBoundary><TabComponent /></TabErrorBoundary>
          </TabRouteContext.Provider>
        </div>;
      })}
    </div>
  </div>;
}
