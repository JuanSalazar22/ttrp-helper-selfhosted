import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { useSQLiteContext } from 'expo-sqlite';
import { Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, useLocale } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { ContentPicker } from '@/components/wfrp4e/ContentPicker';
import { WikiModal } from '@/components/wfrp4e/WikiModal';
import { confirmRemove } from '@/lib/confirm';
import { searchContent } from '@/db/queries';
import { findCriticalWound } from './criticalWoundLookup';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';
import type { ContentRecord } from '@/data/wfrp-content';

type CriticalWound = Wfrp4eCharacter['criticalWounds'][number];
type Location = CriticalWound['location'];

const LOCATIONS: Location[] = ['head', 'body', 'arm', 'leg'];

type Props = {
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
};

export function CriticalWounds({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const db = useSQLiteContext();
  const { locale } = useLocale();

  const [rolling, setRolling] = useState(false);
  const [location, setLocation] = useState<Location>('head');
  const [rollValue, setRollValue] = useState(1);
  const [editingRoll, setEditingRoll] = useState(false);
  const [rollDraft, setRollDraft] = useState('1');
  const [locationRows, setLocationRows] = useState<ContentRecord[]>([]);
  const [picking, setPicking] = useState(false);
  const [wikiId, setWikiId] = useState<string | null>(null);

  const wikiWound = wikiId ? character.criticalWounds.find(x => x.id === wikiId) ?? null : null;

  // Load this location's 80-row-total (20 per location) table once the roll
  // picker is open, so findCriticalWound has something to search.
  useEffect(() => {
    if (!rolling) return;
    let cancelled = false;
    searchContent(db, 'critical_wound', '', 100, locale).then(rows => {
      if (!cancelled) setLocationRows(rows.filter(r => r.location === location));
    });
    return () => { cancelled = true; };
  }, [rolling, location, db, locale]);

  function openRoll() {
    setLocation('head');
    setRollValue(Math.floor(Math.random() * 100) + 1);
    setRolling(true);
  }

  function reroll() {
    setRollValue(Math.floor(Math.random() * 100) + 1);
  }

  function startEditingRoll() {
    setRollDraft(String(rollValue));
    setEditingRoll(true);
  }

  function commitRollEdit() {
    const n = parseInt(rollDraft, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 100) setRollValue(n);
    setEditingRoll(false);
  }

  const match = findCriticalWound(locationRows, rollValue);

  function addFromRoll() {
    if (!match) return;
    addWound({
      id: uuidv4(),
      name: match.name,
      location,
      wounds: match.wounds as number | 'death',
      description: (match.description as string) ?? '',
      roll: rollValue,
    });
    setRolling(false);
  }

  function addFromPicker(r: ContentRecord) {
    addWound({
      id: uuidv4(),
      name: r.name,
      location: r.location as Location,
      wounds: r.wounds as number | 'death',
      description: (r.description as string) ?? '',
      roll: null,
    });
    setPicking(false);
  }

  function addWound(w: CriticalWound) {
    onChange({ criticalWounds: [...character.criticalWounds, w] });
  }

  function removeWound(id: string) {
    const w = character.criticalWounds.find(x => x.id === id);
    confirmRemove(tr, tr('wfrp.criticalWounds.removeConfirm', { name: w?.name ?? '' }), () =>
      onChange({ criticalWounds: character.criticalWounds.filter(x => x.id !== id) }));
  }

  return (
    <Section title={tr('wfrp.criticalWounds.title')}>
      {character.criticalWounds.map(w => (
        <TouchableOpacity
          key={w.id}
          style={[styles.row, { borderColor: t.colors.border }]}
          activeOpacity={0.6}
          onPress={() => setWikiId(w.id)}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: t.colors.text }]}>{w.name}</Text>
            <Text style={[styles.sub, { color: t.colors.textSecondary }]}>
              {tr(`wfrp.criticalWounds.${w.location}`)}
              {' · '}
              {w.wounds === 'death' ? tr('wfrp.criticalWounds.death') : `${w.wounds} ${tr('wfrp.combat.ap')}`}
              {w.roll !== null ? ` · ${tr('wfrp.criticalWounds.rollLabel')} ${w.roll}` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => removeWound(w.id)} style={styles.del} hitSlop={8}>
            <Trash2 size={14} color={t.colors.danger} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}

      {!rolling ? (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={openRoll}>
            <Plus size={14} color={t.colors.accent} />
            <Text style={[styles.addText, { color: t.colors.accent }]}>{tr('wfrp.criticalWounds.roll')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addBtn, { borderColor: t.colors.accent }]} onPress={() => setPicking(true)}>
            <Plus size={14} color={t.colors.accent} />
            <Text style={[styles.addText, { color: t.colors.accent }]}>{tr('wfrp.criticalWounds.search')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.rollPanel, { borderColor: t.colors.border }]}>
          <Text style={[styles.panelLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.criticalWounds.location')}</Text>
          <View style={styles.chipRow}>
            {LOCATIONS.map(loc => (
              <TouchableOpacity
                key={loc}
                onPress={() => setLocation(loc)}
                style={[styles.chip, {
                  borderColor: t.colors.accent,
                  backgroundColor: location === loc ? t.colors.accent : 'transparent',
                }]}
              >
                <Text style={{ color: location === loc ? t.colors.accentText : t.colors.accent }}>
                  {tr(`wfrp.criticalWounds.${loc}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {editingRoll ? (
            <TextInput
              style={[styles.rollInput, { color: t.colors.text, borderColor: t.colors.accent }]}
              value={rollDraft}
              onChangeText={setRollDraft}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              maxLength={3}
              onSubmitEditing={commitRollEdit}
              onBlur={commitRollEdit}
            />
          ) : (
            <TouchableOpacity onPress={startEditingRoll} accessibilityLabel={tr('wfrp.criticalWounds.editRoll')}>
              <Text style={[styles.rollNumber, { color: t.colors.text }]}>{rollValue}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={reroll} style={[styles.rerollBtn, { borderColor: t.colors.accent }]}>
            <Text style={{ color: t.colors.accent }}>{tr('wfrp.criticalWounds.reroll')}</Text>
          </TouchableOpacity>

          <Text style={[styles.panelLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.criticalWounds.preview')}</Text>
          <Text style={[styles.previewText, { color: t.colors.text }]}>
            {match ? `${match.name} — ${match.wounds === 'death' ? tr('wfrp.criticalWounds.death') : match.wounds}` : tr('wfrp.criticalWounds.noMatch')}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.panelBtn} onPress={() => setRolling(false)}>
              <Text style={{ color: t.colors.textSecondary }}>{tr('wfrp.criticalWounds.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.panelBtn} onPress={addFromRoll} disabled={!match}>
              <Text style={{ color: match ? t.colors.accent : t.colors.textMuted, fontWeight: '700' }}>
                {tr('wfrp.criticalWounds.confirm')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ContentPicker
        visible={picking}
        category="critical_wound"
        title={tr('wfrp.criticalWounds.title')}
        subtitle={(r) => `${tr(`wfrp.criticalWounds.${r.location as Location}`)} · ${r.wounds === 'death' ? tr('wfrp.criticalWounds.death') : r.wounds}`}
        onSelect={addFromPicker}
        onClose={() => setPicking(false)}
      />

      <WikiModal
        visible={wikiWound !== null}
        title={wikiWound?.name ?? ''}
        subtitle={wikiWound ? `${tr(`wfrp.criticalWounds.${wikiWound.location}`)}${wikiWound.roll !== null ? ` · ${tr('wfrp.criticalWounds.rollLabel')} ${wikiWound.roll}` : ''}` : undefined}
        body={wikiWound?.description ?? ''}
        onClose={() => setWikiId(null)}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 8, gap: 8 },
  name: { fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
  del: { padding: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, borderStyle: 'dashed', padding: 10, flex: 1, justifyContent: 'center' },
  addText: { fontWeight: '600', fontSize: 13 },
  rollPanel: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 8 },
  panelLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  rollNumber: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  rollInput: { fontSize: 32, fontWeight: '700', textAlign: 'center', borderWidth: 1, borderRadius: 8 },
  rerollBtn: { alignSelf: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  previewText: { fontSize: 13 },
  panelBtn: { padding: 10 },
});
