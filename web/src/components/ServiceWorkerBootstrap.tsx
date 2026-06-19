'use client';

import { useEffect } from 'react';
import { registerAppServiceWorker } from '@/lib/registerServiceWorker';

/** Active le service worker en production (mise en cache du shell et assets statiques). */
export default function ServiceWorkerBootstrap() {
  useEffect(() => {
    void registerAppServiceWorker();
  }, []);

  return null;
}
