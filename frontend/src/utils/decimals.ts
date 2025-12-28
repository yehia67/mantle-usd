import { parseUnits, formatUnits } from 'ethers';

// Token decimals constants
export const MUSD_DECIMALS = 6;
export const METH_DECIMALS = 18;
export const RWA_DECIMALS = 18;

/**
 * Parse amount from user input string to wei with specified decimals
 */
export function parseAmount(amount: string, decimals: number = 18): bigint {
  return parseUnits(amount, decimals);
}

/**
 * Format amount from wei to user-readable string with specified decimals
 */
export function formatAmount(amount: bigint | string, decimals: number = 18, displayDecimals: number = 4): string {
  try {
    const formatted = formatUnits(amount.toString(), decimals);
    const num = parseFloat(formatted);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: Math.min(displayDecimals, 2),
      maximumFractionDigits: displayDecimals 
    });
  } catch {
    return '0';
  }
}

// Convenience helpers
export const parseMUSD = (amount: string) => parseAmount(amount, MUSD_DECIMALS);
export const parseToken = (amount: string) => parseAmount(amount, METH_DECIMALS);
export const formatMUSD = (amount: bigint | string, displayDecimals: number = 2) => 
  formatAmount(amount, MUSD_DECIMALS, displayDecimals);
export const formatToken = (amount: bigint | string, displayDecimals: number = 4) => 
  formatAmount(amount, METH_DECIMALS, displayDecimals);
