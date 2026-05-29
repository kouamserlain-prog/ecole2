import type { MessageRecipientUser } from './MessageRecipientSearch';

export type MessagingContact = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  role: string;
  label?: string;
  _label?: string;
};

export type MessagingContactsGroups = {
  admins?: MessagingContact[];
  teachers?: MessagingContact[];
  educators?: MessagingContact[];
  staff?: MessagingContact[];
  parents?: MessagingContact[];
  students?: MessagingContact[];
};

/** Regroupe les listes de contacts messagerie en une liste plate dédupliquée. */
export function flattenMessagingContacts(
  contacts: MessagingContactsGroups | undefined,
): MessageRecipientUser[] {
  if (!contacts) return [];

  const out: MessageRecipientUser[] = [];
  const seen = new Set<string>();

  const add = (list: MessagingContact[] | undefined) => {
    for (const u of list ?? []) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      out.push({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email ?? '',
        role: u.role,
        contextLabel: u.label ?? u._label,
      });
    }
  };

  add(contacts.admins);
  add(contacts.teachers);
  add(contacts.staff);
  add(contacts.educators);
  add(contacts.parents);
  add(contacts.students);

  return out;
}
