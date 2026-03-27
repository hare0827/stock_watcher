// __tests__/hooks/usePortfolioSummary.test.ts
import { renderHook } from '@testing-library/react-native';
import { usePortfolioSummary } from '../../src/hooks/usePortfolioSummary';
import { useStocksStore } from '../../src/stores/stocksStore';
import { useHoldingsStore } from '../../src/stores/holdingsStore';

jest.mock('../../src/stores/stocksStore');
jest.mock('../../src/stores/holdingsStore');
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  useQueries: () => [],
  useQueryClient: () => ({ getQueryData: () => undefined }),
}));

it('보유 내역 없으면 null 반환', () => {
  (useStocksStore as jest.Mock).mockReturnValue({ stocks: [] });
  (useHoldingsStore as jest.Mock).mockReturnValue({ getHoldings: () => [] });
  const { result } = renderHook(() => usePortfolioSummary());
  expect(result.current).toBeNull();
});

it('모든 종목 holdings가 빈 배열이면 null 반환', () => {
  (useStocksStore as jest.Mock).mockReturnValue({
    stocks: [{ ticker: 'NVDA', name: 'NVIDIA' }],
  });
  (useHoldingsStore as jest.Mock).mockReturnValue({ getHoldings: () => [] });
  const { result } = renderHook(() => usePortfolioSummary());
  expect(result.current).toBeNull();
});

it('KRW 매도 있으면 totalPnL에 실현 손익 반영', () => {
  (useStocksStore as jest.Mock).mockReturnValue({
    stocks: [{ ticker: 'TEST', name: '테스트' }],
  });
  (useHoldingsStore as jest.Mock).mockReturnValue({
    getHoldings: () => [
      { id: '1', ticker: 'TEST', shares: 10, pricePerShare: 100, purchaseDate: '2024-01-01', currency: 'KRW', type: 'buy' },
      { id: '2', ticker: 'TEST', shares: 3, pricePerShare: 150, purchaseDate: '2024-06-01', currency: 'KRW', type: 'sell' },
    ],
  });
  const { result } = renderHook(() => usePortfolioSummary());
  // totalCost=1000, currentValue=0 (no quote), sellProceeds=450
  // totalPnL = (0 + 450) - 1000 = -550
  expect(result.current).not.toBeNull();
  expect(result.current!.totalPnL).toBe(-550);
});
