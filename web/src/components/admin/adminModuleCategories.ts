/**
 * Regroupe les onglets d’administration par domaine fonctionnel (annuaire des modules).
 */
export const ADMIN_MODULE_CATEGORIES: {
  title: string;
  hint?: string;
  tabIds: string[];
}[] = [
  {
    title: 'Pilotage & indicateurs',
    hint: 'Synthèses, alertes et rapports consolidés',
    tabIds: ['activities', 'notifications', 'analytics', 'reports'],
  },
  {
    title: 'Pédagogique & vie de classe',
    tabIds: [
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
    tabIds: ['teachers', 'educators', 'staff-personnel', 'parent-guardians', 'hr', 'roles'],
  },
  {
    title: 'Finances, inscriptions & admin',
    tabIds: ['fees', 'tuition-fees', 'payments', 'accounting', 'admissions', 'administrative'],
  },
  {
    title: 'Communication & matériel',
    tabIds: ['communication', 'material', 'nfc-scanner'],
  },
  {
    title: 'Système & conformité',
    tabIds: ['security', 'performance', 'settings', 'workspaces', 'schools'],
  },
];
