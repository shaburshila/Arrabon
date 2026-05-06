export const DISPUTE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function computeReleaseDeadlineMs(
  scheduledAtMs: number,
  durationMinutes: number,
): number {
  return scheduledAtMs + durationMinutes * 60 * 1000 + DISPUTE_WINDOW_MS;
}
