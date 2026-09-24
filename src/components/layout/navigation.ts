import { Bell, ClipboardCheck, ClipboardList, Code2, CreditCard, Database, Gauge, ListChecks, ShieldCheck, Store, Workflow } from "lucide-react";

// Extraído de app-shell.tsx para ser reaproveitado também pelo registro de rotas das abas
// (tab-registry.ts) sem criar um import circular entre os dois.
export const navigation = [
  { href: "/dashboard", label: "Painel de conciliações", icon: Gauge },
  { href: "/commercial", label: "Portal do Cliente", icon: CreditCard },
  // Ferramenta interna de curadoria de cadastro entre clientes — o admin de UM cliente
  // (COMPANY_ADMIN) não deve ver produtos/tributação de outros clientes aqui.
  { href: "/marketplace", label: "Catálogo mestre", icon: Store, visibleTo: ["ADMIN", "ANALYST"] },
  { href: "/consinco", label: "Integração Consinco", icon: Workflow, admin: true },
  { href: "/alerts", label: "Alertas", icon: Bell },
  { href: "/rules", label: "Regras", icon: ListChecks, admin: true },
  { href: "/connections", label: "Conexões ERP", icon: ShieldCheck, admin: true },
  // Não é admin-only: ANALYST sempre vê a aba "Catálogo" (capacidade base) e pode ganhar as demais
  // por concessão pontual (ver AccessPermissionsService) — mas COMPANY_ADMIN nunca acessa nada aqui,
  // é ferramenta interna da equipe ConciliaERP (know-how de extração do ERP do cliente).
  { href: "/connector-queries", label: "Consultas do agente conector", icon: Code2, visibleTo: ["ADMIN", "ANALYST"] },
  { href: "/connector-data", label: "Cadastros importados", icon: Database },
  { href: "/catalog-review", label: "Revisão de cadastros", icon: ClipboardCheck, admin: true },
  { href: "/adherence-plan", label: "Plano de aderência", icon: ClipboardList, admin: true },
];

export function navLabel(href: string): string {
  return navigation.find((item) => item.href === href)?.label ?? href;
}
