import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { CharacterData, GameSystem } from '@/types';

function fileName(data: CharacterData): string {
  return `${(data.name || 'character').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.ttrp.json`;
}

export async function exportCharacter(data: CharacterData): Promise<void> {
  const json = JSON.stringify(data, null, 2);

  // Web: trigger a browser download (expo-sharing has no web implementation).
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(data);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const uri = `${FileSystem.cacheDirectory}${fileName(data)}`;
  await FileSystem.writeAsStringAsync(uri, json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export character' });
  }
}

export type ImportedCharacter = { system: GameSystem; data: CharacterData };

// Validate the parsed JSON is one of our character files. Version is NOT checked here —
// on-load migration brings older schemas up to date, so any schemaVer is accepted.
function parseImported(text: string): ImportedCharacter {
  const parsed = JSON.parse(text);
  if (parsed?.system !== 'dnd5e' && parsed?.system !== 'wfrp4e') {
    throw new Error('Unrecognized character file.');
  }
  return { system: parsed.system as GameSystem, data: parsed as CharacterData };
}

export async function pickAndParseCharacter(): Promise<ImportedCharacter | null> {
  // Web: use a file input + FileReader (DocumentPicker's web uri isn't readable via FS).
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = () => {
          try { resolve(parseImported(String(reader.result))); }
          catch (e) { reject(e); }
        };
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsText(file);
      };
      input.click();
    });
  }

  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (res.canceled) return null;
  const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
  return parseImported(text);
}

// Picks a raw JSON file with no shape validation — unlike pickAndParseCharacter, this
// isn't one of our own exports, so there's nothing of ours to check it against.
// src/lib/hammergenImport.ts's hammergenToCharacter() does the actual transformation.
export async function pickHammergenFile(): Promise<unknown | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = () => {
          try { resolve(JSON.parse(String(reader.result))); }
          catch (e) { reject(e); }
        };
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsText(file);
      };
      input.click();
    });
  }

  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (res.canceled) return null;
  const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
  return JSON.parse(text);
}
