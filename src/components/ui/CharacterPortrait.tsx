import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';

type Props = {
  /** 'lg' (default) is the full block shown atop the left column in wide layout.
   *  'sm' is a small tappable thumbnail (e.g. next to the name in the header) that
   *  opens a modal with the 'lg' placeholder centered on screen. */
  size?: 'sm' | 'lg';
};

/**
 * Placeholder portrait. Image upload isn't wired yet — this reserves the spot and
 * frames it. `size="sm"` renders a small tap-to-expand thumbnail instead of the
 * full block.
 */
export function CharacterPortrait({ size = 'lg' }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const frame = (
    <View style={[styles.frame, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
      <UserRound size={56} color={t.colors.textMuted} />
      <Text style={[styles.label, { color: t.colors.textMuted }]}>{tr('common.portraitPlaceholder')}</Text>
    </View>
  );

  if (size === 'lg') return frame;

  return (
    <>
      <TouchableOpacity
        style={[styles.thumb, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
        onPress={() => setExpanded(true)}
        activeOpacity={0.7}
        accessibilityLabel={tr('common.portraitPlaceholder')}
      >
        <UserRound size={20} color={t.colors.textMuted} />
      </TouchableOpacity>
      <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setExpanded(false)} />
          {frame}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    maxWidth: 240,
    aspectRatio: 3 / 4,
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  label: { fontSize: 12, fontWeight: '600' },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
