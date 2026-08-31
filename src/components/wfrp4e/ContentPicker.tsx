import { useEffect, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useLocale, useTranslation } from '@/i18n';
import { searchContent } from '@/db/queries';
import { hoverTitle } from '@/lib/a11y';
import type { ContentCategory, ContentRecord } from '@/data/wfrp-content';

type Props = {
  visible: boolean;
  category: ContentCategory;
  title: string;
  onSelect: (record: ContentRecord, query: string) => void;
  onClose: () => void;
  /** Optional one-line summary shown under each result name. */
  subtitle?: (r: ContentRecord) => string;
  /** If set, shows a "Use <query>" row so the typed text can be used as a custom entry. */
  onUseCustom?: (query: string) => void;
  /** Optional client-side filter applied to search results (e.g. weapons-only). */
  filter?: (r: ContentRecord) => boolean;
};

// Searchable autocomplete over the seeded WFRP book content. Picking a row hands the
// full trimmed record back to the caller, which prefills its own add/edit form.
export function ContentPicker({ visible, category, title, onSelect, onClose, subtitle, onUseCustom, filter }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const db = useSQLiteContext();
  const { locale } = useLocale();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ContentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await searchContent(db, category, query, filter ? 200 : 40, locale);
        if (!cancelled) setRows(filter ? res.filter(filter).slice(0, 60) : res);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [visible, query, category, db]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={tr('wfrp.contentPicker.closeA11y')} {...hoverTitle(tr('wfrp.contentPicker.closeA11y'))}><X size={22} color={t.colors.textMuted} /></TouchableOpacity>
          </View>

          <View style={[styles.searchBox, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
            <Search size={16} color={t.colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: t.colors.text }]}
              placeholder={tr('wfrp.contentPicker.searchPlaceholder')}
              placeholderTextColor={t.colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={rows}
            keyExtractor={(r) => r.id}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListHeaderComponent={
              onUseCustom && query.trim() ? (
                <TouchableOpacity
                  style={[styles.customRow, { borderColor: t.colors.accent }]}
                  onPress={() => { onUseCustom(query.trim()); onClose(); }}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.customText, { color: t.colors.accentFg }]} numberOfLines={1}>
                    {tr('wfrp.contentPicker.useCustom', { query: query.trim() })}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              loading
                ? <ActivityIndicator style={{ marginTop: 24 }} color={t.colors.accent} />
                : <Text style={[styles.empty, { color: t.colors.textMuted }]}>{tr('wfrp.contentPicker.noMatches')}</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.rowItem, { borderBottomColor: t.colors.border }]}
                onPress={() => { onSelect(item, query); onClose(); }}
                activeOpacity={0.6}
              >
                <Text style={[styles.rowName, { color: t.colors.text }]} numberOfLines={1}>{item.name}</Text>
                {subtitle && <Text style={[styles.rowSub, { color: t.colors.textSecondary }]} numberOfLines={1}>{subtitle(item)}</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, padding: 20, paddingBottom: 28, height: '80%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 15 },
  list: { marginTop: 8 },
  empty: { textAlign: 'center', marginTop: 24, fontSize: 13, paddingHorizontal: 20 },
  customRow: { paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8, borderStyle: 'dashed', marginBottom: 6 },
  customText: { fontSize: 14, fontWeight: '700' },
  rowItem: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
});
