// src/hooks/useHoldingPnL.ts
import { useQuery, useQueries } from '@tanstack/react-query';
import { Holding } from '../types';
import { fetchCurrentExchangeRate, fetchHistoricalExchangeRate } from '../api/yahoo';

export interface HoldingPnLResult {
  totalPnL: number;
  pnlPercent: number;
  perHolding: { id: string; pnl: number }[];
  isLoading: boolean;
  isError: boolean;
  netShares: number;
}

export function useHoldingPnL(
  holdings: Holding[],
  currentPrice: number
): HoldingPnLResult {
  const empty: HoldingPnLResult = {
    totalPnL: 0, pnlPercent: 0, perHolding: [], isLoading: false, isError: false, netShares: 0,
  };

  const buys = holdings.filter((h) => (h.type ?? 'buy') === 'buy');
  const sells = holdings.filter((h) => h.type === 'sell');

  // 매수+매도 모두에서 USD 거래일 날짜 수집
  const usdTransactions = holdings.filter((h) => h.currency === 'USD');
  const hasUsd = usdTransactions.length > 0;
  const uniqueDates = [...new Set(usdTransactions.map((h) => h.purchaseDate))];

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

  // Guard placed here (after hook calls) to comply with Rules of Hooks —
  // hooks must not be called conditionally.
  if (holdings.length === 0) return empty;

  const isLoading = hasUsd && (fxNowLoading || historicalResults.some((r) => r.isLoading));
  const isError = hasUsd && (fxNowError || historicalResults.some((r) => r.isError));

  if (isLoading || isError) return { ...empty, isLoading, isError };

  // uniqueDates and historicalResults share the same index order —
  // do not reorder uniqueDates without updating historicalResults queries.
  const fxByDate: Record<string, number> = {};
  uniqueDates.forEach((date, i) => {
    const rate = historicalResults[i]?.data;
    if (rate != null) fxByDate[date] = rate;
  });

  let totalCost = 0;
  let totalCurrentValue = 0;
  let totalSellProceeds = 0;

  for (const h of buys) {
    if (h.currency === 'KRW') {
      totalCost += h.shares * h.pricePerShare;
      totalCurrentValue += h.shares * currentPrice;
    } else {
      const fxAtBuy = fxByDate[h.purchaseDate];
      if (fxAtBuy == null || fxNow == null) continue;
      totalCost += h.shares * h.pricePerShare * fxAtBuy;
      totalCurrentValue += h.shares * currentPrice * fxNow;
    }
  }

  for (const h of sells) {
    if (h.currency === 'KRW') {
      totalCurrentValue -= h.shares * currentPrice;
      totalSellProceeds += h.shares * h.pricePerShare;
    } else {
      const fxAtSell = fxByDate[h.purchaseDate];
      if (fxAtSell == null || fxNow == null) continue;
      totalCurrentValue -= h.shares * currentPrice * fxNow;
      totalSellProceeds += h.shares * h.pricePerShare * fxAtSell;
    }
  }

  const totalValue = totalCurrentValue + totalSellProceeds;
  const totalPnL = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // 매도 있으면 개별 row PnL 숨김 (avg cost 방식과 혼용 시 혼란 방지)
  const perHolding: { id: string; pnl: number }[] = [];
  if (sells.length === 0) {
    for (const h of buys) {
      if (h.currency === 'KRW') {
        perHolding.push({ id: h.id, pnl: h.shares * (currentPrice - h.pricePerShare) });
      } else {
        const fxAtBuy = fxByDate[h.purchaseDate];
        if (fxAtBuy == null || fxNow == null) continue;
        perHolding.push({
          id: h.id,
          pnl: h.shares * currentPrice * fxNow - h.shares * h.pricePerShare * fxAtBuy,
        });
      }
    }
  }

  const netShares = buys.reduce((s, h) => s + h.shares, 0)
                  - sells.reduce((s, h) => s + h.shares, 0);

  return { totalPnL, pnlPercent, perHolding, isLoading: false, isError: false, netShares };
}
