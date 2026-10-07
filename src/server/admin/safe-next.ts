/** Nur interne Admin-Pfade als Weiterleitungsziel zulassen (kein Open Redirect). */
export function safeNext(value?: string | null): string {
  if (!value || !value.startsWith('/admin') || value.startsWith('//') || value.includes('\\') || value.includes('://')) return '/admin';
  return value;
}
