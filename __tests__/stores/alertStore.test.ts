import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { useAlertStore } from '../../src/stores/alertStore';

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

beforeEach(async () => {
  await AsyncStorage.clear();
  useAlertStore.setState({ alerts: {}, alerted: {} });
});

it('알림 설정 저장', async () => {
  const { result } = renderHook(() => useAlertStore());
  await act(async () => {
    await result.current.setAlert('NVDA', { targetPrice: 200, stopLossPrice: 100, enabled: true });
  });
  expect(result.current.getAlert('NVDA')?.targetPrice).toBe(200);
});

it('알림 삭제', async () => {
  const { result } = renderHook(() => useAlertStore());
  await act(async () => {
    await result.current.setAlert('NVDA', { targetPrice: 200, stopLossPrice: 100, enabled: true });
    result.current.removeAlert('NVDA');
  });
  expect(result.current.getAlert('NVDA')).toBeUndefined();
});

it('발송 플래그 — 중복 알림 방지', () => {
  const { result } = renderHook(() => useAlertStore());
  result.current.markAlerted('NVDA', 'target');
  expect(result.current.wasAlerted('NVDA', 'target')).toBe(true);
  expect(result.current.wasAlerted('NVDA', 'stoploss')).toBe(false);
});

it('발송 플래그 초기화', () => {
  const { result } = renderHook(() => useAlertStore());
  result.current.markAlerted('NVDA', 'target');
  result.current.clearAlerted('NVDA');
  expect(result.current.wasAlerted('NVDA', 'target')).toBe(false);
});
