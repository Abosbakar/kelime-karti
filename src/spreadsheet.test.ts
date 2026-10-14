import { describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { readSpreadsheet } from './spreadsheet';

const toBuffer = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe('readSpreadsheet', () => {
  it('xlsx dosyasının ilk sayfasını okur', () => {
    const wb = utils.book_new();
    utils.book_append_sheet(
      wb,
      utils.aoa_to_sheet([
        ['English', 'Türkçe', 'Örnek'],
        ['apple', 'elma', 'An apple a day.'],
        [],
        ['tree', 'ağaç'],
      ]),
      'Kelimeler',
    );
    utils.book_append_sheet(wb, utils.aoa_to_sheet([['ignored', 'x']]), 'Diğer');
    const buf = write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const rows = readSpreadsheet(buf, 'liste.xlsx');
    expect(rows[0]).toEqual(['English', 'Türkçe', 'Örnek']);
    expect(rows[1]).toEqual(['apple', 'elma', 'An apple a day.']);
    expect(rows[3].slice(0, 2)).toEqual(['tree', 'ağaç']);
    expect(rows).toHaveLength(4); // boş satır numaralandırma için korunur
  });

  it('UTF-8 CSV dosyasını Türkçe karakterleri bozmadan okur (BOM dahil)', () => {
    const rows = readSpreadsheet(toBuffer('﻿apple,elma\ntree,ağaç\n"run","koşmak, çalıştırmak"\n'), 'a.csv');
    expect(rows).toEqual([
      ['apple', 'elma'],
      ['tree', 'ağaç'],
      ['run', 'koşmak, çalıştırmak'],
    ]);
  });

  it('noktalı virgüllü CSV dosyasını okur (Türkçe Excel çıktısı)', () => {
    const rows = readSpreadsheet(toBuffer('apple;elma;An apple a day.\nşeker;sugar\n'), 'a.csv');
    expect(rows[0]).toEqual(['apple', 'elma', 'An apple a day.']);
    expect(rows[1].slice(0, 2)).toEqual(['şeker', 'sugar']);
  });

  it('sayı gibi görünen hücreleri metin olarak bırakır', () => {
    const rows = readSpreadsheet(toBuffer('seven,7\n'), 'a.csv');
    expect(rows[0]).toEqual(['seven', '7']);
  });
});
