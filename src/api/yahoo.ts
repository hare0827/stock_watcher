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

// 특정일 종가 조회 (주식)
// 주말/공휴일이면 해당일 이전 가장 가까운 영업일 종가 반환
export async function fetchHistoricalStockPrice(ticker: string, date: string): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date} (expected YYYY-MM-DD)`);
  }
  const result = await fetchYahooChart(ticker, '5y');
  const timestamps: number[] = result.timestamp ?? [];
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

  const targetMs = new Date(date).getTime() + 86400000;

  let bestIdx = -1;
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    if (timestamps[i] * 1000 <= targetMs) {
      bestIdx = i;
    } else {
      break;
    }
  }

  if (bestIdx === -1) throw new Error(`가격 데이터 없음: ${date}`);
  return closes[bestIdx];
}

// 현재 USD→KRW 환율 (실시간)
export async function fetchCurrentExchangeRate(): Promise<number> {
  const result = await fetchYahooChart('KRW=X', '5d');
  const rate = result.meta.regularMarketPrice as number;
  if (!rate) throw new Error('환율 데이터 없음');
  return rate;
}

// 특정일 USD→KRW 환율 (과거)
// 주말/공휴일이면 해당일 이전 가장 가까운 영업일 환율 반환
export async function fetchHistoricalExchangeRate(date: string): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date} (expected YYYY-MM-DD)`);
  }
  const result = await fetchYahooChart('KRW=X', '5y');
  const timestamps: number[] = result.timestamp ?? [];
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

  const targetMs = new Date(date).getTime() + 86400000; // 해당일 자정 + 하루 여유

  let bestIdx = -1;
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    if (timestamps[i] * 1000 <= targetMs) {
      bestIdx = i;
    } else {
      break;
    }
  }

  if (bestIdx === -1) throw new Error(`환율 데이터 없음: ${date}`);
  return closes[bestIdx];
}
