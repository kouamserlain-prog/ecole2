'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Badge from '../ui/Badge';
import { ROLE_LABELS } from '../../lib/rolePaths';
import { FiSearch, FiUser, FiX } from 'react-icons/fi';
import {
  filterMessageRecipients,
  getActiveMessageRecipients,
  shouldShowRecipientResults,
} from './messagingRecipientSearch.util';

export type MessageRecipientUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive?: boolean;
  contextLabel?: string;
  studentProfile?: {
    studentId?: string;
    class?: { name?: string; level?: string } | null;
  } | null;
  teacherProfile?: { employeeId?: string } | null;
  educatorProfile?: { employeeId?: string } | null;
  staffProfile?: { jobTitle?: string; employeeId?: string } | null;
};

export type MessageRecipientAccent = 'pink' | 'orange' | 'stone' | 'rose';

type MessageRecipientSearchProps = {
  users: MessageRecipientUser[];
  value: string;
  onChange: (userId: string) => void;
  disabled?: boolean;
  compact?: boolean;
  accent?: MessageRecipientAccent;
  /** Autorise une valeur vide (ex. administration par défaut pour les parents). */
  allowDefault?: boolean;
  defaultLabel?: string;
  /** Liste des résultats en portal (modales avec overflow hidden). */
  inModal?: boolean;
  /** Chargement de la liste de contacts (ex. requête API en cours). */
  loading?: boolean;
};

const Z_PANEL = 100_001;

const ACCENT_STYLES: Record<
  MessageRecipientAccent,
  {
    selectedBorder: string;
    selectedBg: string;
    iconBg: string;
    iconText: string;
    userIcon: string;
    hoverRow: string;
    chipActive: string;
    focusRing: string;
  }
> = {
  pink: {
    selectedBorder: 'border-pink-200',
    selectedBg: 'bg-pink-50/50',
    iconBg: 'bg-pink-100',
    iconText: 'text-pink-700',
    userIcon: 'text-pink-600',
    hoverRow: 'hover:bg-pink-50',
    chipActive: 'bg-pink-600',
    focusRing: 'focus:border-pink-500 focus:ring-4 focus:ring-pink-500/20',
  },
  orange: {
    selectedBorder: 'border-orange-200',
    selectedBg: 'bg-orange-50/50',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-700',
    userIcon: 'text-orange-600',
    hoverRow: 'hover:bg-orange-50',
    chipActive: 'bg-orange-600',
    focusRing: 'focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20',
  },
  stone: {
    selectedBorder: 'border-stone-200',
    selectedBg: 'bg-stone-50/80',
    iconBg: 'bg-stone-200',
    iconText: 'text-stone-700',
    userIcon: 'text-stone-600',
    hoverRow: 'hover:bg-stone-50',
    chipActive: 'bg-stone-700',
    focusRing: 'focus:border-stone-400 focus:ring-2 focus:ring-stone-400/20',
  },
  rose: {
    selectedBorder: 'border-rose-200',
    selectedBg: 'bg-rose-50/50',
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-700',
    userIcon: 'text-rose-600',
    hoverRow: 'hover:bg-rose-50',
    chipActive: 'bg-rose-600',
    focusRing: 'focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20',
  },
};

function userSubtitle(u: MessageRecipientUser): string {
  if (u.contextLabel) return u.contextLabel;
  if (u.studentProfile?.class?.name) {
    const cls = u.studentProfile.class;
    const parts = [cls.name, cls.level].filter(Boolean).join(' · ');
    const sid = u.studentProfile.studentId;
    return sid ? `${parts} — N° ${sid}` : parts;
  }
  if (u.studentProfile?.studentId) {
    return `N° élève ${u.studentProfile.studentId}`;
  }
  if (u.staffProfile?.jobTitle) {
    return u.staffProfile.jobTitle;
  }
  const employeeId =
    u.teacherProfile?.employeeId ?? u.educatorProfile?.employeeId ?? u.staffProfile?.employeeId;
  if (employeeId) {
    return `Matricule ${employeeId}`;
  }
  return u.email;
}

export default function MessageRecipientSearch({
  users,
  value,
  onChange,
  disabled = false,
  compact = false,
  accent = 'stone',
  allowDefault = false,
  defaultLabel = 'Administration (défaut)',
  inModal = false,
  loading = false,
}: MessageRecipientSearchProps) {
  const styles = ACCENT_STYLES[accent];
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(query.trim().toLowerCase()), 200);
    return () => window.clearTimeout(t);
  }, [query]);

  const selected = useMemo(
    () => (value ? users.find((u) => u.id === value) ?? null : null),
    [users, value],
  );

  const activeUsers = useMemo(() => getActiveMessageRecipients(users), [users]);

  const roleOptions = useMemo(() => {
    const roles = [...new Set(activeUsers.map((u) => u.role))].sort();
    return roles;
  }, [activeUsers]);

  const filtered = useMemo(
    () =>
      filterMessageRecipients(activeUsers, {
        query: debouncedQ,
        roleFilter,
      }),
    [activeUsers, debouncedQ, roleFilter],
  );

  const showResults = shouldShowRecipientResults({
    open,
    loading,
    query: debouncedQ,
    roleFilter,
  });

  const updatePanelPosition = useCallback(() => {
    const el = inputWrapRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 280);
    const margin = 16;
    const vh = window.innerHeight;
    const maxH = Math.min(vh * 0.45, 280);
    let top = rect.bottom + 6;
    if (top + maxH > vh - margin) {
      const above = rect.top - 6 - maxH;
      if (above >= margin) top = above;
    }
    let left = rect.left;
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - width - margin);
    }
    setPanelPos({ top, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!showResults || !inModal) {
      setPanelPos(null);
      return;
    }
    updatePanelPosition();
    const onScrollOrResize = () => updatePanelPosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [showResults, inModal, updatePanelPosition, debouncedQ, roleFilter]);

  useEffect(() => {
    if (!open || !inModal || !showResults) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, inModal, showResults]);

  const pick = (user: MessageRecipientUser) => {
    onChange(user.id);
    setQuery('');
    setDebouncedQ('');
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(true);
  };

  const inputClasses = inModal
    ? `w-full rounded-lg border-2 border-gray-200 bg-white pl-10 pr-4 text-sm transition-all focus:outline-none disabled:bg-stone-50 ${styles.focusRing} ${
        compact ? 'py-2' : 'py-2.5'
      }`
    : `w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 disabled:bg-stone-50 ${styles.focusRing} ${
        compact ? 'py-1.5' : 'py-2'
      }`;

  const resultsList = showResults ? (
    <>
      {filtered.length === 0 ? (
        <p className="px-3 py-2 text-xs text-stone-500">Aucun destinataire trouvé.</p>
      ) : (
        <ul className="divide-y divide-stone-100 py-1">
          {filtered.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(user)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm ${styles.hoverRow}`}
              >
                <FiUser className={`mt-0.5 h-4 w-4 shrink-0 ${styles.userIcon}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium text-stone-900">
                    {user.firstName} {user.lastName}
                    <span className="ml-1 text-xs font-normal text-stone-500">
                      ({ROLE_LABELS[user.role] ?? user.role})
                    </span>
                  </span>
                  <span className="block truncate text-xs text-stone-500">{userSubtitle(user)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {filtered.length === 50 && (
        <p className="border-t border-stone-100 px-3 py-1.5 text-[10px] text-stone-400">
          Affichage limité à 50 résultats — affinez la recherche.
        </p>
      )}
    </>
  ) : null;

  const resultsPanel =
    showResults && resultsList && (!inModal || panelPos) ? (
      <div
        ref={panelRef}
        aria-label="Résultats destinataires"
        className={`overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg ${
          compact ? 'max-h-44' : 'max-h-56'
        }`}
        style={
          inModal && panelPos
            ? {
                position: 'fixed',
                zIndex: Z_PANEL,
                top: panelPos.top,
                left: panelPos.left,
                minWidth: panelPos.width,
                maxWidth: 'min(100vw - 2rem, 28rem)',
              }
            : undefined
        }
      >
        {resultsList}
      </div>
    ) : null;

  if (selected) {
    return (
      <div
        className={`flex items-start justify-between gap-3 rounded-xl border ${styles.selectedBorder} ${styles.selectedBg} ${
          compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
        }`}
      >
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${styles.iconBg} ${styles.iconText}`}
          >
            <FiUser className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-900">
              {selected.firstName} {selected.lastName}
            </p>
            <p className="truncate text-xs text-stone-600">{userSubtitle(selected)}</p>
            <Badge className="mt-1 border border-stone-200 bg-white text-[10px] text-stone-700">
              {ROLE_LABELS[selected.role] ?? selected.role}
            </Badge>
          </div>
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="shrink-0 rounded-lg p-1.5 text-stone-500 hover:bg-white hover:text-stone-800 disabled:opacity-50"
          aria-label="Changer de destinataire"
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2" ref={rootRef}>
      {loading && (
        <p className="text-[11px] text-stone-500">Chargement des contacts…</p>
      )}

      {!loading && activeUsers.length === 0 && (
        <p className="text-[11px] text-amber-700">Aucun contact disponible pour la messagerie.</p>
      )}

      {allowDefault && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('')}
          className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
            !value
              ? `${styles.selectedBorder} ${styles.selectedBg} font-medium text-stone-900`
              : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
          }`}
        >
          {defaultLabel}
        </button>
      )}

      <div className="relative" ref={inputWrapRef}>
        <FiSearch
          className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 ${
            inModal ? 'h-5 w-5' : compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
          }`}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (inModal) updatePanelPosition();
          }}
          onBlur={(e) => {
            if (inModal) return;
            const related = e.relatedTarget as Node | null;
            if (related && panelRef.current?.contains(related)) return;
            window.setTimeout(() => setOpen(false), 200);
          }}
          placeholder="Rechercher par nom, e-mail, rôle…"
          className={inputClasses}
          aria-label="Rechercher un destinataire"
          autoComplete="off"
        />
      </div>

      {roleOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par rôle">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setRoleFilter('all');
              setOpen(true);
            }}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              roleFilter === 'all'
                ? `${styles.chipActive} text-white`
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Tous
          </button>
          {roleOptions.map((role) => (
            <button
              key={role}
              type="button"
              disabled={disabled}
              onClick={() => {
                setRoleFilter(role);
                setOpen(true);
              }}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                roleFilter === role
                  ? `${styles.chipActive} text-white`
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {ROLE_LABELS[role] ?? role}
            </button>
          ))}
        </div>
      )}

      {open && debouncedQ.length === 0 && roleFilter === 'all' && !allowDefault && !loading && (
        <p className="text-[11px] text-stone-500">
          Recherchez par nom ou filtrez par rôle pour afficher les contacts.
        </p>
      )}

      {allowDefault && !open && !value && (
        <p className="text-[11px] text-stone-500">Ou recherchez un contact précis ci-dessus.</p>
      )}

      {inModal && resultsPanel && typeof document !== 'undefined'
        ? createPortal(resultsPanel, document.body)
        : resultsPanel}
    </div>
  );
}
