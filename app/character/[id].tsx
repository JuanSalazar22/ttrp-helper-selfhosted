import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { useCharacter } from '@/hooks/useCharacter';
import { ErrorState } from '@/components/ui/ErrorState';
import { Dnd5eSheet } from '@/components/dnd5e/Dnd5eSheet';
import { Wfrp4eSheet } from '@/components/wfrp4e/Wfrp4eSheet';
import { exportCharacter } from '@/lib/transfer';
import type { Dnd5eCharacter } from '@/types/dnd5e';
import type { Wfrp4eCharacter } from '@/types/wfrp4e';

export default function CharacterSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const { row, data, loading, saving, patch, setPortrait } = useCharacter(id);

  async function handleExport() {
    if (!data) return;
    try {
      await exportCharacter(data);
    } catch (e) {
      Alert.alert(tr('sheet.exportFailedTitle'), e instanceof Error ? e.message : tr('sheet.exportFailedBody'));
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top']}>
        <ActivityIndicator style={{ flex: 1 }} color={t.colors.accent} />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top']}>
        <ErrorState title={tr('sheet.notFoundTitle')} body={tr('sheet.notFoundBody')} onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.backBar, { borderBottomColor: t.colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/')} activeOpacity={0.7}>
          <ChevronLeft size={22} color={t.colors.accent} />
          <Text style={[styles.backText, { color: t.colors.accent }]}>{tr('sheet.back')}</Text>
        </TouchableOpacity>
        <View style={styles.backRight}>
          {saving && <Text style={[styles.savingText, { color: t.colors.textMuted }]}>{tr('sheet.saving')}</Text>}
          <TouchableOpacity onPress={handleExport} activeOpacity={0.7} hitSlop={8}>
            <Share2 size={20} color={t.colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {data.system === 'dnd5e'
        ? <Dnd5eSheet character={data as Dnd5eCharacter} onChange={(p) => patch(p)} portraitUri={row?.portrait_uri ?? null} onPortraitChange={setPortrait} />
        : <Wfrp4eSheet character={data as Wfrp4eCharacter} onChange={(p) => patch(p)} portraitUri={row?.portrait_uri ?? null} onPortraitChange={setPortrait} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: 15, fontWeight: '500' },
  backRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  savingText: { fontSize: 12 },
});
