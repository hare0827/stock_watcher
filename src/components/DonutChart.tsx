import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

interface DonutChartProps {
  segments: { color: string; weight: number }[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
}

export function DonutChart({ segments, size = 120, strokeWidth = 22, centerLabel }: DonutChartProps) {
  if (segments.length === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const C = 2 * Math.PI * r;
  const gapArc = 2;
  const availableC = C - gapArc * segments.length;

  let accOffset = 0;
  const arcs = segments.map((seg) => {
    const dashLen = seg.weight * availableC;
    const offset = C - accOffset;
    accOffset += dashLen + gapArc;
    return { dashLen, offset, color: seg.color };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation="-90" origin={`${cx}, ${cy}`}>
          {arcs.map((arc, i) => (
            <Circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.dashLen} ${C}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
            />
          ))}
        </G>
      </Svg>
      {centerLabel != null && (
        <Text style={{ color: '#888', fontSize: 11, textAlign: 'center' }}>{centerLabel}</Text>
      )}
    </View>
  );
}
