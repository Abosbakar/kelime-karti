import Dexie, { type EntityTable, type Table } from 'dexie';
import type { Card, Meta, PoolDecision, PoolSettings, ReviewLog } from './types';

export type StoredLog = ReviewLog & { id?: number };
export type MetaRow = Meta & { key: 'main' };

export class AppDB extends Dexie {
  cards!: EntityTable<Card, 'id'>;
  logs!: EntityTable<StoredLog, 'id'>;
  meta!: Table<MetaRow, string>;
  poolDecisions!: Table<PoolDecision, [string, string]>;
  poolSettings!: EntityTable<PoolSettings, 'poolId'>;

  constructor(name = 'kelime-karti') {
    super(name);
    this.version(1).stores({
      cards: 'id, createdDate, term',
      logs: '++id, cardId, date',
      meta: 'key',
    });
    this.version(2).stores({
      poolDecisions: '[poolId+term], poolId, [poolId+date]',
      poolSettings: 'poolId',
    });
  }
}

export const db = new AppDB();
