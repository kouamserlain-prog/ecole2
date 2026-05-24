import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Layout from '../../components/Layout';
import StudentsList from '../../components/admin/StudentsList';
import ClassesList from '../../components/admin/ClassesList';
import TeachersList from '../../components/admin/TeachersList';
import StaffPersonnelModule, {
  type PersonnelCategoryFilter,
} from '../../components/admin/staff/StaffPersonnelModule';
import ParentGuardiansModule from '../../components/admin/parents/ParentGuardiansModule';
import DashboardStats from '../../components/admin/DashboardStats';
import SchoolOverviewCharts from '../../components/admin/SchoolOverviewCharts';
import AllActivities from './AllActivities';
import AllNotifications from './AllNotifications';
import CompleteManagement from '../../components/admin/CompleteManagement';
import MultiRolesManagement from '../../components/admin/MultiRolesManagement';
import PedagogicalTracking from '../../components/admin/PedagogicalTracking';
import CommunicationHubModule from '../../components/admin/CommunicationHubModule';
import AdvancedAnalytics from '../../components/admin/AdvancedAnalytics';
import ScheduleManagement from '../../components/admin/ScheduleManagement';
import AcademicManagement from '../../components/admin/AcademicManagement';
import GradingEvaluationManagement from '../../components/admin/GradingEvaluationManagement';
import FeesManagementModule from '../../components/admin/FeesManagementModule';
import AdministrativeManagement from '../../components/admin/AdministrativeManagement';
import AdmissionsManagement from '../../components/admin/AdmissionsManagement';
import SecurityPrivacyManagement from '../../components/admin/SecurityPrivacyManagement';
import PerformanceManagement from '../../components/admin/PerformanceManagement';
import TuitionFeesManagement from '../../components/admin/TuitionFeesManagement';
import PaymentsManagement from '../../components/admin/PaymentsManagement';
import AccountingManagementModule from '../../components/admin/AccountingManagementModule';
import AccessControlModule from '../../components/admin/AccessControlModule';
import PointageEleves from '../../components/admin/PointageEleves';
import AttendanceManagementModule from '../../components/admin/AttendanceManagementModule';
import HRManagementModule from '../../components/admin/hr/HRManagementModule';
import LibraryManagementModule from '../../components/admin/library/LibraryManagementModule';
import HealthManagementModule from '../../components/admin/health/HealthManagementModule';
import ElearningHub from '../../components/elearning/ElearningHub';
import MaterialManagementModule from '../../components/admin/material/MaterialManagementModule';
import DisciplineAdminModule from '../../components/admin/DisciplineAdminModule';
import ExtracurricularAdminModule from '../../components/admin/ExtracurricularAdminModule';
import OrientationAdminModule from '../../components/admin/OrientationAdminModule';
import ReportsStatisticsModule from '../../components/admin/reports/ReportsStatisticsModule';
import AdminModulesHub from '../../components/admin/AdminModulesHub';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { PremiumPortalShell, PremiumModuleHeader } from '../../components/dashboard/premium';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import AddStudentModal from '../../components/admin/AddStudentModal';
import AddClassModal from '../../components/admin/AddClassModal';
import AddTeacherModal from '../../components/admin/AddTeacherModal';
import GenerateReportModal from '../../components/admin/GenerateReportModal';
import ExportDataModal from '../../components/admin/ExportDataModal';
import SettingsModal from '../../components/admin/SettingsModal';
import AdminTabLogoCard from '../../components/admin/AdminTabLogoCard';
import { 
  FiLayout, 
  FiUsers, 
  FiBook, 
  FiUserCheck, 
  FiSettings,
  FiBarChart,
  FiCalendar,
  FiBell,
  FiSearch,
  FiAward,
  FiBriefcase,
  FiShield,
  FiZap,
  FiDollarSign,
  FiWifi,
  FiActivity,
  FiInbox,
  FiUserPlus,
  FiLayers,
  FiEdit3,
  FiCreditCard,
  FiCheckSquare,
  FiPackage,
  FiBookOpen,
  FiTool,
  FiPieChart,
  FiCommand,
  FiArrowRight,
  FiMenu,
  FiChevronLeft,
  FiChevronRight,
  FiGitBranch,
  FiHeart,
  FiClipboard,
  FiAlertTriangle,
  FiMap,
  FiNavigation,
  FiMonitor,
  FiHome,
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import type { IconType } from 'react-icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import AdminWorkspacesPanel from '../../components/admin/AdminWorkspacesPanel';
import SchoolsManagementPanel from '../../components/admin/SchoolsManagementPanel';
import SchoolSwitcher from '../../components/admin/SchoolSwitcher';
import { useSchool } from '../../contexts/SchoolContext';
import {
  ADMIN_VALID_TAB_IDS,
  filterTabsByVisibleModules,
  isAdminModuleId,
} from '../../lib/adminModules';

const VALID_TAB_IDS = ADMIN_VALID_TAB_IDS;

type TabItem = {
  id: string;
  label: string;
  icon: IconType;
  color: string;
  description: string;
};

const SIDEBAR_COLLAPSED_KEY = 'admin-dashboard-sidebar-collapsed';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const { isMultiSchool, activeSchool } = useSchool();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const path = pathname ?? '';
    if (path.includes('/activities')) {
      setActiveTab('activities');
      return;
    }
    if (path.includes('/notifications')) {
      setActiveTab('notifications');
      return;
    }
    const rawTab = searchParams?.get('tab');
    if (rawTab === 'educators') {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('tab', 'staff-personnel');
      if (!params.get('personnel')) params.set('personnel', 'educator');
      router.replace(`/admin?${params.toString()}`);
      setActiveTab('staff-personnel');
      return;
    }
    const tab = rawTab;
    if (tab && VALID_TAB_IDS.includes(tab as (typeof VALID_TAB_IDS)[number])) {
      setActiveTab(tab);
      return;
    }
    setActiveTab('dashboard');
  }, [pathname, searchParams, router]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [isAddTeacherModalOpen, setIsAddTeacherModalOpen] = useState(false);
  const [isGenerateReportModalOpen, setIsGenerateReportModalOpen] = useState(false);
  const [isExportDataModalOpen, setIsExportDataModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState<'school' | 'academic' | 'notifications' | 'security' | 'user' | 'system'>('school');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') {
        setSidebarCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const schoolsTab: TabItem = {
    id: 'schools',
    label: 'Établissements',
    icon: FiHome,
    color: 'from-amber-600 to-orange-700',
    description: 'Créer et gérer plusieurs collèges sur la plateforme',
  };

  const tabs: TabItem[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: FiLayout, color: 'from-blue-500 to-blue-600', description: 'Vue d’ensemble et indicateurs' },
    ...(user?.role === 'SUPER_ADMIN' ? [schoolsTab] : []),
    { id: 'activities', label: 'Activités', icon: FiActivity, color: 'from-sky-500 to-sky-600', description: 'Historique des activités récentes' },
    { id: 'notifications', label: 'Notifications', icon: FiInbox, color: 'from-amber-500 to-amber-600', description: 'Toutes les notifications' },
    { id: 'students', label: 'Élèves', icon: FiUsers, color: 'from-green-500 to-green-600', description: 'Gestion des élèves' },
    { id: 'academic', label: 'Gestion académique', icon: FiLayers, color: 'from-violet-500 to-violet-600', description: 'Classes, matières, emploi du temps et calendrier' },
    { id: 'grading', label: 'Notation & évaluation', icon: FiEdit3, color: 'from-fuchsia-500 to-fuchsia-600', description: 'Notes, moyennes, bulletins PDF et rapports' },
    { id: 'classes', label: 'Classes', icon: FiBook, color: 'from-purple-500 to-purple-600', description: 'Gestion des classes' },
    { id: 'teachers', label: 'Enseignants', icon: FiUserCheck, color: 'from-indigo-500 to-indigo-600', description: 'Gestion des enseignants' },
    {
      id: 'staff-personnel',
      label: 'Personnel',
      icon: FiGitBranch,
      color: 'from-teal-600 to-emerald-800',
      description: 'Administration, soutien, éducateurs, organigramme, fiches de poste et présences',
    },
    {
      id: 'parent-guardians',
      label: 'Parents & tuteurs',
      icon: FiHeart,
      color: 'from-rose-500 to-orange-500',
      description: 'Profils, portail, contacts, journal, consentements et autorisations de récupération',
    },
    { id: 'management', label: 'Gestion complète', icon: FiBarChart, color: 'from-cyan-500 to-cyan-600', description: 'Notes, absences, devoirs et bulletins' },
    { id: 'roles', label: 'Multi-rôles', icon: FiUsers, color: 'from-pink-500 to-pink-600', description: 'Utilisateurs et rôles' },
    {
      id: 'workspaces',
      label: 'Espaces & modules',
      icon: FiLayers,
      color: 'from-indigo-600 to-violet-700',
      description: 'Créer des espaces et attribuer modules et fonctionnalités',
    },
    { id: 'pedagogical', label: 'Suivi pédagogique', icon: FiAward, color: 'from-yellow-500 to-yellow-600', description: 'Suivi pédagogique et indicateurs' },
    {
      id: 'discipline',
      label: 'Discipline & règlement',
      icon: FiAlertTriangle,
      color: 'from-amber-700 to-orange-800',
      description: 'Règlement intérieur, sanctions, exclusions, conseils de discipline et contrats',
    },
    {
      id: 'extracurricular',
      label: 'Activités parascolaires',
      icon: FiMap,
      color: 'from-teal-600 to-emerald-700',
      description: 'Clubs, sports, culture, sorties, voyages, inscriptions et calendrier des événements',
    },
    {
      id: 'orientation',
      label: 'Orientation',
      icon: FiNavigation,
      color: 'from-indigo-600 to-violet-700',
      description: 'Filières, tests d’aptitude, conseils, partenariats, suivi des élèves, stages et apprentissages',
    },
    { id: 'communication', label: 'Communication', icon: FiBell, color: 'from-rose-500 to-rose-600', description: 'Messagerie, alertes, circulaires, actualités et demandes' },
    { id: 'library', label: 'Bibliothèque', icon: FiBookOpen, color: 'from-sky-500 to-indigo-600', description: 'Catalogue, emprunts, réservations, pénalités et inventaire' },
    { id: 'health', label: 'Infirmerie & santé', icon: FiHeart, color: 'from-rose-500 to-pink-600', description: 'Dossiers médicaux, visites, campagnes sanitaires et urgences' },
    { id: 'elearning', label: 'E-learning', icon: FiMonitor, color: 'from-violet-500 to-purple-600', description: 'Plateforme d’apprentissage, classes virtuelles et ressources numériques' },
    { id: 'material', label: 'Gestion matérielle', icon: FiTool, color: 'from-slate-500 to-slate-700', description: 'Salles, inventaire, maintenance et allocations de matériel' },
    { id: 'reports', label: 'Rapports & statistiques', icon: FiPieChart, color: 'from-cyan-500 to-blue-700', description: 'Tableaux de bord, finances, académique, inscriptions et performances' },
    { id: 'analytics', label: 'Analytique avancée', icon: FiBarChart, color: 'from-emerald-500 to-emerald-600', description: 'Statistiques et analyses' },
    { id: 'schedule', label: 'Emploi du temps', icon: FiCalendar, color: 'from-orange-500 to-orange-600', description: 'Emplois du temps' },
    { id: 'pointage', label: 'Pointage des élèves', icon: FiUserCheck, color: 'from-emerald-500 to-emerald-600', description: 'Carte scolaire, empreinte digitale ou appel manuel' },
    { id: 'attendance', label: 'Gestion des présences', icon: FiCheckSquare, color: 'from-teal-500 to-cyan-600', description: 'Appel, absences, rapports d’assiduité et notifications aux parents' },
    { id: 'hr', label: 'Ressources humaines', icon: FiPackage, color: 'from-rose-500 to-pink-600', description: 'Contrats, paie indicative, avantages, évaluations et congés' },
    { id: 'administrative', label: 'Gestion administrative', icon: FiBriefcase, color: 'from-teal-500 to-teal-600', description: 'Vue d’ensemble administrative' },
    { id: 'admissions', label: 'Inscriptions & admissions', icon: FiUserPlus, color: 'from-violet-500 to-violet-600', description: 'Pré-inscriptions en ligne et finalisation des dossiers' },
    { id: 'fees', label: 'Gestion des frais', icon: FiCreditCard, color: 'from-teal-500 to-teal-600', description: 'Facturation, paiements, rappels, reçus et historique' },
    { id: 'tuition-fees', label: 'Frais de scolarité', icon: FiDollarSign, color: 'from-amber-500 to-amber-600', description: 'Frais de scolarité' },
    { id: 'payments', label: 'Paiements', icon: FiDollarSign, color: 'from-green-500 to-green-600', description: 'Paiements reçus' },
    {
      id: 'accounting',
      label: 'Comptabilité',
      icon: FiClipboard,
      color: 'from-slate-600 to-slate-800',
      description: 'Grand livre, journal, bilan simplifié, budget, dépenses, fournisseurs, petite caisse et exports',
    },
    { id: 'nfc-scanner', label: "Contrôle d'accès", icon: FiWifi, color: 'from-cyan-500 to-cyan-600', description: 'Badges, biométrie, entrées/sorties, visiteurs, CCTV et alarme' },
    { id: 'security', label: 'Sécurité & confidentialité', icon: FiShield, color: 'from-red-500 to-red-600', description: 'Sécurité et confidentialité' },
    { id: 'performance', label: 'Performance & rapidité', icon: FiZap, color: 'from-yellow-500 to-yellow-600', description: 'Performance et monitoring' },
    { id: 'settings', label: 'Paramètres', icon: FiSettings, color: 'from-gray-500 to-gray-600', description: 'Paramètres de l’établissement' },
  ];

  const { data: workspaceContext } = useQuery({
    queryKey: ['admin-workspace-context'],
    queryFn: () => adminApi.getAdminWorkspaceContext(),
    staleTime: 60_000,
  });

  const visibleModules = (workspaceContext as { visibleModules?: string[] } | undefined)?.visibleModules;
  const workspaceRestricted = (workspaceContext as { unrestricted?: boolean } | undefined)?.unrestricted === false;

  const effectiveVisibleModules = useMemo(() => {
    if (!visibleModules?.length) return visibleModules;
    const allowed = new Set(visibleModules);
    if (allowed.has('educators')) allowed.add('staff-personnel');
    return [...allowed];
  }, [visibleModules]);

  const personnelCategoryFilter = useMemo((): PersonnelCategoryFilter => {
    const p = searchParams?.get('personnel');
    if (p === 'educator') return 'EDUCATOR';
    if (p === 'staff') return 'STAFF';
    return 'all';
  }, [searchParams]);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const filteredTabs = useMemo(
    () =>
      filterTabsByVisibleModules(tabs, effectiveVisibleModules, {
        alwaysInclude: isSuperAdmin ? ['schools'] : [],
      }),
    [tabs, effectiveVisibleModules, isSuperAdmin],
  );

  const mainTabs = filteredTabs.filter((t) => t.id !== 'activities' && t.id !== 'notifications');
  const bottomTabs = filteredTabs.filter((t) => t.id === 'activities' || t.id === 'notifications');
  const activeTabMeta = filteredTabs.find((t) => t.id === activeTab) ?? filteredTabs[0] ?? tabs[0];
  const ActiveTabIcon = activeTabMeta.icon;
  const quickActions = useMemo(
    () => [
      { label: 'Ajouter un élève', action: () => setIsAddStudentModalOpen(true) },
      { label: 'Créer une classe', action: () => setIsAddClassModalOpen(true) },
      { label: 'Ajouter un enseignant', action: () => setIsAddTeacherModalOpen(true) },
      { label: 'Exporter des données', action: () => setIsExportDataModalOpen(true) },
    ],
    []
  );

  useEffect(() => {
    if (!effectiveVisibleModules?.length) return;
    if (isSuperAdmin && activeTab === 'schools') return;
    const moduleId = activeTab === 'educators' ? 'staff-personnel' : activeTab;
    const allowed =
      effectiveVisibleModules.includes(moduleId) ||
      (activeTab === 'educators' && effectiveVisibleModules.includes('educators'));
    if (!isAdminModuleId(activeTab) && activeTab !== 'educators') return;
    if (!allowed) {
      setActiveTab('dashboard');
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('tab', 'dashboard');
      params.delete('personnel');
      params.delete('action');
      router.replace(`/admin?${params.toString()}`);
    }
  }, [activeTab, effectiveVisibleModules, router, searchParams, isSuperAdmin]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const changeTab = (
    tabId: string,
    options?: { personnel?: 'educator' | 'staff'; action?: 'add-educator' },
  ) => {
    const resolvedId = tabId === 'educators' ? 'staff-personnel' : tabId;
    setActiveTab(resolvedId);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', resolvedId);
    if (options?.personnel) {
      params.set('personnel', options.personnel);
    } else if (resolvedId !== 'staff-personnel') {
      params.delete('personnel');
    } else if (tabId === 'educators') {
      params.set('personnel', 'educator');
    }
    if (options?.action) {
      params.set('action', options.action);
    } else {
      params.delete('action');
    }
    router.replace(`/admin?${params.toString()}`);
  };

  return (
    <Layout user={user} onLogout={logout} role="ADMIN">
      <PremiumPortalShell variant="admin">
      <div className="min-h-screen">
        <AdminSidebar
          mainTabs={mainTabs}
          bottomTabs={bottomTabs}
          activeTab={activeTab}
          onTabChange={changeTab}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((o) => !o)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />

        <div
          className={`flex min-w-0 flex-col transition-[padding] duration-300 ease-in-out ${
            sidebarCollapsed ? 'lg:pl-[4.25rem]' : 'lg:pl-64'
          }`}
        >
          {/* Header */}
          <header className="sticky top-16 z-20 glass-nav shadow-[0_8px_30px_-12px_rgba(12,10,9,0.08)]">
            <div className="px-2.5 sm:px-5 py-2 sm:py-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen((o) => !o)}
                    className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-xl p-2 text-stone-700 transition-colors hover:bg-stone-100/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45 focus-visible:ring-offset-2 lg:hidden"
                    aria-label="Ouvrir le menu de navigation"
                  >
                    <FiMenu className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed((c) => !c)}
                    className="hidden min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-xl border border-stone-200/90 bg-white/95 p-2 text-stone-600 shadow-sm transition-colors hover:border-amber-300/70 hover:bg-amber-50/40 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 lg:flex"
                    aria-expanded={!sidebarCollapsed}
                    aria-label={
                      sidebarCollapsed ? 'Développer le menu latéral' : 'Réduire le menu latéral'
                    }
                  >
                    {sidebarCollapsed ? (
                      <FiChevronRight className="h-4 w-4" aria-hidden />
                    ) : (
                      <FiChevronLeft className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                  <div className="min-w-0">
                    <h1 className="font-display text-base sm:text-lg md:text-xl font-bold text-stone-900 tracking-tight break-words leading-snug">
                      {getGreeting()}, {user?.firstName}
                    </h1>
                    <p className="text-xs text-stone-600 mt-0.5 line-clamp-2 sm:line-clamp-1 max-w-md">
                      {isMultiSchool && activeSchool
                        ? `Établissement : ${activeSchool.name}`
                        : 'Pilotage — stratégique, opérationnel et conformité'}
                    </p>
                    <p className="text-[11px] sm:text-xs text-stone-500 mt-1 tabular-nums">
                      {format(new Date(), "EEE d MMM yyyy • HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
                <SchoolSwitcher />
                <div className="relative w-full sm:max-w-xs shrink-0">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <FiSearch className="w-4 h-4" aria-hidden />
                  </div>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
                      }
                    }}
                    placeholder="Recherche globale…"
                    aria-label="Recherche globale, valider avec Entrée"
                    autoComplete="off"
                    className="w-full pl-10 pr-3 py-2 sm:py-2.5 bg-white/95 border border-stone-200/90 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-400/50 hover:border-stone-300"
                  />
                </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-3 sm:px-6 py-4 sm:py-6 overflow-y-auto overflow-x-hidden pb-[max(1.25rem,env(safe-area-inset-bottom))] scroll-smooth">
            <div className="max-w-[1200px] mx-auto space-y-4 sm:space-y-5">
              <PremiumModuleHeader
                title={activeTabMeta.label}
                description={activeTabMeta.description}
                icon={ActiveTabIcon}
                gradient={activeTabMeta.color}
                badge="Admin"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    {quickActions.slice(0, 2).map((qa) => (
                      <button
                        key={qa.label}
                        type="button"
                        onClick={qa.action}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-br from-stone-900 to-stone-800 text-amber-50 shadow-sm hover:from-stone-800 hover:to-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2"
                      >
                        {qa.label}
                        <FiArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      </button>
                    ))}
                  </div>
                }
              />

              

              {workspaceRestricted && activeTab !== 'workspaces' ? (
                <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950">
                  Votre accès est limité aux modules des espaces qui vous sont assignés. Gérez les attributions dans{' '}
                  <button
                    type="button"
                    className="font-semibold underline underline-offset-2"
                    onClick={() => changeTab('workspaces')}
                  >
                    Espaces & modules
                  </button>
                  .
                </div>
              ) : null}

              {activeTab === 'activities' ? (
                <AllActivities />
              ) : activeTab === 'notifications' ? (
                <AllNotifications />
              ) : activeTab === 'dashboard' && (
                <div className="space-y-4 sm:space-y-5">
                  {isSuperAdmin ? (
                    <Card className="p-4 border-amber-200/80 bg-gradient-to-r from-amber-50/90 to-orange-50/60">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h2 className="text-base font-bold text-stone-900">Multi-établissements</h2>
                          <p className="text-sm text-stone-600 mt-1">
                            Créez un nouveau collège, gérez les slugs et les liens de pré-inscription publics.
                          </p>
                        </div>
                        <Button type="button" onClick={() => changeTab('schools')}>
                          <FiHome className="mr-2" />
                          Gérer les établissements
                        </Button>
                      </div>
                    </Card>
                  ) : null}
                  <DashboardStats
                    onAddStudent={() => setIsAddStudentModalOpen(true)}
                    onCreateClass={() => setIsAddClassModalOpen(true)}
                    onAddTeacher={() => setIsAddTeacherModalOpen(true)}
                    onAddEducator={() =>
                      changeTab('staff-personnel', { personnel: 'educator', action: 'add-educator' })
                    }
                    onGenerateReport={() => setIsGenerateReportModalOpen(true)}
                    onExportData={() => setIsExportDataModalOpen(true)}
                    onSettings={() => {
                      setSettingsModalTab('school');
                      setIsSettingsModalOpen(true);
                    }}
                  />
                  <SchoolOverviewCharts />
                  <AdminModulesHub
                    allTabs={tabs.filter((t) => t.id !== 'dashboard')}
                    onNavigate={changeTab}
                  />
                </div>
              )}
              {activeTab === 'students' && <StudentsList searchQuery={searchQuery} />}
              {activeTab === 'academic' && <AcademicManagement />}
              {activeTab === 'grading' && <GradingEvaluationManagement />}
              {activeTab === 'classes' && <ClassesList searchQuery={searchQuery} />}
              {activeTab === 'teachers' && <TeachersList searchQuery={searchQuery} />}
              {activeTab === 'staff-personnel' && (
                <StaffPersonnelModule initialCategoryFilter={personnelCategoryFilter} />
              )}
              {activeTab === 'parent-guardians' && <ParentGuardiansModule />}
              {activeTab === 'management' && <CompleteManagement />}
              {activeTab === 'roles' && <MultiRolesManagement />}
              {activeTab === 'schools' && user?.role === 'SUPER_ADMIN' && <SchoolsManagementPanel />}
              {activeTab === 'workspaces' && <AdminWorkspacesPanel />}
              {activeTab === 'pedagogical' && <PedagogicalTracking />}
              {activeTab === 'discipline' && <DisciplineAdminModule />}
              {activeTab === 'extracurricular' && <ExtracurricularAdminModule />}
              {activeTab === 'orientation' && <OrientationAdminModule />}
              {activeTab === 'communication' && <CommunicationHubModule />}
              {activeTab === 'library' && <LibraryManagementModule />}
              {activeTab === 'health' && <HealthManagementModule />}
              {activeTab === 'elearning' && <ElearningHub mode="admin" />}
              {activeTab === 'material' && <MaterialManagementModule />}
              {activeTab === 'reports' && <ReportsStatisticsModule />}
              {activeTab === 'analytics' && <AdvancedAnalytics />}
              {activeTab === 'schedule' && <ScheduleManagement />}
              {activeTab === 'pointage' && <PointageEleves />}
              {activeTab === 'attendance' && <AttendanceManagementModule />}
              {activeTab === 'hr' && <HRManagementModule />}
              {activeTab === 'administrative' && <AdministrativeManagement />}
              {activeTab === 'admissions' && <AdmissionsManagement />}
              {activeTab === 'fees' && <FeesManagementModule />}
              {activeTab === 'tuition-fees' && <TuitionFeesManagement />}
              {activeTab === 'payments' && <PaymentsManagement />}
              {activeTab === 'accounting' && <AccountingManagementModule />}
              {activeTab === 'nfc-scanner' && <AccessControlModule />}
              {activeTab === 'security' && <SecurityPrivacyManagement />}
              {activeTab === 'performance' && <PerformanceManagement />}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <Card variant="premium" className="bg-gradient-to-r from-slate-700 to-slate-800 text-white border-none">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-black mb-2">Paramètres</h2>
                        <p className="text-gray-200 text-lg">
                          Configurez votre établissement scolaire
                        </p>
                      </div>
                      <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                        <FiSettings className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  </Card>
                  
                  <AdminTabLogoCard
                    onOpenFullSettings={() => {
                      setSettingsModalTab('school');
                      setIsSettingsModalOpen(true);
                    }}
                  />

                  <Card variant="premium">
                    <div className="text-center py-12">
                      <FiSettings className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">Gestion des Paramètres</h3>
                      <p className="text-gray-600 mb-6">
                        Accédez à tous les paramètres de configuration de votre établissement
                      </p>
                      <Button
                        onClick={() => {
                          setSettingsModalTab('school');
                          setIsSettingsModalOpen(true);
                        }}
                        className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-8 py-4 text-lg"
                      >
                        <FiSettings className="w-5 h-5 mr-2" />
                        Ouvrir les Paramètres
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Modals */}
      <AddStudentModal
        isOpen={isAddStudentModalOpen}
        onClose={() => setIsAddStudentModalOpen(false)}
      />
      <AddClassModal
        isOpen={isAddClassModalOpen}
        onClose={() => setIsAddClassModalOpen(false)}
      />
      <AddTeacherModal
        isOpen={isAddTeacherModalOpen}
        onClose={() => setIsAddTeacherModalOpen(false)}
      />
      <GenerateReportModal
        isOpen={isGenerateReportModalOpen}
        onClose={() => setIsGenerateReportModalOpen(false)}
      />
      <ExportDataModal
        isOpen={isExportDataModalOpen}
        onClose={() => setIsExportDataModalOpen(false)}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        initialTab={settingsModalTab}
        onClose={() => setIsSettingsModalOpen(false)}
      />
      </PremiumPortalShell>
    </Layout>
  );
};

export default AdminDashboard;

