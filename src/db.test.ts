import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDB } from './db';
import {
  addCard,
  addCards,
  answerCard,
  decidePoolWord,
  deleteCard,
  exportBackup,
  getDueCards,
  getExistingTerms,
  getMeta,
  importBackup,
  markActuallyCorrect,
  processDays,
  setPoolGoal,
  undoPoolDecision,
  updateCard,
} from './repo';
import { getDueDate } from './scheduler';

let n = 0;
const dbs: AppDB[] = [];
function freshDb(): AppDB {
  const db = new AppDB(`test-${n++}`);
  dbs.push(db);
  return db;
}

afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

describe('gün işleme', () => {
  it('ilk açılışta lastProcessedDate dün olur ve hiçbir şey işlenmez', async () => {
    const db = freshDb();
    const r = await processDays(db, '2026-08-10');
    expect(r.logs).toEqual([]);
    expect(await getMeta(db)).toEqual({ lastProcessedDate: '2026-08-09' });
  });

  it('kaçırılan günleri işler, kartları ve logları kaydeder', async () => {
    const db = freshDb();
    await processDays(db, '2026-08-01');
    const card = await addCard(db, { term: 'apple', definition: 'elma' }, '2026-08-01');

    // 2–5 Ağustos girilmedi, 6'sında açılıyor. Due: 2 → 3 → 4 → 5 hepsi kaçırıldı.
    const r = await processDays(db, '2026-08-06');
    expect(r.logs).toHaveLength(8);

    const stored = await db.cards.get(card.id);
    expect(stored!.progress.recognition).toEqual({ stage: 0, anchorDate: '2026-08-05', mastered: false });
    expect(stored!.progress.writing).toEqual({ stage: 0, anchorDate: '2026-08-05', mastered: false });
    expect(await db.logs.count()).toBe(8);
    expect(await getMeta(db)).toEqual({ lastProcessedDate: '2026-08-05' });
  });

  it('aynı gün tekrar açılınca hiçbir şey değişmez', async () => {
    const db = freshDb();
    await processDays(db, '2026-08-01');
    await addCard(db, { term: 'apple', definition: 'elma' }, '2026-08-01');
    await processDays(db, '2026-08-04');
    const before = await db.cards.toArray();

    const r = await processDays(db, '2026-08-04');
    expect(r.logs).toEqual([]);
    expect(await db.cards.toArray()).toEqual(before);
    expect(await db.logs.count()).toBe(4);
  });

  it('geçmişe dönen tarih lastProcessedDate değerini geri almaz', async () => {
    const db = freshDb();
    await processDays(db, '2026-08-10');
    await processDays(db, '2026-08-05');
    expect(await getMeta(db)).toEqual({ lastProcessedDate: '2026-08-09' });
  });
});

describe('cevaplama', () => {
  it('cevabı kaydeder ve log ekler', async () => {
    const db = freshDb();
    await processDays(db, '2026-08-13');
    const card = await addCard(db, { term: 'apple', definition: 'elma' }, '2026-08-13');
    await processDays(db, '2026-08-14');

    const { card: updated, previous } = await answerCard(db, card.id, 'recognition', 'correct', '2026-08-14');
    expect(previous).toEqual(card.progress.recognition);
    expect(updated.progress.recognition.stage).toBe(1);
    expect(updated.progress.writing.stage).toBe(0);
    expect(await db.cards.get(card.id)).toEqual(updated);

    const logs = await db.logs.toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      cardId: card.id,
      mode: 'recognition',
      date: '2026-08-14',
      checkStage: 1,
      result: 'correct',
    });
  });

  it('vadesi gelmemiş karta cevap verilemez (çift tıklama koruması)', async () => {
    const db = freshDb();
    await processDays(db, '2026-08-13');
    const card = await addCard(db, { term: 'apple', definition: 'elma' }, '2026-08-13');
    await processDays(db, '2026-08-14');
    await answerCard(db, card.id, 'recognition', 'correct', '2026-08-14');

    await expect(answerCard(db, card.id, 'recognition', 'correct', '2026-08-14')).rejects.toThrow();
    expect((await db.cards.get(card.id))!.progress.recognition.stage).toBe(1);
    expect(await db.logs.count()).toBe(1);
  });

  it('gece yarısını geçen açık oturumda önce dünü kapatır, sonra cevabı uygular', async () => {
    const db = freshDb();
    await processDays(db, '2026-08-01');
    const card = await addCard(db, { term: 'apple', definition: 'elma' }, '2026-08-01');
    // Uygulama 1 Ağustos'tan beri açık; 2'sinde cevaplanmadı, 3'ünde cevap veriliyor.
    const { card: updated } = await answerCard(db, card.id, 'recognition', 'correct', '2026-08-03');

    expect(updated.progress.recognition).toEqual({ stage: 1, anchorDate: '2026-08-02', mastered: false });
    expect(getDueDate(updated.progress.recognition)).toBe('2026-08-05');
    expect(updated.progress.writing).toEqual({ stage: 0, anchorDate: '2026-08-02', mastered: false });
    expect(await getMeta(db)).toEqual({ lastProcessedDate: '2026-08-02' });
  });

  it('olmayan kart için hata verir', async () => {
    const db = freshDb();
    await expect(answerCard(db, 'yok', 'recognition', 'correct', '2026-08-14')).rejects.toThrow();
  });
});

describe('"Aslında doğruydu"', () => {
  async function setup() {
    const db = freshDb();
    await processDays(db, '2026-08-09');
    const card = await addCard(db, { term: 'apple', definition: 'elma' }, '2026-08-09');
    await processDays(db, '2026-08-10');
    await answerCard(db, card.id, 'writing', 'correct', '2026-08-10');
    await processDays(db, '2026-08-12');
    await answerCard(db, card.id, 'writing', 'correct', '2026-08-12'); // stage 2, sonraki 16
    await processDays(db, '2026-08-16');
    return { db, card };
  }

  it('yanlışı doğruya çevirir: kart doğru cevaplanmış gibi olur, log güncellenir', async () => {
    const { db, card } = await setup();
    const wrong = await answerCard(db, card.id, 'writing', 'wrong', '2026-08-16');
    expect(wrong.card.progress.writing).toEqual({ stage: 1, anchorDate: '2026-08-16', mastered: false });
    expect(wrong.previous).toEqual({ stage: 2, anchorDate: '2026-08-09', mastered: false });

    const fixed = await markActuallyCorrect(db, wrong, '2026-08-16');
    expect(fixed.progress.writing).toEqual({ stage: 3, anchorDate: '2026-08-09', mastered: false });
    expect(await db.cards.get(card.id)).toEqual(fixed);

    // Tanıma modu hiç cevaplanmadı; onun "missed" kayıtları ayrı.
    const logs = (await db.logs.where('cardId').equals(card.id).toArray()).filter((l) => l.mode === 'writing');
    expect(logs).toHaveLength(3);
    expect(logs[2]).toMatchObject({ date: '2026-08-16', checkStage: 3, result: 'correct' });
  });

  it('ikinci kez veya doğru cevapta uygulanamaz', async () => {
    const { db, card } = await setup();
    const wrong = await answerCard(db, card.id, 'writing', 'wrong', '2026-08-16');
    await markActuallyCorrect(db, wrong, '2026-08-16');
    await expect(markActuallyCorrect(db, wrong, '2026-08-16')).rejects.toThrow();
    expect((await db.cards.get(card.id))!.progress.writing.stage).toBe(3);
  });

  it('başka gün uygulanamaz', async () => {
    const { db, card } = await setup();
    const wrong = await answerCard(db, card.id, 'writing', 'wrong', '2026-08-16');
    await expect(markActuallyCorrect(db, wrong, '2026-08-17')).rejects.toThrow();
  });
});

describe('düzenleme ve silme', () => {
  it('düzenleme metni değiştirir, tarih ve ilerlemeyi korur', async () => {
    const db = freshDb();
    await processDays(db, '2026-08-13');
    const card = await addCard(db, { term: 'aple', definition: 'elma', example: 'x' }, '2026-08-13');
    await processDays(db, '2026-08-14');
    await answerCard(db, card.id, 'recognition', 'correct', '2026-08-14');

    const edited = await updateCard(db, card.id, { term: ' apple ', definition: 'elma', example: '' });
    expect(edited.term).toBe('apple');
    expect(edited.example).toBeUndefined();
    expect(edited.createdDate).toBe('2026-08-13');
    expect(edited.progress.recognition.stage).toBe(1);
    expect(await db.cards.get(card.id)).toEqual(edited);
    await expect(updateCard(db, card.id, { term: '', definition: 'elma' })).rejects.toThrow();
  });

  it('silme kartı ve cevap kayıtlarını siler', async () => {
    const db = freshDb();
    await processDays(db, '2026-08-13');
    const a = await addCard(db, { term: 'apple', definition: 'elma' }, '2026-08-13');
    const b = await addCard(db, { term: 'book', definition: 'kitap' }, '2026-08-13');
    await processDays(db, '2026-08-14');
    await answerCard(db, a.id, 'recognition', 'correct', '2026-08-14');
    await answerCard(db, b.id, 'recognition', 'correct', '2026-08-14');

    await deleteCard(db, a.id);
    expect(await db.cards.get(a.id)).toBeUndefined();
    expect((await db.logs.toArray()).map((l) => l.cardId)).toEqual([b.id]);
  });
});

describe('yedekleme', () => {
  it('dışa aktarılan yedek başka veritabanına aynen geri yüklenir', async () => {
    const src = freshDb();
    await processDays(src, '2026-08-13');
    const a = await addCard(src, { term: 'apple', definition: 'elma', example: 'An apple.' }, '2026-08-13');
    await processDays(src, '2026-08-14');
    await answerCard(src, a.id, 'writing', 'wrong', '2026-08-14');
    const backup = await exportBackup(src, '2026-08-14T12:00:00.000Z');
    expect(backup.cards).toHaveLength(1);
    expect(backup.logs).toHaveLength(1);
    expect(backup.meta).toEqual({ lastProcessedDate: '2026-08-13' });

    const dst = freshDb();
    await processDays(dst, '2026-08-14');
    await addCard(dst, { term: 'old', definition: 'eski' }, '2026-08-14');
    await importBackup(dst, backup, '2026-08-14');

    expect(await dst.cards.toArray()).toEqual(await src.cards.toArray());
    expect((await dst.logs.toArray()).map(({ id: _, ...l }) => l)).toEqual(backup.logs);
    expect(await getMeta(dst)).toEqual({ lastProcessedDate: '2026-08-13' });
  });

  it('eski yedek geri yüklenince aradaki günler işlenir', async () => {
    const src = freshDb();
    await processDays(src, '2026-08-01');
    await addCard(src, { term: 'apple', definition: 'elma' }, '2026-08-01');
    const backup = await exportBackup(src, 'x');

    const dst = freshDb();
    const r = await importBackup(dst, backup, '2026-08-04');
    expect(r.missed).toBe(4); // 2 ve 3 Ağustos, iki mod
    expect(await getMeta(dst)).toEqual({ lastProcessedDate: '2026-08-03' });
  });
});

describe('hazır havuzlar', () => {
  async function setup(goal = 2) {
    const db = freshDb();
    await processDays(db, '2026-08-16');
    await setPoolGoal(db, 'a1', goal, '2026-08-16');
    return db;
  }

  it('"öğrenmeliyim" kart ekler, "biliyorum" eklemez', async () => {
    const db = await setup();
    await decidePoolWord(db, 'a1', ['apple', 'elma'], 'known', '2026-08-16');
    const d = await decidePoolWord(db, 'a1', ['book', 'kitap'], 'learn', '2026-08-16');

    const cards = await db.cards.toArray();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ term: 'book', definition: 'kitap', createdDate: '2026-08-16', source: 'a1' });
    expect(d.cardId).toBe(cards[0].id);
    expect(await db.poolDecisions.where('poolId').equals('a1').count()).toBe(2);
  });

  it('günlük hedef dolunca yeni kelime eklenmez, "biliyorum" yine işaretlenebilir', async () => {
    const db = await setup(2);
    await decidePoolWord(db, 'a1', ['a', 'x'], 'learn', '2026-08-16');
    await decidePoolWord(db, 'a1', ['b', 'y'], 'learn', '2026-08-16');
    await expect(decidePoolWord(db, 'a1', ['c', 'z'], 'learn', '2026-08-16')).rejects.toThrow(/hedef/);
    await decidePoolWord(db, 'a1', ['c', 'z'], 'known', '2026-08-16');
    expect(await db.cards.count()).toBe(2);

    // Ertesi gün hedef sıfırlanır.
    await decidePoolWord(db, 'a1', ['d', 'w'], 'learn', '2026-08-17');
    expect(await db.cards.count()).toBe(3);
  });

  it('aynı kelimeye iki kez karar verilemez; havuz başlatılmadan karar verilemez', async () => {
    const db = await setup();
    await decidePoolWord(db, 'a1', ['apple', 'elma'], 'known', '2026-08-16');
    await expect(decidePoolWord(db, 'a1', ['apple', 'elma'], 'learn', '2026-08-16')).rejects.toThrow();
    await expect(decidePoolWord(db, 'b1', ['tree', 'ağaç'], 'learn', '2026-08-16')).rejects.toThrow();
  });

  it('kartlarda zaten olan kelime havuzdan tekrar eklenmez', async () => {
    const db = await setup();
    await addCard(db, { term: 'Apple', definition: 'elma' }, '2026-08-10');
    await expect(decidePoolWord(db, 'a1', ['apple', 'elma'], 'learn', '2026-08-16')).rejects.toThrow(/zaten/);
  });

  it('geri alma kararı ve oluşturulan kartı siler', async () => {
    const db = await setup();
    await decidePoolWord(db, 'a1', ['book', 'kitap'], 'learn', '2026-08-16');
    await decidePoolWord(db, 'a1', ['apple', 'elma'], 'known', '2026-08-16');
    await undoPoolDecision(db, 'a1', 'book', '2026-08-16');
    await undoPoolDecision(db, 'a1', 'apple', '2026-08-16');
    expect(await db.cards.count()).toBe(0);
    expect(await db.poolDecisions.count()).toBe(0);
  });

  it('başka günün veya çalışılmış kartın kararı geri alınamaz', async () => {
    const db = await setup();
    await decidePoolWord(db, 'a1', ['book', 'kitap'], 'learn', '2026-08-16');
    await expect(undoPoolDecision(db, 'a1', 'book', '2026-08-17')).rejects.toThrow();
  });

  it('hedef değiştirilebilir, başlangıç tarihi korunur', async () => {
    const db = await setup(5);
    await setPoolGoal(db, 'a1', 20, '2026-08-20');
    expect(await db.poolSettings.get('a1')).toEqual({ poolId: 'a1', dailyGoal: 20, startedDate: '2026-08-16' });
    await expect(setPoolGoal(db, 'a1', 0, '2026-08-20')).rejects.toThrow();
  });

  it('yedek havuz kararlarını ve ayarlarını da taşır', async () => {
    const src = await setup();
    await decidePoolWord(src, 'a1', ['book', 'kitap'], 'learn', '2026-08-16');
    await decidePoolWord(src, 'a1', ['apple', 'elma'], 'known', '2026-08-16');
    const backup = await exportBackup(src, 'x');
    expect(backup.poolDecisions).toHaveLength(2);
    expect(backup.poolSettings).toEqual([{ poolId: 'a1', dailyGoal: 2, startedDate: '2026-08-16' }]);

    const dst = freshDb();
    await importBackup(dst, backup, '2026-08-16');
    expect(await dst.poolDecisions.toArray()).toEqual(await src.poolDecisions.toArray());
    expect(await dst.poolSettings.toArray()).toEqual(await src.poolSettings.toArray());
  });

  it('kart silinince havuz kararı da silinir (kelime havuza geri döner)', async () => {
    const db = await setup();
    const d = await decidePoolWord(db, 'a1', ['book', 'kitap'], 'learn', '2026-08-16');
    await deleteCard(db, d.cardId!);
    expect(await db.poolDecisions.count()).toBe(0);
  });
});

describe('sorgular', () => {
  it('bugün sorulacak kartları moda göre döndürür', async () => {
    const db = freshDb();
    await processDays(db, '2026-08-13');
    const a = await addCard(db, { term: 'apple', definition: 'elma' }, '2026-08-13');
    const b = await addCard(db, { term: 'book', definition: 'kitap', example: 'A good book.' }, '2026-08-13');
    expect(await getDueCards(db, 'recognition', '2026-08-13')).toEqual([]);

    await processDays(db, '2026-08-14');
    await answerCard(db, a.id, 'recognition', 'correct', '2026-08-14');

    const rec = await getDueCards(db, 'recognition', '2026-08-14');
    expect(rec.map((c) => c.id)).toEqual([b.id]);
    const wri = await getDueCards(db, 'writing', '2026-08-14');
    expect(wri.map((c) => c.id).sort()).toEqual([a.id, b.id].sort());
    expect(wri.find((c) => c.id === b.id)!.example).toBe('A good book.');
  });

  it('kartı kırpılmış alanlarla ekler', async () => {
    const db = freshDb();
    const c = await addCard(db, { term: '  apple ', definition: ' elma ', example: '  ' }, '2026-08-13');
    expect(c.term).toBe('apple');
    expect(c.definition).toBe('elma');
    expect(c.example).toBeUndefined();
    expect(c.createdDate).toBe('2026-08-13');
  });

  it('boş kelime veya anlamla kart eklemez', async () => {
    const db = freshDb();
    await expect(addCard(db, { term: ' ', definition: 'elma' }, '2026-08-13')).rejects.toThrow();
    expect(await db.cards.count()).toBe(0);
  });

  it('toplu ekleme: hepsi kaydedilir, biri geçersizse hiçbiri kaydedilmez', async () => {
    const db = freshDb();
    const added = await addCards(
      db,
      [
        { term: 'apple', definition: 'elma' },
        { term: 'Book', definition: 'kitap', example: 'A book.' },
      ],
      '2026-08-13',
    );
    expect(added).toHaveLength(2);
    expect(await db.cards.count()).toBe(2);
    expect(await getExistingTerms(db)).toEqual(new Set(['apple', 'book']));

    await expect(
      addCards(db, [{ term: 'tree', definition: 'ağaç' }, { term: 'x', definition: '' }], '2026-08-13'),
    ).rejects.toThrow();
    expect(await db.cards.count()).toBe(2);
  });
});
