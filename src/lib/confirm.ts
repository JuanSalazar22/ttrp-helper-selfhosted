import { Alert, Platform } from 'react-native';
import type { TFunc } from '@/i18n';

/**
 * Cross-platform destructive confirm. react-native-web does not render `Alert.alert`
 * (it's a no-op), so on web we fall back to the browser `confirm` dialog — this is why
 * delete buttons silently did nothing on web. Calls `onConfirm` only if the user agrees.
 *
 * `tr` is threaded in rather than imported: the active locale lives in React state
 * (LocaleProvider), so it cannot be read from module scope. Every call site is inside a
 * component that already calls useTranslation().
 *
 * Note the web branch cannot translate its buttons — `window.confirm` renders
 * browser-supplied, browser-localized OK/Cancel labels that cannot be customized.
 */
export function confirmRemove(
  tr: TFunc,
  message: string,
  onConfirm: () => void,
  title?: string,
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert(title ?? tr('common.removeTitle'), message, [
    { text: tr('common.cancel'), style: 'cancel' },
    { text: tr('common.remove'), style: 'destructive', onPress: onConfirm },
  ]);
}
