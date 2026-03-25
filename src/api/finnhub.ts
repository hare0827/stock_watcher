// src/api/finnhub.ts
import { apiClient } from './client';
import { StockQuote, CandleData, Period } from '../types';

// 기간 → Unix timestamp 변환
function periodToUnix(period: Period): { from: number; to: number } {
  const to = Math.floor(Date.now() / 1000);
  const days: Record<Period, number> = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
  const from = to - days[period] * 24 * 60 * 60;
  return { from, to };
}

export async function fetchQuote(ticker: string): Promise<StockQuote> {
  const { data } = await apiClient.get('/quote', { params: { symbol: ticker } });
  // Finnhub 응답: { c: current, pc: prevClose, d: change, dp: changePercent, t: timestamp }
  return {
    ticker,
    currentPrice: data.c ?? 0,
    previousClose: data.pc ?? 0,
    change: data.d ?? 0,
    changePercent: data.dp ?? 0,
    timestamp: data.t ?? Math.floor(Date.now() / 1000),
  };
}

export async function fetchCandles(
  ticker: string,
  period: Period
): Promise<CandleData[]> {
  const { from, to } = periodToUnix(period);
  const { data } = await apiClient.get('/stock/candle', {
    params: { symbol: ticker, resolution: 'D', from, to },
  });

  if (data.s !== 'ok' || !data.t) return [];

  // 최대 252포인트 다운샘플링 — 단일 패스로 인덱스 오류 방지
  const points = data.t.length;
  const step = points > 252 ? Math.ceil(points / 252) : 1;
  const result: CandleData[] = [];

  for (let i = 0; i < points; i += step) {
    result.push({
      date: new Date(data.t[i] * 1000).toISOString().split('T')[0],
      close: data.c[i],
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      volume: data.v[i],
    });
  }
  return result;
}
