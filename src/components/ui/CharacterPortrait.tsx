import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, StyleSheet, ActionSheetIOS, Platform, Alert } from 'react-native';
import { UserRound } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { PortraitCropper } from './PortraitCropper';

type Props = {
  /** 'lg' (default) is the full block shown atop the left column in wide layout.
   *  'sm' is a small tappable thumbnail (e.g. next to the name in the header). */
  size?: 'sm' | 'lg';
  portraitUri: string | null;
  onChange: (croppedUri: string | null) => void;
};

/** Portrait: shows the character's photo if set, otherwise a placeholder.
 *  Tapping opens the library picker (no photo yet) or a change/remove menu
 *  (photo already set). Picking a photo opens PortraitCropper before it's saved. */
export function CharacterPortrait({ size = 'lg', portraitUri, onChange }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [pickedUri, setPickedUri] = useState<string | null>(null);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (result.canceled || result.assets.length === 0) return;
    setPickedUri(result.assets[0].uri);
  }

  function handlePress() {
    if (size === 'sm' && !portraitUri) return void pickPhoto();
    if (size === 'sm' && portraitUri) return openMenu();
    setExpanded(true);
  }

  function openMenu() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [tr('common.changePhoto'), tr('common.removePhoto'), tr('common.cropCancel')], cancelButtonIndex: 2, destructiveButtonIndex: 1 },
        (index) => { if (index === 0) pickPhoto(); else if (index === 1) onChange(null); },
      );
    } else {
      Alert.alert(tr('common.changePhoto'), undefined, [
        { text: tr('common.changePhoto'), onPress: pickPhoto },
        { text: tr('common.removePhoto'), style: 'destructive', onPress: () => onChange(null) },
        { text: tr('common.cropCancel'), style: 'cancel' },
      ]);
    }
  }

  const placeholder = (
    <View style={[styles.frame, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
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
        <TouchableOpacity activeOpacity={0.8} onPress={() => portraitUri ? openMenu() : pickPhoto()}>
          {content}
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.thumb, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}
            onPress={handlePress}
            activeOpacity={0.7}
            accessibilityLabel={portraitUri ? tr('common.changePhoto') : tr('common.addPhoto')}
          >
            {portraitUri ? <Image source={{ uri: portraitUri }} style={styles.thumbImage} /> : <UserRound size={20} color={t.colors.textMuted} />}
          </TouchableOpacity>
          <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
            <View style={styles.overlay}>
              <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setExpanded(false)} />
              {content}
            </View>
          </Modal>
        </>
      )}
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
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
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
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
