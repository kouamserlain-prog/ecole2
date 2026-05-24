import type { PortalModuleCategory } from '@/components/dashboard/PortalModulesHub';

export const TEACHER_MODULE_CATEGORIES: PortalModuleCategory[] = [
  {
    title: 'Profil & organisation',
    moduleIds: ['profile', 'schedule', 'subjects', 'evaluation', 'leaves'],
  },
  {
    title: 'Pédagogie & classes',
    moduleIds: ['courses', 'grades', 'assignments', 'attendance', 'conduct', 'validations'],
  },
  {
    title: 'Communication',
    moduleIds: ['appointments', 'messaging'],
  },
  {
    title: 'Ressources numériques',
    moduleIds: ['digital-library', 'elearning'],
  },
];

export const STUDENT_MODULE_CATEGORIES: PortalModuleCategory[] = [
  {
    title: 'Mon dossier',
    moduleIds: ['profile', 'academic-history', 'identity-documents'],
  },
  {
    title: 'Scolarité',
    moduleIds: ['grades', 'schedule', 'absences', 'assignments', 'conduct'],
  },
  {
    title: 'Parcours & orientation',
    moduleIds: ['extracurricular', 'orientation'],
  },
  {
    title: 'Services & ressources',
    moduleIds: ['payments', 'messages', 'digital-library', 'elearning'],
  },
];

export const PARENT_MODULE_CATEGORIES: PortalModuleCategory[] = [
  {
    title: 'Compte & école',
    moduleIds: ['notifications', 'communication', 'appointments', 'family', 'children'],
  },
  {
    title: 'Suivi de l’enfant',
    hint: 'Sélectionnez un enfant si nécessaire',
    moduleIds: ['grades', 'absences', 'assignments', 'schedule', 'report-cards', 'conduct'],
  },
  {
    title: 'Parcours & finances',
    moduleIds: ['extracurricular', 'orientation', 'payments'],
  },
];

export const EDUCATOR_MODULE_CATEGORIES: PortalModuleCategory[] = [
  {
    title: 'Communauté scolaire',
    moduleIds: ['students', 'teachers', 'parents', 'messaging'],
  },
  {
    title: 'Vie scolaire',
    moduleIds: ['schedule', 'conduct', 'validations'],
  },
];

/** Modules prioritaires pour la direction (hors système). */
export const DIRECTOR_MODULE_CATEGORIES: PortalModuleCategory[] = [
  {
    title: 'Pilotage & indicateurs',
    moduleIds: ['activities', 'notifications', 'analytics', 'reports', 'administrative'],
  },
  {
    title: 'Pédagogie & élèves',
    moduleIds: [
      'students',
      'classes',
      'academic',
      'grading',
      'pedagogical',
      'discipline',
      'extracurricular',
      'orientation',
      'schedule',
      'attendance',
    ],
  },
  {
    title: 'Finances & inscriptions',
    moduleIds: ['admissions', 'fees', 'tuition-fees', 'payments', 'accounting'],
  },
  {
    title: 'Personnel & communication',
    moduleIds: ['teachers', 'staff-personnel', 'parent-guardians', 'hr', 'communication'],
  },
];
