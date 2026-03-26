// app/_layout.tsx
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStocksStore } from '../src/stores/stocksStore';
import { useAlertStore } from '../src/stores/alertStore';
import { useHoldingsStore } from '../src/stores/holdingsStore';

const queryClient = new QueryClient();

function HydrationGate({ children }: { children: React.ReactNode }) {
  const { hydrate, hydrated } = useStocksStore();
  const { hydrateAlert } = useAlertStore();
  const { hydrate: hydrateHoldings } = useHoldingsStore();

  useEffect(() => {
    hydrate().then(() => {
      // hydrate() 완료 후 최신 스토어 상태를 직접 참조 (클로저 stale 방지)
      const latestStocks = useStocksStore.getState().stocks;
      latestStocks.forEach((s) => hydrateAlert(s.ticker));
    });
    hydrateHoldings();
  }, []);

  if (!hydrated) return null; // 로딩 스플래시
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <HydrationGate>
        <Stack screenOptions={{ headerShown: false }} />
      </HydrationGate>
    </QueryClientProvider>
  );
}
