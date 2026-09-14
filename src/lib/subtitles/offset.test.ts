import { describe, expect, it } from 'vitest';
import { computeOffset, findCueAtTime, toCueTime } from './offset';
import { formatOffset, parseTimeInput } from '../time';
import type { Cue } from './types';

describe('parseTimeInput', () => {
  it('reads a full timecode', () => {
    expect(parseTimeInput('1:23:45')).toBe((3600 + 23 * 60 + 45) * 1000);
  });

  it('lets minutes run past sixty', () => {
    expect(parseTimeInput('83:45')).toBe((83 * 60 + 45) * 1000);
  });

  it('reads the spoken form', () => {
    expect(parseTimeInput('1h23')).toBe((3600 + 23 * 60) * 1000);
    expect(parseTimeInput('1h')).toBe(3_600_000);
    expect(parseTimeInput('1h23m45s')).toBe((3600 + 23 * 60 + 45) * 1000);
    expect(parseTimeInput('12min30')).toBe((12 * 60 + 30) * 1000);
  });

  it('reads a bare number as seconds', () => {
    expect(parseTimeInput('5023')).toBe(5_023_000);
    expect(parseTimeInput('12')).toBe(12_000);
    expect(parseTimeInput('45s')).toBe(45_000);
  });

  it('tolerates spaces and a comma typed instead of a colon', () => {
    expect(parseTimeInput('  1:23:45  ')).toBe((3600 + 23 * 60 + 45) * 1000);
    expect(parseTimeInput('12,30')).toBe((12 * 60 + 30) * 1000);
  });

  it('rejects what is not a time', () => {
    expect(parseTimeInput('')).toBeNull();
    expect(parseTimeInput('abc')).toBeNull();
    expect(parseTimeInput('1:99')).toBeNull();
    expect(parseTimeInput('1:70:00')).toBeNull();
    expect(parseTimeInput('1:2:3:4')).toBeNull();
  });
});

describe('offsets', () => {
  it('measures how far ahead the file runs', () => {
    // La réplique est à 1:00 dans le fichier, mais à 1:12 sur le lecteur.
    expect(computeOffset(72_000, 60_000)).toBe(12_000);
    expect(formatOffset(computeOffset(72_000, 60_000))).toBe('+12s');
  });

  it('handles a file that runs late', () => {
    expect(formatOffset(computeOffset(60_000, 63_000))).toBe('-3s');
  });

  it('reads a wildly wrong offset as a duration, not as a pile of seconds', () => {
    expect(formatOffset(4_968_000)).toBe('+1:22:48');
    expect(formatOffset(-180_000)).toBe('-3:00');
  });

  it('round-trips a player time back to file time', () => {
    const offset = computeOffset(72_000, 60_000);
    expect(toCueTime(72_000, offset)).toBe(60_000);
  });
});

describe('findCueAtTime', () => {
  const cues: Cue[] = [
    { index: 0, startMs: 1000, endMs: 2000, text: 'one' },
    { index: 1, startMs: 5000, endMs: 6000, text: 'two' },
    { index: 2, startMs: 9000, endMs: 10_000, text: 'three' },
  ];

  it('finds the line showing at that instant', () => {
    expect(findCueAtTime(cues, 5500)).toBe(1);
    expect(findCueAtTime(cues, 5000)).toBe(1);
    expect(findCueAtTime(cues, 6000)).toBe(1);
  });

  it('falls back to the nearest line during a silence', () => {
    expect(findCueAtTime(cues, 2500)).toBe(0);
    expect(findCueAtTime(cues, 4500)).toBe(1);
  });

  it('clamps outside the file', () => {
    expect(findCueAtTime(cues, 0)).toBe(0);
    expect(findCueAtTime(cues, 60_000)).toBe(2);
  });

  it('says nothing when there is nothing', () => {
    expect(findCueAtTime([], 1000)).toBe(-1);
  });
});
