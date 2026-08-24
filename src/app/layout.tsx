import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/providers/providers";

export const metadata: Metadata = { title: "Concilia ERP", description: "Controle e auditoria de conciliações ERP", icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], shortcut: "/icon.svg", apple: "/icon.svg" } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><Providers>{children}</Providers></body></html>;
}
