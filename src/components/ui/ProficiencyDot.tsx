import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  proficient: boolean;
  expertise?: boolean;
  size?: number;
};

export function ProficiencyDot({ proficient, expertise, size = 10 }: Props) {
  const t = useTheme();
  const color = proficient ? t.colors.accent : t.colors.border;

  if (expertise) {
    // Diamond shape for expertise
    return (
      <View style={[
        styles.diamond,
        {
          width: size,
          height: size,
          backgroundColor: color,
          borderColor: t.colors.accent,
        },
      ]} />
    );
  }

  return (
    <View style={[
      styles.circle,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: proficient ? color : 'transparent',
        borderColor: proficient ? color : t.colors.textMuted,
      },
    ]} />
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 1.5,
  },
  diamond: {
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.5,
  },
});
