// src/hooks/useAlertCheck.ts
import { useEffect, useRef } from 'react';
import { useAlertStore } from '../stores/alertStore';
import { getCardStatus } from '../utils/cardStyle';
import { StockQuote, AlertEvent } from '../types';

/**
 * 알림 조건 감지 훅.
 * @param quotes 호출부에서 useMemo로 참조를 안정화해야 함 — 매 렌더마다 새 배열이 전달되면 effect가 불필요하게 재실행됩니다.
 * @param onAlert 알림 발생 시 콜백. 내부적으로 ref로 래핑되므로 useCallback 없이도 안전합니다.
 */
export function useAlertCheck(
  quotes: Array<{ name: string; quote: StockQuote | undefined }>,
  onAlert: (event: AlertEvent) => void
) {
  const { getAlert, wasAlerted, markAlerted, clearAlerted } = useAlertStore();
  const prevStatusRef = useRef<Record<string, string>>({});
  // onAlert ref: always call the latest version to avoid stale closure
  const onAlertRef = useRef(onAlert);
  useEffect(() => { onAlertRef.current = onAlert; });

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
        onAlertRef.current({ stock: { name, ticker: quote.ticker }, type: 'target', price: quote.currentPrice });
      } else if (status === 'stoploss' && !wasAlerted(quote.ticker, 'stoploss')) {
        markAlerted(quote.ticker, 'stoploss');
        onAlertRef.current({ stock: { name, ticker: quote.ticker }, type: 'stoploss', price: quote.currentPrice });
      }
    }
  }, [quotes, getAlert, wasAlerted, markAlerted, clearAlerted]);
}
