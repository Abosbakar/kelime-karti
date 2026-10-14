// Alıştırma (Quizlet "Öğren" mantığı). Saf fonksiyonlar; kartların kademesini ve tekrar takvimini
// ETKİLEMEZ, sadece ek çalışma içindir.
//
// Her kelime iki aşamadan geçer: önce 4 şıklı soru (İngilizce → Türkçe anlamı seç), sonra yazılı soru
// (Türkçesini yaz). Yanlış bilinen kelime aynı aşamada birkaç soru sonra yeniden sorulur.

import { shuffle } from './answer';

export interface PracticeCard {
  id: string;
  term: string;
  definition: string;
}

export type QuestionKind = 'choice' | 'written';

export interface PracticeItem {
  cardId: string;
  level: 0 | 1 | 2; // 0: şıklı bekliyor, 1: yazılı bekliyor, 2: tamam
  mistakes: number;
}

export interface PracticeState {
  items: PracticeItem[];
  queue: string[]; // sıradaki sorular (kart id); ilk eleman şu anki soru
  streak: number; // art arda doğru
  answered: number;
}

/** Yanlıştan sonra kaç soru sonra tekrar sorulsun; şıklıdan yazılıya geçerken kaç soru ara. */
const RETRY_GAP = 2;
const NEXT_STAGE_GAP = 3;

export function startPractice(cards: readonly PracticeCard[], rng: () => number = Math.random): PracticeState {
  const ids = shuffle(
    cards.map((c) => c.id),
    rng,
  );
  return {
    items: ids.map((cardId) => ({ cardId, level: 0, mistakes: 0 })),
    queue: ids,
    streak: 0,
    answered: 0,
  };
}

export function currentQuestion(s: PracticeState): { cardId: string; kind: QuestionKind } | null {
  const cardId = s.queue[0];
  if (!cardId) return null;
  const item = s.items.find((i) => i.cardId === cardId)!;
  return { cardId, kind: item.level === 0 ? 'choice' : 'written' };
}

export function progressOf(s: PracticeState): { done: number; total: number } {
  return { done: s.items.reduce((n, i) => n + i.level, 0), total: s.items.length * 2 };
}

/** Şu anki soruyu cevaplar. Doğruysa kelime bir aşama ilerler; yanlışsa aynı aşamada geri gelir. */
export function answerPractice(s: PracticeState, correct: boolean): PracticeState {
  const [cardId, ...rest] = s.queue;
  if (!cardId) return s;
  const items = s.items.map((i) => {
    if (i.cardId !== cardId) return i;
    return correct
      ? { ...i, level: Math.min(i.level + 1, 2) as PracticeItem['level'] }
      : { ...i, mistakes: i.mistakes + 1 };
  });
  const item = items.find((i) => i.cardId === cardId)!;
  const queue = [...rest];
  if (item.level < 2) {
    const gap = correct ? NEXT_STAGE_GAP : RETRY_GAP;
    queue.splice(Math.min(gap, queue.length), 0, cardId);
  }
  return { items, queue, streak: correct ? s.streak + 1 : 0, answered: s.answered + 1 };
}

// ---- Şıklar ----

const choiceKey = (s: string) => turkishFold(s);

/** Doğru anlam + en fazla 3 farklı yanlış şık (aynı anlamlar elenir), karışık sırada. */
export function buildChoices(correct: string, allDefinitions: readonly string[], rng: () => number = Math.random): string[] {
  const seen = new Set([choiceKey(correct)]);
  const others: string[] = [];
  for (const d of shuffle(allDefinitions, rng)) {
    const k = choiceKey(d);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    others.push(d.trim());
    if (others.length === 3) break;
  }
  return shuffle([correct.trim(), ...others], rng);
}

// ---- Türkçe cevap kontrolü ----

/** Küçük harf (Türkçe kurallarıyla), Türkçe harfler sadeleşir, noktalama ve fazla boşluk atılır. */
export function turkishFold(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c]!)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.!?'"…]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tanımın kabul edilen biçimleri: tamamı ve `, ; / |` ile ayrılmış her parça; parantezli ve parantezsiz. */
function acceptedTurkish(definition: string): Set<string> {
  const variants = new Set<string>();
  const add = (s: string) => {
    const withoutParens = turkishFold(s.replace(/\([^)]*\)/g, ' '));
    const withParenText = turkishFold(s.replace(/[()]/g, ' '));
    if (withoutParens) variants.add(withoutParens);
    if (withParenText) variants.add(withParenText);
  };
  add(definition);
  for (const part of definition.split(/[,;/|]/)) add(part);
  return variants;
}

export function checkTurkish(input: string, definition: string): boolean {
  const given = turkishFold(input.replace(/[()]/g, ' '));
  if (!given) return false;
  return acceptedTurkish(definition).has(given);
}

/** İpucu: her kelimenin ilk `n` harfi açık, gerisi alt çizgi. */
export function hintFor(definition: string, n: number): string {
  const first = definition.split(/[,;|]/)[0].replace(/\([^)]*\)/g, '').trim();
  return first.replace(/\p{L}+/gu, (w) => w.slice(0, n) + '_'.repeat(Math.max(w.length - n, 0)));
}
