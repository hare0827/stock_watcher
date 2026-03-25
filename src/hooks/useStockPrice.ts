// src/hooks/useStockPrice.ts
import { useQuery } from '@tanstack/react-query';
import { fetchQuote } from '../api/finnhub';
import { StockQuote } from '../types';

export function useStockPrice(ticker: string) {
  return useQuery<StockQuote>({
    queryKey: ['quote', ticker],
    queryFn: () => fetchQuote(ticker),
    staleTime: 60_000,          // 1분 — 알림 실시간성
    gcTime: 900_000,            // 15분 캐시 보존
    retry: 3,
    refetchOnWindowFocus: true,
    enabled: !!ticker,
  });
}
