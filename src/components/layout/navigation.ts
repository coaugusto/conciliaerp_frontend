import type { LucideIcon } from "lucide-react";
import { BarChart3, Bell, ClipboardCheck, ClipboardList, Code2, CreditCard, Database, Gauge, Landmark, ListChecks, ScrollText, ShieldCheck, SlidersHorizontal, Store, Users, Workflow } from "lucide-react";

// Extraído de app-shell.tsx para ser reaproveitado também pelo registro de rotas das abas
// (tab-registry.ts) sem criar um import circular entre os dois.
export type NavItem = { href: string; label: string; icon: LucideIcon; admin?: boolean; visibleTo?: string[]; group?: keyof typeof navigationGroups };

export const navigationGroups = {
  integracao: { label: "Integração C5", icon: Workflow },
} as const;

export const navigation: NavItem[] = [
  { href: "/dashboard", label: "Painel de conciliações", icon: Gauge },
  { href: "/commercial", label: "Portal do Cliente", icon: CreditCard },
  { href: "/bi", label: "BI Financeiro", icon: BarChart3 },
  { href: "/reforma-tributaria", label: "Reforma Tributária", icon: Landmark, visibleTo: ["ADMIN", "COMPANY_ADMIN", "ANALYST"] },
  // Ferramenta interna de curadoria de cadastro entre clientes — o admin de UM cliente
  // (COMPANY_ADMIN) não deve ver produtos/tributação de outros clientes aqui.
  { href: "/marketplace", label: "Catálogo mestre", icon: Store, visibleTo: ["ADMIN", "ANALYST"] },
  { href: "/alerts", label: "Alertas", icon: Bell },
  { href: "/rules", label: "Regras", icon: ListChecks, admin: true },
  // Grupo "Integração C5": tudo que liga, libera e acompanha a extração do Consinco fica junto no
  // menu, na ordem do fluxo (Connector instalado → o que a empresa libera → consultas → dados).
  { href: "/connections", label: "Connectors instalados", icon: ShieldCheck, admin: true, group: "integracao" },
  { href: "/consinco", label: "Liberação por empresa", icon: SlidersHorizontal, admin: true, group: "integracao" },
  // Não é admin-only: ANALYST sempre vê a aba "Catálogo" (capacidade base) e pode ganhar as demais
  // por concessão pontual (ver AccessPermissionsService) — mas COMPANY_ADMIN nunca acessa nada aqui,
  // é ferramenta interna da equipe ConciliaERP (know-how de extração do ERP do cliente).
  { href: "/connector-queries", label: "Consultas do agente conector", icon: Code2, visibleTo: ["ADMIN", "ANALYST"], group: "integracao" },
  { href: "/connector-data", label: "Cadastros importados", icon: Database, group: "integracao" },
  { href: "/catalog-review", label: "Revisão de cadastros", icon: ClipboardCheck, admin: true },
  { href: "/adherence-plan", label: "Plano de aderência", icon: ClipboardList, admin: true },
  { href: "/admin-users", label: "Usuários internos", icon: Users, admin: true },
  { href: "/audit-logs", label: "Auditoria", icon: ScrollText, admin: true },
];

// Itens soltos e grupos na ordem do menu: o grupo entra na posição do seu primeiro item visível.
export type NavEntry = { kind: "item"; item: NavItem } | { kind: "group"; id: keyof typeof navigationGroups; label: string; icon: LucideIcon; items: NavItem[] };
export function buildNavEntries(items: NavItem[]): NavEntry[] {
  const entries: NavEntry[] = [];
  for (const item of items) {
    if (!item.group) { entries.push({ kind: "item", item }); continue; }
    const existing = entries.find((entry) => entry.kind === "group" && entry.id === item.group);
    if (existing && existing.kind === "group") existing.items.push(item);
    else entries.push({ kind: "group", id: item.group, ...navigationGroups[item.group], items: [item] });
  }
  return entries;
}

export function navLabel(href: string): string {
  return navigation.find((item) => item.href === href)?.label ?? href;
}
