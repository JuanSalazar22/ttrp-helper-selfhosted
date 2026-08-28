import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheck } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, useLocale, type TKey } from '@/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { textStyle } from '@/tokens/typography';
import { submitBugReport, type ReportCategory } from '@/sync/bugReports';
import type { GameSystem } from '@/types';

const CATEGORIES: { id: ReportCategory; labelKey: TKey }[] = [
  { id: 'bug', labelKey: 'report.categoryBug' },
  { id: 'content', labelKey: 'report.categoryContent' },
  { id: 'suggestion', labelKey: 'report.categorySuggestion' },
];

const SYSTEMS: { id: GameSystem | null; labelKey: TKey }[] = [
  { id: null, labelKey: 'report.systemNone' },
  { id: 'dnd5e', labelKey: 'report.systemDnd' },
  { id: 'wfrp4e', labelKey: 'report.systemWfrp' },
];

// Matches the database check constraint on bug_reports.message, so the limit surfaces
// as a character counter instead of a server-side rejection.
const MAX_MESSAGE = 5000;

// Matches the database check constraint on bug_reports.contact_email.
const MAX_EMAIL = 320;

export default function ReportScreen() {
  const t = useTheme();
  const tr = useTranslation();
  const { locale } = useLocale();
  const { session } = useAuth();

  const [category, setCategory] = useState<ReportCategory>('bug');
  const [system, setSystem] = useState<GameSystem | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(session?.user.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = message.trim().length > 0 && !submitting;

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    const { ok } = await submitBugReport({
      category,
      message,
      contactEmail: email,
      system,
      locale,
    });
    setSubmitting(false);
    if (!ok) { setError(tr('report.error')); return; }
    setSent(true);
  }

  // Email is deliberately left untouched here — it's pre-filled from the signed-in
  // session and should persist across "send another" within the same visit.
  function reset() {
    setCategory('bug');
    setSystem(null);
    setMessage('');
    setError(null);
    setSent(false);
  }

  function chipRow<T extends string | null>(
    options: { id: T; labelKey: TKey }[],
    value: T,
    onSelect: (v: T) => void,
  ) {
    return (
      <View style={styles.chipRow}>
        {options.map(o => {
          const active = o.id === value;
          return (
            <TouchableOpacity
              key={String(o.id)}
              style={[styles.chip, {
                borderColor: active ? t.colors.accent : t.colors.border,
                backgroundColor: active ? t.colors.accent + '18' : t.colors.backgroundSecondary,
              }]}
              onPress={() => onSelect(o.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, { color: active ? t.colors.accent : t.colors.textMuted }]}>
                {tr(o.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (sent) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top']}>
        <View style={styles.successWrap}>
          <CircleCheck size={48} color={t.colors.success} />
          <Text style={[styles.successTitle, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
            {tr('report.successTitle')}
          </Text>
          <Text style={[styles.successBody, { color: t.colors.textSecondary }]}>
            {tr('report.successBody')}
          </Text>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: t.colors.border }]}
            onPress={reset}
          >
            <Text style={[styles.secondaryBtnText, { color: t.colors.accent }]}>
              {tr('report.sendAnother')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.heading, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
            {tr('report.title')}
          </Text>
          <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>
            {tr('report.subtitle')}
          </Text>

          <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('report.category')}</Text>
          {chipRow(CATEGORIES, category, setCategory)}

          <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('report.system')}</Text>
          {chipRow(SYSTEMS, system, setSystem)}

          <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('report.message')}</Text>
          <TextInput
            style={[styles.messageInput, {
              color: t.colors.text,
              borderColor: t.colors.border,
              backgroundColor: t.colors.backgroundSecondary,
            }]}
            value={message}
            onChangeText={setMessage}
            placeholder={tr('report.messagePlaceholder')}
            placeholderTextColor={t.colors.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={MAX_MESSAGE}
          />
          <Text style={[styles.counter, { color: t.colors.textMuted }]}>
            {message.length} / {MAX_MESSAGE}
          </Text>

          <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>{tr('report.contactEmail')}</Text>
          <TextInput
            style={[styles.input, {
              color: t.colors.text,
              borderColor: t.colors.border,
              backgroundColor: t.colors.backgroundSecondary,
            }]}
            value={email}
            onChangeText={setEmail}
            placeholder={tr('report.contactEmailPlaceholder')}
            placeholderTextColor={t.colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            inputMode="email"
            maxLength={MAX_EMAIL}
          />
          <Text style={[styles.hint, { color: t.colors.textMuted }]}>{tr('report.contactEmailHint')}</Text>

          {error && <Text style={[styles.error, { color: t.colors.danger }]}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitBtn, {
              backgroundColor: t.colors.accent,
              opacity: canSubmit ? 1 : 0.5,
            }]}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            <Text style={[styles.submitBtnText, { color: t.colors.accentText }]}>
              {submitting ? tr('report.submitting') : tr('report.submit')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 8 },
  heading: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  fieldLabel: { ...textStyle.fieldLabel, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  messageInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, minHeight: 140,
  },
  counter: { fontSize: 11, textAlign: 'right' },
  hint: { fontSize: 12, lineHeight: 16 },
  error: { fontSize: 13, marginTop: 4 },
  submitBtn: { borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  submitBtnText: { fontSize: 15, fontWeight: '700' },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successTitle: { fontSize: 22, fontWeight: '700' },
  successBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  secondaryBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, marginTop: 12 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
});
