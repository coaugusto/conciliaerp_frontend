import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { PageLoader } from "@/components/shared/ui";
import { navLabel } from "./navigation";
import type { ScreenCode } from "./screen-catalog";

export type TabRouteEntry = {
  pattern: RegExp;
  /** Código fixo da tela (screen-catalog.ts), mostrado no selo e nos erros. */
  screen: ScreenCode;
  paramNames: string[];
  staticParams?: Record<string, string>;
  Component: ComponentType;
  title: (params: Record<string, string>) => string;
};

const loading = () => <PageLoader />;

// Um item por página real em (dashboard)/**/page.tsx. `import()` precisa de um caminho literal
// (não uma variável) para o Next continuar dividindo o bundle por rota, por isso cada entrada é
// escrita por extenso em vez de gerada por um helper. `executions/page.tsx` fica de fora de
// propósito — é uma rota morta (só chama notFound()) sem nenhum link apontando pra ela; se alguém
// navegar lá manualmente, o fallback de "rota sem correspondência" do TabsProvider cobre o caso.
export const TAB_REGISTRY: TabRouteEntry[] = [
  { pattern: /^\/dashboard$/, screen: "PNL-01", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/dashboard/page"), { ssr: false, loading }), title: () => navLabel("/dashboard") },
  { pattern: /^\/commercial$/, screen: "POR-01", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/commercial/page"), { ssr: false, loading }), title: () => navLabel("/commercial") },
  { pattern: /^\/bi$/, screen: "BI-01", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/bi/page"), { ssr: false, loading }), title: () => navLabel("/bi") },
  { pattern: /^\/reforma-tributaria$/, screen: "RTC-01", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/reforma-tributaria/page"), { ssr: false, loading }), title: () => navLabel("/reforma-tributaria") },
  { pattern: /^\/marketplace$/, screen: "CAT-01", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/marketplace/page"), { ssr: false, loading }), title: () => navLabel("/marketplace") },
  { pattern: /^\/marketplace\/categories$/, screen: "CAT-02", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/marketplace/categories/page"), { ssr: false, loading }), title: () => "Categorias do catálogo mestre" },
  { pattern: /^\/marketplace\/products\/([^/]+)$/, screen: "CAT-03", paramNames: ["id"], Component: dynamic(() => import("@/app/(dashboard)/marketplace/products/[id]/page"), { ssr: false, loading }), title: (p) => `Produto ${decodeURIComponent(p.id)}` },
  { pattern: /^\/consinco$/, screen: "INT-02", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/consinco/page"), { ssr: false, loading }), title: () => navLabel("/consinco") },
  { pattern: /^\/alerts$/, screen: "ALE-01", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/alerts/page"), { ssr: false, loading }), title: () => navLabel("/alerts") },
  { pattern: /^\/rules$/, screen: "REG-01", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/rules/page"), { ssr: false, loading }), title: () => navLabel("/rules") },
  { pattern: /^\/connections$/, screen: "INT-01", paramNames: [], staticParams: { section: "connections" }, Component: dynamic(() => import("@/app/(dashboard)/[section]/page"), { ssr: false, loading }), title: () => navLabel("/connections") },
  { pattern: /^\/connector-queries$/, screen: "INT-03", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/connector-queries/page"), { ssr: false, loading }), title: () => navLabel("/connector-queries") },
  { pattern: /^\/connector-data$/, screen: "INT-04", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/connector-data/page"), { ssr: false, loading }), title: () => navLabel("/connector-data") },
  { pattern: /^\/connector-data\/products\/([^/]+)$/, screen: "INT-05", paramNames: ["id"], Component: dynamic(() => import("@/app/(dashboard)/connector-data/products/[id]/page"), { ssr: false, loading }), title: (p) => `Cadastro ${decodeURIComponent(p.id)}` },
  { pattern: /^\/connector-data\/initial-load\/products\/([^/]+)$/, screen: "INT-06", paramNames: ["productId"], Component: dynamic(() => import("@/app/(dashboard)/connector-data/initial-load/products/[productId]/page"), { ssr: false, loading }), title: (p) => `Carga inicial · Produto ${decodeURIComponent(p.productId)}` },
  { pattern: /^\/connector-data\/initial-load\/records\/([^/]+)$/, screen: "INT-07", paramNames: ["id"], Component: dynamic(() => import("@/app/(dashboard)/connector-data/initial-load/records/[id]/page"), { ssr: false, loading }), title: (p) => `Registro ${decodeURIComponent(p.id)}` },
  { pattern: /^\/catalog-review$/, screen: "CAT-04", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/catalog-review/page"), { ssr: false, loading }), title: () => navLabel("/catalog-review") },
  { pattern: /^\/adherence-plan$/, screen: "PA-01", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/adherence-plan/page"), { ssr: false, loading }), title: () => navLabel("/adherence-plan") },
  { pattern: /^\/tax-impact-simulator$/, screen: "SIM-01", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/tax-impact-simulator/page"), { ssr: false, loading }), title: () => "Simulador de impacto tributário" },
  { pattern: /^\/supplier-portal$/, screen: "CAT-05", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/supplier-portal/page"), { ssr: false, loading }), title: () => "Portal do Fornecedor" },
  { pattern: /^\/admin-users$/, screen: "ADM-01", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/admin-users/page"), { ssr: false, loading }), title: () => navLabel("/admin-users") },
  { pattern: /^\/audit-logs$/, screen: "ADM-02", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/audit-logs/page"), { ssr: false, loading }), title: () => navLabel("/audit-logs") },
  { pattern: /^\/profile$/, screen: "ADM-03", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/profile/page"), { ssr: false, loading }), title: () => "Meu perfil" },
  { pattern: /^\/documentation$/, screen: "ADM-04", paramNames: [], Component: dynamic(() => import("@/app/(dashboard)/documentation/page"), { ssr: false, loading }), title: () => "Documentação" },
];

export function matchRoute(pathname: string): { entry: TabRouteEntry; params: Record<string, string> } | null {
  for (const entry of TAB_REGISTRY) {
    const match = entry.pattern.exec(pathname);
    if (!match) continue;
    const params: Record<string, string> = { ...entry.staticParams };
    entry.paramNames.forEach((name, index) => { params[name] = match[index + 1]; });
    return { entry, params };
  }
  return null;
}
