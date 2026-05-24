import type { IconType } from 'react-icons';
import {
  FiActivity,
  FiAlertTriangle,
  FiAward,
  FiBarChart,
  FiBell,
  FiBook,
  FiBookOpen,
  FiBriefcase,
  FiCalendar,
  FiCheckSquare,
  FiClipboard,
  FiCreditCard,
  FiDollarSign,
  FiEdit3,
  FiGitBranch,
  FiHeart,
  FiHome,
  FiInbox,
  FiLayers,
  FiMap,
  FiMonitor,
  FiNavigation,
  FiPackage,
  FiPieChart,
  FiSettings,
  FiShield,
  FiTool,
  FiUserCheck,
  FiUserPlus,
  FiUsers,
  FiWifi,
  FiZap,
} from 'react-icons/fi';
import type { AdminModuleId } from './adminModules';

export type AdminModuleTabMeta = {
  id: AdminModuleId;
  label: string;
  icon: IconType;
  color: string;
  description: string;
};

const BASE_ADMIN_TABS: AdminModuleTabMeta[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: FiLayers, color: 'from-blue-500 to-blue-600', description: 'Vue d’ensemble et indicateurs' },
  { id: 'activities', label: 'Activités', icon: FiActivity, color: 'from-sky-500 to-sky-600', description: 'Historique des activités récentes' },
  { id: 'notifications', label: 'Notifications', icon: FiInbox, color: 'from-amber-500 to-amber-600', description: 'Toutes les notifications' },
  { id: 'students', label: 'Élèves', icon: FiUsers, color: 'from-green-500 to-green-600', description: 'Gestion des élèves' },
  { id: 'academic', label: 'Gestion académique', icon: FiLayers, color: 'from-violet-500 to-violet-600', description: 'Classes, matières, emploi du temps et calendrier' },
  { id: 'grading', label: 'Notation & évaluation', icon: FiEdit3, color: 'from-fuchsia-500 to-fuchsia-600', description: 'Notes, moyennes, bulletins PDF et rapports' },
  { id: 'classes', label: 'Classes', icon: FiBook, color: 'from-purple-500 to-purple-600', description: 'Gestion des classes' },
  { id: 'teachers', label: 'Enseignants', icon: FiUserCheck, color: 'from-indigo-500 to-indigo-600', description: 'Gestion des enseignants' },
  { id: 'staff-personnel', label: 'Personnel', icon: FiGitBranch, color: 'from-teal-600 to-emerald-800', description: 'Administration, soutien, éducateurs, organigramme et présences' },
  { id: 'parent-guardians', label: 'Parents & tuteurs', icon: FiHeart, color: 'from-rose-500 to-orange-500', description: 'Profils, contacts, consentements et autorisations' },
  { id: 'management', label: 'Gestion complète', icon: FiBarChart, color: 'from-cyan-500 to-cyan-600', description: 'Notes, absences, devoirs et bulletins' },
  { id: 'roles', label: 'Multi-rôles', icon: FiUsers, color: 'from-pink-500 to-pink-600', description: 'Utilisateurs et rôles' },
  { id: 'workspaces', label: 'Espaces & modules', icon: FiLayers, color: 'from-indigo-600 to-violet-700', description: 'Créer des espaces et attribuer modules' },
  { id: 'pedagogical', label: 'Suivi pédagogique', icon: FiAward, color: 'from-yellow-500 to-yellow-600', description: 'Suivi pédagogique et indicateurs' },
  { id: 'discipline', label: 'Discipline & règlement', icon: FiAlertTriangle, color: 'from-amber-700 to-orange-800', description: 'Sanctions, exclusions et conseils de discipline' },
  { id: 'extracurricular', label: 'Activités parascolaires', icon: FiMap, color: 'from-teal-600 to-emerald-700', description: 'Clubs, sports, sorties et inscriptions' },
  { id: 'orientation', label: 'Orientation', icon: FiNavigation, color: 'from-indigo-600 to-violet-700', description: 'Filières, tests, conseils et stages' },
  { id: 'communication', label: 'Communication', icon: FiBell, color: 'from-rose-500 to-rose-600', description: 'Messagerie, alertes, circulaires et actualités' },
  { id: 'library', label: 'Bibliothèque', icon: FiBookOpen, color: 'from-sky-500 to-indigo-600', description: 'Catalogue, emprunts, réservations et inventaire' },
  { id: 'health', label: 'Infirmerie & santé', icon: FiHeart, color: 'from-rose-500 to-pink-600', description: 'Dossiers médicaux, visites et urgences' },
  { id: 'elearning', label: 'E-learning', icon: FiMonitor, color: 'from-violet-500 to-purple-600', description: 'Classes virtuelles et ressources numériques' },
  { id: 'material', label: 'Gestion matérielle', icon: FiTool, color: 'from-slate-500 to-slate-700', description: 'Salles, inventaire et maintenance' },
  { id: 'reports', label: 'Rapports & statistiques', icon: FiPieChart, color: 'from-cyan-500 to-blue-700', description: 'Tableaux de bord consolidés' },
  { id: 'analytics', label: 'Analytique avancée', icon: FiBarChart, color: 'from-emerald-500 to-emerald-600', description: 'Statistiques et analyses' },
  { id: 'schedule', label: 'Emploi du temps', icon: FiCalendar, color: 'from-orange-500 to-orange-600', description: 'Emplois du temps' },
  { id: 'pointage', label: 'Pointage des élèves', icon: FiUserCheck, color: 'from-emerald-500 to-emerald-600', description: 'Carte scolaire, NFC ou appel manuel' },
  { id: 'attendance', label: 'Gestion des présences', icon: FiCheckSquare, color: 'from-teal-500 to-cyan-600', description: 'Appel, absences et notifications aux parents' },
  { id: 'hr', label: 'Ressources humaines', icon: FiPackage, color: 'from-rose-500 to-pink-600', description: 'Contrats, évaluations et congés' },
  { id: 'administrative', label: 'Gestion administrative', icon: FiBriefcase, color: 'from-teal-500 to-teal-600', description: 'Vue d’ensemble administrative' },
  { id: 'admissions', label: 'Inscriptions & admissions', icon: FiUserPlus, color: 'from-violet-500 to-violet-600', description: 'Pré-inscriptions et finalisation des dossiers' },
  { id: 'fees', label: 'Gestion des frais', icon: FiCreditCard, color: 'from-teal-500 to-teal-600', description: 'Facturation, paiements et reçus' },
  { id: 'tuition-fees', label: 'Frais de scolarité', icon: FiDollarSign, color: 'from-amber-500 to-amber-600', description: 'Catalogue et échéanciers' },
  { id: 'payments', label: 'Paiements', icon: FiDollarSign, color: 'from-green-500 to-green-600', description: 'Paiements reçus' },
  { id: 'accounting', label: 'Comptabilité', icon: FiClipboard, color: 'from-slate-600 to-slate-800', description: 'Grand livre, budget et dépenses' },
  { id: 'nfc-scanner', label: "Contrôle d'accès", icon: FiWifi, color: 'from-cyan-500 to-cyan-600', description: 'Badges, biométrie et entrées/sorties' },
  { id: 'security', label: 'Sécurité & confidentialité', icon: FiShield, color: 'from-red-500 to-red-600', description: 'Sécurité et confidentialité' },
  { id: 'performance', label: 'Performance & rapidité', icon: FiZap, color: 'from-yellow-500 to-yellow-600', description: 'Performance et monitoring' },
  { id: 'settings', label: 'Paramètres', icon: FiSettings, color: 'from-gray-500 to-gray-600', description: 'Paramètres de l’établissement' },
];

const SCHOOLS_TAB: AdminModuleTabMeta = {
  id: 'schools',
  label: 'Établissements',
  icon: FiHome,
  color: 'from-amber-600 to-orange-700',
  description: 'Créer et gérer plusieurs collèges sur la plateforme',
};

/** Métadonnées des onglets admin (menu latéral + annuaire). */
export function buildAdminModuleTabs(options?: { includeSchools?: boolean }): AdminModuleTabMeta[] {
  const includeSchools = options?.includeSchools ?? false;
  if (!includeSchools) return BASE_ADMIN_TABS;
  const tabs = [...BASE_ADMIN_TABS];
  tabs.splice(1, 0, SCHOOLS_TAB);
  return tabs;
}
