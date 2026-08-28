import { en } from './en';

export type Locale = 'en' | 'es';

// Values allowed in interpolation. `count` (number) also drives plural selection.
export type TParams = Record<string, string | number>;

// The full message tree shape, derived from the English source of truth.
export type Messages = typeof en;

// Dot-path keys of the message tree, stopping at string leaves or {one,other} plural leaves.
type PathsOf<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends { one: string; other: string }
      ? K
      : T[K] extends object
        ? `${K}.${PathsOf<T[K]>}`
        : never;
}[keyof T & string];

export type TKey = PathsOf<Messages>;

// Spanish may omit any key; omissions fall back to English at runtime.
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
