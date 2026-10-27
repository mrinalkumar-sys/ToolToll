/**
 * Invariant 3: Money is stored as integers in minor units: micro-USD (1 USD = 1,000,000 units) stored as BigInt.
 * Absolutely NO floats anywhere in money paths.
 */

export const MICRO_USD_PER_USD = 1_000_000n;
export const BPS_DIVISOR = 10_000n; // 10,000 Basis Points = 100%

/**
 * Convert integer cents or dollar string to micro-USD BigInt safely
 */
export function dollarsToMicroUsd(dollarsStr: string | number): bigint {
  const str = typeof dollarsStr === 'number' ? dollarsStr.toFixed(6) : dollarsStr.trim();
  const parts = str.split('.');
  const wholePart = BigInt(parts[0] || '0') * MICRO_USD_PER_USD;
  
  if (parts.length === 1) {
    return wholePart;
  }
  
  // Pad or truncate fraction to 6 decimal places (micro-USD)
  const fracStr = (parts[1] || '').padEnd(6, '0').slice(0, 6);
  const fracPart = BigInt(fracStr);
  return wholePart >= 0n ? wholePart + fracPart : wholePart - fracPart;
}

/**
 * Convert micro-USD BigInt to USD string representation (for display only)
 */
export function microUsdToDollars(microUsd: bigint): string {
  const isNegative = microUsd < 0n;
  const absVal = isNegative ? -microUsd : microUsd;
  const whole = absVal / MICRO_USD_PER_USD;
  const frac = absVal % MICRO_USD_PER_USD;
  const formattedFrac = frac.toString().padStart(6, '0');
  const sign = isNegative ? '-' : '';
  return `${sign}${whole}.${formattedFrac}`;
}

/**
 * Format micro-USD for human UI display (e.g., "$0.0050" or "$1.25")
 */
export function formatMicroUsd(microUsd: bigint, decimalPlaces: number = 4): string {
  const dollars = microUsdToDollars(microUsd);
  const num = parseFloat(dollars);
  return `$${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimalPlaces,
  })}`;
}

/**
 * Calculate platform fee using basis points integer arithmetic
 * Fee = (grossMicroUsd * feeBps) / 10000
 */
export function calculatePlatformFee(grossMicroUsd: bigint, feeBps: number): {
  platformFeeMicroUsd: bigint;
  creatorEarningsMicroUsd: bigint;
} {
  const bpsBigInt = BigInt(feeBps);
  const platformFeeMicroUsd = (grossMicroUsd * bpsBigInt) / BPS_DIVISOR;
  const creatorEarningsMicroUsd = grossMicroUsd - platformFeeMicroUsd;
  return { platformFeeMicroUsd, creatorEarningsMicroUsd };
}
