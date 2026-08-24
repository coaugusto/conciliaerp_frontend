"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileCheck2,
  FileSpreadsheet,
  PackageCheck,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Button, Card, ErrorState, PageHeader } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import {
  initialCatalogLoadService,
  type InitialCatalogReviewRow,
} from "@/services/initial-catalog-load.service";
import { masterCatalogService } from "@/services/master-catalog.service";

const columns = [
  "Código",
  "Descrição",
  "GTIN_EAN",
  "NCM",
  "CEST",
  "CST_ICMS",
  "CFOP",
  "Arquivos_Origem",
  "Decisão",
  "Observação",
] as const;

export default function Marketplace() {
  const queryClient = useQueryClient();
  const catalog = useQuery({
    queryKey: ["marketplace"],
    queryFn: masterCatalogService.list,
  });
  const candidates = useQuery({
    queryKey: ["initial-catalog-load", "candidates"],
    queryFn: initialCatalogLoadService.candidates,
    retry: false,
  });
  const [reviewed, setReviewed] = useState<InitialCatalogReviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const approved = reviewed.filter((row) => row.reviewStatus === "APPROVED");
  const importMutation = useMutation({
    mutationFn: () => initialCatalogLoadService.importReviewed(approved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      setReviewed([]);
      setFileName("");
    },
  });

  const exportCandidates = async () => {
    const XLSX = await import("xlsx");
    const rows = (candidates.data ?? []).map((product) => ({
      Código: product.code,
      Descrição: product.description,
      GTIN_EAN: "",
      NCM: product.ncm ?? "",
      CEST: product.cest ?? "",
      CST_ICMS: product.cstIcms ?? "",
      CFOP: product.cfop ?? "",
      Arquivos_Origem: product.files.join("; "),
      Decisão: "PENDENTE",
      Observação: "",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows, { header: [...columns] });
    sheet["!cols"] = [
      { wch: 16 },
      { wch: 46 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 36 },
      { wch: 14 },
      { wch: 42 },
    ];
    sheet["!autofilter"] = { ref: `A1:J${Math.max(rows.length + 1, 2)}` };
    const instructions = XLSX.utils.aoa_to_sheet([
      ["Carga inicial do Catálogo Central"],
      [
        "Revise os campos e preencha Decisão com APROVADO ou REJEITADO. Linhas PENDENTE não serão importadas.",
      ],
      ["Não altere a coluna Código; ela identifica o produto na reimportação."],
      [
        "Somente produtos com cadastro completo foram incluídos nesta planilha.",
      ],
    ]);
    instructions["!cols"] = [{ wch: 120 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, instructions, "Instruções");
    XLSX.utils.book_append_sheet(workbook, sheet, "Produtos para análise");
    XLSX.writeFile(
      workbook,
      `carga-inicial-catalogo-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const readWorkbook = async (file: File) => {
    setFileError("");
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet =
        workbook.Sheets["Produtos para análise"] ??
        workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });
      const rows = data
        .map(mapReviewRow)
        .filter((row) => row.code && row.description);
      if (!rows.length)
        throw new Error(
          "A planilha não contém produtos válidos ou não possui as colunas esperadas.",
        );
      setReviewed(rows);
    } catch (error) {
      setReviewed([]);
      setFileError(
        error instanceof Error
          ? error.message
          : "Não foi possível ler a planilha.",
      );
    }
  };

  return (
    <>
      <PageHeader
        title="Catálogo Central"
        description="Produtos globais aprovados e fluxo de carga inicial para análise externa."
      />
      <InitialLoadCard
        candidates={candidates.data?.length ?? 0}
        loading={candidates.isLoading}
        loadError={candidates.isError}
        exportCandidates={exportCandidates}
        fileInput={fileInput}
        readWorkbook={readWorkbook}
        fileName={fileName}
        reviewed={reviewed}
        approved={approved.length}
        fileError={fileError}
        importing={importMutation.isPending}
        importError={importMutation.error}
        imported={importMutation.data}
        submit={() => importMutation.mutate()}
      />
      <div className="mb-4 mt-8 flex items-center gap-3">
        <ShieldCheck className="text-emerald-600" />
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Produtos publicados
          </h2>
          <p className="text-sm text-slate-500">
            Somente itens submetidos ao fluxo de qualidade são exibidos.
          </p>
        </div>
      </div>
      {catalog.isLoading ? (
        <p className="p-8 text-sm text-slate-500">
          Carregando Catálogo Central...
        </p>
      ) : catalog.isError ? (
        <ErrorState message="Não foi possível consultar o Catálogo Central." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalog.data?.map((product) => (
            <Card key={product.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-bold text-slate-900">
                  {product.canonicalDescription}
                </h2>
                <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                  {Math.round(Number(product.confidence) * 100)}%
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {product.brand ?? "Marca não informada"} ·{" "}
                {product.manufacturer ?? "Fabricante não informado"}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-slate-400">GTIN</dt>
                  <dd>{product.gtin ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">NCM</dt>
                  <dd>{product.ncm ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Categoria</dt>
                  <dd>{product.category ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Versão</dt>
                  <dd>{product.version}</dd>
                </div>
              </dl>
            </Card>
          ))}
          {!catalog.data?.length && (
            <p className="text-sm text-slate-500">
              Nenhum produto publicado no Catálogo Central.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function InitialLoadCard({
  candidates,
  loading,
  loadError,
  exportCandidates,
  fileInput,
  readWorkbook,
  fileName,
  reviewed,
  approved,
  fileError,
  importing,
  importError,
  imported,
  submit,
}: {
  candidates: number;
  loading: boolean;
  loadError: boolean;
  exportCandidates: () => void;
  fileInput: React.RefObject<HTMLInputElement | null>;
  readWorkbook: (file: File) => void;
  fileName: string;
  reviewed: InitialCatalogReviewRow[];
  approved: number;
  fileError: string;
  importing: boolean;
  importError: unknown;
  imported?: { imported: number; rejected: number };
  submit: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 text-cyan-700" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Carga inicial
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Análise externa por planilha Excel
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Exporte produtos completos recebidos do Connector, revise fora do
              sistema e reimporte as decisões.
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-3">
        <Step
          number="1"
          title="Produtos elegíveis"
          description={
            loading
              ? "Consultando produtos..."
              : loadError
                ? "Não foi possível consultar os candidatos."
                : `${candidates} produto(s) com cadastro completo.`
          }
        />
        <Step
          number="2"
          title="Análise externa"
          description="Preencha APROVADO ou REJEITADO e registre observações."
        />
        <Step
          number="3"
          title="Reimportação"
          description="Somente linhas aprovadas serão enviadas ao Catálogo Central."
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 p-5">
        <Button onClick={exportCandidates} disabled={!candidates || loading}>
          <Download size={16} />
          Exportar produtos completos
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) readWorkbook(file);
            event.target.value = "";
          }}
        />
        <Button variant="secondary" onClick={() => fileInput.current?.click()}>
          <Upload size={16} />
          Reimportar análise
        </Button>
        {fileName && <span className="text-sm text-slate-500">{fileName}</span>}
      </div>
      {fileError && (
        <div className="mx-5 mb-5">
          <ErrorState message={fileError} />
        </div>
      )}
      {reviewed.length > 0 && (
        <div className="border-t border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileCheck2 className="text-emerald-600" />
              <p className="text-sm">
                <strong>{reviewed.length}</strong> linha(s) revisada(s) ·{" "}
                <strong className="text-emerald-700">
                  {approved} aprovada(s)
                </strong>{" "}
                ·{" "}
                {
                  reviewed.filter((row) => row.reviewStatus === "REJECTED")
                    .length
                }{" "}
                rejeitada(s) ·{" "}
                {
                  reviewed.filter((row) => row.reviewStatus === "PENDING")
                    .length
                }{" "}
                pendente(s)
              </p>
            </div>
            <Button onClick={submit} disabled={!approved || importing}>
              <PackageCheck size={16} />
              {importing ? "Importando..." : `Importar ${approved} aprovado(s)`}
            </Button>
          </div>
          <ReviewPreview rows={reviewed.slice(0, 8)} />
        </div>
      )}
      {Boolean(importError) && (
        <div className="mx-5 mb-5">
          <ErrorState message={getApiErrorMessage(importError)} />
        </div>
      )}
      {imported && (
        <p className="mx-5 mb-5 text-sm font-medium text-emerald-700">
          Carga concluída: {imported.imported} produto(s) importado(s) e{" "}
          {imported.rejected} rejeitado(s) pelo backend.
        </p>
      )}
    </Card>
  );
}
function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 p-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cyan-700 text-sm font-bold text-white">
        {number}
      </span>
      <div>
        <strong className="text-sm text-slate-900">{title}</strong>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
function ReviewPreview({ rows }: { rows: InitialCatalogReviewRow[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="bg-slate-50 uppercase text-slate-500">
          <tr>
            <th className="p-3">Código</th>
            <th className="p-3">Produto</th>
            <th className="p-3">NCM / CEST</th>
            <th className="p-3">Decisão</th>
            <th className="p-3">Observação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code} className="border-t border-slate-100">
              <td className="p-3 font-mono">{row.code}</td>
              <td className="p-3 font-medium">{row.description}</td>
              <td className="p-3">
                {row.ncm} / {row.cest}
              </td>
              <td className="p-3">
                {row.reviewStatus === "APPROVED"
                  ? "Aprovado"
                  : row.reviewStatus === "REJECTED"
                    ? "Rejeitado"
                    : "Pendente"}
              </td>
              <td className="p-3 text-slate-500">{row.reviewNotes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function mapReviewRow(row: Record<string, unknown>): InitialCatalogReviewRow {
  const decision = text(row.Decisão).toLocaleUpperCase("pt-BR");
  return {
    code: text(row.Código),
    description: text(row.Descrição),
    gtin: text(row.GTIN_EAN),
    ncm: text(row.NCM),
    cest: text(row.CEST),
    cstIcms: text(row.CST_ICMS),
    cfop: text(row.CFOP),
    sourceFiles: text(row.Arquivos_Origem),
    reviewStatus: ["APROVADO", "APROVAR", "SIM"].includes(decision)
      ? "APPROVED"
      : ["REJEITADO", "REJEITAR", "NÃO", "NAO"].includes(decision)
        ? "REJECTED"
        : "PENDING",
    reviewNotes: text(row.Observação),
  };
}
function text(value: unknown) {
  return value == null ? "" : String(value).trim();
}
