/** Pragmatic email check for gating the "send link" button (not RFC-complete). */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
