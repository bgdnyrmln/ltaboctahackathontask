// Week maths in Europe/Riga local time (weeks start Monday 00:00), DST-safe.

export const TIME_ZONE = 'Europe/Riga';

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

export function rigaParts(instant: Date): LocalParts {
  const p = Object.fromEntries(fmt.formatToParts(instant).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}

function offsetMs(instant: number): number {
  const p = rigaParts(new Date(instant));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(instant / 60_000) * 60_000;
}

// Riga wall-clock time -> UTC instant.
export function rigaToUtc(date: string, hour = 0, minute = 0): Date {
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hour, minute);
  let guess = wall - offsetMs(wall);
  guess = wall - offsetMs(guess);
  return new Date(guess);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Monday (YYYY-MM-DD) of the Riga week containing the instant.
export function weekStartOf(instant: Date): string {
  const p = rigaParts(instant);
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const dow = (date.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date.toISOString().slice(0, 10), -dow);
}

export function weekRange(weekStart: string): { from: string; to: string } {
  return {
    from: rigaToUtc(weekStart).toISOString(),
    to: rigaToUtc(addDays(weekStart, 7)).toISOString(),
  };
}

// The `count` week starts ending with the week containing `now`, oldest first.
export function recentWeeks(now: Date, count: number): string[] {
  const current = weekStartOf(now);
  return Array.from({ length: count }, (_, i) => addDays(current, -7 * (count - 1 - i)));
}
