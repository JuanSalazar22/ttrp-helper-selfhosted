import { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, type TKey } from '@/i18n';
import { advancesCostRange, talentCostRange, type AdvanceKind } from '@/types/wfrp4e';

type Kind = AdvanceKind | 'talent';

type Props = {
  visible: boolean;
  title: string;
  /** 'characteristic' | 'skill' use the banded tables; 'talent' uses N×100 per rank. */
  kind: Kind;
  /** Current advances (or talent ranks) already bought. */
  current: number;
  /** Unspent XP available (total - spent). May be negative. */
  unspent: number;
  /** Apply the change: new advance/rank count and the XP cost (can be negative on refund). */
  onApply: (next: number, cost: number) => void;
  onClose: () => void;
};

function costOf(kind: Kind, from: number, to: number): number {
  if (kind === 'talent') return talentCostRange(from, to);
  return advancesCostRange(kind, from, to);
}

// Buy/sell advances with a live XP cost. Starts at delta 0; cost accumulates from the
// CURRENT advance count (so the band is correct). Save applies immediately if affordable;
// if it would overspend, an inline warning lets the player continue anyway.
const UNIT_KEY: Record<Kind, TKey> = {
  talent: 'wfrp.advanceModal.rank',
  characteristic: 'wfrp.advanceModal.advances',
  skill: 'wfrp.advanceModal.advances',
};

const CURRENT_KEY: Record<Kind, TKey> = {
  talent: 'wfrp.advanceModal.currentRank',
  characteristic: 'wfrp.advanceModal.currentAdvances',
  skill: 'wfrp.advanceModal.currentAdvances',
};

export function AdvanceCalculatorModal({ visible, title, kind, current, unspent, onApply, onClose }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [delta, setDelta] = useState(0);
  const [confirming, setConfirming] = useState(false);

  // react-native-web does not fire Modal onShow reliably; re-seed on visible.
  useEffect(() => {
    if (visible) { setDelta(0); setConfirming(false); }
  }, [visible]);

  const target = Math.max(0, current + delta);
  const cost = costOf(kind, current, target);
  const remaining = unspent - cost;
  const overspend = cost > unspent;
  const noChange = target === current;

  function save() {
    if (overspend && !confirming) { setConfirming(true); return; }
    onApply(target, cost);
    onClose();
  }

  const unitLabel = tr(UNIT_KEY[kind]);
  const currentLabel = tr(CURRENT_KEY[kind], { n: current });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{title}</Text>
          <Text style={[styles.sub, { color: t.colors.textSecondary }]}>
            {currentLabel}
          </Text>

          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepBtn, { borderColor: t.colors.border }]}
              onPress={() => setDelta(d => Math.max(-current, d - 1))}
              disabled={target <= 0}
            >
              <Text style={[styles.stepText, { color: t.colors.text }]}>−</Text>
            </TouchableOpacity>

            <View style={styles.targetBox}>
              <Text style={[styles.targetNum, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{target}</Text>
              <Text style={[styles.targetLbl, { color: t.colors.textSecondary }]}>
                {unitLabel}{delta !== 0 ? `  (${delta > 0 ? '+' : ''}${delta})` : ''}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.stepBtn, { borderColor: t.colors.accent }]}
              onPress={() => setDelta(d => d + 1)}
            >
              <Text style={[styles.stepText, { color: t.colors.accent }]}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.costRow, { borderTopColor: t.colors.border }]}>
            <Text style={[styles.costLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.advanceModal.cost')}</Text>
            <Text style={[styles.costValue, { color: cost > 0 ? t.colors.text : t.colors.textMuted }]}>
              {cost > 0 ? `${cost} XP` : cost < 0 ? tr('wfrp.advanceModal.refund', { n: -cost }) : '—'}
            </Text>
          </View>
          <View style={styles.costRow}>
            <Text style={[styles.costLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.advanceModal.unspentAfter')}</Text>
            <Text style={[styles.costValue, { color: remaining < 0 ? t.colors.danger : t.colors.text }]}>{remaining} XP</Text>
          </View>

          {confirming && overspend && (
            <Text style={[styles.warn, { color: t.colors.danger }]}>
              {tr('wfrp.advanceModal.overspendWarn', { cost, unspent })}
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={onClose}>
              <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { backgroundColor: noChange ? t.colors.border : t.colors.accent }]}
              onPress={save}
              disabled={noChange}
            >
              <Text style={[styles.btnText, { color: t.colors.accentText }]}>
                {confirming && overspend ? tr('wfrp.advanceModal.continueAnyway') : tr('common.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 16, borderWidth: 1, padding: 24, gap: 14 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 12, textAlign: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  stepBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 26, fontWeight: '700' },
  targetBox: { alignItems: 'center', minWidth: 90 },
  targetNum: { fontSize: 40, fontWeight: '700' },
  targetLbl: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 0 },
  costLabel: { fontSize: 13, fontWeight: '600' },
  costValue: { fontSize: 15, fontWeight: '700' },
  warn: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnPrimary: { borderWidth: 0 },
  btnText: { fontSize: 15, fontWeight: '600' },
});
