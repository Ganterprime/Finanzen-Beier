import type { Frequency, Period } from './types';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

export const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export function formatEuro(cents: number): string {
  return euro.format(cents / 100);
}

export function formatPercent(ratio: number): string {
  return Number.isFinite(ratio) ? percent.format(ratio) : '–';
}

/** "12,50" / "12.50" / "1.234,56" → 1250 / 123456 Cent; ungültig → null */
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/\s|€/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return cents > 0 ? cents : null;
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Erster und letzter Tag des Zeitraums als ISO-Datum */
export function periodRange(p: Period): { from: string; to: string } {
  if (p.month == null) return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
  const last = new Date(p.year, p.month, 0).getDate();
  const mm = String(p.month).padStart(2, '0');
  return { from: `${p.year}-${mm}-01`, to: `${p.year}-${mm}-${last}` };
}

export function previousPeriod(p: Period): Period {
  if (p.month == null) return { year: p.year - 1, month: null };
  return p.month === 1 ? { year: p.year - 1, month: 12 } : { year: p.year, month: p.month - 1 };
}

export function periodLabel(p: Period): string {
  return p.month == null ? `${p.year}` : `${MONTHS[p.month - 1]} ${p.year}`;
}

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  monatlich: 'monatlich',
  quartalsweise: 'quartalsweise',
  halbjaehrlich: 'halbjährlich',
  jaehrlich: 'jährlich',
};

const FREQUENCY_MONTHS: Record<Frequency, number> = {
  monatlich: 1,
  quartalsweise: 3,
  halbjaehrlich: 6,
  jaehrlich: 12,
};

/** Fixkosten auf einen Monat umgerechnet */
export function monthlyCents(amountCents: number, f: Frequency): number {
  return Math.round(amountCents / FREQUENCY_MONTHS[f]);
}
