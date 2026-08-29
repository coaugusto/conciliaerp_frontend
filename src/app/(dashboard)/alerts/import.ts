// Reads the multi-sheet workbook produced by exportAlertsWorkbook (export.ts) back
// in. Only the cadastro fields that live on a single MASTER_PRODUCTS_V1 record can
// be safely written back — see BULK_IMPORT_ALLOWED_FIELDS on the backend — so this
// intentionally ignores every other column (barcode, taxation-by-UF, etc.) even
// though they're present in the exported file for context.
const WRITABLE_HEADER_TO_FIELD: Record<string, string> = {
  "Descrição": "PRODUCT_DESCRIPTION",
  "Família": "FAMILY_DESCRIPTION",
  "NCM": "NCM",
  "CEST": "CEST",
  "CST PIS (cadastro)": "PIS_CST",
  "CST COFINS (cadastro)": "COFINS_CST",
  "CST IPI (cadastro)": "IPI_CST",
};
const PRODUCT_ID_HEADER = "Código do produto";

export type ImportedAlertsRow = { productId: string; payload: Record<string, unknown> };
export type ImportAlertsResult = { rows: ImportedAlertsRow[]; sheetsRead: string[]; sheetsSkipped: string[] };

export async function readAlertsWorkbook(file: File): Promise<ImportAlertsResult> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const merged = new Map<string, Record<string, unknown>>();
  const sheetsRead: string[] = [];
  const sheetsSkipped: string[] = [];

  for (const sheet of workbook.worksheets) {
    // The export always puts the header on row 4, but this searches a small
    // window by content instead of a fixed row number — tolerant of a user
    // inserting/removing rows above the table before re-uploading.
    let headerRowNumber = -1;
    let headerCells: string[] = [];
    for (let rowNumber = 1; rowNumber <= 10 && rowNumber <= sheet.rowCount; rowNumber++) {
      const values = sheet.getRow(rowNumber).values as unknown[];
      const texts = Array.isArray(values) ? values.map(value => String(value ?? "").trim()) : [];
      if (texts.includes(PRODUCT_ID_HEADER)) { headerRowNumber = rowNumber; headerCells = texts; break; }
    }
    if (headerRowNumber === -1) { sheetsSkipped.push(sheet.name); continue; }
    sheetsRead.push(sheet.name);
    const productIdCol = headerCells.indexOf(PRODUCT_ID_HEADER);
    const fieldByCol = new Map<number, string>();
    headerCells.forEach((header, col) => { const field = WRITABLE_HEADER_TO_FIELD[header]; if (field) fieldByCol.set(col, field); });

    for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const productId = String(row.getCell(productIdCol).value ?? "").trim();
      if (!productId) continue;
      const payload = merged.get(productId) ?? {};
      for (const [col, field] of fieldByCol) {
        const value = row.getCell(col).value;
        const text = value === null || value === undefined ? "" : String(value).trim();
        if (text) payload[field] = text;
      }
      merged.set(productId, payload);
    }
  }

  const rows = [...merged.entries()].map(([productId, payload]) => ({ productId, payload })).filter(row => Object.keys(row.payload).length > 0);
  return { rows, sheetsRead, sheetsSkipped };
}
