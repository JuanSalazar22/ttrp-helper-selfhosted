import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { useRoll } from '@/hooks/useRoll';
import { RollModal } from '@/components/ui/RollModal';
import { textStyle } from '@/tokens/typography';
import type { AdvantageMode } from '@/dice/types';

const DICE = [4, 6, 8, 10, 12, 20, 100] as const;

function DiceButton({ sides, onPress }: { sides: number; onPress: () => void }) {
  const t = useTheme();
  const isD20 = sides === 20;
  return (
    <TouchableOpacity
      style={[
        styles.diceBtn,
        {
          backgroundColor: isD20 ? t.colors.accent : t.colors.card,
          borderColor: isD20 ? t.colors.accent : t.colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.diceSides, { color: isD20 ? t.colors.accentText : t.colors.text }]}>
        d{sides}
      </Text>
    </TouchableOpacity>
  );
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.modeBtn,
        {
          backgroundColor: active ? t.colors.accent + '22' : t.colors.backgroundSecondary,
          borderColor: active ? t.colors.accent : t.colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.modeBtnText, { color: active ? t.colors.accent : t.colors.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function DiceScreen() {
  const t = useTheme();
  const tr = useTranslation();
  const { result, rollExpression, reroll, dismiss } = useRoll();
  const [mode, setMode] = useState<AdvantageMode>('normal');
  const [modifierText, setModifierText] = useState('0');
  const [customExpr, setCustomExpr] = useState('');

  const modifier = parseInt(modifierText, 10) || 0;

  function handleDie(sides: number) {
    const sign = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    const expr = modifier !== 0 ? `1d${sides}${sign}` : `1d${sides}`;
    rollExpression(expr, `d${sides}`, sides === 20 ? mode : 'normal');
  }

  function handleCustom() {
    const expr = customExpr.trim();
    if (!expr) return;
    try {
      rollExpression(expr, expr, mode);
    } catch {}
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
          {tr('dice.title')}
        </Text>

        {/* Dice grid */}
        <View style={styles.diceGrid}>
          {DICE.map(sides => (
            <DiceButton key={sides} sides={sides} onPress={() => handleDie(sides)} />
          ))}
        </View>

        {/* Modifier */}
        <View style={[styles.section, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <Text style={[styles.sectionLabel, { color: t.colors.textSecondary }]}>{tr('dice.modifier')}</Text>
          <View style={styles.modifierRow}>
            <TouchableOpacity
              style={[styles.stepBtn, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              onPress={() => setModifierText(String(modifier - 1))}
            >
              <Text style={[styles.stepBtnText, { color: t.colors.danger }]}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.modInput, { color: t.colors.text, borderColor: t.colors.border, fontFamily: t.fontFamily.serif }]}
              value={modifierText}
              onChangeText={setModifierText}
              keyboardType="number-pad"
              textAlign="center"
            />
            <TouchableOpacity
              style={[styles.stepBtn, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              onPress={() => setModifierText(String(modifier + 1))}
            >
              <Text style={[styles.stepBtnText, { color: t.colors.success }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* d20 Mode */}
        <View style={[styles.section, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <Text style={[styles.sectionLabel, { color: t.colors.textSecondary }]}>{tr('dice.d20Mode')}</Text>
          <View style={styles.modeRow}>
            <ModeButton label={tr('dice.normal')} active={mode === 'normal'} onPress={() => setMode('normal')} />
            <ModeButton label={tr('dice.advantage')} active={mode === 'advantage'} onPress={() => setMode('advantage')} />
            <ModeButton label={tr('dice.disadvantageShort')} active={mode === 'disadvantage'} onPress={() => setMode('disadvantage')} />
          </View>
        </View>

        {/* Custom expression */}
        <View style={[styles.section, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <Text style={[styles.sectionLabel, { color: t.colors.textSecondary }]}>{tr('dice.customExpression')}</Text>
          <View style={styles.customRow}>
            <TextInput
              style={[styles.customInput, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              value={customExpr}
              onChangeText={setCustomExpr}
              placeholder={tr('dice.customPlaceholder')}
              placeholderTextColor={t.colors.textMuted}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleCustom}
            />
            <TouchableOpacity
              style={[styles.rollBtn, { backgroundColor: customExpr.trim() ? t.colors.accent : t.colors.border }]}
              onPress={handleCustom}
              disabled={!customExpr.trim()}
              activeOpacity={0.8}
            >
              <Text style={[styles.rollBtnText, { color: customExpr.trim() ? t.colors.accentText : t.colors.textMuted }]}>{tr('common.roll')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <RollModal result={result} onClose={dismiss} onReroll={reroll} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: '700', marginBottom: 4 },
  diceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  diceBtn: {
    flex: 1,
    minWidth: 48,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceSides: { fontSize: 15, fontWeight: '700' },
  section: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  sectionLabel: { ...textStyle.sectionHeader },
  modifierRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 22, fontWeight: '700', lineHeight: 26 },
  modInput: { flex: 1, fontSize: 32, fontWeight: '700', borderBottomWidth: 2, paddingBottom: 4 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  modeBtnText: { fontSize: 12, fontWeight: '700' },
  customRow: { flexDirection: 'row', gap: 10 },
  customInput: { flex: 1, fontSize: 16, padding: 12, borderRadius: 10, borderWidth: 1 },
  rollBtn: { paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rollBtnText: { fontSize: 15, fontWeight: '700' },
});
