/** Nur interne Admin-Pfade als Weiterleitungsziel zulassen (kein Open Redirect). */
export function safeNext(value?: string | null): string {
  if (value && /^\/studio\/?$/.test(value)) return '/studio/';
  if (!value || !value.startsWith('/admin') || value.startsWith('//') || value.includes('\\') || value.includes('://')) return '/admin';
  return value;
}
