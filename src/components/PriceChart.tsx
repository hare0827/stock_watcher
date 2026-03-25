// src/components/PriceChart.tsx
import React, { useMemo } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { CartesianChart, Line, Area } from 'victory-native';
import { Line as SkiaLine } from '@shopify/react-native-skia';
import { CandleData } from '../types';

const { width } = Dimensions.get('window');

interface Props {
  data: CandleData[];
  ticker: string;
  targetPrice: number;
  stopLossPrice: number;
}

export function PriceChart({ data, ticker, targetPrice, stopLossPrice }: Props) {
  const chartData = useMemo(
    () => data.map((d, i) => ({ day: i, close: d.close })),
    [data]
  );
  const { minY, maxY } = useMemo(() => ({
    minY: data.length > 0 ? Math.min(...data.map((d) => d.close), stopLossPrice) * 0.98 : 0,
    maxY: data.length > 0 ? Math.max(...data.map((d) => d.close), targetPrice) * 1.02 : 1,
  }), [data, stopLossPrice, targetPrice]);

  if (data.length === 0) return null;

  return (
    <View style={[styles.container, { width: width - 32, height: 300 }]}>
      <CartesianChart
        data={chartData}
        xKey="day"
        yKeys={['close']}
        domain={{ y: [minY, maxY] }}
      >
        {({ points, chartBounds }) => {
          const domainHeight = maxY - minY;
          const chartHeight = chartBounds.bottom - chartBounds.top;
          // 가격 → Y픽셀 변환
          const priceToY = (price: number) =>
            chartBounds.top + ((maxY - price) / domainHeight) * chartHeight;

          return (
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
              {/* 목표가 — 빨간 점선 */}
              <SkiaLine
                p1={{ x: chartBounds.left, y: priceToY(targetPrice) }}
                p2={{ x: chartBounds.right, y: priceToY(targetPrice) }}
                color="#FF1744"
                strokeWidth={1.5}
                style="stroke"
              />
              {/* 손절가 — 파란 점선 */}
              <SkiaLine
                p1={{ x: chartBounds.left, y: priceToY(stopLossPrice) }}
                p2={{ x: chartBounds.right, y: priceToY(stopLossPrice) }}
                color="#2979FF"
                strokeWidth={1.5}
                style="stroke"
              />
            </>
          );
        }}
      </CartesianChart>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: -16 },
});
