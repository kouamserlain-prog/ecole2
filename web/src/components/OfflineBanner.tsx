"use client";

import { useEffect, useState } from "react";
import { FiRefreshCw, FiWifiOff } from "react-icons/fi";
import { useSyncQueueStatus } from "@/hooks/useSyncQueueStatus";
import { API_URL } from "@/services/api/client";
import { flushSyncQueue, retryFailedSyncItems } from "@/lib/offline-sync-queue";

/**
 * Bandeau mode hors ligne + état de la file de synchronisation.
 */
export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const sync = useSyncQueueStatus();

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const showOffline = !online;
  const showSyncing = online && sync.syncing;
  const showPending = online && !sync.syncing && sync.pending > 0;
  const showFailed = online && sync.failed > 0;

  if (!showOffline && !showSyncing && !showPending && !showFailed) {
    return null;
  }

  const handleRetry = () => {
    void retryFailedSyncItems(API_URL);
  };

  const handleSyncNow = () => {
    void flushSyncQueue(API_URL);
  };

  return (
    <div
      className="fixed z-[100] flex justify-center pointer-events-none animate-banner-enter left-3 right-3 bottom-[max(1rem,env(safe-area-inset-bottom))]"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-[0_22px_50px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl ring-1 ${
          showFailed
            ? "border-rose-700/50 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 ring-rose-500/20"
            : "border-stone-700/60 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 ring-amber-500/20"
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${
            showFailed
              ? "bg-rose-500/15 ring-rose-400/25"
              : "bg-amber-500/15 ring-amber-400/25"
          }`}
        >
          {showSyncing || showPending ? (
            <FiRefreshCw className="h-5 w-5 text-amber-300 animate-spin" aria-hidden />
          ) : (
            <FiWifiOff
              className={`h-5 w-5 ${showFailed ? "text-rose-300" : "text-amber-300"}`}
              aria-hidden
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          {showOffline && (
            <>
              <p className="text-sm font-semibold text-stone-50 leading-snug">Hors ligne</p>
              <p className="mt-0.5 text-xs text-stone-400 leading-relaxed">
                Consultation du cache local. Les modifications sont mises en file d&apos;attente
                {sync.total > 0 ? ` (${sync.pending + sync.failed} en attente)` : ""}.
              </p>
            </>
          )}
          {showSyncing && (
            <>
              <p className="text-sm font-semibold text-stone-50 leading-snug">Synchronisation…</p>
              <p className="mt-0.5 text-xs text-stone-400 leading-relaxed">
                Envoi des modifications enregistrées hors ligne vers le serveur.
              </p>
            </>
          )}
          {showPending && !showSyncing && (
            <>
              <p className="text-sm font-semibold text-stone-50 leading-snug">
                {sync.pending} modification{sync.pending > 1 ? "s" : ""} en attente
              </p>
              <p className="mt-0.5 text-xs text-stone-400 leading-relaxed">
                La synchronisation reprend automatiquement.
              </p>
            </>
          )}
          {showFailed && (
            <>
              <p className="text-sm font-semibold text-stone-50 leading-snug">
                {sync.failed} échec{sync.failed > 1 ? "s" : ""} de synchronisation
              </p>
              <p className="mt-0.5 text-xs text-stone-400 leading-relaxed">
                Certaines modifications n&apos;ont pas pu être envoyées au serveur.
              </p>
            </>
          )}
        </div>
        {(showFailed || showPending) && online && !sync.syncing && (
          <button
            type="button"
            onClick={showFailed ? handleRetry : handleSyncNow}
            className="shrink-0 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-500/30"
          >
            {showFailed ? "Réessayer" : "Synchroniser"}
          </button>
        )}
      </div>
    </div>
  );
}
