// Tarihler yerel saat diliminde YYYY-MM-DD string olarak tutulur.
// Hesaplar UTC gece yarısı üzerinden yapılır; böylece yaz saati geçişleri gün farkını bozmaz.

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcMs(date: string): number {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Geçersiz tarih: ${date}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new Error(`Geçersiz tarih: ${date}`);
  }
  return ms;
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

function fromUtcMs(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** `to - from` takvim günü olarak. */
export function diffDays(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function formatLocalDate(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "9 Ağustos 2026" veya haftanın günüyle "Pazar, 9 Ağustos 2026". */
export function formatDisplayDate(date: string, withWeekday = false): string {
  return new Date(toUtcMs(date)).toLocaleDateString('tr-TR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withWeekday && { weekday: 'long' }),
  });
}

export function todayLocal(): string {
  return formatLocalDate(new Date());
}
