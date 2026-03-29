import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { KisOrderSection } from '../../src/components/KisOrderSection';
import { useKisStore } from '../../src/stores/kisStore';

jest.mock('../../src/stores/kisStore');
const mockUseKisStore = useKisStore as jest.MockedFunction<typeof useKisStore>;

test('KIS 미연결 시 경고 배너가 표시된다', () => {
  mockUseKisStore.mockReturnValue({
    isConnected: false, placeOrder: jest.fn(),
  } as any);

  const { getByText } = render(
    <KisOrderSection ticker="005930.KS" currentPrice={56000} netShares={0} />
  );
  expect(getByText(/KIS 미연결/)).toBeTruthy();
});

test('KIS 연결 시 경고 배너가 없다', () => {
  mockUseKisStore.mockReturnValue({
    isConnected: true, placeOrder: jest.fn(),
  } as any);

  const { queryByText } = render(
    <KisOrderSection ticker="005930.KS" currentPrice={56000} netShares={10} />
  );
  expect(queryByText(/KIS 미연결/)).toBeNull();
});

test('연결 시 매수 버튼을 탭하면 모달이 열린다', () => {
  mockUseKisStore.mockReturnValue({
    isConnected: true, placeOrder: jest.fn(),
  } as any);

  const { getByText } = render(
    <KisOrderSection ticker="005930.KS" currentPrice={56000} netShares={10} />
  );
  fireEvent.press(getByText('매수'));
  expect(getByText('매수 주문 — 005930.KS')).toBeTruthy();
});
