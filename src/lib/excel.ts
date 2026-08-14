import * as XLSX from 'xlsx';

// The inventory columns (§3.3). Order defines the template; parsing matches on header text so a
// reordered sheet still works.
export const COLUMNS = [
  'Unit number',
  'Layout code',
  'Floor',
  'Size (sqft)',
  'View',
  'Price (AED)',
  'Payment plan',
  'Handover',
  'Status',
] as const;

export type ParsedRow = {
  row: number; // 1-based spreadsheet row (incl. header) for error messages
  unitNumber: string;
  layoutCode: string;
  floor: number | null;
  sizeSqft: number | null;
  view: string | null;
  priceAed: number | null;
  paymentPlanName: string | null;
  handover: string | null;
  status: string | null;
};

export const UNIT_STATUSES = ['AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED'] as const;

// A downloadable .xlsx template: an Instructions sheet + an Inventory sheet with headers and one
// example row, so RMs fill in the right shape.
export function buildTemplate(): Buffer {
  const wb = XLSX.utils.book_new();

  const example = ['1001', '1BR-A', 10, 750, 'Marina', 1450000, '60/40 Standard', 'Q4 2027', 'Available'];
  const inv = XLSX.utils.aoa_to_sheet([COLUMNS as unknown as string[], example]);
  inv['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(12, c.length + 2) }));
  XLSX.utils.book_append_sheet(wb, inv, 'Inventory');

  const notes = XLSX.utils.aoa_to_sheet([
    ['How to fill this in'],
    [''],
    ['Unit number', 'Required. Must be unique within the project (e.g. 1001).'],
    ['Layout code', 'Required. The typology code (e.g. 1BR-A). It links the unit to its floor plan.'],
    ['Floor', 'Optional whole number.'],
    ['Size (sqft)', 'Optional whole number.'],
    ['View', 'Optional (e.g. Marina, Community).'],
    ['Price (AED)', 'Required. Numbers only, no commas or "AED".'],
    ['Payment plan', 'Optional. Must exactly match a payment plan you created in the app.'],
    ['Handover', 'Optional (e.g. Q4 2027).'],
    ['Status', 'Optional. One of: Available, Reserved, Sold, Blocked. Defaults to Available.'],
    [''],
    ['Re-uploading', 'Upload again anytime to update price/status — units are matched on Unit number, not duplicated.'],
  ]);
  notes['!cols'] = [{ wch: 16 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, notes, 'Instructions');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

const toInt = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.trunc(Number(String(v).replace(/[^0-9.-]/g, '')));
  return Number.isFinite(n) ? n : null;
};
const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

// Parse the uploaded workbook's first sheet into rows, matching columns by header name so column
// order / extra columns don't break it.
export function parseInventory(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets['Inventory'] || wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
  if (!grid.length) return [];

  const header = (grid[0] as unknown[]).map((h) => str(h).toLowerCase());
  const find = (...aliases: string[]) => header.findIndex((h) => aliases.some((a) => h.includes(a)));
  const col = {
    unitNumber: find('unit number', 'unit no', 'unit#', 'unit'),
    layoutCode: find('layout', 'type', 'typology'),
    floor: find('floor'),
    size: find('size', 'sqft', 'area'),
    view: find('view'),
    price: find('price'),
    plan: find('payment plan', 'plan'),
    handover: find('handover'),
    status: find('status'),
  };

  const out: ParsedRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const row = (grid[r] as unknown[]) || [];
    const at = (i: number) => (i >= 0 ? row[i] : '');
    const unitNumber = str(at(col.unitNumber));
    const layoutCode = str(at(col.layoutCode));
    const price = toNum(at(col.price));
    // Skip fully-empty lines.
    if (!unitNumber && !layoutCode && price === null) continue;
    out.push({
      row: r + 1,
      unitNumber,
      layoutCode,
      floor: toInt(at(col.floor)),
      sizeSqft: toInt(at(col.size)),
      view: str(at(col.view)) || null,
      priceAed: price,
      paymentPlanName: str(at(col.plan)) || null,
      handover: str(at(col.handover)) || null,
      status: str(at(col.status)) || null,
    });
  }
  return out;
}

export function normalizeStatus(s: string | null): string | null {
  if (!s) return null;
  const up = s.trim().toUpperCase();
  return (UNIT_STATUSES as readonly string[]).includes(up) ? up : 'INVALID';
}
