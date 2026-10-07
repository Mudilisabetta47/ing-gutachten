import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

export type Theme = 'dark' | 'light' | 'system';

/** Standard ist HELL. Wer in seinem Konto „Dunkel“ oder „System“ gewählt hat, behält das (Cookie nur für /admin). */
export function readTheme(jar: Pick<ReadonlyRequestCookies, 'get'>): Theme {
  const v = jar.get('ing_theme')?.value;
  return v === 'dark' || v === 'system' ? v : 'light';
}
