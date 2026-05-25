import type { Role } from '@prisma/client';
import prisma from './prisma';

/** Identifiants des onglets / modules du tableau de bord admin. */
export const ADMIN_MODULE_IDS = [
  'dashboard',
  'workspaces',
  'activities',
  'notifications',
  'students',
  'academic',
  'grading',
  'classes',
  'teachers',
  'educators',
  'staff-personnel',
  'parent-guardians',
  'management',
  'roles',
  /** Multi-collèges — réservé SUPER_ADMIN côté UI et API */
  'schools',
  'pedagogical',
  'discipline',
  'extracurricular',
  'orientation',
  'communication',
  'library',
  'health',
  'elearning',
  'material',
  'reports',
  'analytics',
  'schedule',
  'pointage',
  'attendance',
  'hr',
  'administrative',
  'admissions',
  'fees',
  'tuition-fees',
  'payments',
  'accounting',
  'nfc-scanner',
  'security',
  'performance',
  'settings',
] as const;

export type AdminModuleId = (typeof ADMIN_MODULE_IDS)[number];

const MODULE_SET = new Set<string>(ADMIN_MODULE_IDS);

/** Modules toujours visibles pour les comptes administrateur (hors super-admin). */
const ADMIN_ALWAYS_VISIBLE_MODULES: AdminModuleId[] = ['dashboard', 'workspaces', 'admissions'];

export const ADMIN_MODULE_LABELS: Record<AdminModuleId, string> = {
  dashboard: 'Tableau de bord',
  workspaces: 'Espaces & modules',
  activities: 'Activités',
  notifications: 'Notifications',
  students: 'Élèves',
  academic: 'Gestion académique',
  grading: 'Notation & évaluation',
  classes: 'Classes',
  teachers: 'Enseignants',
  educators: 'Éducateurs',
  'staff-personnel': 'Personnel administratif',
  'parent-guardians': 'Parents & tuteurs',
  management: 'Gestion complète',
  roles: 'Multi-rôles',
  schools: 'Établissements (multi-collèges)',
  pedagogical: 'Suivi pédagogique',
  discipline: 'Discipline & règlement',
  extracurricular: 'Activités parascolaires',
  orientation: 'Orientation',
  communication: 'Communication',
  library: 'Bibliothèque',
  health: 'Infirmerie & santé',
  elearning: 'E-learning',
  material: 'Gestion matérielle',
  reports: 'Rapports & statistiques',
  analytics: 'Analytique avancée',
  schedule: 'Emploi du temps',
  pointage: 'Pointage des élèves',
  attendance: 'Gestion des présences',
  hr: 'Ressources humaines',
  administrative: 'Gestion administrative',
  admissions: 'Inscriptions & admissions',
  fees: 'Gestion des frais',
  'tuition-fees': 'Frais de scolarité',
  payments: 'Paiements',
  accounting: 'Comptabilité',
  'nfc-scanner': "Contrôle d'accès",
  security: 'Sécurité & confidentialité',
  performance: 'Performance & rapidité',
  settings: 'Paramètres',
};

export const ADMIN_MODULE_CATEGORIES: {
  title: string;
  hint?: string;
  moduleIds: AdminModuleId[];
}[] = [
  {
    title: 'Pilotage & indicateurs',
    hint: 'Synthèses, alertes et rapports consolidés',
    moduleIds: ['activities', 'notifications', 'analytics', 'reports'],
  },
  {
    title: 'Pédagogique & vie de classe',
    moduleIds: [
      'students',
      'classes',
      'academic',
      'grading',
      'management',
      'pedagogical',
      'discipline',
      'extracurricular',
      'orientation',
      'schedule',
      'pointage',
      'attendance',
      'library',
    ],
  },
  {
    title: 'Personnel & accès',
    moduleIds: ['teachers', 'educators', 'staff-personnel', 'parent-guardians', 'hr', 'roles'],
  },
  {
    title: 'Finances, inscriptions & admin',
    moduleIds: ['fees', 'tuition-fees', 'payments', 'accounting', 'admissions', 'administrative'],
  },
  {
    title: 'Communication & matériel',
    moduleIds: ['communication', 'material', 'nfc-scanner', 'health', 'elearning'],
  },
  {
    title: 'Système & conformité',
    moduleIds: ['security', 'performance', 'settings', 'workspaces', 'schools'],
  },
];

export function sanitizeEnabledAdminModules(requested: unknown): AdminModuleId[] {
  if (!Array.isArray(requested)) return ['dashboard'];
  const picked = requested
    .map((v) => String(v).trim())
    .filter(
      (id): id is AdminModuleId =>
        MODULE_SET.has(id) && id !== 'dashboard' && id !== 'workspaces' && id !== 'schools',
    );
  return ['dashboard', ...new Set(picked)];
}

export function getAllConfigurableAdminModules(): AdminModuleId[] {
  return ADMIN_MODULE_IDS.filter(
    (id) => id !== 'dashboard' && id !== 'workspaces' && id !== 'schools',
  );
}

export function slugifyWorkspaceName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'espace';
}

export async function resolveAdminVisibleModules(
  userId: string,
  role: Role,
): Promise<{
  visibleModules: AdminModuleId[];
  unrestricted: boolean;
  workspaces: { id: string; name: string; slug: string }[];
}> {
  const all = [...ADMIN_MODULE_IDS] as AdminModuleId[];

  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return { visibleModules: all, unrestricted: true, workspaces: [] };
  }

  const activeCount = await prisma.adminWorkspace.count({ where: { isActive: true } });
  if (activeCount === 0) {
    return { visibleModules: all, unrestricted: true, workspaces: [] };
  }

  const memberships = await prisma.adminWorkspaceMember.findMany({
    where: { userId, workspace: { isActive: true } },
    include: {
      workspace: { select: { id: true, name: true, slug: true, enabledModules: true } },
    },
  });

  if (memberships.length === 0) {
    return {
      visibleModules: [...ADMIN_ALWAYS_VISIBLE_MODULES],
      unrestricted: false,
      workspaces: [],
    };
  }

  const merged = new Set<AdminModuleId>(ADMIN_ALWAYS_VISIBLE_MODULES);
  const workspaces: { id: string; name: string; slug: string }[] = [];
  for (const m of memberships) {
    workspaces.push({ id: m.workspace.id, name: m.workspace.name, slug: m.workspace.slug });
    for (const mod of m.workspace.enabledModules) {
      if (MODULE_SET.has(mod)) merged.add(mod as AdminModuleId);
    }
  }

  return {
    visibleModules: [...merged],
    unrestricted: false,
    workspaces,
  };
}
