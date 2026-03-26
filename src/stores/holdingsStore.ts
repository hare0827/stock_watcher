import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Holding } from '../types';

const STORAGE_KEY = '@holdings';

interface HoldingsState {
  holdings: Record<string, Holding[]>; // ticker → Holding[]
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addHolding: (holding: Holding) => void;
  removeHolding: (ticker: string, id: string) => void;
  clearHoldings: (ticker: string) => void;
  getHoldings: (ticker: string) => Holding[];
  migrateHoldings: (oldTicker: string, newTicker: string) => Promise<void>;
}

export const useHoldingsStore = create<HoldingsState>((set, get) => ({
  holdings: {},
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const holdings = raw ? JSON.parse(raw) : {};
      set({ holdings, hydrated: true });
    } catch {
      set({ holdings: {}, hydrated: true });
    }
  },

  addHolding: (holding) => {
    const { holdings } = get();
    const existing = holdings[holding.ticker] ?? [];
    const next = { ...holdings, [holding.ticker]: [...existing, holding] };
    set({ holdings: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  removeHolding: (ticker, id) => {
    const { holdings } = get();
    const next = {
      ...holdings,
      [ticker]: (holdings[ticker] ?? []).filter((h) => h.id !== id),
    };
    set({ holdings: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  clearHoldings: (ticker) => {
    const { [ticker]: _, ...rest } = get().holdings;
    set({ holdings: rest });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  },

  getHoldings: (ticker) => get().holdings[ticker] ?? [],

  migrateHoldings: async (oldTicker, newTicker) => {
    if (oldTicker === newTicker) return;
    const { holdings } = get();
    const existing = holdings[oldTicker];
    if (!existing) return;

    const { [oldTicker]: _, ...rest } = holdings;
    const next = {
      ...rest,
      [newTicker]: existing.map((h) => ({ ...h, ticker: newTicker })),
    };
    set({ holdings: next });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },
}));
