import * as FileSystem from 'expo-file-system/legacy';

const DIR = `${FileSystem.documentDirectory}portraits/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

/** Copy a (already-cropped) image file into this app's own storage, named by
 *  character id so re-saving a character's portrait overwrites the old file
 *  instead of leaking one per upload. Returns the resulting local file URI. */
export async function saveLocalPortrait(characterId: string, sourceUri: string): Promise<string> {
  await ensureDir();
  const dest = `${DIR}${characterId}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function deleteLocalPortrait(characterId: string): Promise<void> {
  const path = `${DIR}${characterId}.jpg`;
  try { await FileSystem.deleteAsync(path, { idempotent: true }); } catch { /* already gone */ }
}

/** Base64 contents of a character's locally-cached portrait, for uploading —
 *  null if there's no local file (e.g. offline device that hasn't cached the
 *  cloud copy yet). */
export async function readLocalPortraitBase64(characterId: string): Promise<string | null> {
  const path = `${DIR}${characterId}.jpg`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  return FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
}
