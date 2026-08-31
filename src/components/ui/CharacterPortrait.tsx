import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { UserRound } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { PortraitCropper } from './PortraitCropper';
import { hoverTitle } from '@/lib/a11y';

type Props = {
  /** 'lg' (default) is the full block shown atop the left column in wide layout.
   *  'sm' is a small tappable thumbnail (e.g. next to the name in the header). */
  size?: 'sm' | 'lg';
  portraitUri: string | null;
  onChange: (croppedUri: string | null) => void;
};

/** Portrait: shows the character's photo if set, otherwise a placeholder.
 *  Tapping opens the library picker (no photo yet) or a change/remove menu
 *  (photo already set). Picking a photo opens PortraitCropper before it's saved.
 *
 *  The change/remove menu is a plain in-app Modal, not ActionSheetIOS/Alert —
 *  Alert.alert is a silent no-op on react-native-web (confirmed live: tapping
 *  a set photo did nothing at all, no error, no dialog), so a native-dialog
 *  approach would work on iOS/Android but quietly break "change" and "remove"
 *  on web, one of this app's three target platforms. A custom modal behaves
 *  identically everywhere instead of depending on each platform's own dialog
 *  support. */
export function CharacterPortrait({ size = 'lg', portraitUri, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const thumbLabel = portraitUri ? tr('common.changePhoto') : tr('common.addPhoto');

  async function pickPhoto() {
    setMenuOpen(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (result.canceled || result.assets.length === 0) return;
    setPickedUri(result.assets[0].uri);
  }

  function removePhoto() {
    setMenuOpen(false);
    onChange(null);
  }

  function handlePress() {
    if (portraitUri) setMenuOpen(true);
    else void pickPhoto();
  }

  function viewPhoto() {
    setMenuOpen(false);
    setExpanded(true);
  }

  const placeholder = (
    <View style={[styles.frame, styles.frameEmpty, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
      <UserRound size={56} color={t.colors.textMuted} />
      <Text style={[styles.label, { color: t.colors.textMuted }]}>{tr('common.addPhoto')}</Text>
    </View>
  );

  const content = portraitUri
    ? <Image source={{ uri: portraitUri }} style={styles.frame} />
    : placeholder;

  return (
    <>
      {size === 'lg' ? (
        <TouchableOpacity activeOpacity={0.8} onPress={handlePress}>
          {content}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.thumb, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
          onPress={handlePress}
          activeOpacity={0.7}
          accessibilityLabel={thumbLabel}
          {...hoverTitle(thumbLabel)}
        >
          {portraitUri ? <Image source={{ uri: portraitUri }} style={styles.thumbImage} /> : <UserRound size={20} color={t.colors.textMuted} />}
        </TouchableOpacity>
      )}

      {/* Full-size view — shared by both sizes, opened from the menu below. Shows
          the stored portrait at its true 1:1 shape and a larger size than either
          inline display (the 'lg' frame itself crops it into a 3:4 card). */}
      <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayDismiss} onPress={() => setExpanded(false)} />
          {portraitUri && (
            <Image source={{ uri: portraitUri }} style={styles.expandedImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayDismiss} onPress={() => setMenuOpen(false)} />
          <View style={[styles.menu, { backgroundColor: t.colors.card, borderColor: t.colors.border }]}>
            <TouchableOpacity style={styles.menuItem} onPress={viewPhoto}>
              <Text style={[styles.menuItemText, { color: t.colors.text }]}>{tr('common.viewPhoto')}</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: t.colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={pickPhoto}>
              <Text style={[styles.menuItemText, { color: t.colors.text }]}>{tr('common.changePhoto')}</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: t.colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={removePhoto}>
              <Text style={[styles.menuItemText, { color: t.colors.danger }]}>{tr('common.removePhoto')}</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: t.colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={() => setMenuOpen(false)}>
              <Text style={[styles.menuItemText, { color: t.colors.textSecondary }]}>{tr('common.cropCancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PortraitCropper
        visible={pickedUri !== null}
        sourceUri={pickedUri}
        onCancel={() => setPickedUri(null)}
        onConfirm={(croppedUri) => { setPickedUri(null); onChange(croppedUri); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    maxWidth: 240,
    aspectRatio: 3 / 4,
    alignSelf: 'center',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  // Placeholder-only dashed "empty drop zone" look — a real photo (styles.frame
  // alone) shouldn't have it.
  frameEmpty: { borderWidth: 1, borderStyle: 'dashed' },
  label: { fontSize: 12, fontWeight: '600' },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  expandedImage: { width: '100%', maxWidth: 400, aspectRatio: 1, borderRadius: 16 },
  // position:absolute (not flex:1) — react-native-web's Modal portal doesn't
  // reliably give a flexed child a definite height to grow into (confirmed
  // live on the crop screen, which had the same flex:1 pattern and rendered
  // at 0 height); sizing directly off the edges avoids depending on that.
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.5)' },
  overlayDismiss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  menu: { borderRadius: 12, borderWidth: 1, minWidth: 220, overflow: 'hidden' },
  menuItem: { paddingVertical: 14, paddingHorizontal: 20 },
  menuItemText: { fontSize: 15, textAlign: 'center' },
  menuDivider: { height: StyleSheet.hairlineWidth },
});
