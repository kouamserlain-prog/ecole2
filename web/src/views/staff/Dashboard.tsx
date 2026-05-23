'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import Card from '../../components/ui/Card';
import AcademicValidationPanel from '../../components/academic/AcademicValidationPanel';
import StaffCounterTuitionPayment from '../../components/staff/StaffCounterTuitionPayment';
import LibraryManagementModule from '../../components/admin/library/LibraryManagementModule';
import { LibraryManagementProvider } from '@/contexts/LibraryManagementContext';
import StaffModuleRecordsPanel from '../../components/staff/StaffModuleRecordsPanel';
import NurseHealthModule from '../../components/health/NurseHealthModule';
import StaffAdmissionsPanel from '../../components/staff/StaffAdmissionsPanel';
import StaffAppointmentsPanel from '../../components/staff/StaffAppointmentsPanel';
import StaffStudentRegistryPanel from '../../components/staff/StaffStudentRegistryPanel';
import StaffTreasuryPanel from '../../components/staff/StaffTreasuryPanel';
import StaffAcademicOverviewPanel from '../../components/staff/StaffAcademicOverviewPanel';
import StaffClassCouncilsPanel from '../../components/staff/StaffClassCouncilsPanel';
import StaffPedagogyShell from '../../components/staff/StaffPedagogyShell';
import StudentsList from '../../components/admin/StudentsList';
import AcademicManagement from '../../components/admin/AcademicManagement';
import GradingEvaluationManagement from '../../components/admin/GradingEvaluationManagement';
import ClassesList from '../../components/admin/ClassesList';
import TeachersList from '../../components/admin/TeachersList';
import EducatorsList from '../../components/admin/EducatorsList';
import StaffPersonnelModule from '../../components/admin/staff/StaffPersonnelModule';
import ParentGuardiansModule from '../../components/admin/parents/ParentGuardiansModule';
import PedagogicalTracking from '../../components/admin/PedagogicalTracking';
import DisciplineAdminModule from '../../components/admin/DisciplineAdminModule';
import ExtracurricularAdminModule from '../../components/admin/ExtracurricularAdminModule';
import OrientationAdminModule from '../../components/admin/OrientationAdminModule';
import CommunicationHubModule from '../../components/admin/CommunicationHubModule';
import MaterialManagementModule from '../../components/admin/material/MaterialManagementModule';
import ReportsStatisticsModule from '../../components/admin/reports/ReportsStatisticsModule';
import AdvancedAnalytics from '../../components/admin/AdvancedAnalytics';
import ScheduleManagement from '../../components/admin/ScheduleManagement';
import PointageEleves from '../../components/admin/PointageEleves';
import AttendanceManagementModule from '../../components/admin/AttendanceManagementModule';
import HRManagementModule from '../../components/admin/hr/HRManagementModule';
import FeesManagementModule from '../../components/admin/FeesManagementModule';
import TuitionFeesManagement from '../../components/admin/TuitionFeesManagement';
import PaymentsManagement from '../../components/admin/PaymentsManagement';
import AccountingManagementModule from '../../components/admin/AccountingManagementModule';
import AdministrativeManagement from '../../components/admin/AdministrativeManagement';
import StaffFinanceShell from '../../components/staff/StaffFinanceShell';
import AllNotifications from '../admin/AllNotifications';
import StaffRoleWorkspaces from './StaffRoleWorkspaces';
import { resolveStaffSupportKind, staffNavBadgeLabel } from './staffSpaceConfig';
import { inactiveModuleIconClass } from '../../lib/navModuleIconClass';
import {
  getStaffTabsFromModules,
  hasPedagogyStaffAccess,
  isStaffModuleTab,
  PEDAGOGY_STAFF_MODULE_IDS,
  resolveVisibleStaffModules,
  type StaffModuleId,
} from '@/lib/staffModules';
import { FiBookOpen, FiBriefcase, FiUser } from 'react-icons/fi';

const StaffDashboard = () => {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sp = (user as {
    staffProfile?: {
      staffCategory?: string;
      supportKind?: string;
      jobTitle?: string;
      employeeId?: string;
      visibleStaffModules?: string[];
    };
  })?.staffProfile;
  const supportKind = resolveStaffSupportKind(sp?.supportKind);
  const badgeLabel = staffNavBadgeLabel(supportKind);
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Collègue';

  const visibleModules = useMemo(
    () => resolveVisibleStaffModules(supportKind, sp?.visibleStaffModules, sp?.staffCategory),
    [supportKind, sp?.visibleStaffModules, sp?.staffCategory],
  );

  const pedagogyApiEnabled = useMemo(() => hasPedagogyStaffAccess(visibleModules), [visibleModules]);
  const tabs = useMemo(() => getStaffTabsFromModules(visibleModules), [visibleModules]);
  const [activeTab, setActiveTab] = useState<StaffModuleId>('overview');

  useEffect(() => {
    if (!pedagogyApiEnabled) return;
    if (!PEDAGOGY_STAFF_MODULE_IDS.includes(activeTab)) return;
    void queryClient.invalidateQueries();
  }, [activeTab, pedagogyApiEnabled, queryClient]);

  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (isStaffModuleTab(fromUrl, visibleModules)) {
      setActiveTab(fromUrl);
    }
  }, [searchParams, visibleModules]);

  const changeTab = (tabId: StaffModuleId) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === 'overview') params.delete('tab');
    else params.set('tab', tabId);
    const qs = params.toString();
    router.replace(qs ? `/staff?${qs}` : '/staff', { scroll: false });
  };

  const activeMeta = tabs.find((t) => t.id === activeTab) ?? tabs[0];
  const ActiveTabIcon = activeMeta.icon;
  const hasOperationalModules = visibleModules.length > 1;
  const isFinanceStaff = supportKind === 'BURSAR' || supportKind === 'ACCOUNTANT';
  const staffAdminReadOnly = !isFinanceStaff;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const renderModule = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            <Card className="p-4 sm:p-5 border border-stone-200/90 bg-stone-50/40">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-stone-700">
                <div className="flex items-center gap-2 min-w-0">
                  <FiUser className="w-4 h-4 text-stone-500 shrink-0" aria-hidden />
                  {sp?.employeeId ? (
                    <span className="tabular-nums">
                      Matricule :{' '}
                      <span className="font-mono font-semibold text-stone-900">{sp.employeeId}</span>
                    </span>
                  ) : (
                    <span>Compte personnel de l&apos;établissement</span>
                  )}
                </div>
                {sp?.jobTitle ? (
                  <>
                    <span className="hidden sm:inline text-stone-300" aria-hidden>
                      |
                    </span>
                    <span className="text-xs sm:text-sm">{sp.jobTitle}</span>
                  </>
                ) : null}
              </div>
            </Card>
            <StaffRoleWorkspaces
              supportKind={supportKind}
              displayName={displayName}
              hasOperationalModules={hasOperationalModules}
              visibleModules={visibleModules}
              onOpenModule={changeTab}
            />
          </>
        );
      case 'counter':
        return <StaffCounterTuitionPayment supportKind={supportKind} />;
      case 'admissions':
        return <StaffAdmissionsPanel />;
      case 'appointments':
        return <StaffAppointmentsPanel />;
      case 'student_registry':
        return <StaffStudentRegistryPanel />;
      case 'treasury':
        return <StaffTreasuryPanel />;
      case 'validations':
        return (
          <AcademicValidationPanel
            title="Validations notes & moyennes"
            subtitle="3e étape du circuit : professeur principal → éducateur → directeur des études"
          />
        );
      case 'academic_overview':
        return <StaffAcademicOverviewPanel onOpenModule={changeTab} />;
      case 'class_councils':
        return <StaffClassCouncilsPanel />;
      case 'health_log':
        return <NurseHealthModule />;
      case 'library':
        return (
          <LibraryManagementProvider scope="staff">
            <LibraryManagementModule />
          </LibraryManagementProvider>
        );
      case 'digital_library':
        return (
          <LibraryManagementProvider scope="staff">
            <LibraryManagementModule initialTab="digital" />
          </LibraryManagementProvider>
        );
      case 'it_requests':
        return (
          <StaffModuleRecordsPanel
            moduleKey="it_requests"
            title="Support informatique"
            newLabel="Nouvelle demande"
          />
        );
      case 'maintenance_requests':
        return (
          <StaffModuleRecordsPanel
            moduleKey="maintenance_requests"
            title="Maintenance & travaux"
            newLabel="Nouveau signalement"
          />
        );
      case 'students_mgmt':
        return (
          <StaffPedagogyShell>
            <StudentsList />
          </StaffPedagogyShell>
        );
      case 'academic_mgmt':
        return (
          <StaffPedagogyShell>
            <AcademicManagement />
          </StaffPedagogyShell>
        );
      case 'grading_mgmt':
        return (
          <StaffPedagogyShell>
            <GradingEvaluationManagement />
          </StaffPedagogyShell>
        );
      case 'classes_mgmt':
        return (
          <StaffPedagogyShell>
            <ClassesList />
          </StaffPedagogyShell>
        );
      case 'teachers_mgmt':
        return (
          <StaffPedagogyShell>
            <TeachersList />
          </StaffPedagogyShell>
        );
      case 'educators_mgmt':
        return (
          <StaffPedagogyShell>
            <EducatorsList />
          </StaffPedagogyShell>
        );
      case 'staff_mgmt':
        return (
          <StaffPedagogyShell>
            <StaffPersonnelModule pedagogyReadOnly />
          </StaffPedagogyShell>
        );
      case 'parents_mgmt':
        return (
          <StaffPedagogyShell readOnly={staffAdminReadOnly}>
            <ParentGuardiansModule />
          </StaffPedagogyShell>
        );
      case 'pedagogical_tracking':
        return (
          <StaffPedagogyShell>
            <PedagogicalTracking />
          </StaffPedagogyShell>
        );
      case 'discipline_mgmt':
        return (
          <StaffPedagogyShell>
            <DisciplineAdminModule />
          </StaffPedagogyShell>
        );
      case 'extracurricular_mgmt':
        return (
          <StaffPedagogyShell readOnly={staffAdminReadOnly}>
            <ExtracurricularAdminModule />
          </StaffPedagogyShell>
        );
      case 'orientation_mgmt':
        return (
          <StaffPedagogyShell>
            <OrientationAdminModule />
          </StaffPedagogyShell>
        );
      case 'communication_mgmt':
        return (
          <StaffPedagogyShell readOnly={staffAdminReadOnly}>
            <CommunicationHubModule />
          </StaffPedagogyShell>
        );
      case 'library_mgmt':
        return (
          <StaffPedagogyShell>
            <LibraryManagementModule />
          </StaffPedagogyShell>
        );
      case 'material_mgmt':
        return (
          <StaffPedagogyShell readOnly={staffAdminReadOnly}>
            <MaterialManagementModule />
          </StaffPedagogyShell>
        );
      case 'reports_mgmt':
        return (
          <StaffPedagogyShell readOnly={staffAdminReadOnly}>
            <ReportsStatisticsModule />
          </StaffPedagogyShell>
        );
      case 'analytics_mgmt':
        return (
          <StaffPedagogyShell>
            <AdvancedAnalytics />
          </StaffPedagogyShell>
        );
      case 'schedule_mgmt':
        return (
          <StaffPedagogyShell>
            <ScheduleManagement />
          </StaffPedagogyShell>
        );
      case 'pointage_mgmt':
        return (
          <StaffPedagogyShell>
            <PointageEleves />
          </StaffPedagogyShell>
        );
      case 'attendance_mgmt':
        return (
          <StaffPedagogyShell readOnly={staffAdminReadOnly}>
            <AttendanceManagementModule />
          </StaffPedagogyShell>
        );
      case 'hr_mgmt':
        return (
          <StaffPedagogyShell readOnly={staffAdminReadOnly}>
            <HRManagementModule />
          </StaffPedagogyShell>
        );
      case 'notifications_mgmt':
        return (
          <StaffFinanceShell>
            <AllNotifications />
          </StaffFinanceShell>
        );
      case 'fees_mgmt':
        return (
          <StaffFinanceShell>
            <FeesManagementModule />
          </StaffFinanceShell>
        );
      case 'tuition_fees_mgmt':
        return (
          <StaffFinanceShell>
            <TuitionFeesManagement />
          </StaffFinanceShell>
        );
      case 'payments_mgmt':
        return (
          <StaffFinanceShell>
            <PaymentsManagement />
          </StaffFinanceShell>
        );
      case 'accounting_mgmt':
        return (
          <StaffFinanceShell>
            <AccountingManagementModule />
          </StaffFinanceShell>
        );
      case 'administrative_mgmt':
        return (
          <StaffFinanceShell>
            <AdministrativeManagement />
          </StaffFinanceShell>
        );
      default:
        return null;
    }
  };

  return (
    <Layout user={user} onLogout={logout} role="STAFF" staffRoleBadgeLabel={badgeLabel}>
      <div className="min-h-screen flex premium-body">
        <aside className="hidden lg:flex w-64 flex-col shrink-0 sticky top-16 h-[calc(100vh-4rem)] bg-white/92 backdrop-blur-xl border-r border-stone-200/90 shadow-[0_12px_40px_-20px_rgba(12,10,9,0.12)]">
          <div className="p-2.5 flex flex-col flex-1 min-h-0">
            <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider px-2 py-1.5 shrink-0">
              {badgeLabel}
            </p>
            <nav className="space-y-1 flex-1 overflow-y-auto min-h-0 pr-0.5 text-xs leading-snug">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => changeTab(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 ${
                      isActive
                        ? `bg-gradient-to-r ${tab.color} text-white shadow-md ring-1 ring-white/20`
                        : 'text-stone-600 hover:bg-stone-100/90 hover:text-stone-900'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-white' : inactiveModuleIconClass(tab.color)
                      }`}
                    />
                    <span className="truncate text-left">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-16 z-20 glass-nav shadow-[0_8px_30px_-12px_rgba(12,10,9,0.08)] shrink-0">
            <div className="max-w-[1200px] mx-auto px-3 sm:px-6 py-2 sm:py-2.5">
              <div className="flex flex-col gap-2 sm:gap-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-700 to-emerald-900 flex items-center justify-center text-amber-50 shadow-md shrink-0 lg:hidden">
                      <FiBriefcase className="w-5 h-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider">
                        Espace personnel
                      </p>
                      <h1 className="font-display text-base sm:text-lg md:text-xl font-bold text-stone-900 tracking-tight leading-snug">
                        {getGreeting()}, {user?.firstName}
                      </h1>
                      <p className="text-stone-600 text-xs mt-0.5">{badgeLabel}</p>
                      <p className="text-[11px] sm:text-xs text-stone-500 mt-1 tabular-nums">
                        {format(new Date(), 'EEE d MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/help"
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50 shrink-0"
                  >
                    <FiBookOpen className="w-4 h-4 text-amber-800" aria-hidden />
                    Aide
                  </Link>
                </div>
                <div className="lg:hidden flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => changeTab(tab.id)}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold ${
                          isActive
                            ? `bg-gradient-to-r ${tab.color} text-white shadow-md`
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-6 py-4 sm:py-6">
            <div className="max-w-[1200px] mx-auto space-y-4 sm:space-y-5">
              <div className={`rounded-2xl bg-gradient-to-r ${activeMeta.color} p-[1px] shadow-md`}>
                <div className="rounded-[15px] bg-white/95 px-3 py-3 sm:px-5 sm:py-4 border border-white/60">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl bg-gradient-to-br ${activeMeta.color} text-white shrink-0`}>
                      <ActiveTabIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-900">{activeMeta.label}</p>
                      <p className="text-xs text-stone-600 mt-0.5">{activeMeta.description}</p>
                    </div>
                  </div>
                </div>
              </div>
              {renderModule()}
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default StaffDashboard;
