import type { IconType } from 'react-icons';

import {

  FiAward,

  FiBarChart2,

  FiBell,

  FiBook,

  FiBookOpen,

  FiBriefcase,

  FiCalendar,

  FiCheckCircle,

  FiCheckSquare,

  FiClipboard,

  FiCompass,

  FiDollarSign,

  FiEdit3,

  FiHeart,

  FiInbox,

  FiLayers,

  FiCreditCard,

  FiLayout,

  FiMonitor,

  FiPieChart,

  FiShield,

  FiTool,

  FiUserCheck,

  FiUsers,

  FiZap,

} from 'react-icons/fi';

import type { SupportStaffKindKey } from '@/views/staff/staffSpaceConfig';



export const STAFF_MODULE_IDS = [

  'overview',

  'counter',

  'admissions',

  'appointments',

  'student_registry',

  'treasury',

  'validations',

  'academic_overview',

  'class_councils',

  'health_log',

  'library',

  'digital_library',

  'it_requests',

  'maintenance_requests',

  'students_mgmt',

  'academic_mgmt',

  'grading_mgmt',

  'classes_mgmt',

  'teachers_mgmt',

  'educators_mgmt',

  'staff_mgmt',

  'parents_mgmt',

  'pedagogical_tracking',

  'discipline_mgmt',

  'extracurricular_mgmt',

  'orientation_mgmt',

  'communication_mgmt',

  'library_mgmt',

  'material_mgmt',

  'reports_mgmt',

  'analytics_mgmt',

  'schedule_mgmt',

  'pointage_mgmt',

  'attendance_mgmt',

  'hr_mgmt',

  'notifications_mgmt',

  'fees_mgmt',

  'tuition_fees_mgmt',

  'payments_mgmt',

  'accounting_mgmt',

  'administrative_mgmt',

] as const;



export type StaffModuleId = (typeof STAFF_MODULE_IDS)[number];

/** Modules pédagogiques réutilisant les écrans admin (proxy /staff/pedagogy). */
export const PEDAGOGY_STAFF_MODULE_IDS: StaffModuleId[] = [
  'students_mgmt',
  'academic_mgmt',
  'grading_mgmt',
  'classes_mgmt',
  'teachers_mgmt',
  'educators_mgmt',
  'staff_mgmt',
  'parents_mgmt',
  'pedagogical_tracking',
  'discipline_mgmt',
  'extracurricular_mgmt',
  'orientation_mgmt',
  'communication_mgmt',
  'library_mgmt',
  'material_mgmt',
  'reports_mgmt',
  'analytics_mgmt',
  'schedule_mgmt',
  'pointage_mgmt',
  'attendance_mgmt',
  'hr_mgmt',
];

export function hasPedagogyStaffAccess(modules: StaffModuleId[]): boolean {
  return modules.some((m) => PEDAGOGY_STAFF_MODULE_IDS.includes(m));
}



export const STAFF_MODULE_LABELS: Record<StaffModuleId, string> = {

  overview: 'Vue d’ensemble',

  counter: 'Guichet scolarité',

  admissions: 'Inscriptions & admissions',

  appointments: 'Rendez-vous parents',

  student_registry: 'Registre élèves',

  treasury: 'Trésorerie & frais',

  validations: 'Validations notes & moyennes',

  academic_overview: 'Pilotage pédagogique',

  class_councils: 'Conseils de classe',

  health_log: 'Infirmerie',

  library: 'Bibliothèque',

  digital_library: 'Bibliothèque numérique',

  it_requests: 'Support informatique',

  maintenance_requests: 'Maintenance',

  students_mgmt: 'Élèves',

  academic_mgmt: 'Gestion académique',

  grading_mgmt: 'Notation & évaluation',

  classes_mgmt: 'Classes',

  teachers_mgmt: 'Enseignants',

  educators_mgmt: 'Éducateurs',

  staff_mgmt: 'Personnel administratif',

  parents_mgmt: 'Parents & tuteurs',

  pedagogical_tracking: 'Suivi pédagogique',

  discipline_mgmt: 'Discipline & règlement',

  extracurricular_mgmt: 'Activités parascolaires',

  orientation_mgmt: 'Orientation',

  communication_mgmt: 'Communication',

  library_mgmt: 'Bibliothèque',

  material_mgmt: 'Gestion matérielle',

  reports_mgmt: 'Rapports & statistiques',

  analytics_mgmt: 'Analytique avancée',

  schedule_mgmt: 'Emploi du temps',

  pointage_mgmt: 'Pointage des élèves',

  attendance_mgmt: 'Gestion des présences',

  hr_mgmt: 'Ressources humaines',

  notifications_mgmt: 'Notifications',

  fees_mgmt: 'Gestion des frais',

  tuition_fees_mgmt: 'Frais de scolarité',

  payments_mgmt: 'Paiements',

  accounting_mgmt: 'Comptabilité',

  administrative_mgmt: 'Gestion administrative',

};



export const STAFF_MODULE_DESCRIPTIONS: Record<StaffModuleId, string> = {

  overview: 'Missions et organisation de votre poste',

  counter: 'Recherche élève, encaissement espèces ou virement au guichet',

  admissions: 'Pré-inscriptions, suivi des dossiers et classe proposée',

  appointments: 'Planning des entretiens parents–enseignants',

  student_registry: 'Recherche élève, coordonnées familles et pièces d’identité',

  treasury: 'Encours, impayés, encaissements du jour et du mois',

  validations: 'Notes et moyennes — 3e étape (directeur des études)',

  academic_overview: 'Effectifs, moyennes par classe et validations en attente',

  class_councils: 'Sessions, PV, décisions et recommandations',

  health_log: 'Consultations, liaison familles, suivi infirmerie',

  library: 'Catalogue, emprunts et retours',

  digital_library: 'E-books, PDF, ressources pédagogiques en ligne',

  it_requests: 'Demandes et incidents informatiques',

  maintenance_requests: 'Signalements et interventions bâtiment',

  students_mgmt: 'Liste des élèves, classes et dossiers scolaires',

  academic_mgmt: 'Structure pédagogique, programmes, EDT et calendrier',

  grading_mgmt: 'Notes, moyennes, bulletins et validations',

  classes_mgmt: 'Classes, niveaux, effectifs et groupes',

  teachers_mgmt: 'Corps enseignant, matières et affectations',

  educators_mgmt: 'Éducateurs, classes suivies et vie scolaire',

  staff_mgmt: 'Annuaire du personnel administratif et de soutien',

  parents_mgmt: 'Familles, contacts, consentements et enfants rattachés',

  pedagogical_tracking: 'Indicateurs, élèves à risque et suivi par classe',

  discipline_mgmt: 'Règlement intérieur, sanctions et conseils de discipline',

  extracurricular_mgmt: 'Offres, inscriptions et activités hors cursus',

  orientation_mgmt: 'Filières, partenariats, tests et suivi d’orientation',

  communication_mgmt: 'Messagerie, annonces et notifications',

  library_mgmt: 'Catalogue, emprunts, réservations et pénalités',

  material_mgmt: 'Salles, équipements, stocks et maintenance',

  reports_mgmt: 'Tableaux de bord et rapports consolidés',

  analytics_mgmt: 'Statistiques avancées et analyses croisées',

  schedule_mgmt: 'Créneaux, salles et disponibilités enseignants',

  pointage_mgmt: 'Carte scolaire, NFC et appel manuel',

  attendance_mgmt: 'Appel, absences et rapports d’assiduité',

  hr_mgmt: 'Congés, évaluations et suivi du personnel',

  notifications_mgmt: 'Alertes et notifications de l’établissement',

  fees_mgmt: 'Facturation, relances, reçus et vue d’ensemble financière',

  tuition_fees_mgmt: 'Catalogue, échéanciers et lignes de scolarité',

  payments_mgmt: 'Paiements reçus et validation des espèces',

  accounting_mgmt: 'Grand livre, budget, dépenses et petite caisse',

  administrative_mgmt: 'Vue d’ensemble et indicateurs administratifs',

};



type StaffTabMeta = {

  id: StaffModuleId;

  label: string;

  icon: IconType;

  color: string;

  description: string;

};



const TAB_META: Record<StaffModuleId, Omit<StaffTabMeta, 'id'>> = {

  overview: {

    label: STAFF_MODULE_LABELS.overview,

    icon: FiLayout,

    color: 'from-teal-600 to-emerald-700',

    description: STAFF_MODULE_DESCRIPTIONS.overview,

  },

  counter: {

    label: STAFF_MODULE_LABELS.counter,

    icon: FiDollarSign,

    color: 'from-emerald-500 to-teal-600',

    description: STAFF_MODULE_DESCRIPTIONS.counter,

  },

  admissions: {

    label: STAFF_MODULE_LABELS.admissions,

    icon: FiUserCheck,

    color: 'from-sky-500 to-blue-600',

    description: STAFF_MODULE_DESCRIPTIONS.admissions,

  },

  appointments: {

    label: STAFF_MODULE_LABELS.appointments,

    icon: FiUsers,

    color: 'from-cyan-500 to-teal-600',

    description: STAFF_MODULE_DESCRIPTIONS.appointments,

  },

  student_registry: {

    label: STAFF_MODULE_LABELS.student_registry,

    icon: FiClipboard,

    color: 'from-indigo-500 to-violet-600',

    description: STAFF_MODULE_DESCRIPTIONS.student_registry,

  },

  treasury: {

    label: STAFF_MODULE_LABELS.treasury,

    icon: FiDollarSign,

    color: 'from-amber-500 to-orange-600',

    description: STAFF_MODULE_DESCRIPTIONS.treasury,

  },

  validations: {

    label: STAFF_MODULE_LABELS.validations,

    icon: FiCheckCircle,

    color: 'from-indigo-500 to-violet-600',

    description: STAFF_MODULE_DESCRIPTIONS.validations,

  },

  academic_overview: {

    label: STAFF_MODULE_LABELS.academic_overview,

    icon: FiLayers,

    color: 'from-violet-500 to-purple-600',

    description: STAFF_MODULE_DESCRIPTIONS.academic_overview,

  },

  class_councils: {

    label: STAFF_MODULE_LABELS.class_councils,

    icon: FiBookOpen,

    color: 'from-fuchsia-500 to-pink-600',

    description: STAFF_MODULE_DESCRIPTIONS.class_councils,

  },

  health_log: {

    label: STAFF_MODULE_LABELS.health_log,

    icon: FiHeart,

    color: 'from-rose-500 to-pink-600',

    description: STAFF_MODULE_DESCRIPTIONS.health_log,

  },

  library: {

    label: STAFF_MODULE_LABELS.library,

    icon: FiClipboard,

    color: 'from-amber-500 to-orange-600',

    description: STAFF_MODULE_DESCRIPTIONS.library,

  },

  digital_library: {

    label: STAFF_MODULE_LABELS.digital_library,

    icon: FiBook,

    color: 'from-sky-500 to-indigo-600',

    description: STAFF_MODULE_DESCRIPTIONS.digital_library,

  },

  it_requests: {

    label: STAFF_MODULE_LABELS.it_requests,

    icon: FiMonitor,

    color: 'from-blue-500 to-cyan-600',

    description: STAFF_MODULE_DESCRIPTIONS.it_requests,

  },

  maintenance_requests: {

    label: STAFF_MODULE_LABELS.maintenance_requests,

    icon: FiTool,

    color: 'from-stone-500 to-slate-600',

    description: STAFF_MODULE_DESCRIPTIONS.maintenance_requests,

  },

  students_mgmt: {

    label: STAFF_MODULE_LABELS.students_mgmt,

    icon: FiUsers,

    color: 'from-blue-500 to-indigo-600',

    description: STAFF_MODULE_DESCRIPTIONS.students_mgmt,

  },

  academic_mgmt: {

    label: STAFF_MODULE_LABELS.academic_mgmt,

    icon: FiBookOpen,

    color: 'from-violet-500 to-purple-600',

    description: STAFF_MODULE_DESCRIPTIONS.academic_mgmt,

  },

  grading_mgmt: {

    label: STAFF_MODULE_LABELS.grading_mgmt,

    icon: FiEdit3,

    color: 'from-fuchsia-500 to-pink-600',

    description: STAFF_MODULE_DESCRIPTIONS.grading_mgmt,

  },

  classes_mgmt: {

    label: STAFF_MODULE_LABELS.classes_mgmt,

    icon: FiLayers,

    color: 'from-cyan-500 to-teal-600',

    description: STAFF_MODULE_DESCRIPTIONS.classes_mgmt,

  },

  teachers_mgmt: {

    label: STAFF_MODULE_LABELS.teachers_mgmt,

    icon: FiUserCheck,

    color: 'from-emerald-500 to-teal-600',

    description: STAFF_MODULE_DESCRIPTIONS.teachers_mgmt,

  },

  educators_mgmt: {

    label: STAFF_MODULE_LABELS.educators_mgmt,

    icon: FiShield,

    color: 'from-amber-500 to-orange-600',

    description: STAFF_MODULE_DESCRIPTIONS.educators_mgmt,

  },

  staff_mgmt: {

    label: STAFF_MODULE_LABELS.staff_mgmt,

    icon: FiBriefcase,

    color: 'from-stone-500 to-slate-600',

    description: STAFF_MODULE_DESCRIPTIONS.staff_mgmt,

  },

  parents_mgmt: {

    label: STAFF_MODULE_LABELS.parents_mgmt,

    icon: FiHeart,

    color: 'from-rose-500 to-pink-600',

    description: STAFF_MODULE_DESCRIPTIONS.parents_mgmt,

  },

  pedagogical_tracking: {

    label: STAFF_MODULE_LABELS.pedagogical_tracking,

    icon: FiAward,

    color: 'from-yellow-500 to-amber-600',

    description: STAFF_MODULE_DESCRIPTIONS.pedagogical_tracking,

  },

  discipline_mgmt: {

    label: STAFF_MODULE_LABELS.discipline_mgmt,

    icon: FiShield,

    color: 'from-red-500 to-rose-600',

    description: STAFF_MODULE_DESCRIPTIONS.discipline_mgmt,

  },

  extracurricular_mgmt: {

    label: STAFF_MODULE_LABELS.extracurricular_mgmt,

    icon: FiZap,

    color: 'from-lime-500 to-green-600',

    description: STAFF_MODULE_DESCRIPTIONS.extracurricular_mgmt,

  },

  orientation_mgmt: {

    label: STAFF_MODULE_LABELS.orientation_mgmt,

    icon: FiCompass,

    color: 'from-indigo-500 to-violet-600',

    description: STAFF_MODULE_DESCRIPTIONS.orientation_mgmt,

  },

  communication_mgmt: {

    label: STAFF_MODULE_LABELS.communication_mgmt,

    icon: FiBell,

    color: 'from-rose-500 to-pink-600',

    description: STAFF_MODULE_DESCRIPTIONS.communication_mgmt,

  },

  library_mgmt: {

    label: STAFF_MODULE_LABELS.library_mgmt,

    icon: FiBookOpen,

    color: 'from-sky-500 to-indigo-600',

    description: STAFF_MODULE_DESCRIPTIONS.library_mgmt,

  },

  material_mgmt: {

    label: STAFF_MODULE_LABELS.material_mgmt,

    icon: FiTool,

    color: 'from-slate-500 to-slate-700',

    description: STAFF_MODULE_DESCRIPTIONS.material_mgmt,

  },

  reports_mgmt: {

    label: STAFF_MODULE_LABELS.reports_mgmt,

    icon: FiPieChart,

    color: 'from-cyan-500 to-blue-700',

    description: STAFF_MODULE_DESCRIPTIONS.reports_mgmt,

  },

  analytics_mgmt: {

    label: STAFF_MODULE_LABELS.analytics_mgmt,

    icon: FiBarChart2,

    color: 'from-emerald-500 to-emerald-600',

    description: STAFF_MODULE_DESCRIPTIONS.analytics_mgmt,

  },

  schedule_mgmt: {

    label: STAFF_MODULE_LABELS.schedule_mgmt,

    icon: FiCalendar,

    color: 'from-orange-500 to-orange-600',

    description: STAFF_MODULE_DESCRIPTIONS.schedule_mgmt,

  },

  pointage_mgmt: {

    label: STAFF_MODULE_LABELS.pointage_mgmt,

    icon: FiUserCheck,

    color: 'from-emerald-500 to-emerald-600',

    description: STAFF_MODULE_DESCRIPTIONS.pointage_mgmt,

  },

  attendance_mgmt: {

    label: STAFF_MODULE_LABELS.attendance_mgmt,

    icon: FiCheckSquare,

    color: 'from-teal-500 to-cyan-600',

    description: STAFF_MODULE_DESCRIPTIONS.attendance_mgmt,

  },

  hr_mgmt: {

    label: STAFF_MODULE_LABELS.hr_mgmt,

    icon: FiBriefcase,

    color: 'from-rose-500 to-pink-600',

    description: STAFF_MODULE_DESCRIPTIONS.hr_mgmt,

  },

  notifications_mgmt: {

    label: STAFF_MODULE_LABELS.notifications_mgmt,

    icon: FiInbox,

    color: 'from-amber-500 to-orange-600',

    description: STAFF_MODULE_DESCRIPTIONS.notifications_mgmt,

  },

  fees_mgmt: {

    label: STAFF_MODULE_LABELS.fees_mgmt,

    icon: FiCreditCard,

    color: 'from-teal-500 to-teal-600',

    description: STAFF_MODULE_DESCRIPTIONS.fees_mgmt,

  },

  tuition_fees_mgmt: {

    label: STAFF_MODULE_LABELS.tuition_fees_mgmt,

    icon: FiDollarSign,

    color: 'from-amber-500 to-amber-600',

    description: STAFF_MODULE_DESCRIPTIONS.tuition_fees_mgmt,

  },

  payments_mgmt: {

    label: STAFF_MODULE_LABELS.payments_mgmt,

    icon: FiDollarSign,

    color: 'from-green-500 to-emerald-600',

    description: STAFF_MODULE_DESCRIPTIONS.payments_mgmt,

  },

  accounting_mgmt: {

    label: STAFF_MODULE_LABELS.accounting_mgmt,

    icon: FiClipboard,

    color: 'from-slate-600 to-slate-800',

    description: STAFF_MODULE_DESCRIPTIONS.accounting_mgmt,

  },

  administrative_mgmt: {

    label: STAFF_MODULE_LABELS.administrative_mgmt,

    icon: FiBriefcase,

    color: 'from-teal-500 to-cyan-600',

    description: STAFF_MODULE_DESCRIPTIONS.administrative_mgmt,

  },

};



export function getEligibleModulesForSupportKind(kind: SupportStaffKindKey): StaffModuleId[] {
  switch (kind) {

    case 'SECRETARY':

      return [
        'overview',
        'counter',
        'admissions',
        'appointments',
        'student_registry',
        'students_mgmt',
        'classes_mgmt',
        'parents_mgmt',
        'class_councils',
        'communication_mgmt',
        'extracurricular_mgmt',
      ];

    case 'BURSAR':

      return [
        'overview',
        'counter',
        'admissions',
        'treasury',
        'notifications_mgmt',
        'reports_mgmt',
        'extracurricular_mgmt',
        'attendance_mgmt',
        'parents_mgmt',
        'hr_mgmt',
        'fees_mgmt',
        'tuition_fees_mgmt',
        'payments_mgmt',
        'accounting_mgmt',
        'administrative_mgmt',
        'communication_mgmt',
        'material_mgmt',
      ];

    case 'ACCOUNTANT':

      return [
        'overview',
        'counter',
        'admissions',
        'treasury',
        'notifications_mgmt',
        'reports_mgmt',
        'fees_mgmt',
        'tuition_fees_mgmt',
        'payments_mgmt',
        'accounting_mgmt',
        'administrative_mgmt',
        'communication_mgmt',
      ];

    case 'STUDIES_DIRECTOR':

      return [
        'overview',
        'admissions',
        'appointments',
        'student_registry',
        'validations',
        'grading_mgmt',
        'academic_overview',
        'class_councils',
        'parents_mgmt',
        'pedagogical_tracking',
        'discipline_mgmt',
        'extracurricular_mgmt',
        'orientation_mgmt',
        'communication_mgmt',
        'hr_mgmt',
      ];

    case 'NURSE':

      return ['overview', 'health_log'];

    case 'LIBRARIAN':

      return ['overview', 'library', 'digital_library'];

    case 'IT':

      return ['overview', 'it_requests'];

    case 'MAINTENANCE':

      return ['overview', 'maintenance_requests'];

    default:

      return ['overview'];

  }

}



/** Tous les modules du menu latéral STAFF (hors vue d'ensemble). */
export function getAllConfigurableStaffModules(): StaffModuleId[] {
  return STAFF_MODULE_IDS.filter((id) => id !== 'overview');
}

/** Vue d'ensemble + tous les modules configurables (accès menu complet). */
export function getAllStaffVisibleModules(): StaffModuleId[] {
  return ['overview', ...getAllConfigurableStaffModules()];
}

export function resolveVisibleStaffModules(
  kind: SupportStaffKindKey,
  stored: string[] | null | undefined,
  staffCategory?: string | null,
): StaffModuleId[] {
  if (staffCategory && staffCategory !== 'SUPPORT') {
    return ['overview'];
  }

  const eligible = getEligibleModulesForSupportKind(kind);
  if (!stored?.length) return eligible;

  let picked = stored.filter((id): id is StaffModuleId =>
    (STAFF_MODULE_IDS as readonly string[]).includes(id),
  );
  if (!picked.includes('overview')) picked.unshift('overview');

  const merged = new Set<StaffModuleId>([...eligible, ...picked]);
  return [...merged];
}



export function getStaffTabsFromModules(moduleIds: StaffModuleId[]): StaffTabMeta[] {

  return moduleIds.map((id) => ({ id, ...TAB_META[id] }));

}



export function isStaffModuleTab(value: string | null, visible: StaffModuleId[]): value is StaffModuleId {

  return !!value && visible.includes(value as StaffModuleId);

}


