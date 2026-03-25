import { useQuery, useQueries } from '@tanstack/react-query';
import { Holding } from '../types';
import { fetchCurrentExchangeRate, fetchHistoricalExchangeRate } from '../api/yahoo';

export interface HoldingPnLResult {
  totalPnL: number;       // 원화 기준 총 손익
  pnlPercent: number;     // 수익률 (%)
  perHolding: { id: string; pnl: number }[]; // 매수건별 손익 (원화)
  isLoading: boolean;
  isError: boolean;
}

export function useHoldingPnL(
  holdings: Holding[],
  currentPrice: number
): HoldingPnLResult {
  const empty: HoldingPnLResult = {
    totalPnL: 0, pnlPercent: 0, perHolding: [], isLoading: false, isError: false,
  };

  const usdHoldings = holdings.filter((h) => h.currency === 'USD');
  const hasUsd = usdHoldings.length > 0;
  const uniqueDates = [...new Set(usdHoldings.map((h) => h.purchaseDate))];

  const { data: fxNow, isLoading: fxNowLoading, isError: fxNowError } = useQuery({
    queryKey: ['fx', 'now'] as const,
    queryFn: fetchCurrentExchangeRate,
    staleTime: 60_000,
    enabled: hasUsd,
  });

  const historicalResults = useQueries({
    queries: uniqueDates.map((date) => ({
      queryKey: ['fx', date] as const,
      queryFn: () => fetchHistoricalExchangeRate(date),
      staleTime: Infinity,
      enabled: hasUsd,
    })),
  });

  if (holdings.length === 0) return empty;

  const isLoading = hasUsd && (fxNowLoading || historicalResults.some((r) => r.isLoading));
  const isError = hasUsd && (fxNowError || historicalResults.some((r) => r.isError));

  if (isLoading || isError) return { ...empty, isLoading, isError };

  // 날짜 → 환율 맵 구성
  const fxByDate: Record<string, number> = {};
  uniqueDates.forEach((date, i) => {
    const rate = historicalResults[i]?.data;
    if (rate != null) fxByDate[date] = rate;
  });

  let totalCost = 0;
  let totalValue = 0;
  const perHolding: { id: string; pnl: number }[] = [];

  for (const h of holdings) {
    let cost: number;
    let value: number;

    if (h.currency === 'KRW') {
      cost = h.shares * h.pricePerShare;
      value = h.shares * currentPrice;
    } else {
      const fxAtPurchase = fxByDate[h.purchaseDate];
      if (fxAtPurchase == null || fxNow == null) continue;
      cost = h.shares * h.pricePerShare * fxAtPurchase;
      value = h.shares * currentPrice * fxNow;
    }

    totalCost += cost;
    totalValue += value;
    perHolding.push({ id: h.id, pnl: value - cost });
  }

  const totalPnL = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  return { totalPnL, pnlPercent, perHolding, isLoading: false, isError: false };
}
