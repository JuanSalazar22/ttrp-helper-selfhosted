import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { X, Plus } from 'lucide-react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, useLocale } from '@/i18n';
import { OriginEditor } from '@/components/wfrp4e/OriginEditor';
import { useWfrpLibrary } from '@/hooks/useWfrpLibrary';
import { applyOrigin, type GrantedTalent } from '@/types/wfrp4e';
import { getContentByNames } from '@/db/queries';
import type { Wfrp4eCharacter, WfrpOriginDef } from '@/types/wfrp4e';

type Props = {
  visible: boolean;
  character: Wfrp4eCharacter;
  onChange: (patch: Partial<Wfrp4eCharacter>) => void;
  onClose: () => void;
};

export function OriginPicker({ visible, character, onChange, onClose }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const db = useSQLiteContext();
  const { locale } = useLocale();
  const { origins, addOrigin } = useWfrpLibrary();
  const [editing, setEditing] = useState(false);

  async function buildLookup(def: WfrpOriginDef): Promise<Map<string, GrantedTalent>> {
    const records = await getContentByNames(db, 'talent', def.talents ?? [], locale);
    return new Map(records.map(r => [
      r.name.toLowerCase(),
      { name: r.name, description: r.description as string | undefined, tests: r.tests as string | undefined },
    ]));
  }

  async function applyDef(def: WfrpOriginDef) {
    onChange(applyOrigin(character, def, uuidv4, await buildLookup(def)));
    onClose();
  }

  async function handleCreate(def: WfrpOriginDef) {
    addOrigin(def);
    onChange(applyOrigin(character, def, uuidv4, await buildLookup(def)));
    setEditing(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: t.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
          <Text style={[styles.title, { color: t.colors.text }]}>{tr('wfrp.origin.title')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={tr('wfrp.origin.closeA11y')}>
            <X size={24} color={t.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {origins.length === 0 && (
            <Text style={[styles.empty, { color: t.colors.textMuted }]}>{tr('wfrp.origin.empty')}</Text>
          )}
          {origins.map(def => (
            <TouchableOpacity
              key={def.name}
              style={[styles.row, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
              onPress={() => applyDef(def)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowName, { color: t.colors.text }]}>{def.name}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.createBtn, { borderColor: t.colors.accent }]}
            onPress={() => setEditing(true)}
            activeOpacity={0.7}
          >
            <Plus size={16} color={t.colors.accent} />
            <Text style={[styles.createText, { color: t.colors.accentFg }]}>{tr('wfrp.origin.createNew')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <OriginEditor
        visible={editing}
        onSubmit={handleCreate}
        onClose={() => setEditing(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { padding: 16, gap: 8 },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  row: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  rowName: { fontSize: 16, fontWeight: '700' },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', marginTop: 4 },
  createText: { fontSize: 14, fontWeight: '600' },
});
