"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Send } from "lucide-react";
import { jsPDF } from "jspdf";
import { Button, Card, PageHeader } from "@/components/shared/ui";
import { useAuth } from "@/providers/providers";

const pdfSections = [
  ["Regra principal", "A consulta existe e é executada no Connector, na rede do cliente. O backend somente armazena a definição, agenda o trabalho e recebe os resultados. O SQL nunca é enviado ao ERP pela API central."],
  ["1. Criar no Connector", "Crie o arquivo SQL e registre-o em queries/catalog.json. Exemplo: queryId FINANCEIRO_TITULOS_V1, versão 1 e arquivo queries/financeiro/financeiro_titulos_v1.sql. O catálogo deve conter limites e parâmetros tipados."],
  ["Exemplo de SELECT", "SELECT T.NROEMPRESA, T.SEQPESSOA, T.NROTITULO, T.DTAEMISSAO, T.DTAVENCIMENTO, T.VLRORIGINAL, T.VLRABERTO FROM CONCILIAERP.VW_TITULOS_FINANCEIROS T WHERE T.NROEMPRESA = :empresa AND T.DTAEMISSAO >= :dataInicial AND T.DTAEMISSAO < :dataFinal + 1"],
  ["2. Validar e anunciar", "Execute validate-catalog, teste no Oracle e reinicie ou atualize o serviço. O heartbeat anuncia código, versão, SHA-256 e status habilitado. O texto do SQL publicado no backend deve ser idêntico ao arquivo local após trim()."],
  ["3. Publicar e agendar", "Em Consultas do Connector, publique a mesma definição e mantenha-a habilitada. Depois, selecione um Connector ativo e agende a carga. O ciclo esperado é PENDING, DISPATCHED, UPLOADING e COMPLETED."],
  ["4. Dados extraídos", "Para a nova consulta aparecer na tela de dados extraídos, adicione seu código à lista types do backend e a extractionTypes do frontend. Defina sourceKeys e changeColumns no backend quando precisar de atualização idempotente e data de alteração."],
  ["Atenção aos parâmetros", "A tela de agendamento atual envia parameters vazio. Consultas com parâmetros obrigatórios precisam de uma melhoria na tela/API para coletar e enviar esses valores; sem isso, o Connector retorna INVALID_PARAMETERS."],
  ["Versionamento", "Não altere uma consulta usada por jobs em andamento. Para mudança incompatível, publique uma nova consulta, como FINANCEIRO_TITULOS_V2, valide no Connector e só então habilite e agende no backend."],
] as const;

function createPdf() {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageHeight = pdf.internal.pageSize.getHeight();
  const addText = (text: string, size: number, weight: "normal" | "bold" = "normal") => {
    pdf.setFont("helvetica", weight);
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, 170) as string[];
    const height = lines.length * (size * 0.45 + 1.3);
    if (y + height > pageHeight - 18) { pdf.addPage(); y = 18; }
    pdf.text(lines, 20, y);
    y += height + 4;
  };
  let y = 20;
  addText("Consultas do Connector", 19, "bold");
  addText("Guia de criação, publicação e carga", 11);
  pdf.setDrawColor(7, 93, 112); pdf.line(20, y, 190, y); y += 8;
  for (const [title, content] of pdfSections) { addText(title, 13, "bold"); addText(content, 10); }
  return pdf.output("blob");
}

function downloadPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "guia-consultas-connector.pdf";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export default function ConnectorDocumentationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  useEffect(() => { if (user && user.role !== "ADMIN") router.replace("/dashboard"); }, [router, user]);
  if (!user || user.role !== "ADMIN") return null;

  const sharePdf = async () => {
    setSending(true);
    try {
      const blob = createPdf();
      const file = new File([blob], "guia-consultas-connector.pdf", { type: "application/pdf" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) await navigator.share({ title: "Guia de consultas do Connector", files: [file] });
      else downloadPdf(blob);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
    } finally { setSending(false); }
  };

  return <>
    <PageHeader title="Documentação do Connector" description="Guia operacional restrito a administradores." action={<div className="flex gap-2"><Button variant="secondary" onClick={() => downloadPdf(createPdf())}><FileDown size={16} />Exportar PDF</Button><Button disabled={sending} onClick={sharePdf}><Send size={16} />{sending ? "Preparando..." : "Enviar PDF"}</Button></div>} />
    <Card className="mb-6 overflow-hidden p-5"><div className="grid gap-3 md:grid-cols-4"><FlowStep number="1" title="Connector" detail="Catálogo e arquivo SQL" /><FlowStep number="2" title="Backend" detail="Heartbeat e agendamento" /><FlowStep number="3" title="ERP local" detail="Execução do SELECT" /><FlowStep number="4" title="Dados extraídos" detail="Lotes e exportação" /></div><p className="mt-4 text-sm text-slate-600">O Connector anuncia código, versão e SHA-256. O job só é entregue quando esses dados correspondem à definição habilitada no backend.</p></Card>
    <div className="space-y-5">{pdfSections.map(([title, content]) => <Card key={title} className="p-5"><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{content}</p></Card>)}</div>
  </>;
}

function FlowStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="relative rounded-lg border border-cyan-200 bg-cyan-50 p-4"><span className="grid size-7 place-items-center rounded-full bg-[#075d70] text-sm font-bold text-white">{number}</span><h2 className="mt-3 font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-600">{detail}</p></div>;
}
