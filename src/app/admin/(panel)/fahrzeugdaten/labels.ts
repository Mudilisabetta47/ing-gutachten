export const JOB_LABELS: Record<string, [string, 'ok' | 'info' | 'warn' | 'danger' | 'muted']> = {
  PREVIEW: ['Vorschau', 'info'], RUNNING: ['Läuft', 'info'], PAUSED: ['Pausiert', 'warn'], COMPLETED: ['Abgeschlossen', 'ok'], FAILED: ['Fehlgeschlagen', 'danger'], CANCELLED: ['Abgebrochen', 'muted'],
};

