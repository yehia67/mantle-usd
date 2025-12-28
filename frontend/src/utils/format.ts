export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatNumber(value: string | number, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

export function formatPercentage(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  return `${formatNumber(num * 100, 2)}%`;
}

// Re-export formatting functions from decimals.ts for convenience
export { formatMUSD, formatToken, formatAmount } from './decimals';
