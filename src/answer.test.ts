import { describe, expect, it } from 'vitest';
import { acceptedAnswers, checkAnswer, shuffle } from './answer';

describe('yazım modu cevap kontrolü', () => {
  it('büyük/küçük harf duyarsız, baş/son boşlukları kırpar', () => {
    expect(checkAnswer('  Apple ', 'apple')).toBe(true);
    expect(checkAnswer('APPLE', 'Apple')).toBe(true);
    expect(checkAnswer('aple', 'apple')).toBe(false);
    expect(checkAnswer('', 'apple')).toBe(false);
  });

  it('/ ile ayrılmış her alternatifi kabul eder', () => {
    expect(checkAnswer('big', 'big / large')).toBe(true);
    expect(checkAnswer('Large', 'big / large')).toBe(true);
    expect(checkAnswer('big / large', 'big / large')).toBe(true);
    expect(checkAnswer('huge', 'big/large')).toBe(false);
    expect(acceptedAnswers('big / large /')).toEqual(['big', 'large']);
  });

  it('parantez içindeki edatlar zorunlu değildir; içlerindeki "/" alternatif sayılmaz', () => {
    expect(checkAnswer('abound', 'abound (in/with)')).toBe(true);
    expect(checkAnswer('Abound (in/with)', 'abound (in/with)')).toBe(true);
    expect(checkAnswer('abound in', 'abound (in/with)')).toBe(false);
    expect(checkAnswer('with)', 'abound (in/with)')).toBe(false);
    expect(acceptedAnswers('abound (in/with)')).toEqual(['abound']);
    expect(acceptedAnswers('big / large (for)')).toEqual(['big', 'large']);
  });

  it('çok kelimeli cevaplarda fazla boşluğu yok sayar', () => {
    expect(checkAnswer('give  up', 'give up')).toBe(true);
    expect(checkAnswer('giveup', 'give up')).toBe(false);
  });
});

describe('shuffle', () => {
  it('girdiyi değiştirmeden aynı elemanları karışık döndürür', () => {
    const input = [1, 2, 3, 4, 5];
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const out = shuffle(input, rng);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(out).not.toEqual(input);
  });
});
