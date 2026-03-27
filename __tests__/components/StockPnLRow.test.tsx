// __tests__/components/StockPnLRow.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { StockPnLRow } from '../../src/components/StockPnLRow';
import { useHoldingsStore } from '../../src/stores/holdingsStore';
import { useStockPrice } from '../../src/hooks/useStockPrice';
import { useHoldingPnL } from '../../src/hooks/useHoldingPnL';

jest.mock('../../src/stores/holdingsStore');
jest.mock('../../src/hooks/useStockPrice');
jest.mock('../../src/hooks/useHoldingPnL');

const mockStock = { ticker: 'TEST', name: '테스트' };
const mockHolding = {
  id: '1', ticker: 'TEST', shares: 10, pricePerShare: 100,
  purchaseDate: '2024-01-01', currency: 'KRW' as const, type: 'buy' as const,
};

it('양수 손익은 초록색으로 표시', () => {
  (useHoldingsStore as jest.Mock).mockReturnValue({ getHoldings: () => [mockHolding] });
  (useStockPrice as jest.Mock).mockReturnValue({ data: { currentPrice: 150 } });
  (useHoldingPnL as jest.Mock).mockReturnValue({
    totalPnL: 500, pnlPercent: 5.0, isLoading: false, isError: false, perHolding: [], netShares: 10,
  });

  const { getByText } = render(<StockPnLRow stock={mockStock} color="#5b9bd5" />);
  const el = getByText('+₩500');
  expect(el.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: '#00e676' })])
  );
});

it('음수 손익은 빨간색으로 표시', () => {
  (useHoldingsStore as jest.Mock).mockReturnValue({ getHoldings: () => [mockHolding] });
  (useStockPrice as jest.Mock).mockReturnValue({ data: { currentPrice: 80 } });
  (useHoldingPnL as jest.Mock).mockReturnValue({
    totalPnL: -200, pnlPercent: -2.0, isLoading: false, isError: false, perHolding: [], netShares: 10,
  });

  const { getByText } = render(<StockPnLRow stock={mockStock} color="#5b9bd5" />);
  const el = getByText('-₩200');
  expect(el.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: '#FF1744' })])
  );
});

it('로딩 중이면 — 표시', () => {
  (useHoldingsStore as jest.Mock).mockReturnValue({ getHoldings: () => [] });
  (useStockPrice as jest.Mock).mockReturnValue({ data: undefined });
  (useHoldingPnL as jest.Mock).mockReturnValue({
    totalPnL: 0, pnlPercent: 0, isLoading: true, isError: false, perHolding: [], netShares: 0,
  });

  const { getByText } = render(<StockPnLRow stock={mockStock} color="#5b9bd5" />);
  expect(getByText('—')).toBeTruthy();
});
