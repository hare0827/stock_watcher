// src/components/PriceChart.tsx
import React from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { CartesianChart, Line, Area } from 'victory-native';
import { CandleData } from '../types';
import { formatCurrency } from '../utils/format';

const { width } = Dimensions.get('window');

interface Props {
  data: CandleData[];
  ticker: string;
  targetPrice: number;
  stopLossPrice: number;
}

export function PriceChart({ data, ticker, targetPrice, stopLossPrice }: Props) {
  const chartData = data.map((d, i) => ({
    day: i,
    close: d.close,
  }));

  const minY = Math.min(...data.map((d) => d.close), stopLossPrice) * 0.98;
  const maxY = Math.max(...data.map((d) => d.close), targetPrice) * 1.02;

  // Add reference lines for target and stop-loss
  const targetData = data.map((_, i) => ({ day: i, value: targetPrice }));
  const stopLossData = data.map((_, i) => ({ day: i, value: stopLossPrice }));

  return (
    <View style={[styles.container, { width: width - 32, height: 300 }]}>
      <CartesianChart
        data={chartData}
        xKey="day"
        yKeys={['close']}
        domain={{ y: [minY, maxY] }}
      >
        {({ points, chartBounds }) => (
          <>
            <Area
              points={points.close}
              y0={chartBounds.bottom}
              color="rgba(91,155,213,0.08)"
              animate={{ type: 'timing', duration: 300 }}
            />
            <Line
              points={points.close}
              color="#5b9bd5"
              strokeWidth={2.5}
              animate={{ type: 'timing', duration: 300 }}
            />
          </>
        )}
      </CartesianChart>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: -16 },
});
