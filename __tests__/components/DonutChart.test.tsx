import React from 'react';
import { render } from '@testing-library/react-native';
import { DonutChart } from '../../src/components/DonutChart';

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, ...props }: any) => <View testID="svg" {...props}>{children}</View>,
    Svg: ({ children, ...props }: any) => <View testID="svg" {...props}>{children}</View>,
    Circle: (props: any) => <View testID="circle" {...props} />,
    G: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

it('segments 없으면 null 렌더링', () => {
  const { toJSON } = render(<DonutChart segments={[]} />);
  expect(toJSON()).toBeNull();
});

it('segments 있으면 Circle 개수만큼 렌더링', () => {
  const { getAllByTestId } = render(
    <DonutChart
      segments={[
        { color: '#5b9bd5', weight: 0.6 },
        { color: '#ff6b6b', weight: 0.4 },
      ]}
    />
  );
  expect(getAllByTestId('circle')).toHaveLength(2);
});

it('centerLabel 텍스트 표시', () => {
  const { getByText } = render(
    <DonutChart segments={[{ color: '#5b9bd5', weight: 1 }]} centerLabel="2종목" />
  );
  expect(getByText('2종목')).toBeTruthy();
});
