import { describe, expect, it } from 'vitest';
import {
  applyReview,
  getDueDate,
  isDue,
  newCard,
  newProgress,
  processMissedDays,
  reviewCard,
} from './scheduler';
import { addDays, diffDays } from './dates';
import type { Card, Progress } from './types';

const card = (createdDate: string, id = 'c1'): Card =>
  newCard({ id, term: 'apple', definition: 'elma', createdDate });

describe('dates', () => {
  it('ay ve yıl sınırlarında gün ekler', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30'); // AB yaz saati geçişi
    expect(addDays('2026-08-16', -1)).toBe('2026-08-15');
  });

  it('takvim günü farkını hesaplar', () => {
    expect(diffDays('2026-08-13', '2026-08-16')).toBe(3);
    expect(diffDays('2026-12-30', '2027-01-02')).toBe(3);
    expect(diffDays('2026-08-16', '2026-08-13')).toBe(-3);
  });

  it('geçersiz tarihi reddeder', () => {
    expect(() => addDays('2026-8-1', 1)).toThrow();
    expect(() => addDays('2026-02-30', 1)).toThrow();
  });
});

describe('yeni kart', () => {
  it('her iki modda stage 0 ve anchorDate = createdDate ile başlar', () => {
    const c = card('2026-08-13');
    for (const mode of ['recognition', 'writing'] as const) {
      expect(c.progress[mode]).toEqual({ stage: 0, anchorDate: '2026-08-13', mastered: false });
    }
    expect(getDueDate(c.progress.recognition)).toBe('2026-08-14');
    expect(isDue(c.progress.recognition, '2026-08-13')).toBe(false);
    expect(isDue(c.progress.recognition, '2026-08-14')).toBe(true);
  });
});

describe('zorunlu senaryolar', () => {
  it('1) kullanıcının örneği (a): 3 günlükten düşen kart ertesi gün sorulur', () => {
    let p = newProgress('2026-08-13');
    expect(getDueDate(p)).toBe('2026-08-14');

    p = applyReview(p, 'correct', '2026-08-14');
    expect(p).toEqual({ stage: 1, anchorDate: '2026-08-13', mastered: false });
    expect(getDueDate(p)).toBe('2026-08-16');

    p = applyReview(p, 'wrong', '2026-08-16');
    expect(p).toEqual({ stage: 0, anchorDate: '2026-08-16', mastered: false });
    expect(getDueDate(p)).toBe('2026-08-17');

    p = applyReview(p, 'correct', '2026-08-17');
    expect(p.stage).toBe(1);
    expect(getDueDate(p)).toBe('2026-08-19');
  });

  it('2) kullanıcının örneği (b): 7 günlükten düşen kart 3 gün sonra sorulur', () => {
    let p = newProgress('2026-08-09');
    p = applyReview(p, 'correct', '2026-08-10');
    expect(getDueDate(p)).toBe('2026-08-12');
    p = applyReview(p, 'correct', '2026-08-12');
    expect(p.stage).toBe(2);
    expect(getDueDate(p)).toBe('2026-08-16');

    p = applyReview(p, 'wrong', '2026-08-16');
    expect(p).toEqual({ stage: 1, anchorDate: '2026-08-16', mastered: false });
    expect(getDueDate(p)).toBe('2026-08-19');

    p = applyReview(p, 'correct', '2026-08-19');
    expect(p).toEqual({ stage: 2, anchorDate: '2026-08-16', mastered: false });
    expect(getDueDate(p)).toBe('2026-08-23');
  });

  it('2b) 30 günlükten düşen kart 7 gün sonra sorulur', () => {
    const p: Progress = { stage: 3, anchorDate: '2026-01-01', mastered: false };
    expect(getDueDate(p)).toBe('2026-01-31'); // 1 Ocak + 30
    const after = applyReview(p, 'wrong', '2026-01-31');
    expect(after).toEqual({ stage: 2, anchorDate: '2026-01-31', mastered: false });
    expect(getDueDate(after)).toBe('2026-02-07');
  });

  it('3) stage 0 hata: eklendiği günün ertesi bilinmezse ertesi gün tekrar sorulur', () => {
    let p = newProgress('2026-08-01');
    p = applyReview(p, 'wrong', '2026-08-02');
    expect(p).toEqual({ stage: 0, anchorDate: '2026-08-02', mastered: false });
    expect(getDueDate(p)).toBe('2026-08-03');

    p = applyReview(p, 'wrong', '2026-08-03');
    expect(p).toEqual({ stage: 0, anchorDate: '2026-08-03', mastered: false });
    expect(getDueDate(p)).toBe('2026-08-04');
  });

  it('3b) stage 0 kart cevapsız kalırsa ertesi gün missed işlenir ve bugün tekrar sorulur', () => {
    const c = card('2026-08-01');
    // 1 Ağustos'ta açıldı, 2 Ağustos'ta hiç girilmedi, 3 Ağustos'ta açılıyor.
    const r = processMissedDays([c], '2026-07-31', '2026-08-03');
    const p = r.cards[0].progress.recognition;
    expect(p).toEqual({ stage: 0, anchorDate: '2026-08-02', mastered: false });
    expect(isDue(p, '2026-08-03')).toBe(true);
    expect(r.lastProcessedDate).toBe('2026-08-02');
  });

  it('4) art arda kaçırma: 5 gün girilmeyince kart gün gün düşer', () => {
    // stage 2, çapa 1 Ağustos → 7 günlük kontrol 8 Ağustos'ta.
    const c = card('2026-08-01');
    const p0: Progress = { stage: 2, anchorDate: '2026-08-01', mastered: false };
    const start: Card = { ...c, progress: { recognition: p0, writing: p0 } };

    // Son açılış 7 Ağustos (6'sına kadar işlendi). 8–12 Ağustos hiç girilmiyor, 13'ünde açılıyor.
    const r = processMissedDays([start], '2026-08-06', '2026-08-13');

    // 8 Ağu: kaçırıldı → stage 1, çapa 8, sonraki 11
    // 11 Ağu: kaçırıldı → stage 0, çapa 11, sonraki 12
    // 12 Ağu: kaçırıldı → stage 0, çapa 12, sonraki 13 (bugün)
    const p = r.cards[0].progress.recognition;
    expect(p).toEqual({ stage: 0, anchorDate: '2026-08-12', mastered: false });
    expect(getDueDate(p)).toBe('2026-08-13');
    expect(isDue(p, '2026-08-13')).toBe(true);
    expect(r.lastProcessedDate).toBe('2026-08-12');

    const recLogs = r.logs.filter((l) => l.mode === 'recognition');
    expect(recLogs).toEqual([
      { cardId: 'c1', mode: 'recognition', date: '2026-08-08', checkStage: 3, result: 'missed' },
      { cardId: 'c1', mode: 'recognition', date: '2026-08-11', checkStage: 2, result: 'missed' },
      { cardId: 'c1', mode: 'recognition', date: '2026-08-12', checkStage: 1, result: 'missed' },
    ]);
    expect(r.logs).toHaveLength(6);
  });

  it('4b) kaçırma işlemi sadece dünü kapatır, bugünün kartına dokunmaz', () => {
    const c = card('2026-08-01'); // due 2 Ağustos
    const r = processMissedDays([c], '2026-08-01', '2026-08-02');
    expect(r.cards[0]).toBe(c);
    expect(r.logs).toEqual([]);
    expect(r.lastProcessedDate).toBe('2026-08-01');
  });

  it('4c) aynı gün içinde tekrar açılış hiçbir şey yapmaz ve lastProcessedDate geri gitmez', () => {
    const c = card('2026-08-01');
    const r = processMissedDays([c], '2026-08-05', '2026-08-03');
    expect(r.cards[0]).toBe(c);
    expect(r.logs).toEqual([]);
    expect(r.lastProcessedDate).toBe('2026-08-05');
  });

  it('5) ustalık: 7 kontrolü geçen kart mastered olur ve bir daha sorulmaz', () => {
    let p = newProgress('2026-01-01');
    const expectedDue = [
      '2026-01-02', // +1
      '2026-01-04', // +3
      '2026-01-08', // +7
      '2026-01-31', // +30
      '2026-03-02', // +60
      '2026-05-01', // +120
      '2026-12-27', // +360
    ];
    for (let i = 0; i < 7; i++) {
      const due = getDueDate(p);
      expect(due).toBe(expectedDue[i]);
      expect(p.mastered).toBe(false);
      p = applyReview(p, 'correct', due!);
    }
    expect(p).toEqual({ stage: 7, anchorDate: '2026-01-01', mastered: true });
    expect(getDueDate(p)).toBeNull();
    expect(isDue(p, '2030-01-01')).toBe(false);
    expect(() => applyReview(p, 'wrong', '2027-01-01')).toThrow();

    const c: Card = { ...card('2026-01-01'), progress: { recognition: p, writing: p } };
    const r = processMissedDays([c], '2026-12-27', '2030-01-01');
    expect(r.cards[0]).toBe(c);
    expect(r.logs).toEqual([]);
  });

  it('6) mod bağımsızlığı: yazım modundaki hata tanıma modunu etkilemez', () => {
    let c = card('2026-08-13');
    c = reviewCard(c, 'recognition', 'correct', '2026-08-14').card;
    c = reviewCard(c, 'writing', 'correct', '2026-08-14').card;
    const recBefore = c.progress.recognition;

    const { card: after, log } = reviewCard(c, 'writing', 'wrong', '2026-08-16');
    expect(after.progress.writing).toEqual({ stage: 0, anchorDate: '2026-08-16', mastered: false });
    expect(after.progress.recognition).toBe(recBefore);
    expect(after.progress.recognition).toEqual({ stage: 1, anchorDate: '2026-08-13', mastered: false });
    expect(log).toEqual({
      cardId: 'c1',
      mode: 'writing',
      date: '2026-08-16',
      checkStage: 2,
      result: 'wrong',
    });
  });

  it('6b) mod bağımsızlığı: sadece cevaplanmayan mod missed olarak işlenir', () => {
    let c = card('2026-08-01');
    c = reviewCard(c, 'recognition', 'correct', '2026-08-02').card; // yazım cevaplanmadı
    const r = processMissedDays([c], '2026-08-01', '2026-08-03');
    expect(r.cards[0].progress.recognition).toEqual({ stage: 1, anchorDate: '2026-08-01', mastered: false });
    expect(r.cards[0].progress.writing).toEqual({ stage: 0, anchorDate: '2026-08-02', mastered: false });
    expect(r.logs).toEqual([
      { cardId: 'c1', mode: 'writing', date: '2026-08-02', checkStage: 1, result: 'missed' },
    ]);
  });
});

describe('saflık', () => {
  it('girdileri değiştirmez', () => {
    const c = card('2026-08-01');
    const snapshot = structuredClone(c);
    reviewCard(c, 'recognition', 'wrong', '2026-08-02');
    processMissedDays([c], '2026-07-31', '2026-08-20');
    expect(c).toEqual(snapshot);
  });

  it('missed sonucu wrong ile aynı kuralı uygular', () => {
    const p: Progress = { stage: 3, anchorDate: '2026-08-01', mastered: false };
    expect(applyReview(p, 'missed', '2026-08-31')).toEqual(applyReview(p, 'wrong', '2026-08-31'));
  });

  it('logları tarihe göre sıralı döndürür', () => {
    const a = card('2026-08-01', 'a');
    const b = card('2026-08-03', 'b');
    const r = processMissedDays([b, a], '2026-07-31', '2026-08-06');
    const dates = r.logs.map((l) => l.date);
    expect(dates).toEqual([...dates].sort());
    expect(diffDays(r.lastProcessedDate, '2026-08-06')).toBe(1);
  });
});
