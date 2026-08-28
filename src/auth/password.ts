export const MIN_PASSWORD_LENGTH = 8;

export function isValidPassword(p: string): boolean {
  return typeof p === 'string' && p.length >= MIN_PASSWORD_LENGTH;
}
