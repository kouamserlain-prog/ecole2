"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/services/api/client";
import {
  flushSyncQueue,
  SYNC_QUEUE_QUEUED_EVENT,
} from "@/lib/offline-sync-queue";
import type { SyncQueueItem } from "@/lib/offline-storage";

/**
 * Écoute la reconnexion réseau et vide la file de synchronisation hors ligne.
 */
export default function SyncQueueBootstrap() {
  const queryClient = useQueryClient();
  const flushingRef = useRef(false);

  useEffect(() => {
    const runFlush = async () => {
      if (flushingRef.current || !navigator.onLine) return;
      flushingRef.current = true;
      try {
        let totalSynced = 0;
        let result = await flushSyncQueue(API_URL);
        totalSynced += result.synced;

        while (result.remaining > 0 && result.synced > 0) {
          result = await flushSyncQueue(API_URL);
          totalSynced += result.synced;
        }

        if (totalSynced > 0) {
          toast.success(
            `${totalSynced} modification${totalSynced > 1 ? "s" : ""} synchronisée${totalSynced > 1 ? "s" : ""} avec le serveur.`,
            { id: "offline-sync-done" },
          );
          void queryClient.invalidateQueries();
        }

        if (result.failed > 0) {
          toast.error(
            `${result.failed} modification${result.failed > 1 ? "s" : ""} n'ont pas pu être synchronisées.`,
            { id: "offline-sync-failed", duration: 6000 },
          );
        }
      } finally {
        flushingRef.current = false;
      }
    };

    const onOnline = () => void runFlush();
    window.addEventListener("online", onOnline);
    void runFlush();

    const onQueued = (event: Event) => {
      const item = (event as CustomEvent<SyncQueueItem>).detail;
      toast(
        `${item.label} — enregistrée localement, envoi à la reconnexion.`,
        {
          id: `offline-queued-${item.id}`,
          icon: "📥",
          duration: 4500,
        },
      );
    };
    window.addEventListener(SYNC_QUEUE_QUEUED_EVENT, onQueued);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener(SYNC_QUEUE_QUEUED_EVENT, onQueued);
    };
  }, [queryClient]);

  return null;
}
