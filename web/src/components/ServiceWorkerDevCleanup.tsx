'use client';

import { useEffect } from 'react';
import { unregisterServiceWorkersInDevelopment } from '@/lib/serviceWorkerDev';

/** Retire le SW en local (évite les blocages sur /inscription pendant npm run dev). */
export default function ServiceWorkerDevCleanup() {
  useEffect(() => {
    void unregisterServiceWorkersInDevelopment();
  }, []);

  return null;
}
