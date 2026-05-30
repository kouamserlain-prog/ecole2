import { describe, expect, it } from 'vitest';
import { flattenMessagingContacts } from './flattenMessagingContacts';

describe('flattenMessagingContacts', () => {
  it('retourne une liste vide si contacts undefined', () => {
    expect(flattenMessagingContacts(undefined)).toEqual([]);
  });

  it('aplatit et déduplique les groupes', () => {
    const shared = {
      id: 'u1',
      firstName: 'Alice',
      lastName: 'Admin',
      email: 'alice@ecole.fr',
      role: 'ADMIN',
    };
    const result = flattenMessagingContacts({
      admins: [shared],
      teachers: [{ ...shared, role: 'TEACHER' }],
      staff: [
        {
          id: 'u2',
          firstName: 'Bob',
          lastName: 'Staff',
          email: 'bob@ecole.fr',
          role: 'STAFF',
          label: 'Bibliothèque',
        },
      ],
      parents: [
        {
          id: 'u3',
          firstName: 'Claire',
          lastName: 'Parent',
          email: 'claire@ecole.fr',
          role: 'PARENT',
          _label: 'Parent — 5ème B',
        },
      ],
    });

    expect(result).toHaveLength(3);
    expect(result.find((u) => u.id === 'u1')).toMatchObject({
      firstName: 'Alice',
      role: 'ADMIN',
    });
    expect(result.find((u) => u.id === 'u2')?.contextLabel).toBe('Bibliothèque');
    expect(result.find((u) => u.id === 'u3')?.contextLabel).toBe('Parent — 5ème B');
  });

  it('conserve l’ordre d’insertion par groupe', () => {
    const result = flattenMessagingContacts({
      admins: [{ id: 'a', firstName: 'A', lastName: 'A', role: 'ADMIN' }],
      teachers: [{ id: 't', firstName: 'T', lastName: 'T', role: 'TEACHER' }],
    });
    expect(result.map((u) => u.id)).toEqual(['a', 't']);
  });
});
