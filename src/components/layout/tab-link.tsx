"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useTabs } from "@/providers/tabs-provider";

type TabLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; title?: string; children: ReactNode };

// Clique normal: abre/ativa a rota como aba interna. Ctrl/Cmd/clique-do-meio: propositalmente não
// interceptado — o <a href> real deixa o navegador abrir nativamente numa nova aba. Shift+clique:
// abre de fato uma nova janela do navegador (window.open), fora do sistema de abas.
export function TabLink({ href, title, onClick, children, ...rest }: TabLinkProps) {
  const { openTab } = useTabs();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.button === 1) return;
    if (event.shiftKey) { event.preventDefault(); window.open(href, "_blank", "noopener"); return; }
    event.preventDefault();
    openTab(href, { title });
  };
  return <a href={href} title={title} onClick={handleClick} {...rest}>{children}</a>;
}
