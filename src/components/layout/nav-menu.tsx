"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { buildNavEntries, type NavItem } from "./navigation";
import { TabLink } from "./tab-link";

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

// Menu lateral com grupos (ex.: "Integração C5"). Três formas:
// - rail: menu recolhido, só ícones. O grupo vira uma faixa separada por linhas, para os
//   submenus continuarem a um clique;
// - expanded / mobile: o grupo tem um cabeçalho que abre e fecha; começa aberto quando a tela
//   atual é dele.
export function NavMenu({ items, path, variant }: { items: NavItem[]; path: string; variant: "rail" | "expanded" | "mobile" }) {
  const entries = buildNavEntries(items);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const rail = variant === "rail";

  const link = (item: NavItem, nested = false) => {
    const Icon = item.icon;
    const active = isActive(path, item.href);
    return <TabLink key={item.href} href={item.href} title={rail ? item.label : undefined} aria-current={active ? "page" : undefined}
      className={cn("flex h-10 items-center border-l-[3px] transition",
        rail ? "w-9 justify-center" : cn("gap-3 px-2.5", variant === "mobile" && "rounded", nested && "pl-6"),
        active ? "border-[#5471bf] bg-[#e6eafc] text-[#405b9e]" : "border-transparent text-[#39a4c2] hover:bg-cyan-50")}>
      <Icon size={nested ? 16 : 18} className="shrink-0" />
      {!rail && <span className="truncate text-sm font-medium">{item.label}</span>}
    </TabLink>;
  };

  return <>{entries.map((entry) => {
    if (entry.kind === "item") return link(entry.item);
    if (rail) return <div key={entry.id} role="group" aria-label={entry.label} className="my-1 flex flex-col items-center gap-1 border-y border-slate-200 py-1">{entry.items.map((item) => link(item))}</div>;
    const hasActive = entry.items.some((item) => isActive(path, item.href));
    const open = toggled[entry.id] ?? hasActive;
    const Icon = entry.icon;
    return <div key={entry.id} role="group" aria-label={entry.label}>
      <button type="button" aria-expanded={open} onClick={() => setToggled((current) => ({ ...current, [entry.id]: !open }))}
        className={cn("flex h-10 w-full items-center gap-3 border-l-[3px] px-2.5 text-left transition hover:bg-cyan-50", variant === "mobile" && "rounded", hasActive && !open ? "border-[#5471bf] text-[#405b9e]" : "border-transparent text-[#39a4c2]")}>
        <Icon size={18} className="shrink-0" />
        <span className="flex-1 truncate text-sm font-semibold">{entry.label}</span>
        <ChevronDown size={15} className={cn("shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="flex flex-col gap-1 pt-1">{entry.items.map((item) => link(item, true))}</div>}
    </div>;
  })}</>;
}
