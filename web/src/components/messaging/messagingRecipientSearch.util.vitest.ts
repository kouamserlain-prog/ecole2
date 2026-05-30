import { describe, expect, it } from 'vitest';
import type { MessageRecipientUser } from './MessageRecipientSearch';
import {
  filterMessageRecipients,
  getActiveMessageRecipients,
  matchesRecipientQuery,
  normalizeSearchText,
  shouldShowRecipientResults,
} from './messagingRecipientSearch.util';

const sampleUsers: MessageRecipientUser[] = [
  {
    id: '1',
    firstName: 'José',
    lastName: 'Martin',
    email: 'jose.martin@ecole.fr',
    role: 'TEACHER',
    teacherProfile: { employeeId: 'ENS-42' },
  },
  {
    id: '2',
    firstName: 'Marie',
    lastName: 'Dupont',
    email: 'marie.dupont@ecole.fr',
    role: 'PARENT',
    contextLabel: 'Parent — 6ème A',
  },
  {
    id: '3',
    firstName: 'Paul',
    lastName: 'Bernard',
    email: 'paul@ecole.fr',
    role: 'ADMIN',
    isActive: false,
  },
  {
    id: '4',
    firstName: 'Sophie',
    lastName: 'Leroy',
    email: 'sophie@ecole.fr',
    role: 'STAFF',
    staffProfile: { jobTitle: 'Secrétaire', employeeId: 'STF-01' },
  },
];

describe('normalizeSearchText', () => {
  it('ignore la casse et les accents', () => {
    expect(normalizeSearchText('José')).toBe('jose');
    expect(normalizeSearchText('ÉLÈVE')).toBe('eleve');
  });
});

describe('matchesRecipientQuery', () => {
  it('trouve par nom sans accent', () => {
    expect(matchesRecipientQuery(sampleUsers[0], 'jose')).toBe(true);
  });

  it('trouve par rôle libellé', () => {
    expect(matchesRecipientQuery(sampleUsers[0], 'enseignant')).toBe(true);
  });

  it('trouve par matricule ou libellé contexte', () => {
    expect(matchesRecipientQuery(sampleUsers[0], 'ens-42')).toBe(true);
    expect(matchesRecipientQuery(sampleUsers[1], '6eme')).toBe(true);
  });

  it('trouve par intitulé de poste', () => {
    expect(matchesRecipientQuery(sampleUsers[3], 'secretaire')).toBe(true);
  });
});

describe('getActiveMessageRecipients', () => {
  it('exclut les utilisateurs inactifs', () => {
    const active = getActiveMessageRecipients(sampleUsers);
    expect(active.map((u) => u.id)).toEqual(['1', '2', '4']);
  });
});

describe('filterMessageRecipients', () => {
  it('ne retourne rien sans requête ni filtre de rôle', () => {
    expect(filterMessageRecipients(sampleUsers)).toEqual([]);
  });

  it('filtre par texte dès 1 caractère', () => {
    const results = filterMessageRecipients(sampleUsers, { query: 'm' });
    expect(results.map((u) => u.id)).toContain('1');
    expect(results.map((u) => u.id)).toContain('2');
  });

  it('filtre par rôle sans texte', () => {
    const results = filterMessageRecipients(sampleUsers, { roleFilter: 'TEACHER' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('combine filtre rôle et texte', () => {
    const results = filterMessageRecipients(sampleUsers, {
      roleFilter: 'STAFF',
      query: 'sophie',
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('4');
  });

  it('trie par nom de famille', () => {
    const results = filterMessageRecipients(sampleUsers, { roleFilter: 'PARENT' });
    expect(results[0].lastName).toBe('Dupont');
  });

  it('limite le nombre de résultats', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: String(i),
      firstName: 'User',
      lastName: `Nom${String(i).padStart(2, '0')}`,
      email: `u${i}@test.fr`,
      role: 'TEACHER',
    }));
    expect(filterMessageRecipients(many, { roleFilter: 'TEACHER', limit: 10 })).toHaveLength(10);
  });
});

describe('shouldShowRecipientResults', () => {
  it('affiche si ouvert avec au moins 1 caractère', () => {
    expect(
      shouldShowRecipientResults({ open: true, loading: false, query: 'a', roleFilter: 'all' }),
    ).toBe(true);
  });

  it('affiche si un filtre de rôle est actif', () => {
    expect(
      shouldShowRecipientResults({ open: true, loading: false, query: '', roleFilter: 'TEACHER' }),
    ).toBe(true);
  });

  it('masque pendant le chargement', () => {
    expect(
      shouldShowRecipientResults({ open: true, loading: true, query: 'marie', roleFilter: 'all' }),
    ).toBe(false);
  });

  it('masque si fermé', () => {
    expect(
      shouldShowRecipientResults({ open: false, loading: false, query: 'marie', roleFilter: 'all' }),
    ).toBe(false);
  });
});
