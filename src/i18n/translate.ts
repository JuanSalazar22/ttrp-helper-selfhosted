import type { TParams } from './types';

// Walk a dot-path into a nested dictionary; return the node or undefined.
function lookup(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) =>
      node && typeof node === 'object'
        ? (node as Record<string, unknown>)[part]
        : undefined,
    dict,
  );
}

// Replace {name} placeholders with params; leave unknown placeholders intact.
function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_m, k: string) =>
    params[k] != null ? String(params[k]) : `{${k}}`,
  );
}

function isPlural(node: unknown): node is { one?: string; other?: string } {
  return !!node && typeof node === 'object' && 'other' in (node as object);
}

/**
 * Resolve a message key against the active dictionary, falling back to `fallback`
 * (English). Supports {placeholder} interpolation and {one,other} pluralisation
 * driven by params.count. Never throws: an absent key returns the key string.
 */
export function translate(
  active: unknown,
  fallback: unknown,
  key: string,
  params?: TParams,
): string {
  let node = lookup(active, key);
  if (node == null) node = lookup(fallback, key);

  if (isPlural(node)) {
    const count = typeof params?.count === 'number' ? params.count : 0;
    const form: 'one' | 'other' = count === 1 ? 'one' : 'other';
    let pn = (node as Record<string, unknown>)[form];
    if (pn == null) pn = lookup(fallback, `${key}.${form}`);
    node = pn;
  }

  if (typeof node !== 'string') {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(`[i18n] missing translation key: ${key}`);
    }
    return key;
  }
  return interpolate(node, params);
}
