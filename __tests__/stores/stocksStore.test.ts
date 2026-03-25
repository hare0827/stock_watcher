import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { useStocksStore } from '../../src/stores/stocksStore';

const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    return Promise.resolve();
  }),
}));

const DEFAULT_STOCKS = [
  { name: 'NVIDIA', ticker: 'NVDA' },
  { name: '삼성전자', ticker: '005930.KS' },
  { name: '테슬라', ticker: 'TSLA' },
  { name: 'SK하이닉스', ticker: '000660.KS' },
];

beforeEach(async () => {
  await AsyncStorage.clear();
  useStocksStore.setState({ stocks: DEFAULT_STOCKS, hydrated: false });
});

it('기본 종목 4개로 초기화', () => {
  const { result } = renderHook(() => useStocksStore());
  expect(result.current.stocks).toHaveLength(4);
});

it('종목 추가', async () => {
  const { result } = renderHook(() => useStocksStore());
  await act(async () => {
    result.current.addStock({ name: '애플', ticker: 'AAPL' });
  });
  expect(result.current.stocks).toHaveLength(5);
});

it('종목 추가 — 20개 초과 시 예외', () => {
  const twentyStocks = Array.from({ length: 20 }, (_, i) => ({
    name: `Stock${i}`,
    ticker: `TK${i}`,
  }));
  useStocksStore.setState({ stocks: twentyStocks, hydrated: true });
  const { result } = renderHook(() => useStocksStore());
  expect(() => result.current.addStock({ name: '초과', ticker: 'OVER' })).toThrow(
    '종목은 최대 20개까지 등록 가능합니다.'
  );
});

it('중복 티커 추가 시 예외', () => {
  const { result } = renderHook(() => useStocksStore());
  expect(() => result.current.addStock({ name: '엔비디아2', ticker: 'NVDA' })).toThrow(
    '이미 등록된 티커입니다.'
  );
});

it('종목 삭제', async () => {
  const { result } = renderHook(() => useStocksStore());
  await act(async () => {
    result.current.removeStock('NVDA');
  });
  expect(result.current.stocks.find((s) => s.ticker === 'NVDA')).toBeUndefined();
});
