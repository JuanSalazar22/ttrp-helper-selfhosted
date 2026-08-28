import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { textStyle } from '@/tokens/typography';

type Props = {
  title: string;
  children: React.ReactNode;
  noPad?: boolean;
};

export function Section({ title, children, noPad }: Props) {
  const t = useTheme();
  return (
    <View style={styles.wrapper}>
      <View style={[styles.headerRow, { borderBottomColor: t.colors.accent }]}>
        <Text style={[styles.title, { color: t.colors.accent }]}>{title}</Text>
      </View>
      <View style={noPad ? undefined : styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 24 },
  headerRow: {
    borderBottomWidth: 2,
    paddingBottom: 4,
    marginBottom: 12,
  },
  title: { ...textStyle.sectionHeader },
  body: { gap: 6 },
});
