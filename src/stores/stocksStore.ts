import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stock } from '../types';
import { useAlertStore } from './alertStore';
import { useHoldingsStore } from './holdingsStore';

const STORAGE_KEY = '@stocks';
const MAX_STOCKS = 20;

const DEFAULT_STOCKS: Stock[] = [
  { name: 'NVIDIA', ticker: 'NVDA' },
  { name: '삼성전자', ticker: '005930.KS' },
  { name: '테슬라', ticker: 'TSLA' },
  { name: 'SK하이닉스', ticker: '000660.KS' },
];

interface StocksState {
  stocks: Stock[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addStock: (stock: Stock) => void;
  removeStock: (ticker: string) => void;
}

export const useStocksStore = create<StocksState>((set, get) => ({
  stocks: DEFAULT_STOCKS,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const stocks = raw ? JSON.parse(raw) : DEFAULT_STOCKS;
      set({ stocks, hydrated: true });
    } catch {
      set({ stocks: DEFAULT_STOCKS, hydrated: true });
    }
  },

  addStock: (stock: Stock) => {
    const { stocks } = get();
    if (stocks.length >= MAX_STOCKS) throw new Error('종목은 최대 20개까지 등록 가능합니다.');
    if (stocks.some((s) => s.ticker === stock.ticker)) throw new Error('이미 등록된 티커입니다.');
    if (stocks.some((s) => s.name === stock.name)) throw new Error('이미 등록된 표시명입니다.');
    const next = [...stocks, stock];
    set({ stocks: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  removeStock: (ticker: string) => {
    const next = get().stocks.filter((s) => s.ticker !== ticker);
    set({ stocks: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // AsyncStorage 고아 레코드 정리
    AsyncStorage.removeItem(`@alerts:${ticker}`);
    AsyncStorage.removeItem(`@alert_enabled:${ticker}`);
    // alertStore in-memory 상태 정리
    useAlertStore.getState().removeAlert(ticker);
    // holdingsStore 정리
    useHoldingsStore.getState().clearHoldings(ticker);
  },
}));
