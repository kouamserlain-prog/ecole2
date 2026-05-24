import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '../../components/Layout';
import { PremiumPortalShell, PremiumModuleHeader } from '../../components/dashboard/premium';
import PortalRoleModulesHub from '../../components/dashboard/PortalRoleModulesHub';
import { PARENT_MODULE_CATEGORIES } from '@/lib/portalModuleCategories';
import ParentSidebar, { type ParentNavItem } from '../../components/parent/ParentSidebar';
import ParentOverview from '../../components/parent/ParentOverview';
import ChildrenList from '../../components/parent/ChildrenList';
import ChildGrades from '../../components/parent/ChildGrades';
import ChildAbsences from '../../components/parent/ChildAbsences';
import ChildSchedule from '../../components/parent/ChildSchedule';
import ChildAssignments from '../../components/parent/ChildAssignments';
import ChildPayments from '../../components/parent/ChildPayments';
import ChildReportCards from '../../components/parent/ChildReportCards';
import ChildConduct from '../../components/parent/ChildConduct';
import ParentAppointmentsPanel from '../../components/parent/ParentAppointmentsPanel';
import ParentFamilyProfilePanel from '../../components/parent/ParentFamilyProfilePanel';
import ParentExtracurricularPanel from '../../components/parent/ParentExtracurricularPanel';
import ParentOrientationPanel from '../../components/parent/ParentOrientationPanel';
import ParentNotificationsPanel from '../../components/parent/ParentNotificationsPanel';
import SchoolCommunication from '../../components/portal/SchoolCommunication';
import Card from '../../components/ui/Card';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import {
  FiSearch,
  FiHeart,
  FiMenu,
  FiAward,
  FiAlertCircle,
  FiFileText,
  FiCalendar,
  FiShield,
  FiCreditCard,
  FiUsers,
  FiLayout,
  FiBook,
  FiMessageCircle,
  FiCommand,
  FiClock,
  FiMap,
  FiNavigation,
  FiBell,
} from 'react-icons/fi';

const VALID_PARENT_TABS = [
  'overview',
  'notifications',
  'communication',
  'appointments',
  'family',
  'children',
  'grades',
  'absences',
  'assignments',
  'schedule',
  'report-cards',
  'conduct',
  'extracurricular',
  'orientation',
  'payments',
] as const;

type ParentTabId = (typeof VALID_PARENT_TABS)[number];

const ParentDashboard = () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems: ParentNavItem[] = useMemo(
    () => [
      { id: 'overview', label: 'Vue d’ensemble', icon: FiLayout, requiresChild: false, color: 'from-orange-500 to-amber-600' },
      { id: 'notifications', label: 'Notifications', icon: FiBell, requiresChild: false, color: 'from-amber-500 to-orange-600' },
      { id: 'communication', label: 'Messages école', icon: FiMessageCircle, requiresChild: false, color: 'from-amber-500 to-yellow-600' },
      { id: 'appointments', label: 'Rendez-vous', icon: FiClock, requiresChild: false, color: 'from-amber-600 to-orange-600' },
      {
        id: 'family',
        label: 'Compte & famille',
        icon: FiHeart,
        requiresChild: false,
        color: 'from-rose-500 to-orange-500',
      },
      { id: 'children', label: 'Mes enfants', icon: FiUsers, requiresChild: false, color: 'from-orange-600 to-rose-500' },
      { id: 'grades', label: 'Notes', icon: FiAward, requiresChild: true, color: 'from-amber-600 to-orange-600' },
      { id: 'absences', label: 'Absences', icon: FiAlertCircle, requiresChild: true, color: 'from-orange-500 to-red-500' },
      { id: 'assignments', label: 'Devoirs', icon: FiFileText, requiresChild: true, color: 'from-yellow-500 to-amber-600' },
      { id: 'schedule', label: 'Emploi du temps', icon: FiCalendar, requiresChild: true, color: 'from-amber-500 to-orange-500' },
      { id: 'report-cards', label: 'Bulletins', icon: FiBook, requiresChild: true, color: 'from-orange-700 to-amber-700' },
      { id: 'conduct', label: 'Conduite', icon: FiShield, requiresChild: true, color: 'from-rose-500 to-orange-600' },
      {
        id: 'extracurricular',
        label: 'Activités parascolaires',
        icon: FiMap,
        requiresChild: true,
        color: 'from-teal-500 to-emerald-600',
      },
      {
        id: 'orientation',
        label: 'Orientation',
        icon: FiNavigation,
        requiresChild: false,
        color: 'from-indigo-500 to-violet-600',
      },
      { id: 'payments', label: 'Paiements', icon: FiCreditCard, requiresChild: true, color: 'from-emerald-600 to-amber-600' },
    ],
    []
  );

  const tabDescriptions: Record<string, string> = useMemo(
    () => ({
      overview: 'Vue d’ensemble de la scolarité et raccourcis utiles',
      notifications: 'Alertes paiements, notes, devoirs, présence et rendez-vous',
      communication: 'Échanges avec l’école',
      appointments: 'Entretiens avec les enseignants de vos enfants',
      family: 'Profil, préférences du portail, contacts, consentements et personnes autorisées à récupérer vos enfants',
      children: 'Liste de vos enfants et sélection du profil actif',
      grades: 'Notes et résultats de l’enfant sélectionné',
      absences: 'Assiduité et justifications',
      assignments: 'Devoirs et travaux à rendre',
      schedule: 'Emploi du temps hebdomadaire',
      'report-cards': 'Bulletins et bilans',
      conduct: 'Appréciations et conduite',
      extracurricular: 'Clubs, événements, sorties et inscriptions',
      orientation: 'Filières, tests, conseils, partenariats et suivi de votre enfant',
      payments: 'Frais scolaires et règlements',
    }),
    []
  );

  const hubTabs = useMemo(
    () =>
      navItems.map((n) => ({
        id: n.id,
        label: n.label,
        icon: n.icon,
        color: n.color,
        description: tabDescriptions[n.id] ?? n.label,
      })),
    [navItems, tabDescriptions]
  );

  useEffect(() => {
    const t = searchParams?.get('tab');
    if (t && VALID_PARENT_TABS.includes(t as ParentTabId)) {
      setActiveTab(t);
    }
  }, [searchParams]);

  const changeTab = (tabId: string) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', tabId);
    router.replace(`/parent?${params.toString()}`);
  };

  const activeMeta = navItems.find((n) => n.id === activeTab) ?? navItems[0];
  const ActiveTabIcon = activeMeta.icon;
  const activeDescription = tabDescriptions[activeTab] ?? tabDescriptions.overview;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  return (
    <Layout user={user} onLogout={logout} role="PARENT">
      <PremiumPortalShell variant="parent">
      <div className="min-h-screen">
        <ParentSidebar
          items={navItems}
          activeTab={activeTab}
          onTabChange={changeTab}
          selectedChild={selectedChild}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        <div className="lg:pl-64">
          <header className="sticky top-16 z-30 glass-nav shadow-[0_8px_30px_-12px_rgba(12,10,9,0.08)]">
            <div className="px-3 sm:px-6 py-2 sm:py-2.5">
              <div className="flex flex-col gap-2 sm:gap-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      className="lg:hidden p-2 rounded-xl hover:bg-stone-100/90 transition-colors text-stone-700 shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45 focus-visible:ring-offset-2"
                      aria-label="Ouvrir le menu"
                    >
                      <FiMenu className="w-4 h-4" aria-hidden />
                    </button>
                    <div className="min-w-0">
                      <h1 className="font-display text-base sm:text-lg md:text-xl font-bold text-stone-900 tracking-tight leading-snug">
                        {getGreeting()}, {user?.firstName}
                      </h1>
                      <p className="text-stone-600 text-xs mt-0.5 line-clamp-2 sm:line-clamp-1 max-w-md">
                        Scolarité de vos enfants
                      </p>
                      <p className="text-[11px] sm:text-xs text-stone-500 mt-1 tabular-nums">
                        {format(new Date(), "EEE d MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-orange-950 text-xs font-semibold shrink-0 ring-1 ring-orange-900/5">
                    <FiHeart className="w-3.5 h-3.5 text-orange-700" aria-hidden />
                    Parent
                  </div>
                </div>

                <div className="relative w-full max-w-xl">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <FiSearch className="w-4 h-4" aria-hidden />
                  </div>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher…"
                    className="w-full pl-10 pr-3 py-2 sm:py-2.5 bg-white/95 border border-stone-200/90 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-400/50 hover:border-stone-300"
                    aria-label="Recherche dans l’espace parent"
                  />
                </div>
              </div>
            </div>
          </header>

          <main className="px-3 sm:px-6 py-4 sm:py-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] overflow-x-hidden scroll-smooth">
            <div className="max-w-[1200px] mx-auto space-y-4 sm:space-y-5">
                            <PremiumModuleHeader
                title={activeMeta.label}
                description={activeDescription}
                icon={ActiveTabIcon}
                gradient={activeMeta.color}
                badge="Parent"
              />

              <div className="animate-slide-up">
                {activeTab === 'overview' && (
                  <>
                    <ParentOverview />
                    <PortalRoleModulesHub
                      tabs={hubTabs}
                      categories={PARENT_MODULE_CATEGORIES}
                      onNavigate={changeTab}
                    />
                  </>
                )}
                {activeTab === 'notifications' && <ParentNotificationsPanel />}
                {activeTab === 'communication' && (
                  <SchoolCommunication role="parent" contextStudentId={selectedChild} />
                )}
                {activeTab === 'appointments' && <ParentAppointmentsPanel />}
                {activeTab === 'family' && <ParentFamilyProfilePanel />}
                {activeTab === 'children' && (
                  <ChildrenList
                    onSelectChild={setSelectedChild}
                    selectedChild={selectedChild}
                    searchQuery={searchQuery}
                  />
                )}
                {activeTab === 'grades' &&
                  (selectedChild ? (
                    <ChildGrades studentId={selectedChild} searchQuery={searchQuery} />
                  ) : (
                    <Card>
                      <div className="text-center py-12 text-stone-600">
                        <p className="text-lg mb-2 font-semibold text-stone-900">Sélectionnez un enfant</p>
                        <p className="text-sm leading-relaxed">Choisissez un enfant dans « Mes enfants » pour voir ses notes.</p>
                      </div>
                    </Card>
                  ))}
                {activeTab === 'absences' &&
                  (selectedChild ? (
                    <ChildAbsences studentId={selectedChild} searchQuery={searchQuery} />
                  ) : (
                    <Card>
                      <div className="text-center py-12 text-stone-600">
                        <p className="text-lg mb-2 font-semibold text-stone-900">Sélectionnez un enfant</p>
                        <p className="text-sm leading-relaxed">Choisissez un enfant dans « Mes enfants » pour voir ses absences.</p>
                      </div>
                    </Card>
                  ))}
                {activeTab === 'assignments' &&
                  (selectedChild ? (
                    <ChildAssignments studentId={selectedChild} searchQuery={searchQuery} />
                  ) : (
                    <Card>
                      <div className="text-center py-12 text-stone-600">
                        <p className="text-lg mb-2 font-semibold text-stone-900">Sélectionnez un enfant</p>
                        <p className="text-sm leading-relaxed">Choisissez un enfant dans « Mes enfants » pour voir ses devoirs.</p>
                      </div>
                    </Card>
                  ))}
                {activeTab === 'schedule' &&
                  (selectedChild ? (
                    <ChildSchedule studentId={selectedChild} searchQuery={searchQuery} />
                  ) : (
                    <Card>
                      <div className="text-center py-12 text-stone-600">
                        <p className="text-lg mb-2 font-semibold text-stone-900">Sélectionnez un enfant</p>
                        <p className="text-sm leading-relaxed">Choisissez un enfant dans « Mes enfants » pour voir son emploi du temps.</p>
                      </div>
                    </Card>
                  ))}
                {activeTab === 'report-cards' &&
                  (selectedChild ? (
                    <ChildReportCards studentId={selectedChild} />
                  ) : (
                    <Card>
                      <div className="text-center py-12 text-stone-600">
                        <p className="text-lg mb-2 font-semibold text-stone-900">Sélectionnez un enfant</p>
                        <p className="text-sm leading-relaxed">Choisissez un enfant dans « Mes enfants » pour voir ses bulletins.</p>
                      </div>
                    </Card>
                  ))}
                {activeTab === 'conduct' &&
                  (selectedChild ? (
                    <ChildConduct studentId={selectedChild} />
                  ) : (
                    <Card>
                      <div className="text-center py-12 text-stone-600">
                        <p className="text-lg mb-2 font-semibold text-stone-900">Sélectionnez un enfant</p>
                        <p className="text-sm leading-relaxed">Choisissez un enfant dans « Mes enfants » pour voir sa conduite.</p>
                      </div>
                    </Card>
                  ))}
                {activeTab === 'orientation' && <ParentOrientationPanel studentId={selectedChild} />}
                {activeTab === 'extracurricular' &&
                  (selectedChild ? (
                    <ParentExtracurricularPanel studentId={selectedChild} />
                  ) : (
                    <Card>
                      <div className="text-center py-12 text-stone-600">
                        <p className="text-lg mb-2 font-semibold text-stone-900">Sélectionnez un enfant</p>
                        <p className="text-sm leading-relaxed">
                          Choisissez un enfant dans « Mes enfants » pour gérer les activités parascolaires.
                        </p>
                      </div>
                    </Card>
                  ))}
                {activeTab === 'payments' &&
                  (selectedChild ? (
                    <ChildPayments studentId={selectedChild} />
                  ) : (
                    <Card>
                      <div className="text-center py-12 text-stone-600">
                        <p className="text-lg mb-2 font-semibold text-stone-900">Sélectionnez un enfant</p>
                        <p className="text-sm leading-relaxed">Choisissez un enfant dans « Mes enfants » pour gérer ses paiements.</p>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          </main>
        </div>
      </div>
      </PremiumPortalShell>
    </Layout>
  );
};

export default ParentDashboard;
