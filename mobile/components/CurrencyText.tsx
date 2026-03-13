import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { colors } from '../constants/theme';

interface CurrencyTextProps {
  amount: number;
  style?: StyleProp<TextStyle>;
  showSign?: boolean;
  compact?: boolean;
}

export default function CurrencyText({ amount, style, showSign = false, compact = false }: CurrencyTextProps) {
  let formatted: string;

  if (compact && Math.abs(amount) >= 1000) {
    const k = amount / 1000;
    formatted = `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  } else {
    const abs = Math.abs(amount);
    const str = abs.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    const sign = showSign && amount < 0 ? '-' : '';
    formatted = `${sign}$${str}`;
  }

  return (
    <Text
      style={[
        {
          fontFamily: 'Menlo',
          fontSize: 14,
          color: colors.textPrimary,
        },
        style,
      ]}
    >
      {formatted}
    </Text>
  );
}
