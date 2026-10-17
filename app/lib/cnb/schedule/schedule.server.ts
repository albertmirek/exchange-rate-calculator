const TIME_ZONE = "Europe/Prague";
// CNB publishes on weekdays at 14:30 Prague time.
const PUBLICATION_TIME = "14:30";
// Within this hour after the publication we expect the new rates any minute.
const FAST_RETRY_UNTIL = "15:30";

const FAST_RETRY_MS = 5 * 60 * 1000;
const SLOW_RETRY_MS = 30 * 60 * 1000;

const pragueFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * The wall clock in Prague at the given instant, as `date` ("2026-10-16") and
 * `time` ("14:30"). Both are zero-padded, so they compare correctly as strings.
 * Comparing wall-clock times avoids any daylight saving arithmetic.
 */
function getPragueTime(instant: Date): { date: string; time: string } {
  const parts: Record<string, string> = {};
  for (const { type, value } of pragueFormat.formatToParts(instant)) {
    parts[type] = value;
  }
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function getPreviousDate(date: string): string {
  const previous = new Date(`${date}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

function isWeekday(date: string): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

/** The Prague date of the most recent publication that has already happened. */
function getLastPublicationDate(now: Date): string {
  const pragueTime = getPragueTime(now);
  let publicationDate = pragueTime.time >= PUBLICATION_TIME ? pragueTime.date : getPreviousDate(pragueTime.date);
  while (!isWeekday(publicationDate)) {
    publicationDate = getPreviousDate(publicationDate);
  }
  return publicationDate;
}

/** Whether a publication has happened between `fetchedAt` and `now`. */
export function hasPublicationSince(fetchedAt: Date, now: Date): boolean {
  const fetched = getPragueTime(fetchedAt);
  const publicationDate = getLastPublicationDate(now);
  return (
    fetched.date < publicationDate ||
    (fetched.date === publicationDate && fetched.time < PUBLICATION_TIME)
  );
}

/**
 * Minimum wait between attempts to fetch rates that have not appeared yet:
 * 5 minutes in the first hour after a publication, 30 afterwards.
 */
export function getRetryIntervalMs(now: Date): number {
  const { date, time } = getPragueTime(now);
  const isWithinFastRetryInterval = date === getLastPublicationDate(now) && time < FAST_RETRY_UNTIL;
  return isWithinFastRetryInterval ? FAST_RETRY_MS : SLOW_RETRY_MS;
}
