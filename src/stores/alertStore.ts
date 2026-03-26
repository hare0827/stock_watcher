import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AlertConfig } from '../types';

type AlertPayload = Omit<AlertConfig, 'ticker'>;
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
  migrateAlert: (oldTicker: string, newTicker: string) => Promise<void>;
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

  migrateAlert: async (oldTicker, newTicker) => {
    if (oldTicker === newTicker) return;

    try {
      // AsyncStorage 키 이전 (write 먼저, delete 나중)
      const [alertsRaw, enabledRaw] = await Promise.all([
        AsyncStorage.getItem(`@alerts:${oldTicker}`),
        AsyncStorage.getItem(`@alert_enabled:${oldTicker}`),
      ]);
      await Promise.all([
        alertsRaw
          ? AsyncStorage.setItem(`@alerts:${newTicker}`, alertsRaw)
          : Promise.resolve(),
        enabledRaw
          ? AsyncStorage.setItem(`@alert_enabled:${newTicker}`, enabledRaw)
          : Promise.resolve(),
      ]);
      await Promise.all([
        AsyncStorage.removeItem(`@alerts:${oldTicker}`),
        AsyncStorage.removeItem(`@alert_enabled:${oldTicker}`),
      ]);
    } catch { /* AsyncStorage 실패 시 무시 */ }

    // in-memory 상태 이전 (alerts와 alerted 독립적으로 처리)
    const { alerts, alerted } = get();
    const payload = alerts[oldTicker];
    const { [oldTicker]: _a, ...restAlerts } = alerts;
    const { [oldTicker]: oldAlerted, ...restAlerted } = alerted;

    set({
      alerts: payload
        ? { ...restAlerts, [newTicker]: payload }
        : restAlerts,
      alerted: oldAlerted
        ? { ...restAlerted, [newTicker]: oldAlerted }
        : restAlerted,
    });
  },
}));
