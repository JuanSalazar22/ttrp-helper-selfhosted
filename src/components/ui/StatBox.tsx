import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { textStyle } from '@/tokens/typography';

type Props = {
  value: string | number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  accent?: boolean;
};

export function StatBox({ value, label, size = 'md', accent }: Props) {
  const t = useTheme();

  const valueSize = size === 'lg' ? 36 : size === 'md' ? 26 : 18;

  return (
    <View style={[
      styles.box,
      { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border },
    ]}>
      <Text style={[
        styles.value,
        {
          fontSize: valueSize,
          fontFamily: t.fontFamily.serif,
          color: accent ? t.colors.accent : t.colors.text,
        },
      ]}>
        {value}
      </Text>
      <Text style={[styles.label, textStyle.fieldLabel, { color: t.colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 2,
  },
  value: {
    fontWeight: '700',
    lineHeight: undefined,
  },
  label: {
    textAlign: 'center',
  },
});
