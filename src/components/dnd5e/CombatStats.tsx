import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { EditableNumber } from '@/components/ui/EditableNumber';
import { Stepper } from '@/components/ui/Stepper';
import { abilityModifier } from '@/types/dnd5e';
import type { Dnd5eCharacter } from '@/types/dnd5e';

type Props = {
  character: Dnd5eCharacter;
  onChange?: (patch: Partial<Dnd5eCharacter>) => void;
};

export function CombatStats({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const { hp, hitDice, deathSaves, ac, initiativeBonus, speed } = character;
  const initMod = abilityModifier(character.abilities.dex) + initiativeBonus;
  const initStr = initMod >= 0 ? `+${initMod}` : `${initMod}`;
  const ro = !onChange;

  function tapDeathSave(type: 'successes' | 'failures') {
    if (ro) return;
    const cur = deathSaves[type];
    const next = cur >= 3 ? 0 : cur + 1;
    onChange!({ deathSaves: { ...deathSaves, [type]: next } });
  }

  return (
    <Section title={tr('dnd.sections.combat')}>
      {/* Top row: AC, Initiative, Speed */}
      <View style={styles.topRow}>
        <EditableNumber value={ac} label={tr('dnd.combat.armorClass')} size="lg"
          onSave={v => onChange?.({ ac: v })} min={0} max={30} />
        <View style={[styles.statChip, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
          <Text style={[styles.statVal, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{initStr}</Text>
          <Text style={[styles.statLabel, { color: t.colors.textSecondary }]}>{tr('dnd.combat.initiative')}</Text>
        </View>
        <EditableNumber value={speed} label={tr('dnd.combat.speed')} size="lg" suffix=" ft"
          onSave={v => onChange?.({ speed: v })} min={0} max={120} />
      </View>

      {/* HP */}
      <View style={[styles.hpCard, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
        <Stepper
          label={tr('dnd.combat.hitPoints')}
          value={hp.current}
          max={hp.max}
          min={0}
          onStep={v => onChange?.({ hp: { ...hp, current: v } })}
          onPressValue={ro ? undefined : () => {}}
        />
        <View style={styles.hpMeta}>
          <TouchableOpacity
            style={[styles.metaChip, { borderColor: t.colors.border }]}
            onPress={() => {
              if (ro) return;
              const n = parseInt(prompt?.('Max HP') ?? '', 10);
              if (!isNaN(n)) onChange?.({ hp: { ...hp, max: n } });
            }}
            disabled={ro}
          >
            <Text style={[styles.metaLabel, { color: t.colors.textSecondary }]}>{tr('dnd.combat.max')}</Text>
            <Text style={[styles.metaVal, { color: t.colors.text }]}>{hp.max}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.metaChip, { borderColor: t.colors.border }]}
            disabled={ro}
          >
            <Text style={[styles.metaLabel, { color: t.colors.textSecondary }]}>{tr('dnd.combat.temp')}</Text>
            <Text style={[styles.metaVal, { color: hp.temp > 0 ? t.colors.gold : t.colors.textMuted }]}>
              {hp.temp}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Hit Dice & Death Saves */}
      <View style={styles.bottomRow}>
        <View style={[styles.miniCard, { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
          <Text style={[styles.miniLabel, { color: t.colors.textSecondary }]}>{tr('dnd.combat.hitDice')}</Text>
          <Text style={[styles.miniValue, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
            {hitDice.current}{hitDice.die}
          </Text>
          <View style={styles.hdButtons}>
            <TouchableOpacity
              style={[styles.hdBtn, { borderColor: t.colors.danger }]}
              onPress={() => onChange?.({ hitDice: { ...hitDice, current: Math.max(0, hitDice.current - 1) } })}
              disabled={ro || hitDice.current === 0}
            >
              <Text style={[styles.hdBtnText, { color: t.colors.danger }]}>−1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.hdBtn, { borderColor: t.colors.success }]}
              onPress={() => onChange?.({ hitDice: { ...hitDice, current: Math.min(hitDice.max, hitDice.current + 1) } })}
              disabled={ro || hitDice.current === hitDice.max}
            >
              <Text style={[styles.hdBtnText, { color: t.colors.success }]}>+1</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.miniSub, { color: t.colors.textSecondary }]}>{tr('dnd.combat.of', { max: hitDice.max, die: hitDice.die })}</Text>
        </View>

        {/* Death Saves */}
        <View style={[styles.miniCard, { flex: 1.6, backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border }]}>
          <Text style={[styles.miniLabel, { color: t.colors.textSecondary }]}>{tr('dnd.combat.deathSaves')}</Text>
          {(['successes', 'failures'] as const).map(type => (
            <View key={type} style={styles.savesRow}>
              <Text style={[styles.savesLabel, { color: type === 'successes' ? t.colors.success : t.colors.danger }]}>
                {type === 'successes' ? tr('dnd.combat.successes') : tr('dnd.combat.failures')}
              </Text>
              <View style={styles.dots}>
                {[0, 1, 2].map(i => (
                  <TouchableOpacity key={i} onPress={() => tapDeathSave(type)} disabled={ro}>
                    <View style={[
                      styles.saveDot,
                      {
                        backgroundColor: i < deathSaves[type]
                          ? (type === 'successes' ? t.colors.success : t.colors.danger)
                          : 'transparent',
                        borderColor: type === 'successes' ? t.colors.success : t.colors.danger,
                      },
                    ]} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: 8 },
  statChip: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  statVal: { fontSize: 26, fontWeight: '700' },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  hpCard: { borderRadius: 8, borderWidth: 1, padding: 16, gap: 12 },
  hpMeta: { flexDirection: 'row', gap: 8 },
  metaChip: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 8, alignItems: 'center', gap: 2 },
  metaLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metaVal: { fontSize: 16, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', gap: 8 },
  miniCard: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 10, alignItems: 'center', gap: 4 },
  miniLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  miniValue: { fontSize: 22, fontWeight: '700' },
  hdButtons: { flexDirection: 'row', gap: 8 },
  hdBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1.5 },
  hdBtnText: { fontSize: 12, fontWeight: '700' },
  miniSub: { fontSize: 11 },
  savesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savesLabel: { fontSize: 11, fontWeight: '600', width: 40 },
  dots: { flexDirection: 'row', gap: 6 },
  saveDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
});
