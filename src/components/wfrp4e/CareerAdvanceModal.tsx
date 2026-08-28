import { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, useLocale } from '@/i18n';
import { searchContent } from '@/db/queries';
import { applyCareerLevel } from '@/components/wfrp4e/CareerPicker';
import { CAREER_LEVEL_XP, experienceCurrent } from '@/types/wfrp4e';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';
import type { ContentRecord } from '@/data/wfrp-content';

type Props = {
  visible: boolean;
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  onClose: () => void;
};

type Level = { name: string; status?: number; standing?: number; skills?: string[]; talents?: string[] };

const TIER_BY_STATUS: Record<number, Wfrp4eCharacter['status']['tier']> = {
  1: 'Brass', 2: 'Silver', 3: 'Gold',
};

// Advance to the next career level (rank) for a flat XP cost. Requisites are intentionally
// ignored for now. Charges `spent`, bumps careerRank, and grants the new level's
// skills/talents (resolved from the seeded career record). Warns but allows overspend.
export function CareerAdvanceModal({ visible, character, onChange, onClose }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const { locale } = useLocale();
  const db = useSQLiteContext();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { if (visible) setConfirming(false); }, [visible]);

  const nextRank = (character.careerRank + 1) as Wfrp4eCharacter['careerRank'];
  const atMax = character.careerRank >= 4;
  const unspent = experienceCurrent(character);
  const overspend = CAREER_LEVEL_XP > unspent;
  const nextName = character.careerPath?.[nextRank - 1] ?? tr('wfrp.header.rank', { n: nextRank });

  async function advance() {
    if (overspend && !confirming) { setConfirming(true); return; }
    // Resolve the new level's grants from the seeded career record (matched by name).
    let grants: Pick<Wfrp4eCharacter, 'skills' | 'talents'> = { skills: character.skills, talents: character.talents };
    if (character.currentCareer) {
      const matches = await searchContent(db, 'career', character.currentCareer, 10, locale);
      // Prefer an exact name match; fall back to the top hit (the overlaid name can differ
      // from the stored career name if the locale changed since the career was picked).
      const rec = matches.find((m: ContentRecord) => m.name.toLowerCase() === character.currentCareer.toLowerCase()) ?? matches[0];
      const level = (rec?.levels as Level[] | undefined)?.[nextRank - 1];
      if (level) grants = await applyCareerLevel(db, character, level, locale);
    }
    onChange({
      careerRank: nextRank,
      experience: { ...character.experience, spent: character.experience.spent + CAREER_LEVEL_XP },
      ...grants,
    });
    onClose();
  }

  // Undo a career advance: drop one rank, refund the flat XP, and reset status to the
  // lower level. Non-destructive — already-granted skills/talents are kept (they may
  // carry bought advances), so the user removes any extras manually.
  async function decrease() {
    const prevRank = (character.careerRank - 1) as Wfrp4eCharacter['careerRank'];
    let status = character.status;
    if (character.currentCareer) {
      const matches = await searchContent(db, 'career', character.currentCareer, 10, locale);
      const rec = matches.find((m: ContentRecord) => m.name.toLowerCase() === character.currentCareer.toLowerCase()) ?? matches[0];
      const level = (rec?.levels as Level[] | undefined)?.[prevRank - 1];
      if (level?.status) status = { tier: TIER_BY_STATUS[level.status] ?? character.status.tier, standing: level.standing ?? 0 };
    }
    onChange({
      careerRank: prevRank,
      experience: { ...character.experience, spent: Math.max(0, character.experience.spent - CAREER_LEVEL_XP) },
      status,
    });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{tr('wfrp.careerModal.title')}</Text>

          {atMax ? (
            <Text style={[styles.body, { color: t.colors.textMuted }]}>{tr('wfrp.careerModal.atMax')}</Text>
          ) : (
            <>
              <Text style={[styles.body, { color: t.colors.textMuted }]}>
                {tr('wfrp.careerModal.rankArrow', { from: character.careerRank, to: nextRank })}{nextName ? `  ·  ${nextName}` : ''}
              </Text>
              <View style={styles.row}>
                <Text style={[styles.label, { color: t.colors.textSecondary }]}>{tr('wfrp.careerModal.cost')}</Text>
                <Text style={[styles.value, { color: t.colors.text }]}>{CAREER_LEVEL_XP} XP</Text>
              </View>
              <View style={styles.row}>
                <Text style={[styles.label, { color: t.colors.textSecondary }]}>{tr('wfrp.careerModal.unspentAfter')}</Text>
                <Text style={[styles.value, { color: unspent - CAREER_LEVEL_XP < 0 ? t.colors.danger : t.colors.text }]}>
                  {unspent - CAREER_LEVEL_XP} XP
                </Text>
              </View>
              {confirming && overspend && (
                <Text style={[styles.warn, { color: t.colors.danger }]}>
                  {tr('wfrp.careerModal.overspendWarn', { unspent })}
                </Text>
              )}
            </>
          )}

          {character.careerRank > 1 && (
            <>
              <TouchableOpacity style={[styles.decreaseBtn, { borderColor: t.colors.border }]} onPress={decrease} activeOpacity={0.7}>
                <Text style={[styles.decreaseText, { color: t.colors.textSecondary }]}>
                  {tr('wfrp.careerModal.decreaseBtn', { n: character.careerRank - 1 })}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.hint, { color: t.colors.textMuted }]}>
                {tr('wfrp.careerModal.decreaseHint', { cost: CAREER_LEVEL_XP })}
              </Text>
            </>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={onClose}>
              <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{atMax ? tr('common.close') : tr('common.cancel')}</Text>
            </TouchableOpacity>
            {!atMax && (
              <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: t.colors.accent }]} onPress={advance}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>
                  {confirming && overspend ? tr('wfrp.careerModal.continueAnyway') : tr('wfrp.careerModal.advanceBtn', { cost: CAREER_LEVEL_XP })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 16, borderWidth: 1, padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600' },
  value: { fontSize: 15, fontWeight: '700' },
  warn: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  decreaseBtn: { borderRadius: 10, borderWidth: 1, alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  decreaseText: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnPrimary: { borderWidth: 0 },
  btnText: { fontSize: 14, fontWeight: '600' },
});
