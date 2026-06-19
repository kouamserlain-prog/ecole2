"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSyncQueueStatus,
  SYNC_QUEUE_CHANGED_EVENT,
} from "@/lib/offline-sync-queue";

export type SyncQueueUiStatus = {
  pending: number;
  failed: number;
  syncing: boolean;
  total: number;
};

export function useSyncQueueStatus(): SyncQueueUiStatus {
  const [status, setStatus] = useState<SyncQueueUiStatus>({
    pending: 0,
    failed: 0,
    syncing: false,
    total: 0,
  });

  const refresh = useCallback(async () => {
    const next = await getSyncQueueStatus();
    setStatus({
      pending: next.pending,
      failed: next.failed,
      syncing: next.syncing,
      total: next.items.length,
    });
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(SYNC_QUEUE_CHANGED_EVENT, onChange);
    window.addEventListener("online", onChange);
    return () => {
      window.removeEventListener(SYNC_QUEUE_CHANGED_EVENT, onChange);
      window.removeEventListener("online", onChange);
    };
  }, [refresh]);

  return status;
}
