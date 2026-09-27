import { PunchType } from '@granisafe/shared';

/** Parse "HH:MM" or "HH:MM:SS" into minutes since midnight. */
export function parseShiftStartMinutes(shiftStart: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(shiftStart.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours * 60 + minutes + seconds / 60;
}

/**
 * ENTRY is late when punched after shiftStart + grace (UTC clock of punchedAt).
 * EXIT is never late. Missing/invalid shiftStart → not late.
 */
export function computeIsLate(
  punchType: string,
  punchedAt: Date,
  shiftStart: string | null | undefined,
  lateGraceMinutes: number,
): boolean {
  if (punchType !== PunchType.ENTRY || !shiftStart) return false;
  const shiftMinutes = parseShiftStartMinutes(shiftStart);
  if (shiftMinutes === null) return false;

  const punchMinutes =
    punchedAt.getUTCHours() * 60 + punchedAt.getUTCMinutes() + punchedAt.getUTCSeconds() / 60;

  const grace = Number.isFinite(lateGraceMinutes) ? Math.max(0, lateGraceMinutes) : 0;
  return punchMinutes > shiftMinutes + grace;
}
