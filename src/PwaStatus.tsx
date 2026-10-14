import { useRegisterSW } from 'virtual:pwa-register/react';

/** Service worker kaydı. Yeni sürüm hazır olduğunda yenileme önerir; çevrimdışı hazır olunca bir kez bildirir. */
export function PwaStatus() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Uygulama günlerce açık kalabilir; saatte bir güncelleme kontrolü.
      if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  if (needRefresh) {
    return (
      <div className="toast" role="status">
        <span>Yeni sürüm hazır.</span>
        <button type="button" className="primary small" onClick={() => updateServiceWorker()}>
          Yenile
        </button>
        <button type="button" className="secondary small" onClick={() => setNeedRefresh(false)}>
          Sonra
        </button>
      </div>
    );
  }
  if (offlineReady) {
    return (
      <div className="toast" role="status">
        <span>Uygulama artık çevrimdışı da çalışır.</span>
        <button type="button" className="secondary small" onClick={() => setOfflineReady(false)}>
          Tamam
        </button>
      </div>
    );
  }
  return null;
}
