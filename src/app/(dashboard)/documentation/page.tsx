import Link from "next/link";
import { BookOpen, Database, ExternalLink, MonitorCog, ServerCog } from "lucide-react";
import { Card, PageHeader } from "@/components/shared/ui";

const areas = [
  {
    title: "Connector",
    description: "Instalação, Oracle, schema, catálogo assinado, jobs, lotes, retomada e diagnóstico local.",
    icon: MonitorCog,
    links: [
      ["Processos do Connector", "/documentation/connector/processos.md"],
      ["Consultas autorizadas", "/documentation/connector/consultas.md"],
    ],
  },
  {
    title: "Frontend",
    description: "Fluxos do Portal, contexto de cliente, carga inicial, listagens e responsabilidades das telas.",
    icon: BookOpen,
    links: [["Processos do Portal", "/documentation/frontend/processos.md"]],
  },
  {
    title: "Backend",
    description: "APIs, persistência, chaves, linhagem das tabelas Consinco e confronto cadastral e fiscal.",
    icon: ServerCog,
    links: [["Extração e listagem Consinco", "/documentation/backend/processos-extracao-consinco.md"]],
  },
] as const;

export default function DocumentationPage() {
  return <>
    <PageHeader title="Documentação" description="Processos técnicos e operacionais separados por componente da plataforma." />
    <section className="grid gap-5 xl:grid-cols-3">
      {areas.map(({ title, description, icon: Icon, links }) => <Card key={title} className="flex min-h-64 flex-col p-6">
        <div className="mb-5 grid size-11 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><Icon size={22} /></div>
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-auto grid gap-2 pt-6">
          {links.map(([label, href]) => <Link key={href} href={href} target="_blank" className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-cyan-800 hover:border-cyan-400 hover:bg-cyan-50">
            {label}<ExternalLink size={15} />
          </Link>)}
        </div>
      </Card>)}
    </section>
    <Card className="mt-5 p-6">
      <div className="flex items-start gap-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700"><Database size={20} /></div>
        <div><h2 className="font-semibold text-slate-950">Ordem recomendada de leitura</h2><p className="mt-1 text-sm leading-6 text-slate-600">Comece pelo processo do Connector, siga para extração e listagem do Backend e finalize com os fluxos do Portal. Os documentos são publicados em Markdown para consulta, compartilhamento e versionamento.</p></div>
      </div>
    </Card>
  </>;
}
