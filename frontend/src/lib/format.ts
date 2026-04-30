/*
 * Workspace-aware formatters.
 * Each helper takes the active workspace as input — never reads a global.
 * Multi-tenant correctness: a workspace declares its own currency, region,
 * and timezone, and the UI must respect them.
 */
import type { Workspace } from '@/types';

const CURRENCY_LOCALE: Record<Workspace['currency'], string> = {
  INR: 'en-IN',
  AED: 'en-AE',
  USD: 'en-US',
};

const CURRENCY_SYMBOL: Record<Workspace['currency'], string> = {
  INR: '₹',
  AED: 'د.إ',
  USD: '$',
};

export function formatMoney(amount: number, ws: Workspace, opts: { compact?: boolean } = {}): string {
  if (opts.compact && ws.currency === 'INR') {
    if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(1)}Cr`;
    if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(1)}L`;
    if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(0)}K`;
  }
  if (opts.compact) {
    if (amount >= 1_000_000) return `${CURRENCY_SYMBOL[ws.currency]}${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `${CURRENCY_SYMBOL[ws.currency]}${(amount / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat(CURRENCY_LOCALE[ws.currency], {
    style: 'currency',
    currency: ws.currency,
    maximumFractionDigits: amount < 100 ? 2 : 0,
  }).format(amount);
}

export function formatNumber(value: number, ws: Workspace): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE[ws.currency]).format(value);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatPhone(e164: string): string {
  // Indian format: +91 XXXXX XXXXX
  if (e164.startsWith('+91') && e164.length === 13) {
    return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
  }
  return e164;
}

export function formatDateTime(iso: string, ws: Workspace): string {
  return new Intl.DateTimeFormat(CURRENCY_LOCALE[ws.currency], {
    timeZone: ws.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function formatDate(iso: string, ws: Workspace): string {
  return new Intl.DateTimeFormat(CURRENCY_LOCALE[ws.currency], {
    timeZone: ws.timezone,
    dateStyle: 'medium',
  }).format(new Date(iso));
}

export function formatTime(iso: string, ws: Workspace): string {
  return new Intl.DateTimeFormat(CURRENCY_LOCALE[ws.currency], {
    timeZone: ws.timezone,
    timeStyle: 'short',
  }).format(new Date(iso));
}

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatRelative(iso: string, now: Date = new Date()): string {
  const target = new Date(iso).getTime();
  const diffMs = target - now.getTime();
  const abs = Math.abs(diffMs);
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (abs < min) return RTF.format(Math.round(diffMs / 1_000), 'second');
  if (abs < hr) return RTF.format(Math.round(diffMs / min), 'minute');
  if (abs < day) return RTF.format(Math.round(diffMs / hr), 'hour');
  if (abs < 30 * day) return RTF.format(Math.round(diffMs / day), 'day');
  return RTF.format(Math.round(diffMs / (30 * day)), 'month');
}
