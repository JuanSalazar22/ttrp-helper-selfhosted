import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Pencil } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { Section } from '@/components/ui/Section';
import { TextEditModal } from '@/components/ui/TextEditModal';
import { confirmRemove } from '@/lib/confirm';
import type { Dnd5eCharacter } from '@/types/dnd5e';

type Props = {
  character: Dnd5eCharacter;
  onChange?: (patch: Partial<Dnd5eCharacter>) => void;
};

function renderMarkdownLite(text: string, textColor: string, boldColor: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('**') && line.includes('**', 2)) {
      const parts = line.split('**');
      return (
        <Text key={i} style={[styles.line, { color: textColor }]}>
          {parts.map((part, j) =>
            j % 2 === 1
              ? <Text key={j} style={{ color: boldColor, fontWeight: '700' }}>{part}</Text>
              : part
          )}
        </Text>
      );
    }
    if (line === '') return <View key={i} style={styles.spacer} />;
    return <Text key={i} style={[styles.line, { color: textColor }]}>{line}</Text>;
  });
}

type EditField = 'featuresAndTraits' | 'proficienciesAndLanguages' | 'backstory' | null;

export function FeaturesSection({ character, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [editing, setEditing] = useState<EditField>(null);

  const textBlocks: Array<{
    field: EditField & string;
    title: string;
    content: string;
    markdown?: boolean;
  }> = [
    { field: 'featuresAndTraits', title: tr('dnd.sections.featuresAndTraits'), content: character.featuresAndTraits, markdown: true },
    { field: 'proficienciesAndLanguages', title: tr('dnd.sections.proficienciesAndLanguages'), content: character.proficienciesAndLanguages, markdown: true },
    { field: 'backstory', title: tr('dnd.sections.backstory'), content: character.backstory },
  ];

  function removeCondition(index: number) {
    if (!onChange) return;
    confirmRemove(tr, tr('dnd.features.removeConditionConfirm', { name: character.conditions[index].name }), () =>
      onChange({ conditions: character.conditions.filter((_, i) => i !== index) }));
  }

  return (
    <>
      {textBlocks.map(({ field, title, content, markdown }) => {
        if (!content && !onChange) return null;
        return (
          <Section key={field} title={title}>
            <TouchableOpacity
              style={styles.textBlock}
              onPress={() => onChange && setEditing(field as EditField)}
              disabled={!onChange}
              activeOpacity={0.7}
            >
              <View style={styles.textContent}>
                {content
                  ? (markdown
                      ? renderMarkdownLite(content, t.colors.textSecondary, t.colors.text)
                      : <Text style={[styles.line, { color: t.colors.textSecondary }]}>{content}</Text>)
                  : <Text style={[styles.placeholder, { color: t.colors.textMuted }]}>{tr('dnd.features.tapToAdd')}</Text>
                }
              </View>
              {onChange && <Pencil size={14} color={t.colors.textMuted} style={styles.editIcon} />}
            </TouchableOpacity>
          </Section>
        );
      })}

      {(character.conditions.length > 0 || onChange) && (
        <Section title={tr('dnd.sections.conditions')}>
          {character.conditions.length === 0 && (
            <Text style={[styles.placeholder, { color: t.colors.textMuted }]}>{tr('dnd.features.noConditions')}</Text>
          )}
          {character.conditions.map((c, i) => (
            <TouchableOpacity
              key={i}
              style={styles.conditionRow}
              onPress={() => removeCondition(i)}
              disabled={!onChange}
              activeOpacity={0.7}
            >
              <View style={[styles.conditionDot, { backgroundColor: t.colors.danger }]} />
              <Text style={[styles.conditionName, { color: t.colors.danger }]}>{c.name}</Text>
              {c.notes && <Text style={[styles.conditionNotes, { color: t.colors.textMuted }]}>{c.notes}</Text>}
            </TouchableOpacity>
          ))}
        </Section>
      )}

      {character.exhaustionLevel > 0 && (
        <Section title={tr('dnd.sections.exhaustion')}>
          <Text style={[styles.exhaustion, { color: t.colors.danger }]}>{tr('dnd.features.exhaustionLevel', { n: character.exhaustionLevel })}</Text>
        </Section>
      )}

      {/* Text edit modal */}
      {editing && (
        <TextEditModal
          visible={!!editing}
          title={textBlocks.find(b => b.field === editing)?.title ?? ''}
          value={character[editing as 'featuresAndTraits' | 'proficienciesAndLanguages' | 'backstory']}
          onSave={v => onChange?.({ [editing!]: v })}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  textBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  textContent: { flex: 1, gap: 2 },
  editIcon: { marginTop: 2 },
  line: { fontSize: 14, lineHeight: 22 },
  spacer: { height: 8 },
  placeholder: { fontSize: 14, fontStyle: 'italic' },
  conditionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  conditionDot: { width: 8, height: 8, borderRadius: 4 },
  conditionName: { fontSize: 14, fontWeight: '600' },
  conditionNotes: { fontSize: 13, flex: 1 },
  exhaustion: { fontSize: 16, fontWeight: '700' },
});
