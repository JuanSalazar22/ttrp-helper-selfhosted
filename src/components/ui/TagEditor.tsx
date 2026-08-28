import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
};

const MAX_TAG_LEN = 24;

function normalize(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LEN);
}

export function TagEditor({ tags, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  function commit() {
    const value = normalize(draft);
    setDraft('');
    setAdding(false);
    if (!value) return;
    if (tags.some(tg => tg.toLowerCase() === value.toLowerCase())) return;
    onChange([...tags, value]);
  }

  function remove(idx: number) {
    onChange(tags.filter((_, i) => i !== idx));
  }

  return (
    <View style={styles.row}>
      {tags.map((tag, i) => (
        <TouchableOpacity
          key={`${tag}-${i}`}
          onPress={() => remove(i)}
          activeOpacity={0.7}
          style={[styles.chip, { backgroundColor: t.colors.accent + '18', borderColor: t.colors.accent }]}
          accessibilityLabel={tr('tags.removeA11y', { tag })}
        >
          <Text style={[styles.chipText, { color: t.colors.accent }]} numberOfLines={1}>{tag}</Text>
          <X size={10} color={t.colors.accent} />
        </TouchableOpacity>
      ))}
      {adding ? (
        <View style={[styles.chip, { borderColor: t.colors.accent, backgroundColor: t.colors.backgroundSecondary }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            placeholder={tr('tags.placeholder')}
            placeholderTextColor={t.colors.textMuted}
            style={[styles.input, { color: t.colors.text }]}
            autoFocus
            maxLength={MAX_TAG_LEN}
            returnKeyType="done"
            blurOnSubmit
          />
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setAdding(true)}
          activeOpacity={0.7}
          style={[styles.chip, styles.addChip, { borderColor: t.colors.textMuted }]}
          accessibilityLabel={tr('tags.addA11y')}
        >
          <Plus size={11} color={t.colors.textMuted} />
          <Text style={[styles.chipText, { color: t.colors.textMuted }]}>{tr('tags.add')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  addChip: { borderStyle: 'dashed' },
  chipText: { fontSize: 11, fontWeight: '600' },
  input: {
    fontSize: 12,
    padding: 0,
    minWidth: 60,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
});
