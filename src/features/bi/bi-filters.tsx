"use client";

// Filtros do construtor. Texto: lista de valores (fixos do campo ou buscados no servidor, os 50 mais
// frequentes) ou "contém". Data: períodos relativos a hoje ou datas fixas. Valor: mínimo e máximo.

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { Button, InlineLoader } from "@/components/shared/ui";
import { FieldHelp } from "@/components/help/field-help";
import { biService, type Dataset, type DatasetField, type ViewDefinition, type ViewFilter } from "@/services/bi.service";
import { PERIOD_PRESETS, filterLabel, formatMeasure } from "./bi-format";

export function newFilter(field: DatasetField): ViewFilter {
  if (field.kind === "date") return { field: field.id, op: "between", value: ["today", "today+30d"] };
  if (field.kind === "number") return { field: field.id, op: "gte", value: 0 };
  return { field: field.id, op: "in", value: [] };
}

export function FilterList({ dataset, definition, editing, onEdit, onChange }: {
  dataset: Dataset; definition: ViewDefinition; editing: number | null; onEdit: (index: number | null) => void; onChange: (definition: ViewDefinition) => void;
}) {
  const remove = (index: number) => { onChange({ ...definition, filters: definition.filters.filter((_, i) => i !== index) }); onEdit(null); };
  return <div>
    <div className="flex flex-wrap gap-1.5">
      {definition.filters.map((filter, index) => <span key={index} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm ${editing === index ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-slate-50"}`}>
        <button type="button" onClick={() => onEdit(editing === index ? null : index)} className="text-left text-slate-800 hover:underline">{filterLabel(dataset, filter)}</button>
        <button type="button" onClick={() => remove(index)} aria-label="Tirar filtro" className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-700"><X size={12} /></button>
      </span>)}
      {!definition.filters.length && <span className="text-xs text-slate-400">Sem filtros: entra tudo. Solte um campo aqui para filtrar.</span>}
    </div>
    {editing !== null && definition.filters[editing] && <FilterEditor key={editing} dataset={dataset} definition={definition} filter={definition.filters[editing]}
      onCancel={() => onEdit(null)}
      onSave={(filter) => { onChange({ ...definition, filters: definition.filters.map((item, i) => (i === editing ? filter : item)) }); onEdit(null); }} />}
  </div>;
}

function FilterEditor({ dataset, definition, filter, onSave, onCancel }: { dataset: Dataset; definition: ViewDefinition; filter: ViewFilter; onSave: (filter: ViewFilter) => void; onCancel: () => void }) {
  const field = dataset.fields.find((item) => item.id === filter.field);
  if (!field) return null;
  return <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
    <p className="mb-2 text-sm font-semibold text-slate-800">{field.label}</p>
    {field.kind === "date" ? <DateEditor filter={filter} onSave={onSave} onCancel={onCancel} />
      : field.kind === "number" ? <NumberEditor field={field} filter={filter} onSave={onSave} onCancel={onCancel} />
      : <TextEditor dataset={dataset} definition={definition} field={field} filter={filter} onSave={onSave} onCancel={onCancel} />}
  </div>;
}

function Actions({ onSave, onCancel, disabled }: { onSave: () => void; onCancel: () => void; disabled?: boolean }) {
  return <div className="mt-3 flex justify-end gap-2"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button onClick={onSave} disabled={disabled}><Check size={14} />Aplicar</Button></div>;
}

function DateEditor({ filter, onSave, onCancel }: { filter: ViewFilter; onSave: (filter: ViewFilter) => void; onCancel: () => void }) {
  const current = Array.isArray(filter.value) ? filter.value.map(String) : [String(filter.value), String(filter.value)];
  const presetIndex = PERIOD_PRESETS.findIndex((preset) => preset.value[0] === current[0] && preset.value[1] === current[1]);
  const [choice, setChoice] = useState(presetIndex >= 0 ? String(presetIndex) : "custom");
  const isoOrEmpty = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");
  const [from, setFrom] = useState(isoOrEmpty(current[0]));
  const [to, setTo] = useState(isoOrEmpty(current[1]));
  const valid = choice !== "custom" || (from && to && from <= to);
  return <div className="space-y-2 text-sm">
    <label className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1">Período<FieldHelp screen="bi" field="periodo-relativo" /></span>
      <select value={choice} onChange={(event) => setChoice(event.target.value)} className="h-8 rounded-md border border-slate-300 bg-white px-2">
        {PERIOD_PRESETS.map((preset, index) => <option key={preset.label} value={index}>{preset.label}</option>)}
        <option value="custom">Personalizado (datas fixas)</option>
      </select>
    </label>
    {choice === "custom" && <div className="flex flex-wrap items-center gap-2">
      <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Data inicial" className="h-8 rounded-md border border-slate-300 px-2" />
      <span>a</span>
      <input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Data final" className="h-8 rounded-md border border-slate-300 px-2" />
    </div>}
    <Actions disabled={!valid} onCancel={onCancel} onSave={() => onSave({ field: filter.field, op: "between", value: choice === "custom" ? [from, to] : PERIOD_PRESETS[Number(choice)].value })} />
  </div>;
}

function NumberEditor({ field, filter, onSave, onCancel }: { field: Extract<DatasetField, { kind: "number" }>; filter: ViewFilter; onSave: (filter: ViewFilter) => void; onCancel: () => void }) {
  const values = Array.isArray(filter.value) ? filter.value : [filter.value];
  const [min, setMin] = useState(filter.op === "lte" ? "" : String(values[0] ?? ""));
  const [max, setMax] = useState(filter.op === "lte" ? String(values[0] ?? "") : filter.op === "between" ? String(values[1] ?? "") : "");
  const parse = (value: string) => (value.trim() === "" ? null : Number(value.replace(",", ".")));
  const lo = parse(min), hi = parse(max);
  const valid = (lo !== null || hi !== null) && [lo, hi].every((value) => value === null || Number.isFinite(value)) && (lo === null || hi === null || lo <= hi);
  const save = () => onSave(lo !== null && hi !== null ? { field: field.id, op: "between", value: [lo, hi] } : lo !== null ? { field: field.id, op: "gte", value: lo } : { field: field.id, op: "lte", value: hi! });
  return <div className="text-sm">
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1">De <input inputMode="decimal" value={min} onChange={(event) => setMin(event.target.value)} placeholder="sem mínimo" className="h-8 w-32 rounded-md border border-slate-300 px-2" /></label>
      <label className="flex items-center gap-1">até <input inputMode="decimal" value={max} onChange={(event) => setMax(event.target.value)} placeholder="sem máximo" className="h-8 w-32 rounded-md border border-slate-300 px-2" /></label>
    </div>
    {lo !== null && Number.isFinite(lo) && <p className="mt-1 text-xs text-slate-500">A partir de {formatMeasure(lo, field.format)}</p>}
    <Actions disabled={!valid} onCancel={onCancel} onSave={save} />
  </div>;
}

function TextEditor({ dataset, definition, field, filter, onSave, onCancel }: { dataset: Dataset; definition: ViewDefinition; field: Extract<DatasetField, { kind: "text" }>; filter: ViewFilter; onSave: (filter: ViewFilter) => void; onCancel: () => void }) {
  const initial = Array.isArray(filter.value) ? filter.value.map(String) : filter.value === "" ? [] : [String(filter.value)];
  const [mode, setMode] = useState<"pick" | "contains">(filter.op === "contains" ? "contains" : "pick");
  const [exclude, setExclude] = useState(filter.op === "neq" || filter.op === "notIn");
  const [selected, setSelected] = useState<string[]>(filter.op === "contains" ? [] : initial);
  const [text, setText] = useState(filter.op === "contains" ? initial[0] ?? "" : "");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(timer); }, [search]);
  const remote = useQuery({
    queryKey: ["bi", "values", dataset.id, field.id, definition.regime, debounced],
    queryFn: () => biService.values({ dataset: dataset.id, field: field.id, search: debounced || undefined, regime: definition.regime }),
    enabled: mode === "pick" && !field.values,
    staleTime: 60_000,
  });
  const options = field.values ? field.values.map((value) => ({ value, total: null as number | null })) : remote.data ?? [];
  const toggle = (value: string) => setSelected((list) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]));
  const save = () => onSave(mode === "contains" ? { field: field.id, op: "contains", value: text.trim() } : { field: field.id, op: exclude ? "notIn" : "in", value: selected });
  return <div className="text-sm">
    <div className="mb-2 flex flex-wrap gap-3">
      <label className="flex items-center gap-1"><input type="radio" checked={mode === "pick"} onChange={() => setMode("pick")} />Escolher valores</label>
      <label className="flex items-center gap-1"><input type="radio" checked={mode === "contains"} onChange={() => setMode("contains")} />Contém o texto</label>
    </div>
    {mode === "contains"
      ? <input autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder="Parte do nome" className="h-8 w-full rounded-md border border-slate-300 px-2" />
      : <>
        {!field.values && <div className="relative mb-2"><Search size={14} className="absolute left-2 top-2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" className="h-8 w-full rounded-md border border-slate-300 pl-7 pr-2" /></div>}
        <div className="max-h-56 space-y-0.5 overflow-auto rounded-md border border-slate-100 p-1">
          {remote.isLoading && !field.values && <InlineLoader label="Buscando valores..." />}
          {[...selected.filter((value) => !options.some((option) => option.value === value)).map((value) => ({ value, total: null })), ...options].map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-50">
            <input type="checkbox" checked={selected.includes(option.value)} onChange={() => toggle(option.value)} />
            <span className="flex-1 truncate">{option.value}</span>
            {option.total !== null && <span className="text-xs text-slate-400">{option.total.toLocaleString("pt-BR")}</span>}
          </label>)}
          {!remote.isLoading && !options.length && <p className="p-2 text-xs text-slate-500">Nenhum valor encontrado.</p>}
        </div>
        {!field.values && <p className="mt-1 text-xs text-slate-500">Mostra os 50 valores mais frequentes; use a busca para achar os demais.</p>}
        <label className="mt-2 flex items-center gap-1"><input type="checkbox" checked={exclude} onChange={(event) => setExclude(event.target.checked)} />Tirar os selecionados (em vez de manter só eles)</label>
      </>}
    <Actions disabled={mode === "contains" ? !text.trim() : !selected.length} onCancel={onCancel} onSave={save} />
  </div>;
}
