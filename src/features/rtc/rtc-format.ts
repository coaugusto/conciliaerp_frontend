import type { RtcSeverity } from "@/services/rtc.service";

export const SEVERITY: Record<RtcSeverity, { label: string; card: string; badge: string }> = {
  HIGH: { label: "Com erro", card: "border-red-200 bg-red-50 text-red-800", badge: "bg-red-100 text-red-800" },
  MEDIUM: { label: "Atenção", card: "border-amber-200 bg-amber-50 text-amber-900", badge: "bg-amber-100 text-amber-900" },
  INFO: { label: "Oportunidade", card: "border-sky-200 bg-sky-50 text-sky-900", badge: "bg-sky-100 text-sky-900" },
  OK: { label: "Correta", card: "border-emerald-200 bg-emerald-50 text-emerald-800", badge: "bg-emerald-100 text-emerald-800" },
};

export const formatNcm = (ncm: string) => (ncm.length === 8 ? `${ncm.slice(0, 4)}.${ncm.slice(4, 6)}.${ncm.slice(6)}` : ncm || "—");
/** "2026-10-15" → "15/10/2026". */
export const formatDay = (value: string | null) => (value ? value.slice(0, 10).split("-").reverse().join("/") : "—");
