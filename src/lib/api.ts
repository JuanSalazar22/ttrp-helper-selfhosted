import { apiConfig } from '@/lib/config';

export type ApiUser = { id: string; name: string };
export type CloudCharacter = { id: string; system: string; data: any; updated_at: string; deleted_at: string | null };

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiConfig.url}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

export async function getMe(): Promise<ApiUser | null> {
  const res = await apiFetch('/me');
  if (!res.ok) return null;
  const { user } = await res.json();
  return user;
}

export async function updateMe(name: string): Promise<{ error: string | null }> {
  const res = await apiFetch('/me', { method: 'PATCH', body: JSON.stringify({ name }) });
  if (!res.ok) return { error: (await res.json().catch(() => ({})))?.error ?? 'request failed' };
  return { error: null };
}

export async function registerOptions(name: string) {
  const res = await apiFetch('/register/options', { method: 'POST', body: JSON.stringify({ name }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return res.json() as Promise<{ cid: string; options: any }>;
}

export async function registerVerify(cid: string, credential: any): Promise<ApiUser> {
  const res = await apiFetch('/register/verify', { method: 'POST', body: JSON.stringify({ cid, credential }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return (await res.json()).user;
}

export async function loginOptions() {
  const res = await apiFetch('/login/options', { method: 'POST' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return res.json() as Promise<{ cid: string; options: any }>;
}

export async function loginVerify(cid: string, credential: any): Promise<ApiUser> {
  const res = await apiFetch('/login/verify', { method: 'POST', body: JSON.stringify({ cid, credential }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return (await res.json()).user;
}

export async function logout(): Promise<void> {
  await apiFetch('/logout', { method: 'POST' });
}

export async function startDeviceLinkOptions() {
  const res = await apiFetch('/passkey/link/options', { method: 'POST' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return res.json() as Promise<{ code: string; options: any }>;
}

export async function verifyDeviceLink(code: string, credential: any): Promise<ApiUser> {
  const res = await apiFetch('/passkey/link/verify', { method: 'POST', body: JSON.stringify({ code, credential }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return (await res.json()).user;
}

/** Called by the *receiving* device, which has only the 6-digit code and no
 *  session of its own, to fetch the registration options tied to that code. */
export async function exchangeLinkCode(code: string): Promise<{ options: any }> {
  const res = await apiFetch('/passkey/link/exchange', { method: 'POST', body: JSON.stringify({ code }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'request failed');
  return res.json();
}

export async function deleteAccountRequest(): Promise<{ error: string | null }> {
  const res = await apiFetch('/account/delete', { method: 'POST' });
  if (!res.ok) return { error: (await res.json().catch(() => ({})))?.error ?? 'request failed' };
  return { error: null };
}

export async function getCharacters(): Promise<CloudCharacter[]> {
  const res = await apiFetch('/characters');
  if (!res.ok) return [];
  return (await res.json()).characters;
}

export async function putCharacter(id: string, system: string, data: any): Promise<{ updated_at: string } | null> {
  const res = await apiFetch(`/characters/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ system, data }) });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteCharacterRequest(id: string): Promise<void> {
  await apiFetch(`/characters/${encodeURIComponent(id)}/delete`, { method: 'POST' });
}

export async function clearCharactersRequest(): Promise<{ ok: boolean }> {
  const res = await apiFetch('/characters/clear', { method: 'POST' });
  return { ok: res.ok };
}
