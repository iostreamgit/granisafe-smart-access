import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PunchType } from '@granisafe/shared';
import { computeIsLate, parseShiftStartMinutes } from './late.util';

describe('parseShiftStartMinutes', () => {
  it('parses HH:MM:SS', () => {
    assert.equal(parseShiftStartMinutes('08:00:00'), 8 * 60);
    assert.equal(parseShiftStartMinutes('08:15:30'), 8 * 60 + 15 + 0.5);
  });

  it('rejects invalid values', () => {
    assert.equal(parseShiftStartMinutes('25:00'), null);
    assert.equal(parseShiftStartMinutes('nope'), null);
  });
});

describe('computeIsLate', () => {
  const shift = '08:00:00';
  const grace = 10;

  it('marks ENTRY late after shift + grace (UTC)', () => {
    const punchedAt = new Date('2026-08-03T08:11:00.000Z');
    assert.equal(computeIsLate(PunchType.ENTRY, punchedAt, shift, grace), true);
  });

  it('allows ENTRY within grace window', () => {
    const punchedAt = new Date('2026-08-03T08:10:00.000Z');
    assert.equal(computeIsLate(PunchType.ENTRY, punchedAt, shift, grace), false);
  });

  it('never marks EXIT late', () => {
    const punchedAt = new Date('2026-08-03T18:00:00.000Z');
    assert.equal(computeIsLate(PunchType.EXIT, punchedAt, shift, grace), false);
  });

  it('returns false when shiftStart missing', () => {
    const punchedAt = new Date('2026-08-03T12:00:00.000Z');
    assert.equal(computeIsLate(PunchType.ENTRY, punchedAt, null, grace), false);
  });
});
