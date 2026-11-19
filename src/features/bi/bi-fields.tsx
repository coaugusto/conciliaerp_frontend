"use client";

// Painel de campos e áreas Linhas / Colunas / Valores do construtor. Arrastar usa o drag and drop
// nativo do navegador; o mesmo resultado sai clicando no campo e escolhendo a área (teclado e
// celular). Os "?" usam ids literais porque o teste de cobertura da ajuda lê este arquivo.

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Calendar, Filter, GripVertical, Hash, Plus, Rows3, Columns3, Sigma, Type, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { FieldHelp } from "@/components/help/field-help";
import type { Agg, Dataset, DatasetField, Granularity, ViewDefinition } from "@/services/bi.service";
import { AGG_LABEL, GRANULARITY_LABEL, dimensionLabel, measureLabel } from "./bi-format";

export type Zone = "rows" | "columns" | "measures" | "filters";
const DRAG_TYPE = "application/x-concilia-bi-field";
export const COUNT_FIELD = "count";
const ZONE_LABEL: Record<Zone, string> = { rows: "Linhas", columns: "Colunas", measures: "Valores", filters: "Filtros" };

/** "?" de campos que precisam de explicação (docs/bi-financeiro-mvp.md, 8.4). */
const FIELD_HELP: Record<string, ReactNode> = {
  direction: <FieldHelp screen="bi" field="direcao" />,
  status: <FieldHelp screen="bi" field="status" />,
  situation: <FieldHelp screen="bi" field="titulos-vencidos" />,
  aging: <FieldHelp screen="bi" field="faixa-atraso" />,
  openAmount: <FieldHelp screen="bi" field="valor-original-saldo" />,
  origin: <FieldHelp screen="bi" field="origem" />,
};

export function zonesFor(field: DatasetField | { kind: "count" }): Zone[] {
  if (field.kind === "number" || field.kind === "count") return field.kind === "number" ? ["measures", "filters"] : ["measures"];
  return ["rows", "columns", "filters"];
}

export function startFieldDrag(event: DragEvent, fieldId: string) {
  event.dataTransfer.setData(DRAG_TYPE, fieldId);
  event.dataTransfer.setData("text/plain", fieldId);
  event.dataTransfer.effectAllowed = "copyMove";
}
export const draggedField = (event: DragEvent) => event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData("text/plain");

const kindIcon = (kind: string) => kind === "date" ? <Calendar size={14} /> : kind === "number" || kind === "count" ? <Hash size={14} /> : <Type size={14} />;

export function FieldPanel({ dataset, onAdd }: { dataset: Dataset; onAdd: (fieldId: string, zone: Zone) => void }) {
  const groups: Array<{ title: string; fields: Array<{ id: string; label: string; kind: string; description?: string }> }> = [
    { title: "Agrupar por", fields: dataset.fields.filter((field) => field.kind === "text") },
    { title: "Datas", fields: dataset.fields.filter((field) => field.kind === "date") },
    { title: "Valores", fields: [...dataset.fields.filter((field) => field.kind === "number"), { id: COUNT_FIELD, label: dataset.countLabel, kind: "count" }] },
  ];
  return <aside data-help="bi-campos" className="rounded-xl border border-[#aab8cb] bg-white p-3">
    <p className="mb-1 text-sm font-semibold text-slate-800">Campos</p>
    <p className="mb-3 text-xs text-slate-500">Arraste para Linhas, Colunas, Valores ou Filtros, ou clique no campo.</p>
    {groups.map((group) => <div key={group.title} className="mb-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{group.title}</p>
      <ul className="space-y-1">{group.fields.map((field) => <FieldChip key={field.id} field={field} help={FIELD_HELP[field.id]} onAdd={onAdd} />)}</ul>
    </div>)}
  </aside>;
}

function FieldChip({ field, help, onAdd }: { field: { id: string; label: string; kind: string; description?: string }; help?: ReactNode; onAdd: (fieldId: string, zone: Zone) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const zones = zonesFor(field as DatasetField);
  return <li ref={ref} className="relative">
    <div className="flex items-center gap-1">
      <button
        type="button" draggable onDragStart={(event) => startFieldDrag(event, field.id)} onClick={() => setOpen(!open)} title={field.description}
        aria-haspopup="menu" aria-expanded={open}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-sm text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 active:cursor-grabbing"
      >
        <GripVertical size={13} className="shrink-0 text-slate-400" />
        <span className="shrink-0 text-slate-500">{kindIcon(field.kind)}</span>
        <span className="truncate">{field.label}</span>
      </button>
      {help}
    </div>
    {open && <div role="menu" className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
      {zones.map((zone) => <button key={zone} role="menuitem" type="button" onClick={() => { onAdd(field.id, zone); setOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-cyan-50">
        <Plus size={13} /> Adicionar em {ZONE_LABEL[zone]}
      </button>)}
    </div>}
  </li>;
}

// ---------------------------------------------------------------- áreas

type ZoneProps = { dataset: Dataset; definition: ViewDefinition; onChange: (definition: ViewDefinition) => void; onAdd: (fieldId: string, zone: Zone) => void; onRemoveMeasure: (index: number) => void };

function DropArea({ zone, onAdd, icon, title, help, children, empty }: { zone: Zone; onAdd: ZoneProps["onAdd"]; icon: ReactNode; title: string; help?: ReactNode; children: ReactNode; empty: boolean }) {
  const [over, setOver] = useState(false);
  return <div
    onDragOver={(event) => { event.preventDefault(); setOver(true); }}
    onDragLeave={() => setOver(false)}
    onDrop={(event) => { event.preventDefault(); setOver(false); const id = draggedField(event); if (id) onAdd(id, zone); }}
    className={cn("min-h-[76px] rounded-lg border border-dashed p-2 transition", over ? "border-cyan-500 bg-cyan-50" : "border-slate-300 bg-slate-50/70")}
  >
    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon}{title}{help}</p>
    <div className="flex flex-wrap gap-1.5">{children}{empty && <span className="text-xs text-slate-400">Solte um campo aqui</span>}</div>
  </div>;
}

function Chip({ children, onRemove, onLeft, onRight }: { children: ReactNode; onRemove: () => void; onLeft?: () => void; onRight?: () => void }) {
  return <span className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-white px-1.5 py-1 text-sm text-slate-800 shadow-sm">
    {onLeft && <button type="button" onClick={onLeft} aria-label="Mover para a esquerda" className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><ArrowLeft size={12} /></button>}
    {children}
    {onRight && <button type="button" onClick={onRight} aria-label="Mover para a direita" className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><ArrowRight size={12} /></button>}
    <button type="button" onClick={onRemove} aria-label="Tirar o campo" className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-700"><X size={12} /></button>
  </span>;
}

const swap = <T,>(list: T[], from: number, to: number) => { const next = [...list]; [next[from], next[to]] = [next[to], next[from]]; return next; };

function DimensionChips({ dataset, keys, onKeys }: { dataset: Dataset; keys: string[]; onKeys: (keys: string[]) => void }) {
  return <>{keys.map((key, index) => {
    const [id, granularity] = key.split(":");
    const field = dataset.fields.find((item) => item.id === id);
    return <Chip key={key} onRemove={() => onKeys(keys.filter((_, i) => i !== index))} onLeft={index > 0 ? () => onKeys(swap(keys, index, index - 1)) : undefined} onRight={index < keys.length - 1 ? () => onKeys(swap(keys, index, index + 1)) : undefined}>
      {field?.kind === "date"
        ? <span className="inline-flex items-center gap-1">{field.label}
            <select aria-label={`Agrupar ${field.label} por`} value={granularity ?? "month"} onChange={(event) => onKeys(keys.map((item, i) => (i === index ? `${id}:${event.target.value}` : item)))} className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs">
              {dataset.granularities.map((item) => <option key={item} value={item}>{GRANULARITY_LABEL[item as Granularity]}</option>)}
            </select>
          </span>
        : dimensionLabel(dataset, key)}
    </Chip>;
  })}</>;
}

export function DropZones({ dataset, definition, onChange, onAdd, onRemoveMeasure }: ZoneProps) {
  const hasDate = [...definition.rows, ...definition.columns].some((key) => dataset.fields.find((field) => field.id === key.split(":")[0])?.kind === "date");
  return <div data-help="bi-areas" className="grid gap-2 md:grid-cols-3">
    <DropArea zone="rows" onAdd={onAdd} icon={<Rows3 size={13} />} title="Linhas" empty={!definition.rows.length}
      help={hasDate ? <FieldHelp screen="bi" field="granularidade" /> : undefined}>
      <DimensionChips dataset={dataset} keys={definition.rows} onKeys={(rows) => onChange({ ...definition, rows, ...(rows.length ? {} : { limit: undefined }) })} />
    </DropArea>
    <DropArea zone="columns" onAdd={onAdd} icon={<Columns3 size={13} />} title="Colunas" empty={!definition.columns.length}>
      <DimensionChips dataset={dataset} keys={definition.columns} onKeys={(columns) => onChange({ ...definition, columns })} />
    </DropArea>
    <DropArea zone="measures" onAdd={onAdd} icon={<Sigma size={13} />} title="Valores" help={<FieldHelp screen="bi" field="medidas" />} empty={!definition.measures.length}>
      {definition.measures.map((measure, index) => {
        const field = dataset.fields.find((item) => item.id === measure.field);
        const aggs: Agg[] = field?.kind === "number" ? field.aggs : ["count"];
        return <Chip key={`${measure.field}-${index}`} onRemove={() => onRemoveMeasure(index)}
          onLeft={index > 0 ? () => onChange({ ...definition, measures: swap(definition.measures, index, index - 1), sort: undefined }) : undefined}
          onRight={index < definition.measures.length - 1 ? () => onChange({ ...definition, measures: swap(definition.measures, index, index + 1), sort: undefined }) : undefined}>
          {aggs.length > 1
            ? <span className="inline-flex items-center gap-1">{field?.label}
                <select aria-label={`Cálculo de ${field?.label}`} value={measure.agg} onChange={(event) => onChange({ ...definition, measures: definition.measures.map((item, i) => (i === index ? { ...item, agg: event.target.value as Agg } : item)) })} className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs">
                  {aggs.map((agg) => <option key={agg} value={agg}>{AGG_LABEL[agg]}</option>)}
                </select>
              </span>
            : measureLabel(dataset, measure)}
        </Chip>;
      })}
    </DropArea>
  </div>;
}

/** Ordenação das linhas e "top N". */
export function SortControls({ dataset, definition, onChange }: { dataset: Dataset; definition: ViewDefinition; onChange: (definition: ViewDefinition) => void }) {
  const value = definition.sort ? (definition.sort.by === "label" ? "label" : `m${definition.sort.measure ?? 0}`) : "label";
  const dir = definition.sort?.dir ?? "asc";
  const set = (sortValue: string, nextDir: "asc" | "desc") => onChange({ ...definition, sort: sortValue === "label" ? { by: "label", dir: nextDir } : { by: "measure", measure: Number(sortValue.slice(1)), dir: nextDir } });
  return <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
    <span className="inline-flex items-center gap-1">Ordenar linhas por<FieldHelp screen="bi" field="top-n" /></span>
    <select aria-label="Ordenar linhas por" value={value} onChange={(event) => set(event.target.value, event.target.value === "label" ? "asc" : "desc")} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm">
      <option value="label">Nome / data</option>
      {definition.measures.map((measure, index) => <option key={index} value={`m${index}`}>{measureLabel(dataset, measure)}</option>)}
    </select>
    <select aria-label="Direção da ordenação" value={dir} onChange={(event) => set(value, event.target.value as "asc" | "desc")} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm">
      <option value="asc">Crescente</option>
      <option value="desc">Decrescente</option>
    </select>
    <label className="inline-flex items-center gap-1">Mostrar só as primeiras
      <input type="number" min={1} max={1000} disabled={!definition.rows.length} value={definition.limit ?? ""} placeholder="todas"
        onChange={(event) => { const limit = event.target.value ? Math.min(1000, Math.max(1, Number(event.target.value))) : undefined; onChange({ ...definition, limit }); }}
        className="h-8 w-20 rounded-md border border-slate-300 bg-white px-2 text-sm disabled:opacity-50" />
      linhas
    </label>
  </div>;
}

export function FilterDropTarget({ onAdd, children }: { onAdd: ZoneProps["onAdd"]; children: ReactNode }) {
  const [over, setOver] = useState(false);
  return <div data-help="bi-filtros"
    onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
    onDrop={(event) => { event.preventDefault(); setOver(false); const id = draggedField(event); if (id) onAdd(id, "filters"); }}
    className={cn("rounded-lg border border-dashed p-2 transition", over ? "border-cyan-500 bg-cyan-50" : "border-slate-300 bg-white")}>
    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Filter size={13} />Filtros</p>
    {children}
  </div>;
}
