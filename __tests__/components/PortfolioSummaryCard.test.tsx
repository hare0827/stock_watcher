// __tests__/components/PortfolioSummaryCard.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { PortfolioSummaryCard } from '../../src/components/PortfolioSummaryCard';
import * as summaryHook from '../../src/hooks/usePortfolioSummary';

jest.mock('../../src/hooks/usePortfolioSummary');

it('hook이 null 반환하면 아무것도 렌더링 안 됨', () => {
  jest.spyOn(summaryHook, 'usePortfolioSummary').mockReturnValue(null);
  const { toJSON } = render(<PortfolioSummaryCard />);
  expect(toJSON()).toBeNull();
});

it('로딩 중이면 ActivityIndicator 표시', () => {
  jest.spyOn(summaryHook, 'usePortfolioSummary').mockReturnValue({
    totalPnL: 0, pnlPercent: 0, isLoading: true, isError: false, segments: [],
  });
  const { getByTestId } = render(<PortfolioSummaryCard />);
  expect(getByTestId('portfolio-loading')).toBeTruthy();
});

it('양수 손익은 초록색으로 표시', () => {
  jest.spyOn(summaryHook, 'usePortfolioSummary').mockReturnValue({
    totalPnL: 1_000_000,
    pnlPercent: 8.4,
    isLoading: false,
    isError: false,
    segments: [{ ticker: 'NVDA', name: 'NVIDIA', color: '#5b9bd5', weight: 1 }],
  });
  const { getByTestId } = render(<PortfolioSummaryCard />);
  const pnlText = getByTestId('portfolio-pnl');
  expect(pnlText.props.style).toMatchObject({ color: '#00e676' });
});
