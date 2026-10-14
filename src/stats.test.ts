import { describe, expect, it } from 'vitest';
import { newCard } from './scheduler';
import { activityByDay, homeStats, matchesSearch, STAGES, stageDistribution, stageOf, streak } from './stats';
import type { Card, Progress } from './types';

const p = (stage: number, anchorDate: string): Progress => ({ stage, anchorDate, mastered: stage === 7 });

function card(id: string, createdDate: string, rec: Progress, wri: Progress): Card {
  return { ...newCard({ id, term: id, definition: id, createdDate }), progress: { recognition: rec, writing: wri } };
}

describe('homeStats', () => {
  const today = '2026-08-16';
  const cards = [
    card('a', '2026-08-15', p(0, '2026-08-15'), p(0, '2026-08-15')), // 1 gün önceki, ikisi de bugün
    card('b', '2026-08-13', p(1, '2026-08-13'), p(0, '2026-08-16')), // tanıma: 3 gün önceki; yazım: yarın
    card('c', '2026-08-09', p(2, '2026-08-09'), p(2, '2026-08-09')), // 7 gün önceki
    card('d', '2026-08-16', p(0, '2026-08-16'), p(0, '2026-08-16')), // bugün eklendi, yarın sorulur
    card('e', '2025-01-01', p(7, '2025-01-01'), p(3, '2026-07-17')), // tanıma ustalaşıldı; yazım 30 gün önceki
  ];

  it('toplam, bugün eklenen ve ustalaşılan kartları sayar', () => {
    const s = homeStats(cards, today);
    expect(s.total).toBe(5);
    expect(s.addedToday).toBe(1);
    expect(s.modes.recognition.mastered).toBe(1);
    expect(s.modes.writing.mastered).toBe(0);
  });

  it('bugün sorulacakları kademe aralığına göre (küçükten büyüğe) gruplar', () => {
    const s = homeStats(cards, today);
    expect(s.modes.recognition.due).toBe(3);
    expect(s.modes.recognition.breakdown).toEqual([
      { interval: 1, count: 1 },
      { interval: 3, count: 1 },
      { interval: 7, count: 1 },
    ]);
    expect(s.modes.writing.due).toBe(3);
    expect(s.modes.writing.breakdown).toEqual([
      { interval: 1, count: 1 },
      { interval: 7, count: 1 },
      { interval: 30, count: 1 },
    ]);
  });
});

describe('matchesSearch', () => {
  const c = { ...newCard({ id: 'x', term: 'Light', definition: 'Işık', example: 'Turn on the light.', createdDate: '2026-08-01' }) };

  it('kelime, anlam ve örnekte büyük/küçük harf duyarsız arar', () => {
    expect(matchesSearch(c, '')).toBe(true);
    expect(matchesSearch(c, 'LIGHT')).toBe(true);
    expect(matchesSearch(c, 'turn on')).toBe(true);
    expect(matchesSearch(c, 'yok')).toBe(false);
  });

  it('Türkçe ı/i ve I/İ farkını yok sayar', () => {
    expect(matchesSearch(c, 'ışık')).toBe(true);
    expect(matchesSearch(c, 'isik')).toBe(false); // ş/s farklıdır
    expect(matchesSearch(c, 'işık')).toBe(true);
  });
});

describe('kademe isimleri', () => {
  it('her kademenin bir adı var, ustalaşılan kart son kademede', () => {
    expect(STAGES).toHaveLength(8);
    expect(STAGES.map((s) => s.name)).toEqual(['Acemi', 'Çırak', 'Kalfa', 'Usta', 'Uzman', 'Üstat', 'Bilge', 'Efsane']);
    expect(stageOf(p(0, '2026-08-01')).name).toBe('Acemi');
    expect(stageOf(p(3, '2026-08-01')).name).toBe('Usta');
    expect(stageOf(p(7, '2026-08-01')).name).toBe('Efsane');
  });

  it('kart sayısını moda göre kademelere dağıtır', () => {
    const cards = [
      card('a', '2026-08-01', p(0, '2026-08-01'), p(1, '2026-08-01')),
      card('b', '2026-08-01', p(0, '2026-08-01'), p(1, '2026-08-01')),
      card('c', '2026-08-01', p(3, '2026-08-01'), p(7, '2026-08-01')),
    ];
    expect(stageDistribution(cards, 'recognition')).toEqual([2, 0, 0, 1, 0, 0, 0, 0]);
    expect(stageDistribution(cards, 'writing')).toEqual([0, 2, 0, 0, 0, 0, 0, 1]);
  });
});

describe('etkinlik ve seri', () => {
  const log = (date: string, result: 'correct' | 'wrong' | 'missed') => ({
    cardId: 'x',
    mode: 'recognition' as const,
    date,
    checkStage: 1,
    result,
  });

  it('son N günü doğru/yanlış/eklenen olarak sayar; kaçırılanlar sayılmaz', () => {
    const logs = [log('2026-08-15', 'correct'), log('2026-08-15', 'wrong'), log('2026-08-16', 'correct'), log('2026-08-16', 'missed'), log('2026-08-01', 'correct')];
    const cards = [card('a', '2026-08-16', p(0, '2026-08-16'), p(0, '2026-08-16'))];
    const days = activityByDay(logs, cards, '2026-08-16', 3);
    expect(days).toEqual([
      { date: '2026-08-14', correct: 0, wrong: 0, added: 0 },
      { date: '2026-08-15', correct: 1, wrong: 1, added: 0 },
      { date: '2026-08-16', correct: 1, wrong: 0, added: 1 },
    ]);
  });

  it('seri: bugün veya dünden geriye kesintisiz etkin günler', () => {
    const active = new Set(['2026-08-14', '2026-08-15', '2026-08-16', '2026-08-10']);
    expect(streak(active, '2026-08-16')).toEqual({ days: 3, activeToday: true });
    // Bugün henüz çalışılmadı: seri dünden sayılır, bozulmaz.
    expect(streak(active, '2026-08-17')).toEqual({ days: 3, activeToday: false });
    // Dün de çalışılmadıysa seri sıfırlanır.
    expect(streak(active, '2026-08-18')).toEqual({ days: 0, activeToday: false });
    expect(streak(new Set(), '2026-08-18')).toEqual({ days: 0, activeToday: false });
  });
});
