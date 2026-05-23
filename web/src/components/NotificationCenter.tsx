"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiBell } from "react-icons/fi";
import {
  adminApi,
  educatorApi,
  parentApi,
  studentApi,
  teacherApi,
} from "@/services/api";
import { staffApi } from "@/services/api/staff.api";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  content: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
};

type NotificationRole = "ADMIN" | "TEACHER" | "STUDENT" | "PARENT" | "EDUCATOR" | "STAFF";

const queryKey = (role: NotificationRole, userId?: string | null) =>
  ["notifications", role, userId ?? ""] as const;

interface NotificationCenterProps {
  role: NotificationRole;
  /** Pour ADMIN : filtre les notifications sur l’utilisateur connecté */
  currentUserId?: string | null;
}

export default function NotificationCenter({
  role,
  currentUserId,
}: NotificationCenterProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const enabled = role !== "ADMIN" || Boolean(currentUserId);

  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKey(role, currentUserId),
    queryFn: async (): Promise<AppNotification[]> => {
      switch (role) {
        case "ADMIN":
          return adminApi.getNotifications(
            currentUserId ? { userId: currentUserId } : undefined
          );
        case "STUDENT":
          return studentApi.getNotifications();
        case "PARENT":
          return parentApi.getNotifications();
        case "TEACHER":
          return teacherApi.getNotifications();
        case "EDUCATOR":
          return educatorApi.getNotifications();
        case "STAFF":
          return staffApi.getNotifications();
        default:
          return [];
      }
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: open ? 45_000 : false,
  });

  const unreadCount = useMemo(
    () => items.filter((n) => !n.read).length,
    [items]
  );

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      switch (role) {
        case "ADMIN":
          return adminApi.markNotificationAsRead(id);
        case "STUDENT":
          return studentApi.markNotificationAsRead(id);
        case "PARENT":
          return parentApi.markNotificationAsRead(id);
        case "TEACHER":
          return teacherApi.markNotificationAsRead(id);
        case "EDUCATOR":
          return educatorApi.markNotificationAsRead(id);
        case "STAFF":
          return staffApi.markNotificationAsRead(id);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKey(role, currentUserId),
      });
    },
    onError: () => toast.error("Impossible de marquer la notification comme lue."),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      switch (role) {
        case "ADMIN":
          return adminApi.markAllNotificationsAsRead(currentUserId ?? undefined);
        case "STUDENT":
          return studentApi.markAllNotificationsAsRead();
        case "PARENT":
          return parentApi.markAllNotificationsAsRead();
        case "TEACHER":
          return teacherApi.markAllNotificationsAsRead();
        case "EDUCATOR":
          return educatorApi.markAllNotificationsAsRead();
        case "STAFF":
          return staffApi.markAllNotificationsAsRead();
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKey(role, currentUserId),
      });
      toast.success("Toutes les notifications sont marquées comme lues.");
    },
    onError: () =>
      toast.error("Impossible de tout marquer comme lu."),
  });

  const displayed = useMemo(() => items.slice(0, 12), [items]);

  const navigateLink = (href: string) => {
    if (href.startsWith("http://") || href.startsWith("https://")) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href.startsWith("/") ? href : `/${href}`);
  };

  const onRowActivate = async (n: AppNotification) => {
    if (!n.read) {
      markOne.mutate(n.id);
    }
    setOpen(false);
    if (n.link) {
      navigateLink(n.link);
    }
  };

  return (
    <div className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-300/70 bg-white/85 text-stone-700 shadow-sm backdrop-blur-sm transition hover:bg-amber-50/50 hover:border-amber-300/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45 focus-visible:ring-offset-2"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Notifications"
      >
        <FiBell className="h-[18px] w-[18px]" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[45] cursor-default bg-stone-900/15 backdrop-blur-[2px]"
            aria-label="Fermer les notifications"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Centre de notifications"
            className="absolute right-0 z-[60] mt-2 w-[min(calc(100vw-1.5rem),22rem)] overflow-hidden rounded-2xl border border-stone-200/90 bg-white/98 shadow-lux-soft backdrop-blur-xl ring-1 ring-amber-900/5 animate-fade-in"
          >
            <div className="flex items-center justify-between border-b border-stone-200/70 px-4 py-3 bg-gradient-to-r from-amber-50/90 to-stone-50/80">
              <p className="text-sm font-bold text-stone-900">Notifications</p>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                  className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 disabled:opacity-50"
                >
                  Tout marquer comme lu
                </button>
              ) : null}
            </div>

            <div className="max-h-[min(55vh,22rem)] overflow-y-auto overscroll-contain">
              {isLoading ? (
                <p className="px-4 py-8 text-center text-sm text-stone-500">
                  Chargement…
                </p>
              ) : displayed.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-stone-500">
                  Aucune notification pour le moment.
                </p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {displayed.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => void onRowActivate(n)}
                        className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition hover:bg-stone-50/95 ${
                          !n.read ? "bg-amber-50/40" : ""
                        }`}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={`text-xs font-semibold leading-snug ${
                              !n.read ? "text-stone-900" : "text-stone-700"
                            }`}
                          >
                            {n.title}
                          </span>
                          <span className="shrink-0 text-[10px] text-stone-400 tabular-nums">
                            {formatDistanceToNow(new Date(n.createdAt), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </span>
                        </span>
                        <span className="line-clamp-2 text-[11px] leading-relaxed text-stone-600">
                          {n.content}
                        </span>
                        {n.type ? (
                          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-stone-400">
                            {n.type}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {role === "ADMIN" ? (
              <div className="border-t border-stone-200/80 bg-stone-50/50 px-3 py-2">
                <Link
                  href="/admin/notifications"
                  onClick={() => setOpen(false)}
                  className="block w-full rounded-xl px-2 py-2 text-center text-xs font-semibold text-amber-900 hover:bg-amber-50/80"
                >
                  Voir toutes les notifications
                </Link>
              </div>
            ) : null}
            {role === "PARENT" ? (
              <div className="border-t border-stone-200/80 bg-stone-50/50 px-3 py-2">
                <Link
                  href="/parent?tab=notifications"
                  onClick={() => setOpen(false)}
                  className="block w-full rounded-xl px-2 py-2 text-center text-xs font-semibold text-amber-900 hover:bg-amber-50/80"
                >
                  Voir toutes les notifications
                </Link>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
