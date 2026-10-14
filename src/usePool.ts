import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from './db';
import { loadPool, poolProgress, type PoolProgress, type PoolWord } from './pools';
import { getExistingTerms } from './repo';
import type { PoolSettings } from './types';

export function usePoolWords(poolId: string): PoolWord[] | null | Error {
  const [words, setWords] = useState<PoolWord[] | null | Error>(null);
  useEffect(() => {
    let cancelled = false;
    setWords(null);
    loadPool(poolId)
      .then((w) => !cancelled && setWords(w))
      .catch((e: unknown) => !cancelled && setWords(e instanceof Error ? e : new Error(String(e))));
    return () => {
      cancelled = true;
    };
  }, [poolId]);
  return words;
}

/** Havuzun canlÄ± durumu: ayarlar ve ilerleme. Veri yÃ¼klenene kadar undefined. */
export function usePoolState(poolId: string, today: string) {
  const words = usePoolWords(poolId);
  const data = useLiveQuery(
    async () => ({
      settings: (await db.poolSettings.get(poolId)) ?? null,
      decisions: await db.poolDecisions.where('poolId').equals(poolId).toArray(),
      existing: await getExistingTerms(db),
    }),
    [poolId],
  );
  const progress = useMemo<PoolProgress | undefined>(
    () => (data && Array.isArray(words) ? poolProgress(words, data.decisions, data.existing, today) : undefined),
    [data, words, today],
  );
  return {
    error: words instanceof Error ? words : null,
    settings: data?.settings as PoolSettings | null | undefined,
    progress,
  };
}
