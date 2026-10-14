// Zamanlama algoritması (SPEC §4). Saf fonksiyonlar; veritabanı veya UI bağımlılığı yok.
// YYYY-MM-DD formatındaki tarihler string olarak doğrudan karşılaştırılabilir.

import { addDays } from './dates';
import { MODES } from './types';
import type { Card, Mode, Progress, ReviewLog, ReviewResult } from './types';

/** I[s + 1]: stage = s olan kartın bir sonraki kontrolüne kadar anchorDate'ten geçen gün. */
export const INTERVALS = [0, 1, 3, 7, 30, 60, 120, 360] as const;
export const MAX_STAGE = INTERVALS.length - 1; // 7

export function newProgress(createdDate: string): Progress {
  return { stage: 0, anchorDate: createdDate, mastered: false };
}

export function newCard(input: {
  id: string;
  term: string;
  definition: string;
  example?: string;
  createdDate: string;
}): Card {
  const card: Card = {
    id: input.id,
    term: input.term,
    definition: input.definition,
    createdDate: input.createdDate,
    progress: {
      recognition: newProgress(input.createdDate),
      writing: newProgress(input.createdDate),
    },
  };
  if (input.example) card.example = input.example;
  return card;
}

/** Bekleyen kontrolün tarihi; ustalaşılmış kart için null. */
export function getDueDate(p: Progress): string | null {
  if (p.mastered) return null;
  return addDays(p.anchorDate, INTERVALS[p.stage + 1]);
}

export function isDue(p: Progress, today: string): boolean {
  const due = getDueDate(p);
  return due !== null && due <= today;
}

/** `date` gününde verilen cevabı uygular. Yanlış/cevapsızda kart o günün kelimesi olur ve bir kademe düşer. */
export function applyReview(p: Progress, result: ReviewResult, date: string): Progress {
  if (p.mastered) throw new Error('Ustalaşılmış kart tekrar sorulamaz');
  if (result === 'correct') {
    const stage = p.stage + 1;
    return { stage, anchorDate: p.anchorDate, mastered: stage === MAX_STAGE };
  }
  return { stage: Math.max(p.stage - 1, 0), anchorDate: date, mastered: false };
}

export function reviewCard(
  card: Card,
  mode: Mode,
  result: ReviewResult,
  date: string,
): { card: Card; log: ReviewLog } {
  const p = card.progress[mode];
  const log: ReviewLog = { cardId: card.id, mode, date, checkStage: p.stage + 1, result };
  return {
    card: { ...card, progress: { ...card.progress, [mode]: applyReview(p, result, date) } },
    log,
  };
}

/**
 * `lastProcessedDate + 1` ile dün arasındaki günleri sırayla kapatır: o gün vadesi gelmiş ve
 * cevaplanmamış her kart o gün için `missed` sayılır. Yeni vade yine geçmişteyse tekrar işlenir.
 *
 * Gün gün döngüyle eşdeğerdir ama her kart için yalnızca vade günlerine atlar.
 * Değişmeyen kartlar aynı referansla döner.
 */
export function processMissedDays(
  cards: readonly Card[],
  lastProcessedDate: string,
  today: string,
): { cards: Card[]; logs: ReviewLog[]; lastProcessedDate: string } {
  const firstDay = addDays(lastProcessedDate, 1);
  const lastDay = addDays(today, -1);
  if (firstDay > lastDay) return { cards: [...cards], logs: [], lastProcessedDate };

  const logs: ReviewLog[] = [];
  const result = cards.map((card) => {
    let current = card;
    for (const mode of MODES) {
      let due = getDueDate(current.progress[mode]);
      while (due !== null && due <= lastDay) {
        // Vadesi işlenen aralıktan önce kalmış kart, aralığın ilk günü kaçırılmış sayılır.
        const day = due < firstDay ? firstDay : due;
        const r = reviewCard(current, mode, 'missed', day);
        current = r.card;
        logs.push(r.log);
        due = getDueDate(current.progress[mode]);
      }
    }
    return current;
  });

  logs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { cards: result, logs, lastProcessedDate: lastDay };
}
