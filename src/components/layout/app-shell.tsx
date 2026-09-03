"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BookOpen, ChevronDown, ChevronLeft, Database, Gauge, ListChecks, LogOut, Menu, Moon, ShieldCheck, Store, Sun, Workflow, CreditCard, Code2, ClipboardCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/providers";
import { cn } from "@/utils/cn";
import { api, type ApiResponse } from "@/services/api/client";
import { clientContextService } from "@/services/client-context.service";

type ClientTenant = { id: string; name: string; cncCode: string };

const navigation = [
  { href: "/dashboard", label: "Painel de conciliações", icon: Gauge },
  { href: "/commercial", label: "Portal do Cliente", icon: CreditCard },
  { href: "/marketplace", label: "Catálogo mestre", icon: Store },
  { href: "/consinco", label: "Integração Consinco", icon: Workflow, admin: true },
  { href: "/alerts", label: "Alertas", icon: Bell },
  { href: "/rules", label: "Regras", icon: ListChecks, admin: true },
  { href: "/connections", label: "Conexões ERP", icon: ShieldCheck, admin: true },
  { href: "/connector-queries", label: "Consultas do agente conector", icon: Code2, admin: true },
  { href: "/connector-data", label: "Cadastros importados", icon: Database },
  { href: "/catalog-review", label: "Revisão de cadastros", icon: ClipboardCheck, admin: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, hydrated, logout, theme, toggleTheme } = useAuth();
  const tenants = useQuery({ queryKey: ["client-tenants"], queryFn: async () => (await api.get<ApiResponse<ClientTenant[]>>("/auth/tenants")).data.data, enabled: !!user });
  const [tenantId, setTenantId] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("concilia_tenant_id") ?? "");
  // O ambiente selecionado precisa ficar visível na barra do header em toda tela — sem isso, o
  // campo aparecia em branco (mesmo com o tenant continuando ativo por trás), dando a impressão
  // de que a seleção tinha sumido ao navegar/recarregar.
  const tenantLabelFromStorage = () => { if (typeof window === "undefined") return ""; const code = localStorage.getItem("concilia_cnc_code"); const name = localStorage.getItem("concilia_tenant_name"); return code && name ? `${code} · ${name}` : ""; };
  const [tenantSearch, setTenantSearch] = useState(tenantLabelFromStorage);
  const [companyId, setCompanyId] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("concilia_company_id") ?? "");
  const clients = useQuery({ queryKey: ["client-context", tenantId], queryFn: clientContextService.list, enabled: !!user && !!tenantId });
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => { setMobileMenuOpen(false); }, [path]);
  const activeItem = navigation.find((item) => path === item.href || path.startsWith(`${item.href}/`));

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace("/login");
    else if (user.mustChangePassword) router.replace("/change-password");
    else if (user.role === "ANALYST" && ["/rules", "/data-sources", "/connections", "/connector-queries", "/documentation"].some((item) => path.startsWith(item))) router.replace("/dashboard");
  }, [hydrated, user, path, router]);
  useEffect(() => {
    const syncClientSelection = () => {
      setTenantId(localStorage.getItem("concilia_tenant_id") ?? "");
      setCompanyId(localStorage.getItem("concilia_company_id") ?? "");
      setTenantSearch(tenantLabelFromStorage());
    };

    window.addEventListener("concilia:tenant-changed", syncClientSelection);
    window.addEventListener("storage", syncClientSelection);
    return () => {
      window.removeEventListener("concilia:tenant-changed", syncClientSelection);
      window.removeEventListener("storage", syncClientSelection);
    };
  }, []);
  useEffect(() => {
    if (!clients.data?.length) return;
    const selected = clients.data.find(client => client.companyIds.includes(companyId)) ?? clients.data[0];
    const selectedCompanyId = selected?.companyIds[0];
    if (!selectedCompanyId || selectedCompanyId === companyId) return;
    localStorage.setItem("concilia_company_id", selectedCompanyId);
    window.dispatchEvent(new Event("concilia:company-changed"));
    const update = window.setTimeout(() => setCompanyId(selectedCompanyId), 0);
    return () => window.clearTimeout(update);
  }, [clients.data, companyId]);
  if (!hydrated || !user) return null;

  const visibleNavigation = navigation.filter((item) => !item.admin || user.role === "ADMIN");
  const selectTenant = async (id: string) => { const response = await api.post<ApiResponse<{ accessToken: string; tenant: ClientTenant }>>("/auth/select-tenant", { tenantId: id }); const selected = response.data.data; localStorage.setItem("concilia_token", selected.accessToken); localStorage.setItem("concilia_tenant_id", selected.tenant.id); localStorage.setItem("concilia_tenant_name", selected.tenant.name); localStorage.setItem("concilia_cnc_code", selected.tenant.cncCode); localStorage.removeItem("concilia_company_id"); setTenantId(selected.tenant.id); setTenantSearch(`${selected.tenant.cncCode} · ${selected.tenant.name}`); window.location.reload(); };
  const selectTenantFromSearch = async (value: string) => {
    const normalized = value.trim().toLocaleLowerCase("pt-BR");
    const tenant = (tenants.data ?? []).find(item => item.id === value || item.cncCode.toLocaleLowerCase("pt-BR") === normalized || item.name.toLocaleLowerCase("pt-BR") === normalized || `${item.cncCode} · ${item.name}`.toLocaleLowerCase("pt-BR") === normalized);
    if (tenant && tenant.id !== tenantId) await selectTenant(tenant.id);
  };
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-800">
      <header className="sticky top-0 z-30 h-[72px] border-b border-slate-200 bg-white">
        <div className="flex h-[61px] items-center gap-3 px-4 lg:gap-5 lg:px-7">
          <button onClick={() => setMobileMenuOpen(true)} className="rounded p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Abrir menu" aria-expanded={mobileMenuOpen}><Menu size={20} /></button>
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5 text-[#273252]">
            <span className="grid size-8 place-items-center rounded-full bg-[#394a78] text-sm font-bold text-white">C</span>
            <span className="text-lg font-bold tracking-tight">CONCILIA <small className="font-medium text-slate-500">ERP</small></span>
          </Link>
          <div className="hidden h-8 w-px bg-slate-200 lg:block" />
          <label className="hidden w-[21rem] items-center gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 lg:flex"><span className="whitespace-nowrap font-semibold">Ambiente:</span><input list="concilia-tenant-options" value={tenantSearch} onChange={event => setTenantSearch(event.target.value)} onBlur={event => selectTenantFromSearch(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); selectTenantFromSearch(event.currentTarget.value); } }} placeholder="Digite o nome ou CNC_CODE" aria-label="Buscar ambiente por nome ou CNC_CODE" className="min-w-0 flex-1 bg-transparent font-medium text-slate-800 outline-none"/><datalist id="concilia-tenant-options">{(tenants.data ?? []).map(tenant => <option key={tenant.id} value={`${tenant.cncCode} · ${tenant.name}`}>{tenant.id}</option>)}</datalist></label>
          <div className="hidden min-w-0 flex-1 truncate text-xs text-slate-500 xl:block">Início <span className="px-1">›</span> {activeItem?.label ?? "Concilia ERP"}</div>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            {user.role === "ADMIN" && <Link href="/documentation" className="hidden items-center gap-1.5 hover:text-[#176a84] md:flex"><BookOpen size={16} className="text-cyan-600" />Documentação</Link>}
            <button className="relative rounded p-2 hover:bg-slate-100" aria-label="Notificações"><Bell size={18} /><i className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-amber-400" /></button>
            <button onClick={toggleTheme} className="rounded p-2 hover:bg-slate-100" aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
            <Link href="/profile" className="flex items-center gap-1 rounded px-2 py-1.5 hover:bg-slate-100"><span className="hidden text-right sm:block"><b className="block text-sm font-semibold text-slate-700">{user.name}</b><span>{user.role === "ADMIN" ? "Administrador" : user.role === "COMPANY_ADMIN" ? "Administrador do cliente" : "Analista"}</span></span><ChevronDown size={15} /></Link>
            <button onClick={() => { logout(); router.replace("/login"); }} title="Sair" className="rounded p-2 hover:bg-slate-100"><LogOut size={17} /></button>
          </div>
        </div>
        <div className="h-[11px] border-t border-[#dedcff] bg-[#e8e7ff]" />
      </header>
      <aside className={cn("fixed bottom-0 left-0 top-[72px] z-20 hidden overflow-y-auto border-r border-[#d9d8ff] bg-white transition-[width] duration-200 lg:block", menuExpanded ? "w-64 shadow-lg" : "w-12")}>
        <nav className={cn("flex flex-col gap-1 py-3", menuExpanded ? "px-2" : "items-center")}>
          <button onClick={() => setMenuExpanded((current) => !current)} className={cn("mb-2 flex h-9 items-center rounded text-cyan-600 hover:bg-cyan-50", menuExpanded ? "w-full gap-3 px-2" : "justify-center p-1.5")} aria-label={menuExpanded ? "Recolher menu" : "Expandir menu"} aria-expanded={menuExpanded}>
            {menuExpanded ? <ChevronLeft size={20} /> : <Menu size={20} />}
            {menuExpanded && <span className="text-sm font-semibold text-slate-600">Menu principal</span>}
          </button>
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const active = path === item.href || path.startsWith(`${item.href}/`);
            return <Link key={item.href} href={item.href} title={menuExpanded ? undefined : item.label} className={cn("flex h-10 items-center border-l-[3px] transition", menuExpanded ? "gap-3 px-2.5" : "w-9 justify-center", active ? "border-[#5471bf] bg-[#e6eafc] text-[#405b9e]" : "border-transparent text-[#39a4c2] hover:bg-cyan-50")}><Icon size={18} className="shrink-0" />{menuExpanded && <span className="truncate text-sm font-medium">{item.label}</span>}</Link>;
          })}
        </nav>
      </aside>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute bottom-0 left-0 top-0 w-72 max-w-[85vw] overflow-y-auto bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <span className="text-sm font-bold text-slate-700">Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="rounded p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar menu"><X size={18} /></button>
            </div>
            <label className="mx-3 mt-3 flex items-center gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
              <span className="whitespace-nowrap font-semibold">Ambiente:</span>
              <input list="concilia-tenant-options" value={tenantSearch} onChange={event => setTenantSearch(event.target.value)} onBlur={event => selectTenantFromSearch(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); selectTenantFromSearch(event.currentTarget.value); } }} placeholder="Digite o nome ou CNC_CODE" aria-label="Buscar ambiente por nome ou CNC_CODE" className="min-w-0 flex-1 bg-transparent font-medium text-slate-800 outline-none"/>
            </label>
            <nav className="flex flex-col gap-1 px-2 py-3">
              {visibleNavigation.map((item) => {
                const Icon = item.icon;
                const active = path === item.href || path.startsWith(`${item.href}/`);
                return <Link key={item.href} href={item.href} className={cn("flex h-10 items-center gap-3 rounded border-l-[3px] px-2.5 transition", active ? "border-[#5471bf] bg-[#e6eafc] text-[#405b9e]" : "border-transparent text-[#39a4c2] hover:bg-cyan-50")}><Icon size={18} className="shrink-0" /><span className="truncate text-sm font-medium">{item.label}</span></Link>;
              })}
            </nav>
          </aside>
        </div>
      )}
      <main className={cn("transition-[padding] duration-200", menuExpanded ? "lg:pl-64" : "lg:pl-12")}><div className="min-h-[calc(100vh-72px)] border-l-4 border-[#e4e2ff] bg-white px-5 py-8 lg:px-10">{children}</div></main>
    </div>
  );
}
