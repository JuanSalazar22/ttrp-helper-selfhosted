import { View, Text, StyleSheet } from 'react-native';
import { Cloud, CloudOff, RefreshCw, CloudCog } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, type TKey } from '@/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { useSync } from '@/sync/SyncProvider';
import type { SyncStatus } from '@/sync/syncStatus';

const ICON: Record<SyncStatus, typeof Cloud> = {
  idle: Cloud,
  syncing: RefreshCw,
  offline: CloudOff,
  error: CloudCog,
};
const LABEL_KEY: Record<SyncStatus, TKey> = {
  idle: 'sync.backedUp',
  syncing: 'sync.syncing',
  offline: 'sync.offline',
  error: 'sync.error',
};

/** Compact sync-state badge for the list header. Renders nothing when signed out. */
export function SyncBadge() {
  const t = useTheme();
  const tr = useTranslation();
  const { session } = useAuth();
  const { status } = useSync();
  if (!session) return null;

  const Icon = ICON[status];
  const color = status === 'offline' || status === 'error' ? t.colors.danger : t.colors.textMuted;
  return (
    <View style={styles.row}>
      <Icon size={14} color={color} />
      <Text style={[styles.text, { color }]}>{tr(LABEL_KEY[status])}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { fontSize: 12, fontWeight: '500' },
});
