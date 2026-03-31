import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { testConnection as apiTestConnection, fetchBalance, KisHolding } from '../api/kis';
import { useHoldingsStore } from './holdingsStore';
import { useStocksStore } from './stocksStore';

const BACKEND_URL_KEY = '@kis_backend_url';

interface KisState {
  backendUrl: string | null;
  isConnected: boolean;
  setBackendUrl: (url: string) => Promise<void>;
  hydrate: () => Promise<void>;
  testConnection: () => Promise<boolean>;
  syncBalance: () => Promise<void>;
  reset: () => void;
}

export const useKisStore = create<KisState>((set, get) => ({
  backendUrl: null,
  isConnected: false,

  setBackendUrl: async (url) => {
    set({ backendUrl: url });
    await AsyncStorage.setItem(BACKEND_URL_KEY, url);
  },

  hydrate: async () => {
    const url = await AsyncStorage.getItem(BACKEND_URL_KEY);
    if (url) {
      set({ backendUrl: url });
      const ok = await apiTestConnection(url);
      set({ isConnected: ok });
    }
  },

  testConnection: async () => {
    const { backendUrl } = get();
    if (!backendUrl) return false;
    const ok = await apiTestConnection(backendUrl);
    set({ isConnected: ok });
    return ok;
  },

  syncBalance: async () => {
    const { backendUrl, isConnected } = get();
    if (!backendUrl || !isConnected) return;
    try {
      const holdings = await fetchBalance(backendUrl);

      // KIS 종목 중 관심종목에 없는 것 자동 추가
      const stocksStore = useStocksStore.getState();
      const kisTickers = [...new Set(holdings.map((h) => h.ticker))];
      for (const h of holdings as KisHolding[]) {
        if (!stocksStore.stocks.some((s) => s.ticker === h.ticker)) {
          try {
            stocksStore.addStock({ name: h.name ?? h.ticker, ticker: h.ticker });
          } catch {
            // 이미 존재하거나 최대 개수 초과 시 무시
          }
        }
      }

      const holdingsStore = useHoldingsStore.getState();
      const existingTickers = Object.keys(useHoldingsStore.getState().holdings);
      existingTickers.forEach((t) => holdingsStore.clearHoldings(t));
      holdings.forEach((h) => holdingsStore.addHolding(h));
    } catch {
      // 동기화 실패 시 기존 내역 유지
    }
  },

  reset: () => set({ backendUrl: null, isConnected: false }),
}));
