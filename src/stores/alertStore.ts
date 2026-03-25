import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AlertPayload = { targetPrice: number; stopLossPrice: number; enabled: boolean };
// Set 대신 Record 사용 — Zustand 직렬화 안전
type AlertedFlags = Record<string, { target: boolean; stoploss: boolean }>;

interface AlertState {
  alerts: Record<string, AlertPayload>;
  alerted: AlertedFlags;
  getAlert: (ticker: string) => AlertPayload | undefined;
  setAlert: (ticker: string, payload: AlertPayload) => Promise<void>;
  removeAlert: (ticker: string) => void;
  hydrateAlert: (ticker: string) => Promise<void>;
  markAlerted: (ticker: string, type: 'target' | 'stoploss') => void;
  wasAlerted: (ticker: string, type: 'target' | 'stoploss') => boolean;
  clearAlerted: (ticker: string) => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: {},
  alerted: {},

  getAlert: (ticker) => get().alerts[ticker],

  setAlert: async (ticker, payload) => {
    const next = { ...get().alerts, [ticker]: payload };
    set({ alerts: next });
    await AsyncStorage.setItem(`@alerts:${ticker}`, JSON.stringify(payload));
  },

  removeAlert: (ticker) => {
    const { [ticker]: _, ...rest } = get().alerts;
    set({ alerts: rest });
    AsyncStorage.removeItem(`@alerts:${ticker}`);
    AsyncStorage.removeItem(`@alert_enabled:${ticker}`);
  },

  hydrateAlert: async (ticker) => {
    try {
      const raw = await AsyncStorage.getItem(`@alerts:${ticker}`);
      if (!raw) return;
      const payload = JSON.parse(raw) as AlertPayload;
      set((s) => ({ alerts: { ...s.alerts, [ticker]: payload } }));
    } catch { /* 무시 */ }
  },

  markAlerted: (ticker, type) => {
    set((s) => ({
      alerted: {
        ...s.alerted,
        [ticker]: { ...(s.alerted[ticker] ?? { target: false, stoploss: false }), [type]: true },
      },
    }));
  },

  wasAlerted: (ticker, type) => get().alerted[ticker]?.[type] ?? false,

  clearAlerted: (ticker) => {
    set((s) => ({
      alerted: { ...s.alerted, [ticker]: { target: false, stoploss: false } },
    }));
  },
}));
