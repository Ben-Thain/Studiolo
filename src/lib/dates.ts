/**
 * en-GB dates for the home screens, in the viewer's time zone (the caller
 * passes it; on the server that is UTC until the client re-renders).
 */

function parts(date: Date, timeZone: string | undefined) {
  const values = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => values.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "9 Nov". */
export function formatDayMonth(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(date);
}

/** "Just now" under a minute ago, "Today, 09:42" for today, else "6 Nov". */
export function formatLastEdited(
  date: Date,
  now: Date = new Date(),
  timeZone?: string,
): string {
  if (Number.isNaN(date.getTime())) return "";
  const age = now.getTime() - date.getTime();
  // A little clock skew (a just-made copy stamped by the database a moment
  // "ahead" of this device) still reads as Just now.
  if (age < 60_000 && age > -60_000) return "Just now";
  if (parts(date, timeZone) === parts(now, timeZone)) {
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
    return `Today, ${time}`;
  }
  return formatDayMonth(date, timeZone);
}
