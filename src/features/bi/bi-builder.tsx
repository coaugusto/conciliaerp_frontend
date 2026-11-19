"use client";

// Construtor de visões do BI Financeiro (docs/bi-financeiro-mvp.md, seção 6). O estado da tela é só a
// definição da visão (o mesmo JSON salvo nas visões); toda mudança vira uma nova consulta ao
// servidor, que devolve a matriz já agregada. Ajuda: src/help-assistant/docs/bi.ts no backend.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Building2, ChevronDown, Download, Save, Settings2, Table2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button, Card, ErrorState, InlineLoader, Notice, PageHeader, PageLoader, dateTime } from "@/components/shared/ui";
import { FieldHelp } from "@/components/help/field-help";
import { useAuth } from "@/providers/providers";
import { getApiErrorMessage } from "@/services/api/client";
import { biService, type Dataset, type DatasetId, type ViewDefinition, type ViewFilter } from "@/services/bi.service";
import { emptyDefinition, isUsable, withoutMeasure } from "./bi-format";
import { COUNT_FIELD, DropZones, FieldPanel, FilterDropTarget, SortControls, type Zone } from "./bi-fields";
import { FilterList, newFilter } from "./bi-filters";
import { PivotGrid, type CellRef } from "./bi-grid";
import { BiChart } from "./bi-chart";
import { DrillPanel } from "./bi-drill";
import { SaveViewDialog, ViewsMenu, type OpenedView } from "./bi-views";
import { SettingsPanel } from "./bi-settings";
import { exportCsv, exportXlsx } from "./bi-export";

const LIMITS = { rows: 3, columns: 2, measures: 5 };

/** Filtro ainda sem valor (recém-criado, em edição) não vai para a consulta. */
const isComplete = (filter: ViewFilter) => (Array.isArray(filter.value) ? filter.value.length > 0 : filter.value !== "");

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return debounced;
}

export function BiBuilder() {
  const { user } = useAuth();
  const client = useQueryClient();
  const datasets = useQuery({ queryKey: ["bi", "datasets"], queryFn: biService.datasets, staleTime: Infinity });
  const status = useQuery({ queryKey: ["bi", "status"], queryFn: biService.status });
  // Até o usuário mexer, a visão é a vazia da primeira base.
  const [draft, setDefinition] = useState<ViewDefinition | null>(null);
  const definition = useMemo(() => draft ?? (datasets.data?.length ? emptyDefinition(datasets.data[0]) : null), [draft, datasets.data]);
  const [opened, setOpened] = useState<OpenedView>(null);
  const [tab, setTab] = useState<"grid" | "chart">("grid");
  const [editingFilter, setEditingFilter] = useState<number | null>(null);
  const [drill, setDrill] = useState<CellRef | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dataset: Dataset | undefined = datasets.data?.find((item) => item.id === definition?.dataset);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(null), 5000); return () => clearTimeout(timer); }, [message]);

  // Trocar de cliente no topo do portal muda as empresas visíveis: recomeça a seleção de empresas.
  useEffect(() => {
    const refresh = () => { setDefinition((current) => (current ? { ...current, companyIds: undefined } : current)); client.invalidateQueries({ queryKey: ["bi"] }); };
    window.addEventListener("concilia:company-changed", refresh);
    window.addEventListener("concilia:tenant-changed", refresh);
    return () => { window.removeEventListener("concilia:company-changed", refresh); window.removeEventListener("concilia:tenant-changed", refresh); };
  }, [client]);

  const effective = useMemo(() => (definition ? { ...definition, filters: definition.filters.filter(isComplete) } : null), [definition]);
  const debounced = useDebounced(effective, 350);
  const result = useQuery({
    queryKey: ["bi", "query", debounced],
    queryFn: () => biService.query(debounced!),
    enabled: !!debounced && isUsable(debounced),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const change = useCallback((next: ViewDefinition) => { setDefinition(next); setDrill(null); }, []);

  const addField = useCallback((fieldId: string, zone: Zone) => {
    if (!definition || !dataset) return;
    if (fieldId === COUNT_FIELD) {
      if (zone !== "measures") return setMessage("Quantidade só entra em Valores.");
      if (definition.measures.length >= LIMITS.measures) return setMessage(`No máximo ${LIMITS.measures} valores.`);
      return change({ ...definition, measures: [...definition.measures, { field: COUNT_FIELD, agg: "count" }] });
    }
    const field = dataset.fields.find((item) => item.id === fieldId);
    if (!field) return;
    if (zone === "filters") {
      setDefinition({ ...definition, filters: [...definition.filters, newFilter(field)] });
      setEditingFilter(definition.filters.length);
      return;
    }
    if (zone === "measures") {
      if (field.kind !== "number") return setMessage(`"${field.label}" agrupa os dados: coloque em Linhas ou Colunas. Em Valores entram números e Quantidade.`);
      if (definition.measures.length >= LIMITS.measures) return setMessage(`No máximo ${LIMITS.measures} valores.`);
      return change({ ...definition, measures: [...definition.measures, { field: field.id, agg: field.aggs[0] }] });
    }
    if (field.kind === "number") return setMessage(`"${field.label}" é um valor: coloque em Valores.`);
    const key = field.kind === "date" ? `${field.id}:month` : field.id;
    const strip = (keys: string[]) => keys.filter((item) => item.split(":")[0] !== field.id);
    const rows = strip(definition.rows), columns = strip(definition.columns);
    const target = zone === "rows" ? rows : columns;
    if (target.length >= LIMITS[zone]) return setMessage(`No máximo ${LIMITS[zone]} campos em ${zone === "rows" ? "Linhas" : "Colunas"}.`);
    target.push(key);
    change({ ...definition, rows, columns });
  }, [definition, dataset, change]);

  const switchDataset = (id: DatasetId) => {
    const next = datasets.data?.find((item) => item.id === id);
    if (!next || next.id === definition?.dataset) return;
    change({ ...emptyDefinition(next), companyIds: definition?.companyIds });
    setOpened(null);
    setEditingFilter(null);
  };

  if (datasets.isLoading || !definition) return <PageLoader label="Carregando o BI..." />;
  if (datasets.isError || !dataset) return <ErrorState message="Não foi possível carregar o BI Financeiro." />;

  const companies = status.data?.companies ?? [];
  const canEdit = user?.role === "ADMIN" || user?.role === "COMPANY_ADMIN";
  const noData = status.data && status.data.titles === 0 && status.data.operations === 0;
  const dependsOnOperations = definition.dataset === "cashflow" || (definition.dataset === "expenses" && definition.regime === "CASH");
  const dataAsOf = result.data?.dataAsOf ?? status.data?.dataAsOf ?? null;
  const viewName = opened?.name ?? dataset.label;
  const selectedCompanyNames = companies.filter((company) => definition.companyIds?.includes(company.id)).map((company) => company.name);

  return <>
    <PageHeader title="BI Financeiro" description="Monte relatórios de títulos, fluxo de caixa e despesas arrastando os campos." />

    <Card className="mb-3 flex flex-wrap items-center gap-3 p-3">
      <div data-help="bi-dataset" className="flex flex-wrap items-center gap-1">
        {datasets.data!.map((item) => <button key={item.id} type="button" onClick={() => switchDataset(item.id)} title={item.description}
          className={cn("h-8 rounded-md px-3 text-sm font-semibold", item.id === definition.dataset ? "bg-[#075d70] text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50")}>{item.label}</button>)}
        <FieldHelp screen="bi" field="dataset" />
      </div>
      <div data-help="bi-regime" className={cn("flex items-center gap-1 rounded-md border border-slate-200 p-0.5", !dataset.requiresRegime && "opacity-50")} title={dataset.requiresRegime ? undefined : "Só na base de Despesas"}>
        {(["COMPETENCE", "CASH"] as const).map((regime) => <button key={regime} type="button" disabled={!dataset.requiresRegime} onClick={() => change({ ...definition, regime })}
          className={cn("h-7 rounded px-2 text-sm", dataset.requiresRegime && definition.regime === regime ? "bg-cyan-100 font-semibold text-cyan-900" : "text-slate-600 hover:bg-slate-50 disabled:hover:bg-transparent")}>{regime === "CASH" ? "Caixa" : "Competência"}</button>)}
        <FieldHelp screen="bi" field="regime" />
      </div>
      <CompanyPicker companies={companies} selected={definition.companyIds} onChange={(companyIds) => change({ ...definition, companyIds })} />
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">{dataAsOf ? `Dados de ${dateTime(dataAsOf)}` : "Sem extração financeira"}<FieldHelp screen="bi" field="data-dados" /></span>
        <ViewsMenu onOpen={(next, view) => { change(next); setOpened(view); setEditingFilter(null); }} />
        <Button variant="secondary" onClick={() => setSaveOpen(true)} disabled={!isUsable(definition)}><Save size={15} />Salvar</Button>
        <ExportMenu disabled={!result.data} onExport={(format) => { if (!result.data) return; if (format === "xlsx") void exportXlsx(viewName, dataset, effective!, result.data, selectedCompanyNames); else exportCsv(viewName, result.data); }} />
        <button type="button" data-help="bi-configuracoes" onClick={() => setSettingsOpen(true)} aria-label="Configurações do BI" title="Configurações do BI" className="grid size-8 place-items-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"><Settings2 size={16} /></button>
      </div>
    </Card>

    {noData && <div className="mb-3"><Notice>Ainda não há dados financeiros para este cliente. {user?.role === "COMPANY_ADMIN" ? "Peça à equipe Concilia para ligar a extração financeira." : "Publique o catálogo de consultas (v30) e execute FIN_TITLES_V1 e FIN_TITLE_OPERATIONS_V1 pelo Connector. Antes, confira as colunas marcadas como fase 0."}</Notice></div>}
    {!noData && dependsOnOperations && (status.data?.pendingOperationKinds ?? 0) > 0 && <div className="mb-3"><Notice>
      <span>{status.data!.pendingOperationKinds} código{status.data!.pendingOperationKinds === 1 ? "" : "s"} de operação ainda sem conferência. O caixa depende do efeito de cada um. <button type="button" onClick={() => setSettingsOpen(true)} className="font-semibold underline">Conferir agora</button></span>
    </Notice></div>}
    {message && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">{message}</div>}

    <div className="grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <FieldPanel dataset={dataset} onAdd={addField} />
      <div className="min-w-0 space-y-3">
        <DropZones dataset={dataset} definition={definition} onChange={change} onAdd={addField} onRemoveMeasure={(index) => change(withoutMeasure(definition, index))} />
        <FilterDropTarget onAdd={addField}>
          <FilterList dataset={dataset} definition={definition} editing={editingFilter} onEdit={setEditingFilter} onChange={change} />
        </FilterDropTarget>
        {definition.rows.length > 0 && <SortControls dataset={dataset} definition={definition} onChange={change} />}

        <Card data-help="bi-resultado" className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-2">
            <div className="flex gap-1">
              <Button variant={tab === "grid" ? "primary" : "secondary"} onClick={() => setTab("grid")}><Table2 size={14} />Grade</Button>
              <Button variant={tab === "chart" ? "primary" : "secondary"} onClick={() => setTab("chart")}><BarChart3 size={14} />Gráfico</Button>
            </div>
            <span className="truncate text-sm font-semibold text-slate-700">{viewName}</span>
            {result.isFetching && <InlineLoader label="Calculando..." />}
            {result.data && !result.isFetching && <span className="ml-auto text-xs text-slate-500">{result.data.leafRowCount.toLocaleString("pt-BR")} linha{result.data.leafRowCount === 1 ? "" : "s"} · {result.data.columns.length.toLocaleString("pt-BR")} coluna{result.data.columns.length === 1 ? "" : "s"}</span>}
          </div>
          {result.data?.warnings.map((warning) => <p key={warning} className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">{warning}</p>)}
          {!isUsable(definition) ? <p className="p-8 text-center text-sm text-slate-500">Coloque pelo menos um campo em Valores.</p>
            : result.isError ? <div className="p-3"><ErrorState message={getApiErrorMessage(result.error)} /></div>
            : !result.data ? <PageLoader label="Calculando..." />
            : tab === "grid" ? <PivotGrid key={JSON.stringify([result.data.rowDims, result.data.columnDims])} result={result.data} onDrill={setDrill} />
            : <BiChart result={result.data} />}
        </Card>
      </div>
    </div>

    {drill && result.data && debounced && <DrillPanel definition={debounced} result={result.data} cell={drill} onClose={() => setDrill(null)} />}
    {settingsOpen && <SettingsPanel canEdit={canEdit} onClose={() => setSettingsOpen(false)} />}
    {saveOpen && effective && <SaveViewDialog definition={effective} opened={opened} onClose={() => setSaveOpen(false)} onSaved={(view) => { setOpened(view); setSaveOpen(false); setMessage("Visão salva."); }} />}
  </>;
}

function CompanyPicker({ companies, selected, onChange }: { companies: Array<{ id: string; name: string; document: string }>; selected?: string[]; onChange: (ids: string[] | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const chosen = selected?.length ? selected : [];
  const label = !chosen.length ? `Todas as empresas (${companies.length})` : chosen.length === 1 ? companies.find((company) => company.id === chosen[0])?.name ?? "1 empresa" : `${chosen.length} de ${companies.length} empresas`;
  const toggle = (id: string) => { const next = chosen.includes(id) ? chosen.filter((item) => item !== id) : [...chosen, id]; onChange(next.length && next.length < companies.length ? next : undefined); };
  const cnpj = (value: string) => value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return <div ref={ref} data-help="bi-empresas" className="relative flex items-center gap-1">
    <Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open} disabled={!companies.length}><Building2 size={14} />{label}<ChevronDown size={14} /></Button>
    <FieldHelp screen="bi" field="empresas" />
    {open && <div className="absolute left-0 top-full z-40 mt-1 max-h-80 w-80 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
      <button type="button" onClick={() => onChange(undefined)} className="mb-1 w-full rounded px-2 py-1 text-left text-sm font-semibold text-cyan-700 hover:bg-cyan-50">Todas as empresas</button>
      {companies.map((company) => <label key={company.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
        <input type="checkbox" className="mt-0.5" checked={chosen.includes(company.id)} onChange={() => toggle(company.id)} />
        <span><span className="block text-slate-800">{company.name}</span><span className="text-xs text-slate-500">{cnpj(company.document)}</span></span>
      </label>)}
    </div>}
  </div>;
}

function ExportMenu({ disabled, onExport }: { disabled: boolean; onExport: (format: "xlsx" | "csv") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return <div ref={ref} data-help="bi-exportar" className="relative flex items-center gap-1">
    <Button variant="secondary" disabled={disabled} onClick={() => setOpen(!open)} aria-expanded={open}><Download size={15} />Exportar<ChevronDown size={14} /></Button>
    <FieldHelp screen="bi" field="formato-exportacao" />
    {open && <div className="absolute right-0 top-full z-40 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
      <button type="button" onClick={() => { onExport("xlsx"); setOpen(false); }} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-cyan-50">Excel (.xlsx)</button>
      <button type="button" onClick={() => { onExport("csv"); setOpen(false); }} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-cyan-50">CSV (Excel em português)</button>
    </div>}
  </div>;
}
