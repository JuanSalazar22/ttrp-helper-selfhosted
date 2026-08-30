import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/** Portraits are stored inline as `data:image/jpeg;base64,...` URIs in the
 *  `portrait_uri` column itself — not as separate files. This was originally a
 *  file-per-character design (expo-file-system's document directory), but
 *  `getInfoAsync`/`makeDirectoryAsync`/`copyAsync` all throw "not available on
 *  web" at runtime (confirmed live, not just in docs) — expo-file-system's
 *  directory/file-management calls are native-only, even via the /legacy
 *  compat path. A data: URI works identically on every platform this app
 *  targets (RN's <Image> and the web <img> both render it directly, no file
 *  I/O involved), and it's simpler: no per-character file lifecycle to manage,
 *  no directory to create once, no orphaned file to clean up on removal.
 *
 *  Trade-off: each portrait's ~50-100KB (512x512 JPEG, base64-inflated) lives
 *  in the character's SQLite row instead of on disk. Fine at this app's scale
 *  (a personal/self-hosted character list, not thousands of rows). */

/** Read an arbitrary source URI (blob:/data:/file:, whatever the picker or
 *  image manipulator handed back) as base64. `expo-image-manipulator`'s
 *  output is a file:// URI on native and a blob: URI on web — `readAsStringAsync`
 *  handles the former; the latter needs fetch+FileReader instead, since
 *  expo-file-system doesn't operate on blob: URIs at all. */
async function uriToBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const blob = await fetch(uri).then(r => r.blob());
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string; // "data:<mime>;base64,<data>"
        resolve(result.slice(result.indexOf(',') + 1));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

/** Turn an already-cropped image (from PortraitCropper) into the `data:` URI
 *  to store as `portrait_uri`. */
export async function saveLocalPortrait(_characterId: string, sourceUri: string): Promise<string> {
  const base64 = await uriToBase64(sourceUri);
  return `data:image/jpeg;base64,${base64}`;
}

/** No-op: nothing lives on disk to clean up — removing a portrait is just
 *  clearing `portrait_uri` in SQLite (done by the caller). Kept as a function
 *  (rather than removing every call site) so a future on-disk caching layer
 *  could slot back in here without touching callers again. */
export async function deleteLocalPortrait(_characterId: string): Promise<void> {}

/** Extract the base64 payload back out of a `data:` portrait URI — null if
 *  there isn't one set. No file read involved; the data already IS the URI. */
export function readLocalPortraitBase64(portraitUri: string | null): string | null {
  if (!portraitUri) return null;
  const i = portraitUri.indexOf(',');
  return i === -1 ? null : portraitUri.slice(i + 1);
}
