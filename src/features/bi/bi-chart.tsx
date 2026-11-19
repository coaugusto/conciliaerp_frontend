"use client";

// Gráfico da mesma matriz da grade. Eixo: as colunas da visão (ou as linhas, sem colunas). Séries:
// as linhas da visão, até 8 (com colunas), ou os valores (sem colunas). Linha quando o eixo é data,
// barras nos demais casos.

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { QueryResult } from "@/services/bi.service";
import { dimensionValue, formatMeasure, leafRows } from "./bi-format";

const COLORS = ["#075d70", "#c2410c", "#4f46e5", "#15803d", "#b91c1c", "#a16207", "#0e7490", "#7c3aed"];
const MAX_SERIES = 8;
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function BiChart({ result }: { result: QueryResult }) {
  const leaves = leafRows(result);
  const measure = result.measures[0];
  let axisIsDate = false;
  let data: Array<Record<string, string | number | null>> = [];
  let series: Array<{ key: string; label: string; format: "money" | "number" | "days" }> = [];

  if (result.columns.length) {
    axisIsDate = result.columnDims[result.columnDims.length - 1]?.kind === "date";
    const rows = result.rowDims.length ? [...leaves].sort((a, b) => Math.abs(b.total[0] ?? 0) - Math.abs(a.total[0] ?? 0)).slice(0, MAX_SERIES) : [];
    series = rows.length ? rows.map((row, index) => ({ key: `s${index}`, label: row.key.map((value, i) => dimensionValue(value, result.rowDims[i])).join(" › "), format: measure.format })) : [{ key: "s0", label: measure.label, format: measure.format }];
    data = result.columns.map((column) => {
      const point: Record<string, string | number | null> = { axis: column.key.map((value, index) => dimensionValue(value, result.columnDims[index])).join(" · ") };
      if (rows.length) rows.forEach((row, index) => { point[`s${index}`] = row.cells[column.id]?.[0] ?? null; });
      else point.s0 = result.grandTotal.cells[column.id]?.[0] ?? null;
      return point;
    });
  } else if (result.rowDims.length) {
    axisIsDate = result.rowDims[result.rowDims.length - 1]?.kind === "date";
    series = result.measures.slice(0, 3).map((item, index) => ({ key: `s${index}`, label: item.label, format: item.format }));
    data = leaves.slice(0, 200).map((row) => {
      const point: Record<string, string | number | null> = { axis: row.key.map((value, index) => dimensionValue(value, result.rowDims[index])).join(" › ") };
      series.forEach((_, index) => { point[`s${index}`] = row.total[index] ?? null; });
      return point;
    });
  }

  if (!data.length) return <p className="p-8 text-center text-sm text-slate-500">Coloque um campo em Linhas ou Colunas para ver o gráfico.</p>;
  const format = series[0]?.format ?? "number";
  const tooltip = (value: unknown) => formatMeasure(typeof value === "number" ? value : Number(value), format);
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis dataKey="axis" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
      <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => compact.format(Number(value))} width={64} />
      <Tooltip formatter={tooltip} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
    </>
  );
  return <div className="h-[420px] w-full p-3">
    {result.columns.length > 0 && result.rowDims.length > 0 && leaves.length > MAX_SERIES &&<p className="mb-1 text-xs text-slate-500">Mostrando as {MAX_SERIES} linhas de maior valor.</p>}
    <ResponsiveContainer width="100%" height="100%">
      {axisIsDate
        ? <LineChart data={data}>{common}{series.map((item, index) => <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={data.length < 40} connectNulls />)}</LineChart>
        : <BarChart data={data}>{common}{series.map((item, index) => <Bar key={item.key} dataKey={item.key} name={item.label} fill={COLORS[index % COLORS.length]} />)}</BarChart>}
    </ResponsiveContainer>
  </div>;
}
