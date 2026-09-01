"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button, Card, ErrorState, PageHeader } from "@/components/shared/ui";
import { getApiErrorMessage } from "@/services/api/client";
import { useAuth } from "@/providers/providers";
import {
  initialCatalogLoadService,
  type InitialCatalogReviewRow,
} from "@/services/initial-catalog-load.service";
import { masterCatalogService, type MasterCatalogProduct, type MasterCatalogTaxationStatus, type TaxationSuggestionBulkApplyRow, type TaxationSuggestionBulkApplyResult } from "@/services/master-catalog.service";

const suggestionColumns = ["Código", "Descrição", "NCM", "Método", "Tributação sugerida", "UF origem→destino", "CST_ICMS", "CST_PIS", "CST_COFINS", "CST_IPI", "Confiança", "Base/Justificativa", "Decisão", "Observação", "_Candidato"] as const;

const taxationStatusLabels: Record<MasterCatalogTaxationStatus, string> = { MISSING: "Sem tributação", NEW: "Nova do cadastro", REUSED: "Reaproveitada", NEEDS_CONFIRMATION: "Aguardando confirmação" };
const taxationStatusTone: Record<MasterCatalogTaxationStatus, string> = { MISSING: "bg-amber-100 text-amber-800", NEW: "bg-slate-100 text-slate-700", REUSED: "bg-emerald-100 text-emerald-800", NEEDS_CONFIRMATION: "bg-violet-100 text-violet-800" };
const PAGE_SIZE = 50;

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
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [statusFilter, setStatusFilter] = useState<MasterCatalogTaxationStatus | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const catalog = useQuery({
    queryKey: ["marketplace"],
    queryFn: masterCatalogService.list,
  });
  const items = useMemo(() => catalog.data ?? [], [catalog.data]);
  const searched = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((product) => product.canonicalDescription.toLowerCase().includes(query) || (product.gtin ?? "").includes(query) || (product.ncm ?? "").includes(query));
  }, [items, search]);
  const filtered = useMemo(() => statusFilter ? searched.filter((product) => product.taxation.status === statusFilter) : searched, [searched, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
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
      {isAdmin && <TaxationSuggestionsCard />}
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
        <>
          <CatalogSummaryCards
            items={searched}
            active={statusFilter}
            onSelect={(value) => {
              setStatusFilter((current) => (current === value ? null : value));
              setPage(1);
            }}
          />
          <Card className="mb-4 p-4">
            <label className="grid max-w-sm gap-1 text-sm font-medium text-slate-700">
              Buscar por descrição, GTIN ou NCM
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Digite para filtrar"
                className="h-9 rounded-md border border-slate-300 px-2 text-sm font-normal"
              />
            </label>
          </Card>
          <CatalogProductsTable items={pageItems} total={filtered.length} page={page} totalPages={totalPages} setPage={setPage} />
        </>
      )}
    </>
  );
}

function CatalogSummaryCards({
  items,
  active,
  onSelect,
}: {
  items: MasterCatalogProduct[];
  active: MasterCatalogTaxationStatus | null;
  onSelect: (value: MasterCatalogTaxationStatus) => void;
}) {
  const statuses: MasterCatalogTaxationStatus[] = ["MISSING", "NEW", "REUSED", "NEEDS_CONFIRMATION"];
  const cards = [
    { label: "Total publicado", value: null as MasterCatalogTaxationStatus | null, count: items.length },
    ...statuses.map((status) => ({ label: taxationStatusLabels[status], value: status, count: items.filter((item) => item.taxation.status === status).length })),
  ];
  return (
    <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumo do Catálogo Central">
      {cards.map((card) => (
        <button
          key={card.label}
          type="button"
          disabled={card.value === null}
          onClick={() => card.value && onSelect(card.value)}
          aria-pressed={active === card.value}
          className="rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-default"
        >
          <Card className={`h-full p-4 transition ${card.value ? "hover:border-blue-300 hover:shadow-sm" : ""} ${active === card.value && card.value ? "border-blue-500 bg-blue-50" : ""}`}>
            <p className="text-xs font-semibold uppercase text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{card.count}</p>
            {card.value && <p className="mt-2 text-xs text-blue-700">{active === card.value ? "Filtro ativo — clique para limpar" : "Clique para filtrar"}</p>}
          </Card>
        </button>
      ))}
    </section>
  );
}

function CatalogProductsTable({
  items,
  total,
  page,
  totalPages,
  setPage,
}: {
  items: MasterCatalogProduct[];
  total: number;
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Produto</th>
              <th className="p-3">GTIN / NCM</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Confiança</th>
              <th className="p-3">Tributação</th>
              <th className="p-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {items.map((product) => (
              <tr key={product.id} className="border-t border-slate-100">
                <td className="p-3"><b className="block text-slate-800">{product.canonicalDescription}</b><small className="text-slate-500">{product.brand ?? "Marca não informada"} · {product.manufacturer ?? "Fabricante não informado"}</small></td>
                <td className="p-3 font-mono text-xs">{product.gtin ?? "—"} · {product.ncm ?? "—"}</td>
                <td className="p-3">{product.category ?? "—"}</td>
                <td className="p-3">{Math.round(Number(product.confidence) * 100)}%</td>
                <td className="p-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${taxationStatusTone[product.taxation.status]}`}>{taxationStatusLabels[product.taxation.status]}</span></td>
                <td className="p-3 text-right"><Link href={`/marketplace/products/${encodeURIComponent(product.id)}`} className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-800"><Eye size={14} />Detalhes</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length ? (
        <p className="p-10 text-center text-sm text-slate-500">Nenhum produto encontrado para os filtros selecionados.</p>
      ) : (
        <div className="flex items-center justify-between p-3 text-sm">
          <span>{total} produto(s) · página {page}/{totalPages}</span>
          <div className="flex gap-2">
            <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
            <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Próxima</button>
          </div>
        </div>
      )}
    </Card>
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
function TaxationSuggestionsCard() {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [reviewedRows, setReviewedRows] = useState<TaxationSuggestionBulkApplyRow[]>([]);
  const [result, setResult] = useState<TaxationSuggestionBulkApplyResult | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const accepted = reviewedRows.filter((row) => row.decision === "ACEITAR");
  const applyMutation = useMutation({
    mutationFn: () => masterCatalogService.acceptTaxationSuggestionsBulk(reviewedRows),
    onSuccess: (data) => { setResult(data); queryClient.invalidateQueries({ queryKey: ["marketplace"] }); setReviewedRows([]); setFileName(""); },
  });

  const exportSuggestions = async () => {
    setExporting(true); setExportError(""); setResult(null);
    try {
      const rows = await masterCatalogService.taxationSuggestionsBulk();
      if (!rows.length) { setExportError("Nenhum produto pendente de tributação com sugestão disponível no momento."); return; }
      const XLSX = await import("xlsx");
      const sheetRows = rows.map((row) => {
        const candidate = row.candidate;
        const taxation = candidate.taxation as Record<string, unknown>;
        const isAiAssisted = candidate.method === "AI_ASSISTED_MATCH";
        return {
          "Código": row.productId,
          "Descrição": row.description,
          "NCM": row.ncm ?? "",
          "Método": isAiAssisted ? "IA (escolhida entre tributações reais)" : "Similaridade direta",
          "Tributação sugerida": String(taxation.name ?? ""),
          "UF origem→destino": `${taxation.companyState}→${taxation.counterpartyState}`,
          "CST_ICMS": String(taxation.cstIcms ?? ""),
          "CST_PIS": String(taxation.cstPis ?? ""),
          "CST_COFINS": String(taxation.cstCofins ?? ""),
          "CST_IPI": String(taxation.cstIpi ?? ""),
          "Confiança": `${Math.round(candidate.confidence * 100)}%`,
          "Base/Justificativa": isAiAssisted ? candidate.reasoning : `Baseado em ${candidate.basedOn.matchedProductCount} de ${candidate.basedOn.totalMatched} produto(s) com ${candidate.basedOn.field === "ncm" ? "o mesmo NCM" : candidate.basedOn.field === "ncmPrefix" ? "NCM parecido" : "a mesma categoria"}`,
          "Decisão": "PENDENTE",
          "Observação": "",
          "_Candidato": JSON.stringify(candidate),
        };
      });
      const sheet = XLSX.utils.json_to_sheet(sheetRows, { header: [...suggestionColumns] });
      sheet["!cols"] = suggestionColumns.map((column) => ({ wch: column === "Base/Justificativa" ? 60 : column === "_Candidato" ? 20 : 22 }));
      sheet["!autofilter"] = { ref: `A1:${String.fromCharCode(65 + suggestionColumns.length - 1)}${Math.max(sheetRows.length + 1, 2)}` };
      const instructions = XLSX.utils.aoa_to_sheet([
        ["Sugestões de tributação para produtos sem nenhuma no Catálogo Central"],
        ["Preencha Decisão com ACEITAR ou REJEITAR. Linhas PENDENTE não serão aplicadas."],
        ["Não altere a coluna _Candidato; ela carrega os dados técnicos da sugestão usados na reimportação."],
        ["Todas as sugestões apontam para tributações reais já existentes no catálogo — nenhum valor é inventado. Linhas com Método = IA vêm de um pareamento mais amplo feito pela IA (sem produto com NCM/categoria parecidos) — revise com atenção redobrada antes de aceitar."],
      ]);
      instructions["!cols"] = [{ wch: 120 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, instructions, "Instruções");
      XLSX.utils.book_append_sheet(workbook, sheet, "Sugestões de tributação");
      XLSX.writeFile(workbook, `sugestoes-tributacao-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Não foi possível gerar as sugestões.");
    } finally {
      setExporting(false);
    }
  };

  const readWorkbook = async (file: File) => {
    setFileError(""); setFileName(file.name); setResult(null);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets["Sugestões de tributação"] ?? workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      const rows: TaxationSuggestionBulkApplyRow[] = [];
      for (const row of data) {
        const productId = text(row["Código"]);
        const candidateJson = text(row["_Candidato"]);
        if (!productId || !candidateJson) continue;
        const decision = ["ACEITAR", "APROVADO", "SIM"].includes(text(row["Decisão"]).toLocaleUpperCase("pt-BR")) ? "ACEITAR" as const : "REJEITAR" as const;
        try { rows.push({ productId, candidate: JSON.parse(candidateJson), decision }); } catch { /* linha com _Candidato inválido — ignora */ }
      }
      if (!rows.length) throw new Error("A planilha não contém linhas válidas ou não possui as colunas esperadas.");
      setReviewedRows(rows);
    } catch (error) {
      setReviewedRows([]);
      setFileError(error instanceof Error ? error.message : "Não foi possível ler a planilha.");
    }
  };

  return (
    <Card className="mt-8 overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 text-cyan-700" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Sugestão de tributação</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Produtos sem tributação — sugestão em massa</h2>
            <p className="mt-1 text-sm text-slate-500">Gera uma sugestão para cada produto publicado sem tributação — sempre apontando para uma tributação real já existente no catálogo, nunca inventada. Por similaridade (mesmo NCM/categoria) e, só na ausência disso, por IA escolhendo entre um conjunto mais amplo de tributações reais. Exporta em planilha para revisão e reimporta as decisões.</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 p-5">
        <Button onClick={exportSuggestions} disabled={exporting}><Download size={16} />{exporting ? "Gerando..." : "Gerar e exportar sugestões"}</Button>
        <input ref={fileInput} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) readWorkbook(file); event.target.value = ""; }} />
        <Button variant="secondary" onClick={() => fileInput.current?.click()}><Upload size={16} />Reimportar decisões</Button>
        {fileName && <span className="text-sm text-slate-500">{fileName}</span>}
      </div>
      {exportError && <div className="mx-5 mb-5"><ErrorState message={exportError} /></div>}
      {fileError && <div className="mx-5 mb-5"><ErrorState message={fileError} /></div>}
      {reviewedRows.length > 0 && (
        <div className="border-t border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm"><strong>{reviewedRows.length}</strong> linha(s) lida(s) · <strong className="text-emerald-700">{accepted.length} marcada(s) ACEITAR</strong></p>
            <Button onClick={() => applyMutation.mutate()} disabled={!accepted.length || applyMutation.isPending}><PackageCheck size={16} />{applyMutation.isPending ? "Aplicando..." : `Aplicar ${accepted.length} decisão(ões)`}</Button>
          </div>
        </div>
      )}
      {applyMutation.isError && <div className="mx-5 mb-5"><ErrorState message={getApiErrorMessage(applyMutation.error)} /></div>}
      {result && <p className="mx-5 mb-5 text-sm font-medium text-emerald-700">Concluído: {result.applied} tributação(ões) vinculada(s), {result.rejected} rejeitada(s)/pendente(s), {result.notFound} não encontrada(s) ou inválida(s).</p>}
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
