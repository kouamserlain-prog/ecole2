import api from '@/services/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Enregistre le SW, demande la permission si besoin, envoie l’abonnement au backend.
 * Sans erreur utilisateur si push non configuré ou refusé.
 */
export async function registerPushNotifications(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (process.env.NODE_ENV === 'development') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return false;

    const vapidRes = await api.get<{ publicKey?: string }>('/push/vapid-public');
    const pubKey = vapidRes.data?.publicKey;
    if (!pubKey) return false;

    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pubKey) as BufferSource,
      }));

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    await api.post('/push/subscribe', { subscription: json });
    return true;
  } catch (e) {
    console.warn('[push] inscription:', e);
    return false;
  }
}
