import { describe, expect, it } from 'vitest';
import { answerPractice, buildChoices, checkTurkish, currentQuestion, progressOf, startPractice } from './practice';

const rngFrom = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe('Türkçe cevap kontrolü', () => {
  it('virgül, noktalı virgül, / ve | ile ayrılmış anlamlardan birini kabul eder', () => {
    const def = 'Köpek dişleri, sivri dişler';
    expect(checkTurkish('köpek dişleri', def)).toBe(true);
    expect(checkTurkish('  SİVRİ DİŞLER ', def)).toBe(true);
    expect(checkTurkish('köpek dişleri, sivri dişler', def)).toBe(true);
    expect(checkTurkish('dişler', def)).toBe(false);
    expect(checkTurkish('verim', '(fiil) vermek; boyun eğmek | (isim) verim, getiri')).toBe(true);
    expect(checkTurkish('', def)).toBe(false);
  });

  it('parantezi hem yok sayar hem içeriğiyle kabul eder', () => {
    const def = '(Dişlerini) geçirdi, kapattı';
    expect(checkTurkish('geçirdi', def)).toBe(true);
    expect(checkTurkish('dişlerini geçirdi', def)).toBe(true);
  });

  it('Türkçe karakter yazılmasa da kabul eder (Türkçe klavye yoksa)', () => {
    expect(checkTurkish('kopek disleri', 'Köpek dişleri, sivri dişler')).toBe(true);
    expect(checkTurkish('uyanis', 'Uyanan, uyanış')).toBe(true);
    expect(checkTurkish('IŞIK', 'ışık')).toBe(true);
  });
});

describe('şıklar', () => {
  const all = ['elma', 'kitap', 'ağaç', 'ev', 'su', 'Elma ', 'kalem'];

  it('doğru cevap + 3 farklı yanlış şık, karışık sırada', () => {
    const c = buildChoices('elma', all, rngFrom(3));
    expect(c).toHaveLength(4);
    expect(c).toContain('elma');
    expect(new Set(c.map((x) => x.toLowerCase().trim())).size).toBe(4);
  });

  it('yeterli farklı anlam yoksa daha az şık verir', () => {
    expect(buildChoices('elma', ['elma', 'kitap'], rngFrom(1)).sort()).toEqual(['elma', 'kitap']);
  });
});

describe('alıştırma akışı', () => {
  const cards = [
    { id: 'a', term: 'apple', definition: 'elma' },
    { id: 'b', term: 'book', definition: 'kitap' },
    { id: 'c', term: 'tree', definition: 'ağaç' },
  ];

  it('her kelime önce şıklı sonra yazılı sorulur; toplam soru = 2 × kelime', () => {
    let s = startPractice(cards, rngFrom(7));
    expect(progressOf(s)).toEqual({ done: 0, total: 6 });
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const q = currentQuestion(s)!;
      seen.push(`${q.cardId}:${q.kind}`);
      s = answerPractice(s, true);
    }
    expect(currentQuestion(s)).toBeNull();
    expect(progressOf(s)).toEqual({ done: 6, total: 6 });
    for (const id of ['a', 'b', 'c']) {
      expect(seen.indexOf(`${id}:choice`)).toBeGreaterThanOrEqual(0);
      expect(seen.indexOf(`${id}:written`)).toBeGreaterThan(seen.indexOf(`${id}:choice`));
    }
  });

  it('yanlış bilinen kelime aynı aşamada tekrar sorulur, hatası sayılır', () => {
    let s = startPractice(cards, rngFrom(7));
    const first = currentQuestion(s)!;
    s = answerPractice(s, false);
    expect(progressOf(s).done).toBe(0);
    expect(s.streak).toBe(0);
    // Yanlış bilinen kelime hemen arkasından değil, biraz sonra yeniden gelir.
    expect(currentQuestion(s)!.cardId).not.toBe(first.cardId);
    let guard = 0;
    while (currentQuestion(s) && guard++ < 20) {
      const q = currentQuestion(s)!;
      if (q.cardId === first.cardId) expect(q.kind).toBe('choice');
      if (q.cardId === first.cardId) break;
      s = answerPractice(s, true);
    }
    expect(s.items.find((i) => i.cardId === first.cardId)!.mistakes).toBe(1);
  });

  it('art arda doğrular seriyi artırır', () => {
    let s = startPractice(cards, rngFrom(2));
    s = answerPractice(s, true);
    s = answerPractice(s, true);
    expect(s.streak).toBe(2);
    expect(s.answered).toBe(2);
  });

  it('tek kelimelik sette de biter', () => {
    let s = startPractice([cards[0]], rngFrom(1));
    s = answerPractice(s, false);
    s = answerPractice(s, true);
    s = answerPractice(s, true);
    expect(currentQuestion(s)).toBeNull();
  });
});
