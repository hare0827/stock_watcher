// src/hooks/usePortfolioSummary.ts
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { useStocksStore } from '../stores/stocksStore';
import { useHoldingsStore } from '../stores/holdingsStore';
import { fetchCurrentExchangeRate, fetchHistoricalExchangeRate } from '../api/yahoo';
import { StockQuote } from '../types';

const COLORS = ['#5b9bd5', '#c8caff', '#ff6b6b', '#ffd93d', '#6bcfb5', '#f4a261'];

export interface PortfolioSegment {
  ticker: string;
  name: string;
  color: string;
  weight: number;
}

export interface PortfolioSummary {
  totalPnL: number;
  pnlPercent: number;
  isLoading: boolean;
  isError: boolean;
  segments: PortfolioSegment[];
}

export function usePortfolioSummary(): PortfolioSummary | null {
  const { stocks } = useStocksStore();
  const { getHoldings } = useHoldingsStore();
  const queryClient = useQueryClient();

  const allHoldings = stocks.flatMap((s) => getHoldings(s.ticker));
  // 매수+매도 모두에서 USD 날짜 수집
  const usdTransactions = allHoldings.filter((h) => h.currency === 'USD');
  const hasUsd = usdTransactions.length > 0;
  // uniqueDates and historicalResults share the same index order —
  // do not reorder uniqueDates without updating historicalResults queries.
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
  if (allHoldings.length === 0) return null;

  const isLoading = hasUsd && (fxNowLoading || historicalResults.some((r) => r.isLoading));
  const isError = hasUsd && (fxNowError || historicalResults.some((r) => r.isError));

  if (isLoading || isError) {
    return { totalPnL: 0, pnlPercent: 0, isLoading, isError, segments: [] };
  }

  const fxByDate: Record<string, number> = {};
  uniqueDates.forEach((date, i) => {
    const rate = historicalResults[i]?.data;
    if (rate != null) fxByDate[date] = rate;
  });

  let totalCost = 0;
  let totalPnLValue = 0;     // PnL용: net currentValue + sellProceeds
  let totalCurrentValue = 0; // 비중 바용: net current position만

  const rawSegments = stocks.map((stock, idx) => {
    const holdings = getHoldings(stock.ticker);
    const quote = queryClient.getQueryData<StockQuote>(['quote', stock.ticker]);
    const currentPrice = quote?.currentPrice ?? 0;

    // type ?? 'buy': backward compat — existing stored data has no type field, treated as buy
    const buys = holdings.filter((h) => (h.type ?? 'buy') === 'buy');
    const sells = holdings.filter((h) => h.type === 'sell');

    let stockCost = 0;
    let stockCurrentValue = 0;
    let stockSellProceeds = 0;

    for (const h of buys) {
      if (h.currency === 'KRW') {
        stockCost += h.shares * h.pricePerShare;
        stockCurrentValue += h.shares * currentPrice;
      } else {
        const fx = fxByDate[h.purchaseDate];
        if (fx == null || fxNow == null) continue;
        stockCost += h.shares * h.pricePerShare * fx;
        stockCurrentValue += h.shares * currentPrice * fxNow;
      }
    }

    for (const h of sells) {
      if (h.currency === 'KRW') {
        stockCurrentValue -= h.shares * currentPrice;
        stockSellProceeds += h.shares * h.pricePerShare;
      } else {
        const fx = fxByDate[h.purchaseDate];
        if (fx == null || fxNow == null) continue;
        stockCurrentValue -= h.shares * currentPrice * fxNow;
        stockSellProceeds += h.shares * h.pricePerShare * fx;
      }
    }

    totalCost += stockCost;
    totalPnLValue += stockCurrentValue + stockSellProceeds;
    totalCurrentValue += stockCurrentValue;

    return { ticker: stock.ticker, name: stock.name, value: stockCurrentValue, color: COLORS[idx % COLORS.length] };
  }).filter((s) => s.value > 0);

  const totalPnL = totalPnLValue - totalCost;
  const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const segments: PortfolioSegment[] = rawSegments.map((s) => ({
    ticker: s.ticker,
    name: s.name,
    color: s.color,
    weight: totalCurrentValue > 0 ? s.value / totalCurrentValue : 0,
  }));

  return { totalPnL, pnlPercent, isLoading: false, isError: false, segments };
}
