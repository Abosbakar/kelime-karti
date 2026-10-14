import { useCallback, useEffect, useState } from 'react';
import { db } from './db';
import { processDays } from './repo';
import { getToday } from './today';

/**
 * Bugünün tarihini verir ve gün her değiştiğinde (ilk açılış, gece yarısı, sekmeye dönüş,
 * dev'de tarih simülasyonu) kaçırılan günleri işler.
 */
export function useToday() {
  const [today, setToday] = useState(getToday);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => setToday(getToday()), []);

  useEffect(() => {
    const id = window.setInterval(refresh, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  // `ready` yalnızca ilk işlemede false'tur; sonraki gün değişimlerinde açık oturum bozulmasın diye
  // ekran yeniden yüklenmez (canlı sorgular işlem bitince kendiliğinden güncellenir).
  useEffect(() => {
    let cancelled = false;
    processDays(db, today)
      .then(() => !cancelled && setReady(true))
      .catch((e: unknown) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [today]);

  return { today, ready, error, refresh };
}
