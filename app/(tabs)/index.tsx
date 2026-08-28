import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Plus, Upload, Dices, Copy, Trash2, User, Search } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useCharacterList } from '@/hooks/useCharacterList';
import { useTranslation, useLocale } from '@/i18n';
import { useAuth } from '@/auth/AuthProvider';

import type { CharacterRow, GameSystem } from '@/types';
import { SyncBadge } from '@/components/SyncBadge';
import { AccountSheet } from '@/components/ui/AccountSheet';
import { CreateCharacterModal } from '@/components/ui/CreateCharacterModal';
import { DeleteCharacterModal } from '@/components/ui/DeleteCharacterModal';
import { extractTags, matchesQuery } from '@/lib/characterSearch';

const SYSTEM_LABEL: Record<GameSystem, string> = {
  dnd5e: 'D&D 5e',
  wfrp4e: 'WFRP 4e',
};

function CharacterCard({
  row,
  onPress,
  onDuplicate,
  onDelete,
}: {
  row: CharacterRow;
  onPress: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const tr = useTranslation();
  const { locale } = useLocale();
  const data = JSON.parse(row.data);
  const subtitle = row.system === 'dnd5e'
    ? `${data.class || 'Unknown class'} · ${data.race || 'Unknown race'}`
    : `${data.species || 'Unknown species'} · ${data.currentCareer || 'No career'}`;
  const tags = extractTags(row);

  const updated = new Date(row.updated_at);
  const updatedStr = updated.toLocaleDateString(locale, { month: 'short', day: 'numeric' });

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.systemBadge, { backgroundColor: t.colors.accent + '22', borderColor: t.colors.accent }]}>
          <Text style={[styles.systemText, { color: t.colors.accent }]}>{SYSTEM_LABEL[row.system]}</Text>
        </View>
        <Text style={[styles.charName, { color: t.colors.text, fontFamily: t.fontFamily.serif }]} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={[styles.charSub, { color: t.colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
        {tags.length > 0 && (
          <View style={styles.tagsRow}>
            {tags.map((tag, i) => (
              <View key={`${tag}-${i}`} style={[styles.tagChip, { borderColor: t.colors.accent, backgroundColor: t.colors.accent + '14' }]}>
                <Text style={[styles.tagChipText, { color: t.colors.accent }]} numberOfLines={1}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={styles.cardRight}>
        <Text style={[styles.updatedText, { color: t.colors.textMuted }]}>{updatedStr}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={onDuplicate} hitSlop={8} style={styles.cardAction} accessibilityLabel={tr('characters.duplicateA11y', { name: row.name })}>
            <Copy size={16} color={t.colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.cardAction} accessibilityLabel={tr('characters.deleteA11y', { name: row.name })}>
            <Trash2 size={16} color={t.colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Character list screen (all platforms — expo-sqlite works on web too)
function CharacterListScreen() {
  const t = useTheme();
  const tr = useTranslation();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [deleting, setDeleting] = useState<CharacterRow | null>(null);
  const [query, setQuery] = useState('');
  const { characters, loading, refresh, create, remove, duplicate, importCharacter } = useCharacterList();
  const { session, configured, displayName } = useAuth();

  const filtered = useMemo(
    () => (query.trim() ? characters.filter(c => matchesQuery(c, query)) : characters),
    [characters, query],
  );

  // Refresh list when screen re-focuses (coming back from a sheet)
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  async function handleCreate(system: GameSystem, name: string) {
    const id = await create(system, name);
    router.push(`/character/${id}`);
  }

  async function handleImport() {
    try {
      const id = await importCharacter();
      if (id) router.push(`/character/${id}`);
    } catch (e) {
      Alert.alert(tr('characters.importFailedTitle'), e instanceof Error ? e.message : tr('characters.importFailedBody'));
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
          {tr('characters.title')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <SyncBadge />
          {configured && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: t.colors.backgroundSecondary }]}
              onPress={() => setShowAccount(true)}
              activeOpacity={0.8}
            >
              {session && (displayName ?? session.user.email) ? (
                <View style={[styles.avatarBadge, { backgroundColor: t.colors.accent }]}>
                  <Text style={[styles.avatarChar, { color: t.colors.accentText }]}>
                    {(displayName ?? session.user.email ?? '?')[0].toUpperCase()}
                  </Text>
                </View>
              ) : (
                <User size={18} color={t.colors.accent} />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.addButton, { backgroundColor: t.colors.backgroundSecondary }]} onPress={handleImport} activeOpacity={0.8}>
            <Upload size={18} color={t.colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: t.colors.accent }]} onPress={() => setShowCreate(true)} activeOpacity={0.8}>
            <Plus size={20} color={t.colors.accentText} />
          </TouchableOpacity>
        </View>
      </View>

      {loading && characters.length === 0 ? (
        <ActivityIndicator color={t.colors.accent} style={{ marginTop: 40 }} />
      ) : characters.length === 0 ? (
        <View style={styles.empty}>
          <Dices size={48} color={t.colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: t.colors.text }]}>{tr('characters.emptyTitle')}</Text>
          <Text style={[styles.emptyBody, { color: t.colors.textMuted }]}>
            {tr('characters.emptyBody')}
          </Text>
        </View>
      ) : (
        <>
          <View style={[styles.searchWrap, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
            <Search size={16} color={t.colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={tr('characters.searchPlaceholder')}
              placeholderTextColor={t.colors.textMuted}
              style={[styles.searchInput, { color: t.colors.text }]}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyBody, { color: t.colors.textMuted }]}>
                {tr('characters.noMatches', { query: query.trim() })}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={r => r.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <CharacterCard
                  row={item}
                  onPress={() => router.push(`/character/${item.id}`)}
                  onDuplicate={() => duplicate(item.id)}
                  onDelete={() => setDeleting(item)}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
          )}
        </>
      )}

      <CreateCharacterModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />

      <DeleteCharacterModal
        visible={deleting !== null}
        name={deleting?.name ?? ''}
        onConfirm={() => { if (deleting) remove(deleting.id); }}
        onClose={() => setDeleting(null)}
      />

      <AccountSheet visible={showAccount} onClose={() => setShowAccount(false)} />
    </SafeAreaView>
  );
}

export default function CharactersScreen() {
  return <CharacterListScreen />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 30, fontWeight: '700' },
  addButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarChar: { fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  cardLeft: { flex: 1, gap: 4 },
  cardRight: { alignItems: 'flex-end', gap: 8 },
  cardActions: { flexDirection: 'row', gap: 12 },
  cardAction: { padding: 2 },
  systemBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  systemText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  charName: { fontSize: 18, fontWeight: '700' },
  charSub: { fontSize: 12 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tagChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  tagChipText: { fontSize: 10, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  updatedText: { fontSize: 11 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyBody: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  previewButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  previewText: { fontSize: 15, fontWeight: '600' },
});
