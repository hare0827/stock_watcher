// src/api/finnhub.ts
import { apiClient } from './client';
import { fetchQuoteFromYahoo, fetchCandlesFromYahoo } from './yahoo';
import { StockQuote, CandleData, Period } from '../types';
import { isKoreanStock } from '../utils/format';

export async function fetchQuote(ticker: string): Promise<StockQuote> {
  // Finnhub 무료 플랜은 한국 주식 미지원 → Yahoo Finance 사용
  if (isKoreanStock(ticker)) {
    return fetchQuoteFromYahoo(ticker);
  }
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
  // Finnhub 무료 플랜은 candle API 미지원 → Yahoo Finance 사용
  return fetchCandlesFromYahoo(ticker, period);
}
