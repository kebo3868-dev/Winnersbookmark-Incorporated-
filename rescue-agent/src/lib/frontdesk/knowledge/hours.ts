import { WEEKDAYS, type Location, type ServiceWindow, type Weekday } from '../config/schema';

/**
 * Hours resolution.
 *
 * "What time do you close tonight?" is the most common question a restaurant
 * receives and the easiest one to get subtly wrong. Two rules govern this file:
 *
 * 1. All reasoning happens in the LOCATION's timezone, never the server's.
 *    A Florida restaurant answered from a UTC server would report the wrong
 *    day for every call after 7pm.
 * 2. A configured holiday always wins over the weekly schedule, and a date
 *    with no configured hours produces UNKNOWN rather than a guess. Repeating
 *    the regular schedule on Christmas Day is exactly the fabrication this
 *    product must never commit.
 */

export type HoursStatus = 'OPEN' | 'CLOSED_NOW' | 'CLOSED_TODAY' | 'UNKNOWN';

export interface HoursAnswer {
  status: HoursStatus;
  /** Local calendar date used for the answer (YYYY-MM-DD). */
  localDate: string;
  weekday: Weekday;
  /** Windows that apply to the day asked about. Empty when closed. */
  windows: ServiceWindow[];
  /** Set when the day is governed by a configured holiday entry. */
  holidayName: string | null;
  /** Closing time (HH:MM) of the window in progress or next up today. */
  closesAt: string | null;
  /** Opening time (HH:MM) of the next window later today. */
  opensAt: string | null;
  note: string | null;
}

/** Parts of a date rendered in a specific IANA timezone. */
export function localParts(date: Date, timezone: string): { isoDate: string; weekday: Weekday; minutes: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  // 'en-US' hour12:false renders midnight as '24' in some runtimes.
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const weekdayMap: Record<string, Weekday> = {
    Sun: 'sun',
    Mon: 'mon',
    Tue: 'tue',
    Wed: 'wed',
    Thu: 'thu',
    Fri: 'fri',
    Sat: 'sat',
  };
  return {
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekdayMap[parts.weekday as string] ?? 'sun',
    minutes: hour * 60 + minute,
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * A window whose close is at or before its open crosses midnight (e.g. the bar
 * closes at 02:00). Treated as ending on the following day.
 */
function windowEndMinutes(window: ServiceWindow): number {
  const open = toMinutes(window.open);
  const close = toMinutes(window.close);
  return close <= open ? close + 24 * 60 : close;
}

/** Resolve the windows that apply on a specific local date. */
export function windowsForDate(
  location: Location,
  isoDate: string,
  weekday: Weekday,
): { windows: ServiceWindow[]; holidayName: string | null; note: string | null; known: boolean } {
  const holiday = location.holidayHours.find((h) => h.date === isoDate);
  if (holiday) {
    return {
      windows: holiday.closed ? [] : holiday.windows,
      holidayName: holiday.name ?? 'a holiday',
      note: holiday.note ?? null,
      // A holiday entry is authoritative even when it lists no windows: the
      // restaurant told us it is closed, which is verified information.
      known: true,
    };
  }
  if (!location.hours) return { windows: [], holidayName: null, note: null, known: false };
  return { windows: location.hours[weekday], holidayName: null, note: null, known: true };
}

/** Answer "are you open / when do you close" for a location at an instant. */
export function resolveHours(location: Location, now: Date): HoursAnswer {
  const { isoDate, weekday, minutes } = localParts(now, location.timezone);
  const { windows, holidayName, note, known } = windowsForDate(location, isoDate, weekday);

  const base: HoursAnswer = {
    status: 'UNKNOWN',
    localDate: isoDate,
    weekday,
    windows,
    holidayName,
    closesAt: null,
    opensAt: null,
    note,
  };

  if (!known) return base;
  if (windows.length === 0) return { ...base, status: 'CLOSED_TODAY' };

  const sorted = [...windows].sort((a, b) => toMinutes(a.open) - toMinutes(b.open));
  const current = sorted.find((w) => minutes >= toMinutes(w.open) && minutes < windowEndMinutes(w));
  if (current) {
    return { ...base, status: 'OPEN', closesAt: current.close };
  }

  const next = sorted.find((w) => toMinutes(w.open) > minutes);
  if (next) {
    return { ...base, status: 'CLOSED_NOW', opensAt: next.open, closesAt: next.close };
  }
  return { ...base, status: 'CLOSED_NOW' };
}

/** Human-readable 12-hour time, e.g. "10 PM", "9:30 PM". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

const WEEKDAY_LABEL: Record<Weekday, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

export function weekdayLabel(day: Weekday): string {
  return WEEKDAY_LABEL[day];
}

export function formatWindows(windows: ServiceWindow[]): string {
  return windows
    .map((w) => `${formatTime(w.open)} to ${formatTime(w.close)}${w.label ? ` (${w.label})` : ''}`)
    .join(', ');
}

/** Full week summary, used when a customer asks for hours generally. */
export function formatWeek(location: Location): string | null {
  if (!location.hours) return null;
  return WEEKDAYS.map((day) => {
    const windows = location.hours![day];
    return `${WEEKDAY_LABEL[day]}: ${windows.length === 0 ? 'Closed' : formatWindows(windows)}`;
  }).join('\n');
}
