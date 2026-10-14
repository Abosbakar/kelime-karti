import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup } from './backup';
import { newCard } from './scheduler';

const card = newCard({ id: 'c1', term: 'apple', definition: 'elma', example: 'An apple.', createdDate: '2026-08-01' });
const log = { cardId: 'c1', mode: 'recognition' as const, date: '2026-08-02', checkStage: 1, result: 'correct' as const };

describe('yedek', () => {
  it('oluşturup geri okuyabilir (JSON üzerinden)', () => {
    const b = makeBackup([card], [{ ...log, id: 5 } as typeof log], { lastProcessedDate: '2026-08-02' }, '2026-08-03T10:00:00.000Z');
    expect(b.logs[0]).toEqual(log); // veritabanı id'si yedeğe girmez
    const r = parseBackup(JSON.parse(JSON.stringify(b)));
    expect(r).toEqual({ ok: true, backup: b });
  });

  it('başka bir JSON dosyasını reddeder', () => {
    expect(parseBackup({ foo: 1 })).toMatchObject({ ok: false });
    expect(parseBackup(null)).toMatchObject({ ok: false });
    expect(parseBackup([])).toMatchObject({ ok: false });
  });

  it('bozuk kartları ve logları satır numarasıyla bildirir', () => {
    const bad = makeBackup([card], [log], null, '2026-08-03T10:00:00.000Z') as unknown as Record<string, unknown[]>;
    bad.cards = [
      card,
      { ...card, id: 'c2', term: '' },
      { ...card, id: 'c3', createdDate: '2026-13-01' },
      { ...card, id: 'c4', progress: { recognition: { stage: 9, anchorDate: '2026-08-01', mastered: false } } },
      { ...card, id: 'c1' },
    ];
    bad.logs = [log, { ...log, result: 'maybe' }];
    const r = parseBackup(bad);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual([
      'Kart 2: İngilizce kelime boş',
      'Kart 3: geçersiz eklenme tarihi',
      'Kart 4: geçersiz ilerleme (recognition)',
      'Kart 5: aynı id iki kez var (c1)',
      'Kayıt 2: geçersiz cevap kaydı',
    ]);
  });

  it('1. sürüm (havuzsuz) yedekleri okur', () => {
    const v1 = { app: 'kelime-karti', version: 1, exportedAt: 'x', cards: [card], logs: [log], meta: null };
    const r = parseBackup(v1);
    expect(r).toMatchObject({ ok: true, backup: { version: 2, poolDecisions: [], poolSettings: [] } });
  });

  it('havuz kartlarının kaynağını ve havuz kayıtlarını korur, bozuklarını reddeder', () => {
    const b = makeBackup(
      [{ ...card, source: 'b1' }],
      [],
      null,
      'x',
      [{ poolId: 'b1', term: 'apple', decision: 'learn', date: '2026-08-01', cardId: 'c1' }],
      [{ poolId: 'b1', dailyGoal: 10, startedDate: '2026-08-01' }],
    );
    const r = parseBackup(JSON.parse(JSON.stringify(b)));
    expect(r).toEqual({ ok: true, backup: b });

    const bad = { ...b, poolDecisions: [{ poolId: 'b1', term: 'x', decision: 'maybe', date: '2026-08-01' }] };
    expect(parseBackup(bad)).toMatchObject({ ok: false, errors: ['Havuz kararı 1: geçersiz'] });
  });

  it('mastered ile stage tutarsızsa reddeder', () => {
    const b = makeBackup([{ ...card, progress: { ...card.progress, writing: { stage: 7, anchorDate: '2026-08-01', mastered: false } } }], [], null, 'x');
    expect(parseBackup(b)).toMatchObject({ ok: false, errors: ['Kart 1: geçersiz ilerleme (writing)'] });
  });
});
