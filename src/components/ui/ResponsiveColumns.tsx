import { View, StyleSheet } from 'react-native';

type Props = {
  wide: boolean;
  /** Single-column content (original order), rendered as-is when not wide. */
  single: React.ReactNode;
  /** Left column when wide. */
  left: React.ReactNode;
  /** Right column when wide. */
  right: React.ReactNode;
};

/**
 * Sheet body layout: one column in portrait (unchanged), two centered, width-capped
 * columns in landscape. Callers pass the same sections arranged both ways.
 */
export function ResponsiveColumns({ wide, single, left, right }: Props) {
  if (!wide) return <>{single}</>;
  return (
    <View style={styles.wrap}>
      <View style={styles.col}>{left}</View>
      <View style={styles.col}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 24, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  col: { flex: 1, minWidth: 0 },
});
