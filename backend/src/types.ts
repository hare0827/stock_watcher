export interface Holding {
  id: string;
  ticker: string;
  shares: number;
  pricePerShare: number;
  purchaseDate: string;
  currency: 'KRW' | 'USD';
  type: 'buy' | 'sell';
}
