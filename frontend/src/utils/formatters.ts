/**
 * Formats Micro-USD (1 USD = 1,000,000 micro-USD) into clean human-readable representations.
 */
export function formatMicroUsd(microUsd: string | number | bigint | undefined | null): string {
  if (microUsd === undefined || microUsd === null) return '$0.00';
  const val = typeof microUsd === 'string' ? BigInt(microUsd) : BigInt(Math.floor(Number(microUsd)));
  const dollars = Number(val) / 1_000_000;
  
  if (val === 0n) return '$0.00';
  if (dollars < 0.01) {
    return `$${dollars.toFixed(4)}`;
  }
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

export function formatMicroUnits(microUsd: string | number | bigint | undefined | null): string {
  if (microUsd === undefined || microUsd === null) return '0 µUSD';
  const val = typeof microUsd === 'string' ? BigInt(microUsd) : BigInt(Math.floor(Number(microUsd)));
  return `${Number(val).toLocaleString()} µUSD`;
}

export function formatPriceDual(microUsd: string | number | bigint | undefined | null): string {
  return `${formatMicroUsd(microUsd)} (${formatMicroUnits(microUsd)})`;
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function formatDuration(ms: number | undefined | null): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function truncateText(text: string, maxLen = 80): string {
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}
