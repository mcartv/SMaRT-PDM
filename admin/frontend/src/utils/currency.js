const pesoNumberFormat = new Intl.NumberFormat('en-US', {
  useGrouping: true,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatPeso(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return `${amount < 0 ? '-' : ''}₱${pesoNumberFormat.format(Math.abs(amount))}`;
}
