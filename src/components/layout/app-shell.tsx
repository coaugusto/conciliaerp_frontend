"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BookOpen, ChartNoAxesCombined, ChevronDown, ChevronLeft, Database, Gauge, Handshake, Landmark, ListChecks, LogOut, Menu, PlayCircle, Search, ShieldCheck, Store, Workflow, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/providers";
import { cn } from "@/utils/cn";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/executive-dashboard", label: "Dashboard Executivo", icon: ChartNoAxesCombined },
  { href: "/commercial", label: "Portal do Cliente", icon: CreditCard },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/supplier-portal", label: "Portal do Fornecedor", icon: Handshake },
  { href: "/tax-impact-simulator", label: "Tax Impact Simulator", icon: Landmark },
  { href: "/consinco", label: "Consinco Integration", icon: Workflow, admin: true },
  { href: "/alerts", label: "Alertas", icon: Bell },
  { href: "/executions", label: "Execuções", icon: PlayCircle },
  { href: "/rules", label: "Regras", icon: ListChecks, admin: true },
  { href: "/data-sources", label: "Fontes de dados", icon: Database, admin: true },
  { href: "/connections", label: "Conexões ERP", icon: ShieldCheck, admin: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuExpanded, setMenuExpanded] = useState(false);
  const activeItem = navigation.find((item) => path === item.href || path.startsWith(`${item.href}/`));

  useEffect(() => {
    if (!user) router.replace("/login");
    else if (user.mustChangePassword) router.replace("/change-password");
    else if (user.role === "ANALYST" && ["/rules", "/data-sources", "/connections"].some((item) => path.startsWith(item))) router.replace("/dashboard");
  }, [user, path, router]);

  if (!user) return null;

  const visibleNavigation = navigation.filter((item) => !item.admin || user.role === "ADMIN");
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-800">
      <header className="sticky top-0 z-30 h-[72px] border-b border-slate-200 bg-white">
        <div className="flex h-[61px] items-center gap-5 px-4 lg:px-7">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5 text-[#273252]">
            <span className="grid size-8 place-items-center rounded-full bg-[#394a78] text-sm font-bold text-white">C</span>
            <span className="text-lg font-bold tracking-tight">CONCILIA <small className="font-medium text-slate-500">ERP</small></span>
          </Link>
          <div className="hidden h-8 w-px bg-slate-200 lg:block" />
          <label className="hidden h-9 w-72 items-center gap-2 rounded border border-slate-300 bg-slate-50 px-3 text-slate-400 md:flex">
            <Search size={16} />
            <input className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" placeholder="Pesquisar aplicação" aria-label="Pesquisar aplicação" />
          </label>
          <div className="hidden min-w-0 flex-1 truncate text-xs text-slate-500 xl:block">Início <span className="px-1">›</span> {activeItem?.label ?? "Concilia ERP"}</div>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <button className="hidden items-center gap-1.5 hover:text-[#176a84] md:flex"><BookOpen size={16} className="text-cyan-600" />Documentação</button>
            <button className="relative rounded p-2 hover:bg-slate-100" aria-label="Notificações"><Bell size={18} /><i className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-amber-400" /></button>
            <button className="flex items-center gap-1 rounded px-2 py-1.5 hover:bg-slate-100"><span className="hidden text-right sm:block"><b className="block text-sm font-semibold text-slate-700">{user.name}</b><span>{user.role === "ADMIN" ? "Administrador" : "Analista"}</span></span><ChevronDown size={15} /></button>
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
      <main className={cn("transition-[padding] duration-200", menuExpanded ? "lg:pl-64" : "lg:pl-12")}><div className="min-h-[calc(100vh-72px)] border-l-4 border-[#e4e2ff] bg-white px-5 py-8 lg:px-10">{children}</div></main>
    </div>
  );
}
