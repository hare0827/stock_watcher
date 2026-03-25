// src/hooks/useAlertCheck.ts
import { useEffect, useRef } from 'react';
import { useAlertStore } from '../stores/alertStore';
import { getCardStatus } from '../utils/cardStyle';
import { StockQuote, AlertEvent } from '../types';

export function useAlertCheck(
  quotes: Array<{ name: string; quote: StockQuote | undefined }>,
  onAlert: (event: AlertEvent) => void
) {
  const { getAlert, wasAlerted, markAlerted, clearAlerted } = useAlertStore();
  const prevStatusRef = useRef<Record<string, string>>({});

  useEffect(() => {
    for (const { name, quote } of quotes) {
      if (!quote) continue;
      const alert = getAlert(quote.ticker);
      if (!alert?.enabled) continue;

      const status = getCardStatus(quote.currentPrice, alert.targetPrice, alert.stopLossPrice);
      const prevStatus = prevStatusRef.current[quote.ticker];

      // 상태가 바뀌면 alerted 플래그 초기화
      if (status !== prevStatus) clearAlerted(quote.ticker);
      prevStatusRef.current[quote.ticker] = status;

      if (status === 'target' && !wasAlerted(quote.ticker, 'target')) {
        markAlerted(quote.ticker, 'target');
        onAlert({ stock: { name, ticker: quote.ticker }, type: 'target', price: quote.currentPrice });
      } else if (status === 'stoploss' && !wasAlerted(quote.ticker, 'stoploss')) {
        markAlerted(quote.ticker, 'stoploss');
        onAlert({ stock: { name, ticker: quote.ticker }, type: 'stoploss', price: quote.currentPrice });
      }
    }
  }, [quotes]);
}
