export const DISPUTE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function computeReleaseDeadlineMs(completedAtMs: number): number {
  return completedAtMs + DISPUTE_WINDOW_MS;
}
