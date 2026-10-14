// Kalıcı depolama: izin yoksa tarayıcı yer darlığında IndexedDB'yi (yani tüm kartları) silebilir.

export type PersistState = 'persisted' | 'not-persisted' | 'unsupported';

export async function getPersistState(): Promise<PersistState> {
  if (!navigator.storage?.persisted) return 'unsupported';
  return (await navigator.storage.persisted()) ? 'persisted' : 'not-persisted';
}

export async function requestPersist(): Promise<PersistState> {
  if (!navigator.storage?.persist) return 'unsupported';
  return (await navigator.storage.persist()) ? 'persisted' : 'not-persisted';
}

/** Ana ekrana eklenmiş uygulama olarak açıldıysa izni sessizce ister (Chrome yüklü uygulamalara verir). */
export async function requestPersistIfInstalled(): Promise<void> {
  if (!window.matchMedia('(display-mode: standalone)').matches) return;
  if ((await getPersistState()) === 'not-persisted') await requestPersist().catch(() => {});
}
