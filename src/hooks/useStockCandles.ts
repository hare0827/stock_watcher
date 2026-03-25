// src/hooks/useStockCandles.ts
import { useQuery } from '@tanstack/react-query';
import { fetchCandles } from '../api/finnhub';
import { Period } from '../types';

export function useStockCandles(ticker: string, period: Period) {
  return useQuery({
    queryKey: ['candles', ticker, period],
    queryFn: () => fetchCandles(ticker, period),
    staleTime: 900_000,   // 차트는 15분 캐시
    retry: 3,
  });
}
