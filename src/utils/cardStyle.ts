import { CardStatus } from '../types';

export function getCardStatus(
  currentPrice: number,
  targetPrice: number,
  stopLossPrice: number
): CardStatus {
  if (currentPrice >= targetPrice) return 'target';
  if (currentPrice <= stopLossPrice) return 'stoploss';
  return 'normal';
}

interface CardColors {
  border: string;
  background: string;
  gradient: [string, string] | null;
}

export function getCardColors(status: CardStatus): CardColors {
  switch (status) {
    case 'target':
      return { border: '#FF1744', background: '#2b0d0d', gradient: ['#2b0d0d', '#3d1010'] };
    case 'stoploss':
      return { border: '#2979FF', background: '#0d1a2b', gradient: ['#0d1a2b', '#0f2540'] };
    default:
      return { border: '#1c1f33', background: '#1c1f33', gradient: null };
  }
}
