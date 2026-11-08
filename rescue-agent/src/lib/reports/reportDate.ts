/**
 * THE CALENDAR DATE PRINTED ON A REPORT.
 *
 * The audit date was the UTC date of the stored timestamp
 * (`toISOString().slice(0, 10)`). An audit completed on a Florida evening
 * after 7 or 8 pm (8 pm Eastern Daylight Time, 7 pm Eastern Standard Time) is
 * already the next day in UTC, so the Leverock's report run on the evening of
 * November 7 printed November 8.
 *
 * The date is now the calendar date in the report's display time zone. The
 * product records no time zone per restaurant (Restaurant has a city and a
 * state only), and the restaurants audited so far are in Florida, so the
 * display zone is America/New_York. Daylight-saving changes are handled by the
 * time-zone database, not by a fixed offset.
 *
 * Display only: the stored timestamps (Audit.createdAt / completedAt) are read,
 * never rewritten, and the same function feeds the web report and the PDF, so
 * the two always print the same date.
 */
export const REPORT_TIME_ZONE = 'America/New_York';

/** The calendar date of `at` in `timeZone`, as YYYY-MM-DD (the format the report already prints). */
export function reportCalendarDate(at: Date, timeZone: string = REPORT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
