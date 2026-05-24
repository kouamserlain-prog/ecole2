/**
 * Catalogue des modules / onglets du tableau de bord administrateur.
 */
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

export const ADMIN_VALID_TAB_IDS = ADMIN_MODULE_IDS;

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
  educators: 'Éducateurs (voir Personnel)',
  'staff-personnel': 'Personnel',
  'parent-guardians': 'Parents & tuteurs',
  management: 'Gestion complète',
  roles: 'Multi-rôles',
  schools: 'Établissements',
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

export const ADMIN_MODULE_DESCRIPTIONS: Partial<Record<AdminModuleId, string>> = {
  workspaces: 'Créer des espaces et attribuer modules et fonctionnalités aux administrateurs',
  students: 'Dossiers élèves, inscriptions et suivi',
  fees: 'Facturation, encaissements, reçus et relances',
  accounting: 'Grand livre, budget, dépenses et exports',
  security: 'Audit, confidentialité et accès',
  settings: 'Charte graphique et paramètres établissement',
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
    moduleIds: ['teachers', 'staff-personnel', 'parent-guardians', 'hr', 'roles'],
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

export function getAllConfigurableAdminModules(): AdminModuleId[] {
  return ADMIN_MODULE_IDS.filter(
    (id) => id !== 'dashboard' && id !== 'workspaces' && id !== 'schools',
  );
}

export function isAdminModuleId(id: string): id is AdminModuleId {
  return (ADMIN_MODULE_IDS as readonly string[]).includes(id);
}

export function filterTabsByVisibleModules<T extends { id: string }>(
  tabs: T[],
  visibleModules: string[] | undefined,
  options?: { alwaysInclude?: string[] },
): T[] {
  if (!visibleModules || visibleModules.length === 0) return tabs;
  const allowed = new Set(visibleModules);
  const force = new Set(options?.alwaysInclude ?? []);
  return tabs.filter((t) => allowed.has(t.id) || force.has(t.id));
}
