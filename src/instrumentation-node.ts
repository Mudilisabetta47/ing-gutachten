import { reportError } from '@/lib/error-report';

export function registerNode() {
  process.on('unhandledRejection', (reason) => { void reportError(reason, { kind: 'unhandledRejection' }); });
  process.on('uncaughtException', (err) => { void reportError(err, { kind: 'uncaughtException' }); });
}

export async function reportRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routeType: string },
) {
  const e = err as Error & { digest?: string };
  await reportError(e, { route: request.path, method: request.method, kind: context.routeType, digest: e.digest });
}
