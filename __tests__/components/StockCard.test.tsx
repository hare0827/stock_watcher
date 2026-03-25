// __tests__/components/StockCard.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StockCard } from '../../src/components/StockCard';

const baseProps = {
  stock: { name: 'NVIDIA', ticker: 'NVDA' },
  quote: {
    ticker: 'NVDA', currentPrice: 875.5, previousClose: 850,
    change: 25.5, changePercent: 3.0, timestamp: 0,
  },
  alert: { targetPrice: 1000, stopLossPrice: 700, enabled: true },
  onPress: jest.fn(),
};

it('종목명과 티커 표시', () => {
  render(<StockCard {...baseProps} />);
  expect(screen.getByText('NVIDIA')).toBeTruthy();
  expect(screen.getByText('NVDA')).toBeTruthy();
});

it('현재가 표시', () => {
  render(<StockCard {...baseProps} />);
  expect(screen.getByText('$875.50')).toBeTruthy();
});

it('목표가 도달 시 빨간 테두리', () => {
  const props = { ...baseProps, quote: { ...baseProps.quote, currentPrice: 1050 } };
  const { getByTestId } = render(<StockCard {...props} />);
  const card = getByTestId('stock-card');
  // style may be a flat object or an array depending on RN test renderer
  const style = card.props.style;
  const flatStyle = Array.isArray(style)
    ? Object.assign({}, ...style)
    : style;
  expect(flatStyle).toMatchObject({ borderColor: '#FF1744' });
});
