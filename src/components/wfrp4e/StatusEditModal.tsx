import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, type TKey } from '@/i18n';
import { textStyle } from '@/tokens/typography';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

type Status = Wfrp4eCharacter['status'];

type Props = {
  visible: boolean;
  status: Status;
  onChange: (status: Status) => void;
  onClose: () => void;
};

const TIERS: Status['tier'][] = ['Brass', 'Silver', 'Gold'];
const TIER_KEYS: Record<Status['tier'], TKey> = {
  Brass: 'wfrp.status.brass', Silver: 'wfrp.status.silver', Gold: 'wfrp.status.gold',
};

// Edit social status: tier (Brass/Silver/Gold) + numeric standing. Applies live.
export function StatusEditModal({ visible, status, onChange, onClose }: Props) {
  const t = useTheme();
  const tr = useTranslation();

  const setStanding = (n: number) => onChange({ ...status, standing: Math.max(0, n) });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{tr('wfrp.status.title')}</Text>

          <Text style={[styles.label, { color: t.colors.textSecondary }]}>{tr('wfrp.status.tier')}</Text>
          <View style={styles.segment}>
            {TIERS.map(tier => {
              const active = status.tier === tier;
              return (
                <TouchableOpacity
                  key={tier}
                  style={[styles.segBtn, { borderColor: active ? t.colors.accent : t.colors.border, backgroundColor: active ? t.colors.accent + '18' : t.colors.backgroundSecondary }]}
                  onPress={() => onChange({ ...status, tier })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.segText, { color: active ? t.colors.accent : t.colors.text }]}>{tr(TIER_KEYS[tier])}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { color: t.colors.textSecondary }]}>{tr('wfrp.status.standing')}</Text>
          <View style={styles.stepRow}>
            <TouchableOpacity
              style={[styles.stepBtn, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              onPress={() => setStanding(status.standing - 1)}
              activeOpacity={0.7}
            >
              <Text style={[styles.stepText, { color: t.colors.danger }]}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.standing, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{status.standing}</Text>
            <TouchableOpacity
              style={[styles.stepBtn, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              onPress={() => setStanding(status.standing + 1)}
              activeOpacity={0.7}
            >
              <Text style={[styles.stepText, { color: t.colors.success }]}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.done, { backgroundColor: t.colors.accent }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={[styles.doneText, { color: t.colors.accentText }]}>{tr('common.done')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 16, borderWidth: 1, padding: 24, gap: 10 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  label: { ...textStyle.fieldLabel, marginTop: 6 },
  segment: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, borderRadius: 10, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center' },
  segText: { fontSize: 14, fontWeight: '600' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  stepBtn: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 24, fontWeight: '700', lineHeight: 28 },
  standing: { fontSize: 34, fontWeight: '700', minWidth: 48, textAlign: 'center' },
  done: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  doneText: { fontSize: 15, fontWeight: '700' },
});
