// __tests__/hooks/useHoldingPnL.test.ts
import { renderHook } from '@testing-library/react-native';
import { useHoldingPnL } from '../../src/hooks/useHoldingPnL';
import { Holding } from '../../src/types';

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  useQueries: () => [],
}));

const makeBuy = (overrides: Partial<Holding> = {}): Holding => ({
  id: '1', ticker: 'TEST', shares: 10, pricePerShare: 100,
  purchaseDate: '2024-01-15', currency: 'KRW', type: 'buy', ...overrides,
});

it('보유 내역 없으면 totalPnL=0, isLoading=false', () => {
  const { result } = renderHook(() => useHoldingPnL([], 0));
  expect(result.current.totalPnL).toBe(0);
  expect(result.current.isLoading).toBe(false);
});

it('KRW 매수만 있으면 미실현 손익 계산', () => {
  const holdings = [makeBuy({ shares: 10, pricePerShare: 100 })];
  const { result } = renderHook(() => useHoldingPnL(holdings, 150));
  expect(result.current.totalPnL).toBe(500); // 10 × (150 - 100)
  expect(result.current.perHolding).toHaveLength(1);
  expect(result.current.perHolding[0].pnl).toBe(500);
});

it('KRW 매도 있으면 실현+미실현 합산, perHolding 비움', () => {
  const holdings: Holding[] = [
    makeBuy({ id: '1', shares: 10, pricePerShare: 100 }),
    makeBuy({ id: '2', shares: 3, pricePerShare: 150, type: 'sell' }),
  ];
  const { result } = renderHook(() => useHoldingPnL(holdings, 160));
  // buys: cost=1000, currentValue=1600
  // sells: currentValue -= 480 → 1120, sellProceeds=450
  // totalPnL = (1120 + 450) - 1000 = 570
  expect(result.current.totalPnL).toBe(570);
  expect(result.current.perHolding).toHaveLength(0);
});

it('type 없는 기존 holding은 buy로 간주', () => {
  const holding = {
    id: '1', ticker: 'TEST', shares: 5, pricePerShare: 200,
    purchaseDate: '2024-01-01', currency: 'KRW' as const,
  } as Holding;
  const { result } = renderHook(() => useHoldingPnL([holding], 300));
  expect(result.current.totalPnL).toBe(500); // 5 × (300 - 200)
});

it('netShares는 매수주수 합계 - 매도주수 합계', () => {
  const holdings: Holding[] = [
    makeBuy({ id: '1', shares: 10, pricePerShare: 100 }),
    makeBuy({ id: '2', shares: 3, pricePerShare: 150, type: 'sell' }),
  ];
  const { result } = renderHook(() => useHoldingPnL(holdings, 160));
  expect(result.current.netShares).toBe(7); // 10 - 3
});
