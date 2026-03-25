// src/types/index.ts

export interface Stock {
  name: string;    // 표시명 (예: "NVIDIA")
  ticker: string;  // 티커 (예: "NVDA", "005930.KS")
}

export interface AlertConfig {
  ticker: string;
  targetPrice: number;
  stopLossPrice: number;
  enabled: boolean;
}

export interface StockQuote {
  ticker: string;
  currentPrice: number;
  previousClose: number;
  change: number;        // 절대 변화
  changePercent: number; // % 변화
  timestamp: number;
}

export interface CandleData {
  date: string;     // ISO date string (YYYY-MM-DD)
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export type Period = '1M' | '3M' | '6M' | '1Y';

export type CardStatus = 'normal' | 'target' | 'stoploss';

export interface AlertEvent {
  stock: Stock;
  type: 'target' | 'stoploss';
  price: number;
}
