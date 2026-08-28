import { fiscalComplianceService, type FiscalProduct } from "@/services/fiscal-compliance.service";
import type { FiscalAlertGroup } from "@/services/fiscal-alerts.service";

type ColumnDef = { key: string; header: string; width: number; value: (product: FiscalProduct) => string };

// Full cadastro row shown on every product-backed sheet, regardless of which
// card is being exported — the ask was always the complete product record,
// not just the field the specific finding is about.
const PRODUCT_COLUMNS: ColumnDef[] = [
  { key: "productId", header: "Código do produto", width: 18, value: p => p.productId },
  { key: "description", header: "Descrição", width: 36, value: p => p.description },
  { key: "barcode", header: "Código de barras", width: 22, value: p => p.barcode ?? "" },
  { key: "family", header: "Família", width: 28, value: p => p.family ?? "" },
  { key: "ncm", header: "NCM", width: 12, value: p => p.ncm ?? "" },
  { key: "cest", header: "CEST", width: 12, value: p => p.cest ?? "" },
  { key: "regPisCst", header: "CST PIS (cadastro)", width: 16, value: p => p.registration.pisCst ?? "" },
  { key: "regCofinsCst", header: "CST COFINS (cadastro)", width: 18, value: p => p.registration.cofinsCst ?? "" },
  { key: "regIpiCst", header: "CST IPI (cadastro)", width: 16, value: p => p.registration.ipiCst ?? "" },
  { key: "taxationName", header: "Tributação", width: 20, value: p => p.taxation.taxationName ?? "" },
  { key: "originCode", header: "Código de origem", width: 16, value: p => p.taxation.originCode ?? "" },
  { key: "substitutionCode", header: "Código de substituição", width: 20, value: p => p.taxation.substitutionCode ?? "" },
  { key: "taxationCstIcms", header: "CST ICMS (saída)", width: 16, value: p => p.taxation.icmsCst ?? "" },
  { key: "taxationPisCst", header: "CST PIS (saída)", width: 16, value: p => p.taxation.pisCst ?? "" },
  { key: "taxationCofinsCst", header: "CST COFINS (saída)", width: 18, value: p => p.taxation.cofinsCst ?? "" },
  { key: "taxationIpiCst", header: "CST IPI (saída)", width: 16, value: p => p.taxation.ipiCst ?? "" },
  { key: "taxationIcmsRate", header: "Alíquota ICMS", width: 14, value: p => p.taxation.icmsRate ?? "" },
  { key: "taxationIcmsStRate", header: "Alíquota ICMS-ST", width: 16, value: p => p.taxation.icmsStRate ?? "" },
  { key: "taxationFcpRate", header: "Alíquota FCP", width: 14, value: p => p.taxation.fcpRate ?? "" },
  { key: "taxationDifalRate", header: "Alíquota DIFAL", width: 14, value: p => p.taxation.difalRate ?? "" },
  { key: "defaultIcmsRate", header: "Alíquota ICMS padrão", width: 18, value: p => p.taxation.defaultIcmsRate ?? "" },
  { key: "operationProfile", header: "Perfil de operação", width: 26, value: p => p.taxation.operationProfile ?? "" },
];

// Which of the columns above hold the value that's actually wrong for a given
// finding — those are the cells that get the "erro" fill on the sheet.
const HIGHLIGHT_COLUMNS_BY_FINDING: Record<string, string[]> = {
  NCM_MISSING: ["ncm"],
  BARCODE_MISSING: ["barcode"],
  BARCODE_INVALID_CHECK_DIGIT: ["barcode"],
  FAMILY_TAX_PROFILE_MISSING: ["family"],
  TAXATION_UF_MISSING: ["family", "taxationCstIcms"],
  TAXATION_UF_INTERNAL_MISSING: ["taxationCstIcms", "taxationIcmsRate", "operationProfile"],
  PIS_COFINS_CST_ALIQUOTA_ZERO_NCM: ["ncm", "taxationPisCst", "taxationCofinsCst"],
};

const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF075D70" } };
const ERROR_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFC7CE" } };
const ERROR_FONT = { color: { argb: "FF9C0006" } };

function sheetName(title: string, used: Set<string>): string {
  const cleaned = title.replace(/[\\/?*[\]:]/g, "").trim().slice(0, 31) || "Cartão";
  let candidate = cleaned;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) { candidate = `${cleaned.slice(0, 28)} ${suffix}`; suffix++; }
  used.add(candidate.toLowerCase());
  return candidate;
}

// Pure workbook builder — takes the already-fetched product list so it can be
// exercised without a network round trip (see export.verify.ts).
export async function buildWorkbook(groups: FiscalAlertGroup[], products: FiscalProduct[]) {
  const ExcelJS = (await import("exceljs")).default;
  const productsByFindingCode = new Map<string, FiscalProduct[]>();
  for (const product of products) {
    for (const finding of product.findings) {
      if (!productsByFindingCode.has(finding.code)) productsByFindingCode.set(finding.code, []);
      productsByFindingCode.get(finding.code)!.push(product);
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ConciliaERP";
  workbook.created = new Date();
  const usedNames = new Set<string>();

  for (const group of groups) {
    const products = productsByFindingCode.get(group.id);
    const sheet = workbook.addWorksheet(sheetName(group.title, usedNames), { views: [{ state: "frozen", ySplit: 4 }] });
    if (products?.length) buildProductSheet(sheet, group, products);
    else buildFallbackSheet(sheet, group);
  }
  return workbook;
}

function writeSheetHeader(sheet: import("exceljs").Worksheet, title: string, description: string, columns: number) {
  sheet.mergeCells(1, 1, 1, columns);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 13, color: { argb: "FF283456" } };
  sheet.mergeCells(2, 1, 2, columns);
  const descriptionCell = sheet.getCell(2, 1);
  descriptionCell.value = description;
  descriptionCell.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
}

function buildProductSheet(sheet: import("exceljs").Worksheet, group: FiscalAlertGroup, products: FiscalProduct[]) {
  const highlightKeys = new Set(HIGHLIGHT_COLUMNS_BY_FINDING[group.id] ?? []);
  writeSheetHeader(sheet, group.title, `${group.description} · ${products.length} produto(s) afetado(s)`, PRODUCT_COLUMNS.length);
  sheet.columns = PRODUCT_COLUMNS.map(column => ({ key: column.key, width: column.width }));
  const headerRow = sheet.getRow(4);
  PRODUCT_COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
  });
  headerRow.commit();
  for (const product of products) {
    const row = sheet.addRow(Object.fromEntries(PRODUCT_COLUMNS.map(column => [column.key, column.value(product)])));
    PRODUCT_COLUMNS.forEach((column, index) => {
      if (!highlightKeys.has(column.key)) return;
      const cell = row.getCell(index + 1);
      cell.fill = ERROR_FILL;
      cell.font = ERROR_FONT;
    });
  }
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + products.length, column: PRODUCT_COLUMNS.length } };
}

const FALLBACK_COLUMNS: { key: string; header: string; width: number }[] = [
  { key: "code", header: "Código", width: 22 },
  { key: "description", header: "Descrição", width: 40 },
  { key: "currentValue", header: "Situação atual", width: 30 },
  { key: "suggestedValue", header: "Sugestão", width: 30 },
  { key: "source", header: "Origem", width: 24 },
  { key: "confidence", header: "Confiança (%)", width: 14 },
];

// Cards not backed by the connector's product cadastro (SPED bookkeeping
// alerts, reconciliation-engine alerts, catalog proposals) don't have a full
// product row to expand — still exported as a table, just with the columns
// the card itself carries instead of the full cadastro.
function buildFallbackSheet(sheet: import("exceljs").Worksheet, group: FiscalAlertGroup) {
  writeSheetHeader(sheet, group.title, `${group.description} · ${group.items.length} registro(s)`, FALLBACK_COLUMNS.length);
  sheet.columns = FALLBACK_COLUMNS.map(column => ({ key: column.key, width: column.width }));
  const headerRow = sheet.getRow(4);
  FALLBACK_COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
  });
  headerRow.commit();
  for (const item of group.items) {
    const row = sheet.addRow({ code: item.code, description: item.description, currentValue: item.currentValue, suggestedValue: item.suggestedValue, source: item.source, confidence: item.confidence });
    row.getCell(3).fill = ERROR_FILL;
    row.getCell(3).font = ERROR_FONT;
  }
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + group.items.length, column: FALLBACK_COLUMNS.length } };
}

export async function exportAlertsWorkbook(groups: FiscalAlertGroup[]) {
  // The cards on screen sample at most 100 rows per registration-style group so
  // the tab doesn't freeze — the export must not inherit that cap, so it pulls
  // the full, unsampled product list directly instead of reusing group.items.
  const registrationScan = await fiscalComplianceService.products();
  const workbook = await buildWorkbook(groups, registrationScan.items);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `alertas-fiscais-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
