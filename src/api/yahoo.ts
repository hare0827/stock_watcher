// src/api/yahoo.ts
import axios from 'axios';
import { StockQuote, CandleData, Period } from '../types';

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

const rangeMap: Record<Period, string> = {
  '1M': '1mo',
  '3M': '3mo',
  '6M': '6mo',
  '1Y': '1y',
};

async function fetchYahooChart(ticker: string, range: string): Promise<any> {
  const { data } = await axios.get(
    `${CHART_BASE}/${encodeURIComponent(ticker)}`,
    { params: { interval: '1d', range } }
  );
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo Finance: no data for ${ticker}`);
  return result;
}

export async function fetchQuoteFromYahoo(ticker: string): Promise<StockQuote> {
  const result = await fetchYahooChart(ticker, '5d');
  const meta = result.meta;
  const currentPrice: number = meta.regularMarketPrice ?? 0;
  const previousClose: number = meta.previousClose ?? meta.chartPreviousClose ?? 0;
  const change = currentPrice - previousClose;
  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
  return {
    ticker,
    currentPrice,
    previousClose,
    change,
    changePercent,
    timestamp: meta.regularMarketTime ?? Math.floor(Date.now() / 1000),
  };
}

export async function fetchCandlesFromYahoo(
  ticker: string,
  period: Period
): Promise<CandleData[]> {
  const result = await fetchYahooChart(ticker, rangeMap[period]);
  const timestamps: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0];
  if (!q || timestamps.length === 0) return [];

  const candles: CandleData[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (q.close[i] == null) continue; // 거래 없는 날 스킵
    candles.push({
      date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
      open: q.open[i] ?? 0,
      high: q.high[i] ?? 0,
      low: q.low[i] ?? 0,
      close: q.close[i],
      volume: q.volume[i] ?? 0,
    });
  }
  return candles;
}
