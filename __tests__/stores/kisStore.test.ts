import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKisStore } from '../../src/stores/kisStore';
import { useHoldingsStore } from '../../src/stores/holdingsStore';
import { fetchBalance, testConnection } from '../../src/api/kis';

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

jest.mock('../../src/api/kis', () => ({
  fetchBalance: jest.fn(),
  testConnection: jest.fn(),
}));

const mockFetchBalance = fetchBalance as jest.MockedFunction<typeof fetchBalance>;
const mockTestConnection = testConnection as jest.MockedFunction<typeof testConnection>;

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  jest.clearAllMocks();
  useKisStore.getState().reset();
  // clear holdingsStore state
  const existingTickers = Object.keys(useHoldingsStore.getState().holdings);
  existingTickers.forEach((t) => useHoldingsStore.getState().clearHoldings(t));
});

test('초기 상태: backendUrl null, isConnected false', () => {
  const state = useKisStore.getState();
  expect(state.backendUrl).toBeNull();
  expect(state.isConnected).toBe(false);
});

test('setBackendUrl이 AsyncStorage에 저장한다', async () => {
  await useKisStore.getState().setBackendUrl('https://my.railway.app');
  expect(await AsyncStorage.getItem('@kis_backend_url')).toBe('https://my.railway.app');
  expect(useKisStore.getState().backendUrl).toBe('https://my.railway.app');
});

test('testConnection 성공 시 isConnected true', async () => {
  mockTestConnection.mockResolvedValueOnce(true);
  await useKisStore.getState().setBackendUrl('https://my.railway.app');
  const ok = await useKisStore.getState().testConnection();
  expect(ok).toBe(true);
  expect(useKisStore.getState().isConnected).toBe(true);
});

test('syncBalance가 holdingsStore를 덮어쓴다', async () => {
  const mockHoldings = [{
    id: 'kis_005930.KS', ticker: '005930.KS', shares: 10,
    pricePerShare: 56000, purchaseDate: '2026-03-27', currency: 'KRW', type: 'buy',
  }];
  mockFetchBalance.mockResolvedValueOnce(mockHoldings as any);
  await useKisStore.getState().setBackendUrl('https://my.railway.app');
  useKisStore.setState({ isConnected: true });

  await useKisStore.getState().syncBalance();

  const holdings = useHoldingsStore.getState().getHoldings('005930.KS');
  expect(holdings).toHaveLength(1);
  expect(holdings[0].shares).toBe(10);
});
