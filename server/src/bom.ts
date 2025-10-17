import { parse } from 'csv-parse/sync';

export type BomRow = {
  Reference: string;
  Value: string;
  Footprint: string;
  Qty?: string | number;
  Manufacturer_Part_Number?: string;
  [k: string]: unknown;
};

export function readBomFromText(text: string): BomRow[] {
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as BomRow[];
  return records;
}

function normalizeFootprint(fp: string | undefined): string {
  if (!fp) return '';
  return fp.toLowerCase().replace(/\s+/g, '');
}

export function is0805(fp: string | undefined): boolean {
  const n = normalizeFootprint(fp);
  return n.includes('0805') || n.includes('2012');
}

export function extractResistorValuesNoMPN(rows: BomRow[]): string[] {
  const vals = new Set<string>();
  for (const r of rows) {
    const hasMpn = String(r.Manufacturer_Part_Number || '').trim().length > 0;
    if (hasMpn) continue;
    if (!is0805(r.Footprint)) continue;
    const value = normalizeValue(String(r.Value || ''));
    if (value) vals.add(value);
  }
  return Array.from(vals);
}

export function normalizeValue(v: string): string {
  const s = v.trim().toLowerCase().replace(/ohm(s)?|Ω/g, '').replace(/\s+/g, '');
  if (!s) return '';
  const m = s.match(/^(\d*\.?\d*)([rkm]?)(\d*)$/);
  if (!m) return v;
  let [, intPart, suffix, fracPart] = m;
  if (suffix === 'r' && fracPart) {
    intPart = intPart || '0';
    const num = parseFloat(`${intPart}.${fracPart}`);
    return formatOhms(num);
  }
  let num = parseFloat(intPart || '0');
  if (fracPart) num += parseFloat(`0.${fracPart}`);
  const mult = suffix === 'k' ? 1e3 : suffix === 'm' ? 1e6 : 1;
  return formatOhms(num * mult);
}

function formatOhms(ohms: number): string {
  if (ohms >= 1e6) return `${trimZeros(ohms / 1e6)}M`;
  if (ohms >= 1e3) return `${trimZeros(ohms / 1e3)}k`;
  if (ohms < 1) return `${trimZeros(ohms)}R`;
  return `${trimZeros(ohms)}R`;
}

function trimZeros(n: number): string {
  return Number(n.toFixed(4)).toString();
}

