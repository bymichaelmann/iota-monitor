/**
 * Format a bigint or numeric string value as a human-readable IOTA token amount.
 * 1 IOTA = 1_000_000_000 MIST (10^9)
 */
export function formatIota(value: string | bigint | number, decimals = 9): string {
  const val = typeof value === "bigint" ? value : BigInt(value);
  const divisor = BigInt(10 ** decimals);
  const whole = val / divisor;
  const fraction = val % divisor;
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  if (fractionStr.length === 0) return whole.toLocaleString("en-US");
  return `${whole.toLocaleString("en-US")}.${fractionStr}`;
}

/**
 * Format a bigint as MIST with suffix.
 */
export function formatGasPrice(value: string | bigint): string {
  const val = typeof value === "bigint" ? value : BigInt(value);
  return `${val.toLocaleString("en-US")} MIST`;
}

/**
 * Format a number with commas.
 */
export function formatNumber(value: number | string | bigint): string {
  if (typeof value === "bigint") return value.toLocaleString("en-US");
  return Number(value).toLocaleString("en-US");
}

/**
 * Format a timestamp (Unix ms or ISO string) to human-readable UTC string.
 */
export function formatTimestamp(timestamp: string | number | undefined): string {
  if (!timestamp) return "Unknown";
  const ts = typeof timestamp === "string" && isNaN(Number(timestamp))
    ? new Date(timestamp)
    : new Date(Number(timestamp));
  if (isNaN(ts.getTime())) return "Unknown";
  return ts.toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");
}

/**
 * Truncate a long address/digest for display.
 */
export function truncateAddress(address: string, prefixLen = 6, suffixLen = 4): string {
  if (address.length <= prefixLen + suffixLen + 3) return address;
  return `${address.slice(0, prefixLen)}...${address.slice(-suffixLen)}`;
}

/**
 * Format a commission rate from basis points to percentage.
 * e.g., 200 basis points = 2.00%
 */
export function formatCommission(rate: number | string): string {
  const r = typeof rate === "string" ? parseFloat(rate) : rate;
  return `${(r / 100).toFixed(2)}%`;
}

/**
 * Format APR from decimal to percentage.
 */
export function formatApr(apr: number | string): string {
  const r = typeof apr === "string" ? parseFloat(apr) : apr;
  return `${(r * 100).toFixed(2)}%`;
}
