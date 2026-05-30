import { ROLE_LABELS } from '../../lib/rolePaths';
import type { MessageRecipientUser } from './MessageRecipientSearch';

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function matchesRecipientQuery(u: MessageRecipientUser, q: string): boolean {
  const haystack = normalizeSearchText(
    [
      u.firstName,
      u.lastName,
      u.email,
      u.role,
      u.contextLabel ?? '',
      ROLE_LABELS[u.role] ?? '',
      u.studentProfile?.studentId ?? '',
      u.studentProfile?.class?.name ?? '',
      u.teacherProfile?.employeeId ?? '',
      u.educatorProfile?.employeeId ?? '',
      u.staffProfile?.employeeId ?? '',
      u.staffProfile?.jobTitle ?? '',
    ].join(' '),
  );
  return haystack.includes(normalizeSearchText(q));
}

export function getActiveMessageRecipients(users: MessageRecipientUser[]): MessageRecipientUser[] {
  return users.filter((u) => u.isActive !== false);
}

export type FilterMessageRecipientsOptions = {
  query?: string;
  roleFilter?: string;
  limit?: number;
};

/** Filtre et trie les destinataires pour l’autocomplétion messagerie. */
export function filterMessageRecipients(
  users: MessageRecipientUser[],
  { query = '', roleFilter = 'all', limit = 50 }: FilterMessageRecipientsOptions = {},
): MessageRecipientUser[] {
  const q = query.trim().toLowerCase();
  let list = getActiveMessageRecipients(users);

  if (roleFilter !== 'all') {
    list = list.filter((u) => u.role === roleFilter);
  }

  if (q) {
    list = list.filter((u) => matchesRecipientQuery(u, q));
  } else if (roleFilter === 'all') {
    return [];
  }

  return [...list]
    .sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr'),
    )
    .slice(0, limit);
}

export function shouldShowRecipientResults(options: {
  open: boolean;
  loading: boolean;
  query: string;
  roleFilter: string;
}): boolean {
  const q = options.query.trim();
  return (
    options.open &&
    !options.loading &&
    (q.length >= 1 || options.roleFilter !== 'all')
  );
}
