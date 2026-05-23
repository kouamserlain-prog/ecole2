import Link from 'next/link';
import { useState } from 'react';
import NotificationCenter from './NotificationCenter';
import Avatar from './ui/Avatar';
import ProfileEditModal from './ProfileEditModal';
import { useAppBranding } from '@/contexts/AppBrandingContext';
import { resolveStaffSupportKind, STAFF_KIND_LABELS } from '@/views/staff/staffSpaceConfig';
import {
  FiBook,
  FiBookOpen,
  FiBriefcase,
  FiChevronDown,
  FiEdit3,
  FiLogOut,
  FiMail,
  FiPhone,
  FiSettings,
  FiShield,
  FiUser,
  FiPieChart,
} from 'react-icons/fi';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  onLogout: () => void;
  role: string;
  /** Pour le personnel (STAFF) : libellé précis du métier affiché sur le badge à la place de « Personnel » */
  staffRoleBadgeLabel?: string;
}

const ROLE_ACCENTS: Record<
  string,
  { bar: string; badge: string; logo: string; label: string }
> = {
  ADMIN: {
    bar: 'from-black via-zinc-900 to-black',
    badge: 'bg-black text-white ring-1 ring-white/20',
    logo: 'from-zinc-900 to-black',
    label: 'Administrateur',
  },
  SUPER_ADMIN: {
    bar: 'from-black via-zinc-900 to-black',
    badge: 'bg-black text-white ring-1 ring-amber-400/40 font-bold',
    logo: 'from-zinc-900 to-black',
    label: 'Super administrateur',
  },
  TEACHER: {
    bar: 'from-emerald-800 via-teal-700 to-cyan-800',
    badge: 'bg-emerald-950/80 text-emerald-100 ring-1 ring-emerald-500/30',
    logo: 'from-emerald-900 to-teal-900',
    label: 'Enseignant',
  },
  STUDENT: {
    bar: 'from-violet-800 via-indigo-700 to-slate-900',
    badge: 'bg-indigo-950/85 text-violet-100 ring-1 ring-violet-400/30',
    logo: 'from-indigo-900 to-violet-950',
    label: 'Élève',
  },
  PARENT: {
    bar: 'from-amber-800 via-orange-700 to-rose-900',
    badge: 'bg-orange-950/85 text-amber-50 ring-1 ring-amber-500/30',
    logo: 'from-amber-900 to-orange-950',
    label: 'Parent',
  },
  EDUCATOR: {
    bar: 'from-rose-900 via-pink-800 to-red-950',
    badge: 'bg-rose-950/85 text-rose-100 ring-1 ring-rose-400/30',
    logo: 'from-rose-900 to-pink-950',
    label: 'Éducateur',
  },
  STAFF: {
    bar: 'from-teal-900 via-emerald-800 to-stone-950',
    badge: 'bg-emerald-950/85 text-teal-50 ring-1 ring-teal-400/30',
    logo: 'from-teal-800 to-emerald-950',
    label: 'Personnel',
  },
};

type ProfileRow = { key: string; icon: typeof FiMail; label: string; value: string };

function buildProfileRows(user: LayoutProps['user'], role: string): ProfileRow[] {
  const rows: ProfileRow[] = [];
  if (user?.email) {
    rows.push({ key: 'email', icon: FiMail, label: 'E-mail', value: user.email });
  }
  if (user?.phone) {
    rows.push({ key: 'phone', icon: FiPhone, label: 'Téléphone', value: String(user.phone) });
  }
  const isActive = user?.isActive !== false;
  rows.push({
    key: 'status',
    icon: FiShield,
    label: 'Compte',
    value: isActive ? 'Actif' : 'Suspendu',
  });
  if (role === 'TEACHER' && user?.teacherProfile) {
    const t = user.teacherProfile as {
      employeeId?: string | null;
      specialization?: string | null;
    };
    if (t.employeeId) {
      rows.push({ key: 'emp', icon: FiUser, label: 'Matricule', value: String(t.employeeId) });
    }
    if (t.specialization) {
      rows.push({
        key: 'spec',
        icon: FiBookOpen,
        label: 'Spécialité',
        value: String(t.specialization),
      });
    }
  }
  if (role === 'STUDENT' && user?.studentProfile?.class?.name) {
    rows.push({
      key: 'class',
      icon: FiBook,
      label: 'Classe',
      value: String(user.studentProfile.class.name),
    });
  }
  if (role === 'STAFF' && (user as any)?.staffProfile) {
    const sp = (user as any).staffProfile as {
      employeeId?: string;
      jobTitle?: string | null;
      supportKind?: string | null;
    };
    if (sp.employeeId) {
      rows.push({ key: 'emp', icon: FiUser, label: 'Matricule', value: String(sp.employeeId) });
    }
    if (sp.supportKind) {
      const k = resolveStaffSupportKind(sp.supportKind);
      rows.push({
        key: 'kind',
        icon: FiBriefcase,
        label: 'Métier',
        value: STAFF_KIND_LABELS[k] ?? String(sp.supportKind),
      });
    }
    if (sp.jobTitle) {
      rows.push({ key: 'job', icon: FiBookOpen, label: 'Fonction', value: String(sp.jobTitle) });
    }
  }
  if (role === 'PARENT' && Array.isArray(user?.parentProfile?.students)) {
    const n = user.parentProfile.students.length;
    if (n > 0) {
      rows.push({
        key: 'children',
        icon: FiUser,
        label: 'Enfants liés',
        value: `${n} élève${n > 1 ? 's' : ''}`,
      });
    }
  }
  return rows;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, role, staffRoleBadgeLabel }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const accent = ROLE_ACCENTS[role] ?? ROLE_ACCENTS.ADMIN;
  const roleBadgeText =
    role === 'STAFF' && staffRoleBadgeLabel?.trim() ? staffRoleBadgeLabel.trim() : accent.label;
  const profileRows = buildProfileRows(user, role);
  const { navigationLogoAbsolute, branding } = useAppBranding();
  const headerTitle = (branding.appTitle && branding.appTitle.trim()) || 'Gestion scolaire';
  const headerTagline =
    (branding.appTagline && branding.appTagline.trim()) || 'Espace sécurisé';
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Utilisateur';

  const getRolePath = () => {
    switch (role) {
      case 'ADMIN':
        return '/admin';
      case 'TEACHER':
        return '/teacher';
      case 'STUDENT':
        return '/student';
      case 'PARENT':
        return '/parent';
      case 'EDUCATOR':
        return '/educator';
      case 'STAFF':
        return '/staff';
      default:
        return '/';
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40">
        <div
          className={`h-0.5 w-full bg-gradient-to-r opacity-[0.98] shadow-[0_0_20px_-2px_rgba(201,162,39,0.45)] ${accent.bar}`}
          aria-hidden
        />
        <nav className="glass-nav">
          <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-10">
            <div className="flex min-h-16 h-16 items-center justify-between gap-2 sm:gap-3">
              <Link
                href={getRolePath()}
                className="flex items-center gap-2 sm:gap-2.5 min-w-0 group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafaf9] -m-1 p-1"
              >
                <div
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${navigationLogoAbsolute ? 'bg-white ring-2 ring-amber-500/25' : `${accent.logo} text-amber-50`} shadow-lg shadow-black/25 ring-2 ring-amber-500/25 transition duration-300 group-hover:scale-[1.02] group-hover:shadow-xl`}
                >
                  {navigationLogoAbsolute ? (
                    <img
                      src={navigationLogoAbsolute}
                      alt=""
                      className="h-full w-full object-contain p-0.5"
                    />
                  ) : (
                    <span className="font-display text-base font-semibold tracking-[0.12em]">É</span>
                  )}
                  <span
                    className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/15"
                    aria-hidden
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-base sm:text-lg font-semibold tracking-[0.06em] text-stone-900 truncate">
                    {headerTitle}
                  </p>
                  <p className="text-[9px] sm:text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500 truncate">
                    {headerTagline}
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                <span
                  className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold shrink-0 ${accent.badge}`}
                >
                  {roleBadgeText}
                </span>

                <div className="hidden sm:block text-right min-w-0 max-w-[min(220px,28vw)] lg:max-w-[260px]">
                  <p className="text-xs font-semibold text-stone-900 truncate">{displayName}</p>
                  <p className="text-[9px] text-stone-500 truncate">{user?.email}</p>
                  {user?.phone ? (
                    <p className="text-[9px] text-stone-400 truncate tabular-nums">{user.phone}</p>
                  ) : null}
                </div>

                <NotificationCenter
                  role={
                    role as
                      | 'ADMIN'
                      | 'TEACHER'
                      | 'STUDENT'
                      | 'PARENT'
                      | 'EDUCATOR'
                      | 'STAFF'
                  }
                  currentUserId={role === 'ADMIN' ? user?.id : undefined}
                />

                <div className="relative z-50">
                  <button
                    type="button"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 rounded-xl border border-stone-300/70 bg-white/85 pl-1 pr-2 py-1 shadow-sm backdrop-blur-sm transition hover:bg-amber-50/40 hover:shadow-md hover:border-amber-300/50 min-h-[40px] sm:min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45 focus-visible:ring-offset-2"
                    aria-expanded={showUserMenu}
                    aria-haspopup="menu"
                    aria-label="Menu du compte"
                  >
                    <span className="ring-2 ring-white rounded-full shadow-sm shrink-0">
                      <Avatar
                        src={user?.avatar}
                        name={displayName}
                        size="md"
                      />
                    </span>
                    <span className="hidden min-[420px]:inline max-w-[100px] sm:max-w-[140px] truncate text-left text-xs font-semibold text-stone-800 leading-tight">
                      {user?.firstName}
                    </span>
                    <FiChevronDown
                      className={`h-4 w-4 text-stone-500 shrink-0 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </button>

                  {showUserMenu && (
                    <div
                      role="menu"
                      aria-label="Compte utilisateur"
                      className="absolute right-0 mt-2 w-[min(calc(100vw-1.5rem),20rem)] sm:w-80 overflow-hidden rounded-2xl border border-stone-200/90 bg-white/98 shadow-lux-soft backdrop-blur-xl animate-fade-in ring-1 ring-amber-900/5"
                    >
                      <div role="group" aria-label="Informations du profil">
                        <div
                          className={`relative overflow-hidden border-b border-stone-200/60 px-4 pt-4 pb-3 bg-gradient-to-br from-white via-stone-50/80 to-amber-50/40`}
                        >
                        <div
                          className={`h-1 w-full shrink-0 bg-gradient-to-r opacity-90 ${accent.bar}`}
                          role="presentation"
                        >
                        </div>
                        <div className="relative flex gap-3 pt-2">
                          <span className="ring-2 ring-white/90 rounded-full shadow-md shrink-0">
                            <Avatar src={user?.avatar} name={displayName} size="lg" />
                          </span>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="text-base font-bold text-stone-900 leading-snug truncate">
                              {displayName}
                            </p>
                            <p className="text-[11px] text-stone-600 break-all leading-snug mt-0.5">
                              {user?.email}
                            </p>
                            <p
                              className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${accent.badge}`}
                            >
                              {roleBadgeText}
                            </p>
                          </div>
                        </div>
                        {role === 'ADMIN' ? (
                          <p className="relative mt-3 text-[10px] leading-relaxed text-stone-600">
                            Pilotage stratégique, opérationnel et conformité de l’établissement.
                          </p>
                        ) : null}
                      </div>

                      <div className="px-2 py-2 space-y-0.5 max-h-[min(50vh,16rem)] overflow-y-auto overscroll-contain">
                        {profileRows.map((row) => {
                          const Icon = row.icon;
                          return (
                            <div
                              key={row.key}
                              className="flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-stone-50/90 transition-colors"
                            >
                              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                                <Icon className="h-3.5 w-3.5" aria-hidden />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[9px] font-semibold uppercase tracking-wide text-stone-500">
                                  {row.label}
                                </p>
                                <p className="text-xs font-medium text-stone-800 break-words">{row.value}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      </div>

                      <div className="px-2 pb-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowUserMenu(false);
                            setProfileModalOpen(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-stone-800 transition hover:bg-stone-100/90"
                        >
                          <FiEdit3 className="h-4 w-4 shrink-0 text-amber-800" aria-hidden />
                          Modifier mon profil
                        </button>
                      </div>

                      {role === 'ADMIN' ? (
                        <div className="px-2 pb-1 space-y-1">
                          <Link
                            href="/directeur"
                            role="menuitem"
                            onClick={() => setShowUserMenu(false)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-indigo-50/90"
                          >
                            <FiPieChart className="h-4 w-4 shrink-0 text-indigo-700" aria-hidden />
                            Vue direction (KPI)
                          </Link>
                          <Link
                            href="/admin?tab=settings"
                            role="menuitem"
                            onClick={() => setShowUserMenu(false)}
                            className="flex w-full items-center gap-2 rounded-xl border border-amber-300/50 bg-gradient-to-r from-amber-50/95 to-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-900 transition hover:from-amber-100/90 hover:to-stone-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45"
                          >
                            <FiSettings className="h-4 w-4 shrink-0 text-amber-800" aria-hidden />
                            Paramètres de l’établissement
                          </Link>
                        </div>
                      ) : null}

                      <div className="border-t border-stone-200/80 bg-stone-50/40 p-1.5">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowUserMenu(false);
                            onLogout();
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          <FiLogOut className="h-4 w-4 shrink-0" aria-hidden />
                          Déconnexion
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </nav>
      </header>

      <main className="animate-fade-in">{children}</main>

      {showUserMenu && (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-default bg-stone-900/15 backdrop-blur-[2px]"
          aria-label="Fermer le menu"
          onClick={() => setShowUserMenu(false)}
        />
      )}

      <ProfileEditModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </div>
  );
};

export default Layout;
