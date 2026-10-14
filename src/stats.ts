import { addDays } from './dates';
import { INTERVALS, isDue } from './scheduler';
import { MODES, type Card, type Mode, type Progress, type ReviewLog } from './types';

export interface ModeStats {
  due: number;
  /** Bugün sorulacaklar, bekledikleri kontrolün aralığına göre: "1 gün önceki: 12, 3 gün önceki: 8…" */
  breakdown: { interval: number; count: number }[];
  mastered: number;
}

export interface HomeStats {
  total: number;
  addedToday: number;
  modes: Record<Mode, ModeStats>;
}

export function homeStats(cards: readonly Card[], today: string): HomeStats {
  const modes = {} as Record<Mode, ModeStats>;
  for (const mode of MODES) {
    const byStage = new Array<number>(INTERVALS.length).fill(0);
    let mastered = 0;
    for (const c of cards) {
      const p = c.progress[mode];
      if (p.mastered) mastered++;
      else if (isDue(p, today)) byStage[p.stage]++;
    }
    const breakdown = byStage
      .map((count, stage) => ({ interval: INTERVALS[stage + 1], count }))
      .filter((b) => b.count > 0);
    modes[mode] = { due: breakdown.reduce((n, b) => n + b.count, 0), breakdown, mastered };
  }
  return {
    total: cards.length,
    addedToday: cards.filter((c) => c.createdDate === today).length,
    modes,
  };
}

/**
 * Kademe isimleri: kartın geçtiği kontrol sayısı (0..7). Son kademe ustalaşılmış karttır.
 * Renkleri index.css'te --stage-0 … --stage-7 olarak tanımlı.
 */
export const STAGES = [
  { name: 'Acemi', note: 'Yeni eklendi' },
  { name: 'Çırak', note: '1 günlük kontrolü geçti' },
  { name: 'Kalfa', note: '3 günlük kontrolü geçti' },
  { name: 'Usta', note: '7 günlük kontrolü geçti' },
  { name: 'Uzman', note: '30 günlük kontrolü geçti' },
  { name: 'Üstat', note: '60 günlük kontrolü geçti' },
  { name: 'Bilge', note: '120 günlük kontrolü geçti' },
  { name: 'Efsane', note: 'Ustalaşıldı, artık sorulmaz' },
] as const;

export function stageOf(p: Progress): (typeof STAGES)[number] & { index: number } {
  const index = p.mastered ? STAGES.length - 1 : p.stage;
  return { ...STAGES[index], index };
}

export function stageDistribution(cards: readonly Card[], mode: Mode): number[] {
  const counts = new Array<number>(STAGES.length).fill(0);
  for (const c of cards) counts[stageOf(c.progress[mode]).index]++;
  return counts;
}

export interface DayActivity {
  date: string;
  correct: number;
  wrong: number;
  added: number;
}

/** `today` dahil son `days` gün. Kaçırılan (missed) kontroller etkinlik sayılmaz. */
export function activityByDay(logs: readonly ReviewLog[], cards: readonly Card[], today: string, days: number): DayActivity[] {
  const result: DayActivity[] = [];
  const index = new Map<string, DayActivity>();
  for (let i = days - 1; i >= 0; i--) {
    const d: DayActivity = { date: addDays(today, -i), correct: 0, wrong: 0, added: 0 };
    result.push(d);
    index.set(d.date, d);
  }
  for (const l of logs) {
    const d = index.get(l.date);
    if (!d) continue;
    if (l.result === 'correct') d.correct++;
    else if (l.result === 'wrong') d.wrong++;
  }
  for (const c of cards) {
    const d = index.get(c.createdDate);
    if (d) d.added++;
  }
  return result;
}

/** Cevap verilen ya da kart eklenen günler. */
export function activeDays(logs: readonly ReviewLog[], cards: readonly Card[]): Set<string> {
  const set = new Set<string>();
  for (const l of logs) if (l.result !== 'missed') set.add(l.date);
  for (const c of cards) set.add(c.createdDate);
  return set;
}

/** Seri: bugünden (bugün henüz çalışılmadıysa dünden) geriye kesintisiz etkin gün sayısı. */
export function streak(active: ReadonlySet<string>, today: string): { days: number; activeToday: boolean } {
  const activeToday = active.has(today);
  let day = activeToday ? today : addDays(today, -1);
  let days = 0;
  while (active.has(day)) {
    days++;
    day = addDays(day, -1);
  }
  return { days, activeToday };
}

/** Arama için: küçük harf; Türkçe ı ve İ'nin noktası katlanır ("Işık" ~ "ışık" ~ "işık"). */
function fold(s: string): string {
  return s.toLowerCase().replace(/ı/g, 'i').normalize('NFD').replace(/̇/g, '').normalize('NFC');
}

export function matchesSearch(card: Card, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return [card.term, card.definition, card.example ?? ''].some((f) => fold(f).includes(q));
}
