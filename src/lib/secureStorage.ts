import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;
const HEAD = '__chunks__:';

async function getItem(key: string): Promise<string | null> {
  const head = await SecureStore.getItemAsync(key);
  if (head == null) return null;
  if (!head.startsWith(HEAD)) return head;
  const count = parseInt(head.slice(HEAD.length), 10);
  let out = '';
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(`${key}.${i}`);
    if (part == null) return null;
    out += part;
  }
  return out;
}

// Delete any chunk keys left by a previous (larger) value, so a shrinking write
// can't leave orphaned `.i` chunks that corrupt a later read.
async function clearOldChunks(key: string): Promise<void> {
  const head = await SecureStore.getItemAsync(key);
  if (head?.startsWith(HEAD)) {
    const count = parseInt(head.slice(HEAD.length), 10);
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
}

async function setItem(key: string, value: string): Promise<void> {
  await clearOldChunks(key);
  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  const count = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(key, `${HEAD}${count}`);
  for (let i = 0; i < count; i++) {
    await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
}

async function removeItem(key: string): Promise<void> {
  await clearOldChunks(key);
  await SecureStore.deleteItemAsync(key);
}

/** supabase-js auth storage interface, backed by chunked SecureStore. */
export function makeSecureStoreAdapter() {
  return { getItem, setItem, removeItem };
}

// On web, returning undefined lets supabase-js fall back to localStorage.
export const authStorage = Platform.OS === 'web' ? undefined : makeSecureStoreAdapter();
