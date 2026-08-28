import { useState, useEffect } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { X, LogOut } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation, type TKey } from '@/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { isValidEmail } from '@/auth/email';
import { isValidPassword } from '@/auth/password';
import { softDeleteAllCharacters } from '@/sync/cloudCharacters';
import { confirmRemove } from '@/lib/confirm';

type Props = { visible: boolean; onClose: () => void };

type Mode = 'signIn' | 'signUp' | 'forgot' | 'emailSent';
type EmailSentKind = 'signUp' | 'reset';

/** Bottom sheet for email+password auth (signed-out) or profile (signed-in). */
export function AccountSheet({ visible, onClose }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const {
    session, loading, configured, displayName,
    signInWithPassword, signUp, sendPasswordReset, signOut, updateDisplayName, deleteAccount,
  } = useAuth();

  // mode + form fields (signed-out flow)
  const [mode, setMode] = useState<Mode>('signIn');
  const [emailSentKind, setEmailSentKind] = useState<EmailSentKind>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // display-name edit (signed-in flow)
  const [nameInput, setNameInput] = useState('');
  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // danger-zone (signed-in flow)
  const [removingCloud, setRemovingCloud] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Reset signed-out form whenever the sheet closes or mode changes.
  useEffect(() => {
    if (!visible) {
      setMode('signIn');
      setEmail(''); setPassword(''); setConfirm('');
      setFormError(null); setSubmitting(false);
      setNameStatus('idle');
    }
  }, [visible]);

  // Wipe stale error/secret on mode switch.
  useEffect(() => { setFormError(null); setPassword(''); setConfirm(''); }, [mode]);

  // Prefill display name when the session changes.
  useEffect(() => {
    setNameInput(displayName ?? '');
    setNameStatus('idle');
  }, [displayName]);

  async function onSignIn() {
    if (!isValidEmail(email)) { setFormError(tr('settings.account.invalidEmail')); return; }
    if (!isValidPassword(password)) { setFormError(tr('settings.account.passwordTooShort')); return; }
    setSubmitting(true); setFormError(null);
    const { error } = await signInWithPassword(email, password);
    setSubmitting(false);
    if (error) { setFormError(error); return; }
    // success → AuthProvider session updates → sheet re-renders into signedIn view.
  }

  async function onSignUp() {
    if (!isValidEmail(email)) { setFormError(tr('settings.account.invalidEmail')); return; }
    if (!isValidPassword(password)) { setFormError(tr('settings.account.passwordTooShort')); return; }
    if (password !== confirm) { setFormError(tr('settings.account.passwordMismatch')); return; }
    setSubmitting(true); setFormError(null);
    const { error, needsConfirmation } = await signUp(email, password);
    setSubmitting(false);
    if (error) { setFormError(error); return; }
    if (needsConfirmation) { setEmailSentKind('signUp'); setMode('emailSent'); }
  }

  async function onForgot() {
    if (!isValidEmail(email)) { setFormError(tr('settings.account.invalidEmail')); return; }
    setSubmitting(true); setFormError(null);
    const { error } = await sendPasswordReset(email);
    setSubmitting(false);
    if (error) { setFormError(error); return; }
    setEmailSentKind('reset'); setMode('emailSent');
  }

  async function onSaveName() {
    setNameStatus('saving');
    const { error } = await updateDisplayName(nameInput);
    setNameStatus(error ? 'idle' : 'saved');
  }

  const nameDirty = nameInput !== (displayName ?? '');

  function onRemoveCloudData() {
    confirmRemove(
      tr,
      tr('settings.account.removeCloudDataConfirm'),
      async () => {
        setRemovingCloud(true);
        setAccountError(null);
        const { ok } = await softDeleteAllCharacters(session);
        setRemovingCloud(false);
        if (!ok) { setAccountError(tr('settings.account.removeCloudDataError')); return; }
        signOut();
        onClose();
      },
      tr('settings.account.removeCloudData'),
    );
  }

  async function onDeleteAccount() {
    setDeletingAccount(true);
    setAccountError(null);
    const { error } = await deleteAccount();
    setDeletingAccount(false);
    if (error) { setAccountError(tr('settings.account.deleteAccountError')); return; }
    setDeleteConfirmOpen(false);
    onClose();
  }

  function renderBody() {
    if (!configured) {
      return <Text style={[styles.hint, { color: t.colors.textMuted }]}>{tr('settings.account.subtitle')}</Text>;
    }
    if (loading) {
      return <ActivityIndicator color={t.colors.accent} style={{ marginTop: 24 }} />;
    }
    if (session) return renderSignedIn();
    if (mode === 'emailSent') return renderEmailSent();
    if (mode === 'signUp') return renderSignUp();
    if (mode === 'forgot') return renderForgot();
    return renderSignIn();
  }

  function emailField(autoFocus = false) {
    return (
      <TextInput
        style={[styles.input, inputColors()]}
        value={email}
        onChangeText={(v) => { setEmail(v); if (formError) setFormError(null); }}
        placeholder={tr('settings.account.emailPlaceholder')}
        placeholderTextColor={t.colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        inputMode="email"
        autoFocus={autoFocus}
      />
    );
  }

  function passwordField(placeholderKey: TKey, value: string, setValue: (v: string) => void) {
    return (
      <TextInput
        style={[styles.input, inputColors()]}
        value={value}
        onChangeText={(v) => { setValue(v); if (formError) setFormError(null); }}
        placeholder={tr(placeholderKey)}
        placeholderTextColor={t.colors.textMuted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
    );
  }

  function inputColors() {
    return { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary };
  }

  function primaryButton(label: string, onPress: () => void) {
    return (
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: t.colors.accent, opacity: submitting ? 0.6 : 1 }]}
        onPress={onPress}
        disabled={submitting}
      >
        <Text style={[styles.saveBtnText, { color: t.colors.accentText }]}>
          {submitting ? tr('settings.account.signingIn') : label}
        </Text>
      </TouchableOpacity>
    );
  }

  function errorRow() {
    return formError ? <Text style={[styles.errorText, { color: t.colors.danger }]}>{formError}</Text> : null;
  }

  function linkButton(labelKey: TKey, onPress: () => void) {
    return (
      <TouchableOpacity onPress={onPress} hitSlop={8}>
        <Text style={[styles.link, { color: t.colors.accent }]}>{tr(labelKey)}</Text>
      </TouchableOpacity>
    );
  }

  function renderSignIn() {
    return (
      <View style={styles.body}>
        {emailField(true)}
        {passwordField('settings.account.passwordPlaceholder', password, setPassword)}
        {errorRow()}
        {primaryButton(tr('settings.account.signIn'), onSignIn)}
        <View style={styles.linkRow}>
          {linkButton('settings.account.forgotPassword', () => setMode('forgot'))}
        </View>
        <View style={styles.divider as any} />
        <View style={styles.linkRowCenter}>
          {linkButton('settings.account.createAccountLink', () => setMode('signUp'))}
        </View>
      </View>
    );
  }

  function renderSignUp() {
    return (
      <View style={styles.body}>
        {emailField(true)}
        {passwordField('settings.account.passwordPlaceholder', password, setPassword)}
        {passwordField('settings.account.confirmPassword', confirm, setConfirm)}
        {errorRow()}
        {primaryButton(tr('settings.account.createAccount'), onSignUp)}
        <View style={styles.linkRowCenter}>
          {linkButton('settings.account.backToSignIn', () => setMode('signIn'))}
        </View>
      </View>
    );
  }

  function renderForgot() {
    return (
      <View style={styles.body}>
        <Text style={[styles.hint, { color: t.colors.textMuted }]}>{tr('settings.account.subtitle')}</Text>
        {emailField(true)}
        {errorRow()}
        {primaryButton(tr('settings.account.sendResetLink'), onForgot)}
        <View style={styles.linkRowCenter}>
          {linkButton('settings.account.backToSignIn', () => setMode('signIn'))}
        </View>
      </View>
    );
  }

  function renderEmailSent() {
    const key: TKey = emailSentKind === 'signUp'
      ? 'settings.account.confirmEmailSent'
      : 'settings.account.resetEmailSent';
    return (
      <View style={styles.body}>
        <Text style={[styles.hint, { color: t.colors.text }]}>{tr(key)}</Text>
      </View>
    );
  }

  function renderSignedIn() {
    if (!session) return null;
    return (
      <View style={styles.body}>
        <View style={[styles.avatar, { backgroundColor: t.colors.accent + '22' }]}>
          <Text style={[styles.avatarText, { color: t.colors.accent }]}>
            {(displayName ?? session.user.email ?? '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.emailLabel, { color: t.colors.textSecondary }]} numberOfLines={1}>
          {session.user.email}
        </Text>
        <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>
          {tr('settings.account.displayName')}
        </Text>
        <TextInput
          style={[styles.input, inputColors()]}
          value={nameInput}
          onChangeText={(v) => { setNameInput(v); if (nameStatus === 'saved') setNameStatus('idle'); }}
          placeholder={tr('settings.account.displayNamePlaceholder')}
          placeholderTextColor={t.colors.textMuted}
          autoCorrect={false}
        />
        {(nameDirty || nameStatus === 'saved') && (
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: t.colors.accent, opacity: nameStatus === 'saving' ? 0.6 : 1 }]}
            onPress={onSaveName}
            disabled={nameStatus === 'saving'}
          >
            <Text style={[styles.saveBtnText, { color: t.colors.accentText }]}>
              {nameStatus === 'saved' ? tr('settings.account.nameSaved') : tr('settings.account.saveName')}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.signOutBtn, { borderColor: t.colors.border }]}
          onPress={() => { signOut(); onClose(); }}
        >
          <LogOut size={16} color={t.colors.danger} />
          <Text style={[styles.signOutText, { color: t.colors.danger }]}>{tr('settings.account.signOut')}</Text>
        </TouchableOpacity>

        <View style={[styles.dangerZone, { borderColor: t.colors.border }]}>
          <Text style={[styles.dangerZoneTitle, { color: t.colors.textMuted }]}>
            {tr('settings.account.dangerZone')}
          </Text>

          <TouchableOpacity
            style={[styles.dangerBtn, { borderColor: t.colors.border, opacity: removingCloud ? 0.6 : 1 }]}
            onPress={onRemoveCloudData}
            disabled={removingCloud}
          >
            <Text style={[styles.dangerBtnText, { color: t.colors.text }]}>
              {tr('settings.account.removeCloudData')}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.dangerHint, { color: t.colors.textMuted }]}>
            {tr('settings.account.removeCloudDataHint')}
          </Text>

          <TouchableOpacity
            style={[styles.dangerBtn, { borderColor: t.colors.danger, marginTop: 12 }]}
            onPress={() => setDeleteConfirmOpen(true)}
          >
            <Text style={[styles.dangerBtnText, { color: t.colors.danger }]}>
              {tr('settings.account.deleteAccount')}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.dangerHint, { color: t.colors.textMuted }]}>
            {tr('settings.account.deleteAccountHint')}
          </Text>

          {accountError && <Text style={[styles.errorText, { color: t.colors.danger }]}>{accountError}</Text>}
        </View>

        {deleteConfirmOpen && (
          <View style={[styles.confirmBox, { borderColor: t.colors.danger, backgroundColor: t.colors.backgroundSecondary }]}>
            <Text style={[styles.confirmTitle, { color: t.colors.text }]}>
              {tr('settings.account.deleteAccountConfirmTitle')}
            </Text>
            <Text style={[styles.confirmBody, { color: t.colors.textMuted }]}>
              {tr('settings.account.deleteAccountConfirmBody')}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.btn, { borderColor: t.colors.border }]}
                onPress={() => setDeleteConfirmOpen(false)}
              >
                <Text style={[styles.btnText, { color: t.colors.textMuted }]}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { backgroundColor: t.colors.danger, opacity: deletingAccount ? 0.6 : 1 }]}
                onPress={onDeleteAccount}
                disabled={deletingAccount}
              >
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>
                  {deletingAccount ? tr('settings.account.deletingAccount') : tr('common.delete')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
              {tr('settings.account.title')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}><X size={22} color={t.colors.textMuted} /></TouchableOpacity>
          </View>
          {renderBody()}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, padding: 20, paddingBottom: 36 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { gap: 12 },
  hint: { fontSize: 14, lineHeight: 20 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 4 },
  avatarText: { fontSize: 24, fontWeight: '700' },
  emailLabel: { textAlign: 'center', fontSize: 13, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  saveBtn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 13, marginTop: 8 },
  signOutText: { fontSize: 15, fontWeight: '600' },
  errorText: { fontSize: 12, marginTop: -4 },
  link: { fontSize: 14, fontWeight: '600' },
  linkRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  linkRowCenter: { alignItems: 'center', marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#0002', marginVertical: 8 },
  dangerZone: { marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  dangerZoneTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  dangerBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  dangerBtnText: { fontSize: 14, fontWeight: '600' },
  dangerHint: { fontSize: 12, lineHeight: 16, marginBottom: 4 },
  confirmBox: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 12, gap: 10 },
  confirmTitle: { fontSize: 15, fontWeight: '700' },
  confirmBody: { fontSize: 13, lineHeight: 18 },
  confirmActions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnPrimary: { borderWidth: 0 },
  btnText: { fontSize: 14, fontWeight: '600' },
});
