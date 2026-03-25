export function isKoreanStock(ticker: string): boolean {
  return ticker.endsWith('.KS') || ticker.endsWith('.KQ');
}

export function formatPrice(value: number, ticker: string): string {
  if (isKoreanStock(ticker)) {
    return value.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCurrency(value: number, ticker: string): string {
  const symbol = isKoreanStock(ticker) ? '₩' : '$';
  return `${symbol}${formatPrice(value, ticker)}`;
}

export function formatChangeSign(change: number): string {
  if (change > 0) return '▲';
  if (change < 0) return '▼';
  return '─';
}
