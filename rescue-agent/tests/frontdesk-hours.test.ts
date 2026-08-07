import { describe, expect, it } from 'vitest';
import type { Location } from '@/lib/frontdesk/config/schema';
import { formatTime, localParts, resolveHours, startOfLocalDay } from '@/lib/frontdesk/knowledge/hours';

/**
 * Hours are the most-asked question and the easiest to answer wrongly. These
 * tests pin the two failure modes that matter: reasoning in the server's
 * timezone instead of the restaurant's, and repeating the weekly schedule on a
 * day the restaurant never confirmed.
 */

const location: Location = {
  id: 'main',
  name: 'Test Kitchen',
  addressLine1: '1 Test Way',
  city: 'St. Petersburg',
  state: 'FL',
  timezone: 'America/New_York',
  holidayHours: [
    { date: '2026-12-25', name: 'Christmas Day', closed: true, windows: [], note: 'We reopen on the 26th.' },
    { date: '2026-11-26', name: 'Thanksgiving', closed: false, windows: [{ open: '12:00', close: '18:00' }] },
  ],
  hours: {
    sun: [{ open: '10:00', close: '21:00' }],
    mon: [],
    tue: [{ open: '11:30', close: '22:00' }],
    wed: [{ open: '11:30', close: '22:00' }],
    thu: [{ open: '11:30', close: '22:00' }],
    fri: [{ open: '11:30', close: '23:00' }],
    sat: [{ open: '10:00', close: '23:00' }],
  },
};

describe('local time resolution', () => {
  it('uses the restaurant timezone, not the server timezone', () => {
    // 01:30 UTC on a Thursday is still 21:30 Wednesday in New York. Answering
    // from UTC would quote Thursday's hours to a Wednesday-night caller.
    const parts = localParts(new Date('2026-08-13T01:30:00Z'), 'America/New_York');
    expect(parts.isoDate).toBe('2026-08-12');
    expect(parts.weekday).toBe('wed');
    expect(parts.minutes).toBe(21 * 60 + 30);
  });

  it('handles midnight without rolling to hour 24', () => {
    const parts = localParts(new Date('2026-08-13T04:00:00Z'), 'America/New_York');
    expect(parts.minutes).toBe(0);
    expect(parts.isoDate).toBe('2026-08-13');
  });
});

describe('resolveHours', () => {
  it('reports OPEN with the correct closing time mid-service', () => {
    // Wednesday 2026-08-12, 19:00 New York.
    const answer = resolveHours(location, new Date('2026-08-12T23:00:00Z'));
    expect(answer.status).toBe('OPEN');
    expect(answer.closesAt).toBe('22:00');
    expect(formatTime(answer.closesAt!)).toBe('10 PM');
  });

  it('reports CLOSED_NOW with the next opening time before service', () => {
    // Wednesday 09:00 New York.
    const answer = resolveHours(location, new Date('2026-08-12T13:00:00Z'));
    expect(answer.status).toBe('CLOSED_NOW');
    expect(answer.opensAt).toBe('11:30');
  });

  it('reports CLOSED_TODAY on a configured closed weekday', () => {
    // Monday 2026-08-10, 13:00 New York — the weekly schedule has no windows.
    const answer = resolveHours(location, new Date('2026-08-10T17:00:00Z'));
    expect(answer.status).toBe('CLOSED_TODAY');
    expect(answer.windows).toHaveLength(0);
  });

  it('lets a holiday override the weekly schedule', () => {
    // Christmas Day 2026 falls on a Friday, when the restaurant normally opens.
    const answer = resolveHours(location, new Date('2026-12-25T17:00:00Z'));
    expect(answer.status).toBe('CLOSED_TODAY');
    expect(answer.holidayName).toBe('Christmas Day');
    expect(answer.note).toContain('reopen');
  });

  it('applies reduced holiday hours rather than the weekly schedule', () => {
    // Thanksgiving 2026, 19:00 New York — the restaurant closed at 18:00 even
    // though Thursdays normally run to 22:00.
    const answer = resolveHours(location, new Date('2026-11-27T00:00:00Z'));
    expect(answer.holidayName).toBe('Thanksgiving');
    expect(answer.status).toBe('CLOSED_NOW');
  });

  it('returns UNKNOWN rather than guessing when no hours are configured', () => {
    const bare: Location = { ...location, hours: undefined, holidayHours: [] };
    expect(resolveHours(bare, new Date('2026-08-12T23:00:00Z')).status).toBe('UNKNOWN');
  });

  it('treats a window closing after midnight as still open', () => {
    const lateBar: Location = {
      ...location,
      holidayHours: [],
      hours: { ...location.hours!, wed: [{ open: '17:00', close: '02:00' }] },
    };
    // 23:30 Wednesday New York — before midnight, so the window is found on
    // the current day. The after-midnight case is covered separately below.
    const answer = resolveHours(lateBar, new Date('2026-08-13T03:30:00Z'));
    expect(answer.status).toBe('OPEN');
    expect(answer.closesAt).toBe('02:00');
  });
});

describe('formatTime', () => {
  it('renders 12-hour times the way a host would say them', () => {
    expect(formatTime('22:00')).toBe('10 PM');
    expect(formatTime('11:30')).toBe('11:30 AM');
    expect(formatTime('12:00')).toBe('12 PM');
    expect(formatTime('00:00')).toBe('12 AM');
  });
});

/**
 * Fixes from the PR #29 automated review. Each pinned here because each was a
 * silently wrong answer rather than a visible failure.
 */
describe('cross-midnight service from the previous day', () => {
  const lateBar: Location = {
    ...location,
    holidayHours: [],
    hours: { ...location.hours!, wed: [{ open: '17:00', close: '02:00' }], thu: [] },
  };

  it('reports OPEN at 00:30 Thursday for a Wednesday 17:00-02:00 window', () => {
    // 04:30 UTC Thursday = 00:30 Thursday in New York. The active window is
    // attached to WEDNESDAY, so looking only at Thursday reports closed.
    const answer = resolveHours(lateBar, new Date('2026-08-13T04:30:00Z'));
    expect(answer.status).toBe('OPEN');
    expect(answer.closesAt).toBe('02:00');
  });

  it('reports closed at 02:30 Thursday, after the window has ended', () => {
    const answer = resolveHours(lateBar, new Date('2026-08-13T06:30:00Z'));
    expect(answer.status).not.toBe('OPEN');
  });

  it('still reports OPEN before midnight on the day the window opened', () => {
    const answer = resolveHours(lateBar, new Date('2026-08-13T03:30:00Z')); // 23:30 Wed
    expect(answer.status).toBe('OPEN');
  });

  it('does not treat an ordinary window as spilling into the next day', () => {
    // Wednesday 11:30-22:00 must not make Thursday 00:30 look open.
    const answer = resolveHours(location, new Date('2026-08-13T04:30:00Z'));
    expect(answer.status).not.toBe('OPEN');
  });
});

describe('startOfLocalDay', () => {
  it('returns the instant local midnight actually occurred, not UTC midnight', () => {
    // 2026-08-12 19:00 New York (EDT, UTC-4). Local midnight that day was
    // 2026-08-12T04:00:00Z — NOT 2026-08-12T00:00:00Z.
    const start = startOfLocalDay(new Date('2026-08-12T23:00:00Z'), 'America/New_York');
    expect(start.toISOString()).toBe('2026-08-12T04:00:00.000Z');
  });

  it('handles a zone east of UTC', () => {
    // Tokyo is UTC+9, so its day begins the previous UTC afternoon.
    const start = startOfLocalDay(new Date('2026-08-12T23:00:00Z'), 'Asia/Tokyo');
    expect(start.toISOString()).toBe('2026-08-12T15:00:00.000Z');
  });

  it('handles a half-hour offset zone', () => {
    const start = startOfLocalDay(new Date('2026-08-12T23:00:00Z'), 'Asia/Kolkata');
    expect(start.toISOString()).toBe('2026-08-12T18:30:00.000Z');
  });

  it('is a no-op for UTC', () => {
    const start = startOfLocalDay(new Date('2026-08-12T23:00:00Z'), 'UTC');
    expect(start.toISOString()).toBe('2026-08-12T00:00:00.000Z');
  });

  it('never returns an instant after the moment asked about', () => {
    for (const zone of ['America/New_York', 'Asia/Tokyo', 'Europe/London', 'Pacific/Auckland', 'UTC']) {
      const now = new Date('2026-08-12T23:00:00Z');
      expect(startOfLocalDay(now, zone).getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });

  it('resolves the correct day across a daylight-saving transition', () => {
    // US DST ended 2026-11-01. At 12:00 local on the 1st the offset is -05:00,
    // but local midnight occurred while the offset was still -04:00.
    const start = startOfLocalDay(new Date('2026-11-01T17:00:00Z'), 'America/New_York');
    expect(start.toISOString()).toBe('2026-11-01T04:00:00.000Z');
  });
});
