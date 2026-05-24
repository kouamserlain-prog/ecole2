'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import {
  PremiumDashboardHero,
  PremiumDashboardShell,
  PremiumGlassCard,
  PremiumKpiCard,
  PremiumSectionTitle,
  PremiumTabNav,
} from '@/components/dashboard/premium';
import { superAdminApi } from '@/services/api/superAdmin.api';
import { ROLE_LABELS } from '@/lib/rolePaths';
import { TRANLEFET_SCHOOL } from '@/data/tranlefetSchool';
import toast from 'react-hot-toast';
import {
  FiUsers,
  FiDatabase,
  FiSettings,
  FiShield,
  FiActivity,
  FiExternalLink,
  FiRefreshCw,
  FiUserPlus,
  FiBook,
  FiDollarSign,
  FiGlobe,
} from 'react-icons/fi';

type TabId = 'overview' | 'users' | 'system';

const ROLE_OPTIONS = [
  'SUPER_ADMIN',
  'ADMIN',
  'TEACHER',
  'STUDENT',
  'PARENT',
  'EDUCATOR',
  'STAFF',
] as const;

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>('overview');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'ADMIN',
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['super-admin-overview'],
    queryFn: superAdminApi.getOverview,
  });

  const { data: usersData, refetch: refetchUsers } = useQuery({
    queryKey: ['super-admin-users', search, roleFilter],
    queryFn: () => superAdminApi.getUsers({ q: search || undefined, role: roleFilter || undefined }),
    enabled: tab === 'users',
  });

  const backupMutation = useMutation({
    mutationFn: superAdminApi.runBackup,
    onSuccess: () => toast.success('Sauvegarde MongoDB lancée avec succès'),
    onError: () => toast.error('Échec de la sauvegarde'),
  });

  const createUserMutation = useMutation({
    mutationFn: superAdminApi.createUser,
    onSuccess: () => {
      toast.success('Utilisateur créé');
      setCreateForm({ email: '', password: '', firstName: '', lastName: '', role: 'ADMIN' });
      queryClient.invalidateQueries({ queryKey: ['super-admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-overview'] });
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e?.response?.data?.error || 'Création impossible'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      superAdminApi.updateUser(id, { isActive }),
    onSuccess: () => {
      refetchUsers();
      queryClient.invalidateQueries({ queryKey: ['super-admin-overview'] });
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e?.response?.data?.error || 'Mise à jour impossible'),
  });

  const navItems = [
    { id: 'overview' as const, label: 'Vue plateforme', icon: FiActivity },
    { id: 'users' as const, label: 'Comptes', icon: FiUsers },
    { id: 'system' as const, label: 'Système', icon: FiDatabase },
  ];

  return (
    <Layout user={user} onLogout={logout} role="SUPER_ADMIN">
      <PremiumDashboardShell variant="super">
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
          <PremiumDashboardHero
            variant="super"
            eyebrow="Super administration"
            title={TRANLEFET_SCHOOL.fullName}
            icon={FiShield}
            badge="Plateforme opérationnelle"
            description="Science · Humanisme · Excellence — pilotage global des comptes, données et paramètres système."
            actions={
              <>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                >
                  <FiBook className="h-4 w-4" aria-hidden />
                  Admin établissement
                  <FiExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/25 transition hover:from-amber-300 hover:to-amber-400"
                >
                  <FiGlobe className="h-4 w-4" aria-hidden />
                  Site public
                </Link>
              </>
            }
          />

          <PremiumTabNav items={navItems} active={tab} onChange={setTab} variant="dark" />

          {tab === 'overview' && (
            <div className="space-y-8">
              {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/60 ring-1 ring-stone-200/80" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <PremiumKpiCard
                      label="Utilisateurs actifs"
                      value={overview?.counts.usersActive ?? '—'}
                      icon={FiUsers}
                      accent="indigo"
                    />
                    <PremiumKpiCard
                      label="Élèves"
                      value={overview?.counts.students ?? '—'}
                      icon={FiActivity}
                      accent="emerald"
                    />
                    <PremiumKpiCard
                      label="Enseignants"
                      value={overview?.counts.teachers ?? '—'}
                      icon={FiBook}
                      accent="violet"
                    />
                    <PremiumKpiCard
                      label="Frais ouverts"
                      value={overview?.counts.tuitionOpen ?? '—'}
                      icon={FiDollarSign}
                      accent="rose"
                    />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <PremiumGlassCard accent="gold">
                      <PremiumSectionTitle title="Répartition par rôle" icon={FiUsers} />
                      <ul className="space-y-2">
                        {(overview?.usersByRole ?? []).map((r) => (
                          <li
                            key={r.role}
                            className="flex items-center justify-between rounded-xl bg-stone-50/80 px-3 py-2.5 text-sm ring-1 ring-stone-200/60"
                          >
                            <span className="font-semibold text-stone-800">{ROLE_LABELS[r.role] ?? r.role}</span>
                            <Badge variant="info">{r.count}</Badge>
                          </li>
                        ))}
                      </ul>
                    </PremiumGlassCard>
                    <PremiumGlassCard accent="indigo">
                      <PremiumSectionTitle title="Derniers comptes" icon={FiUserPlus} />
                      <ul className="divide-y divide-stone-100">
                        {(overview?.recentUsers ?? []).map((u) => (
                          <li key={u.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-stone-900">
                                {u.firstName} {u.lastName}
                              </p>
                              <p className="truncate text-stone-500">{u.email}</p>
                            </div>
                            <Badge variant={u.isActive ? 'success' : 'warning'}>
                              {ROLE_LABELS[u.role] ?? u.role}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </PremiumGlassCard>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'users' && (
            <div className="grid gap-8 lg:grid-cols-3">
              <PremiumGlassCard className="lg:col-span-2" accent="indigo" padding="md">
                <PremiumSectionTitle
                  title="Tous les comptes"
                  subtitle="Recherche, filtrage et gestion des accès"
                  icon={FiUsers}
                  action={
                    <button
                      type="button"
                      onClick={() => refetchUsers()}
                      className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 shadow-sm transition hover:bg-stone-50"
                      aria-label="Actualiser"
                    >
                      <FiRefreshCw className="h-4 w-4" />
                    </button>
                  }
                />
                <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher…"
                    className="flex-1 rounded-xl border border-stone-200 bg-white/90 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="rounded-xl border border-stone-200 bg-white/90 px-3 py-2.5 text-sm shadow-sm"
                    aria-label="Filtrer par rôle"
                  >
                    <option value="">Tous les rôles</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="overflow-x-auto rounded-xl ring-1 ring-stone-200/80">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50/90">
                      <tr className="border-b border-stone-200 text-left text-xs font-bold uppercase tracking-wider text-stone-500">
                        <th className="px-4 py-3">Nom</th>
                        <th className="px-4 py-3">E-mail</th>
                        <th className="px-4 py-3">Rôle</th>
                        <th className="px-4 py-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/95">
                      {(usersData?.users ?? []).map((u) => (
                        <tr key={u.id} className="border-b border-stone-100 last:border-0">
                          <td className="px-4 py-3 font-semibold text-stone-900">
                            {u.firstName} {u.lastName}
                          </td>
                          <td className="px-4 py-3 text-stone-600">{u.email}</td>
                          <td className="px-4 py-3">{ROLE_LABELS[u.role] ?? u.role}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive })
                              }
                              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                                u.isActive
                                  ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
                                  : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                              }`}
                            >
                              {u.isActive ? 'Actif' : 'Inactif'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PremiumGlassCard>

              <PremiumGlassCard accent="gold" padding="md" className="h-fit">
                <PremiumSectionTitle title="Nouveau compte" icon={FiUserPlus} />
                <form
                  className="mt-2 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createUserMutation.mutate(createForm);
                  }}
                >
                  {(['firstName', 'lastName', 'email', 'password'] as const).map((field) => (
                    <input
                      key={field}
                      required
                      type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                      placeholder={
                        field === 'firstName'
                          ? 'Prénom'
                          : field === 'lastName'
                            ? 'Nom'
                            : field === 'email'
                              ? 'E-mail'
                              : 'Mot de passe (8+ car.)'
                      }
                      value={createForm[field]}
                      onChange={(e) => setCreateForm((f) => ({ ...f, [field]: e.target.value }))}
                      className="w-full rounded-xl border border-stone-200 bg-white/90 px-3 py-2.5 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  ))}
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full rounded-xl border border-stone-200 bg-white/90 px-3 py-2.5 text-sm"
                    aria-label="Rôle du compte"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" className="w-full" isLoading={createUserMutation.isPending}>
                    Créer le compte
                  </Button>
                </form>
              </PremiumGlassCard>
            </div>
          )}

          {tab === 'system' && (
            <div className="grid gap-6 md:grid-cols-2">
              <PremiumGlassCard accent="indigo">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg">
                    <FiDatabase className="h-6 w-6" aria-hidden />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-stone-900">Sauvegarde MongoDB</h2>
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">
                      Lance une sauvegarde complète de la base de données.
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => backupMutation.mutate()}
                      isLoading={backupMutation.isPending}
                    >
                      Lancer la sauvegarde
                    </Button>
                  </div>
                </div>
              </PremiumGlassCard>
              <PremiumGlassCard accent="gold">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                    <FiSettings className="h-6 w-6" aria-hidden />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-stone-900">Charte & paramètres</h2>
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">
                      Logos, titre et coordonnées de l&apos;établissement.
                    </p>
                    <Link href="/admin?tab=settings">
                      <Button variant="secondary" className="mt-4">
                        Ouvrir les paramètres admin
                      </Button>
                    </Link>
                  </div>
                </div>
              </PremiumGlassCard>
              <PremiumGlassCard accent="emerald" className="md:col-span-2">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg">
                    <FiShield className="h-6 w-6" aria-hidden />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-stone-900">Sécurité plateforme</h2>
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">
                      Le super administrateur gère les comptes globaux et accède à tous les modules admin.
                      Limitez le nombre de comptes SUPER_ADMIN.
                    </p>
                  </div>
                </div>
              </PremiumGlassCard>
            </div>
          )}
        </div>
      </PremiumDashboardShell>
    </Layout>
  );
}
