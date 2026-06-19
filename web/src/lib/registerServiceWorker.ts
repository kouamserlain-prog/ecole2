/** Enregistre le service worker (shell hors ligne + push) — production uniquement. */
export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null;
  if (process.env.NODE_ENV === 'development') return null;
  if (!('serviceWorker' in navigator)) return null;

  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing) return existing;
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (error) {
    console.warn('[sw] enregistrement impossible:', error);
    return null;
  }
}
