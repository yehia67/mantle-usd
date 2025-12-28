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

export function formatBigInt(value: string, decimals: number = 18, displayDecimals: number = 4): string {
  try {
    const num = BigInt(value);
    const divisor = BigInt(10 ** decimals);
    const whole = num / divisor;
    const remainder = num % divisor;
    const decimal = Number(remainder) / Number(divisor);
    return formatNumber(Number(whole) + decimal, displayDecimals);
  } catch {
    return '0';
  }
}

export function formatPercentage(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  return `${formatNumber(num * 100, 2)}%`;
}
