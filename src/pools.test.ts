import { describe, expect, it } from 'vitest';
import { normalizeTerm } from './importParse';
import { POOLS, loadPool, poolProgress, type PoolWord } from './pools';
import type { PoolDecision } from './types';

const words: PoolWord[] = [
  ['apple', 'elma'],
  ['book', 'kitap'],
  ['house', 'ev'],
  ['tree', 'ağaç'],
  ['water', 'su'],
];

const d = (term: string, decision: 'known' | 'learn', date: string): PoolDecision => ({ poolId: 'a1', term, decision, date });

describe('poolProgress', () => {
  it('kararları sayar, kalanları ve bugünkü ilerlemeyi hesaplar', () => {
    const p = poolProgress(
      words,
      [d('apple', 'known', '2026-08-15'), d('book', 'learn', '2026-08-15'), d('house', 'learn', '2026-08-16'), d('tree', 'known', '2026-08-16')],
      new Set(),
      '2026-08-16',
    );
    expect(p).toMatchObject({ total: 5, known: 2, learning: 2, addedToday: 1, alreadyHave: 0 });
    expect(p.remaining.map((w) => w[0])).toEqual(['water']);
  });

  it('elle eklenmiş kartlar havuzda tekrar gösterilmez', () => {
    const p = poolProgress(words, [], new Set([normalizeTerm('Water'), normalizeTerm('house')]), '2026-08-16');
    expect(p.remaining.map((w) => w[0])).toEqual(['apple', 'book', 'tree']);
    expect(p.alreadyHave).toBe(2);
  });

  it('havuzdan öğrenmeye alınan kelime "zaten var" sayılmaz', () => {
    const p = poolProgress(words, [d('book', 'learn', '2026-08-16')], new Set(['book']), '2026-08-16');
    expect(p).toMatchObject({ learning: 1, alreadyHave: 0 });
    expect(p.remaining).toHaveLength(4);
  });
});

describe('havuz verisi', () => {
  it('katalogdaki her havuzun verisi var', async () => {
    for (const pool of POOLS) {
      const list = await loadPool(pool.id);
      expect(list.length, pool.id).toBeGreaterThan(0);
    }
  });

  it('her satır dolu, kırpılmış ve havuz içinde tekrar yok', async () => {
    for (const pool of POOLS) {
      const list = await loadPool(pool.id);
      const seen = new Map<string, string>();
      for (const [term, def] of list) {
        expect(term, `${pool.id}: ${term}`).toBe(term.trim());
        expect(def, `${pool.id}: ${term}`).toBe(def.trim());
        expect(term && def, `${pool.id}: boş satır`).toBeTruthy();
        const key = normalizeTerm(term);
        expect(seen.has(key), `${pool.id}: "${term}" iki kez var`).toBe(false);
        seen.set(key, term);
      }
    }
  });

  it('CEFR seviyeleri arasında aynı kelime yok', async () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const pool of POOLS.filter((p) => p.group === 'cefr')) {
      for (const [term] of await loadPool(pool.id)) {
        const key = normalizeTerm(term);
        const prev = owner.get(key);
        if (prev) clashes.push(`${term}: ${prev} ve ${pool.id}`);
        else owner.set(key, pool.id);
      }
    }
    expect(clashes).toEqual([]);
  });
});
