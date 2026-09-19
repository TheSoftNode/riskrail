export function formatUsd(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return '—';
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Math.abs(number) < 1 ? 4 : 2,
  }).format(number);
}

export function formatBps(value?: number | null) {
  if (value === undefined || value === null) return '—';
  return `${(value / 100).toFixed(2)}%`;
}

export function formatHealth(value?: number | null) {
  if (value === undefined || value === null) return '—';
  return (value / 10_000).toFixed(2);
}

export function shorten(value?: string | null, left = 7, right = 5) {
  if (!value) return '—';
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}
