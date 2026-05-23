'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
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

  const navItems: { id: TabId; label: string; icon: typeof FiShield }[] = [
    { id: 'overview', label: 'Vue plateforme', icon: FiActivity },
    { id: 'users', label: 'Comptes', icon: FiUsers },
    { id: 'system', label: 'Système', icon: FiDatabase },
  ];

  return (
    <Layout user={user} onLogout={logout} role="SUPER_ADMIN">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30">
        <div className="border-b border-cptb-blue/10 bg-gradient-to-r from-cptb-blue via-brand-700 to-cptb-blue-dark text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-cptb-gold bg-cptb-blue text-lg font-bold text-cptb-gold shadow-lux">
                <Image
                  src="/branding/cptb-logo.png"
                  alt="Logo CPTB"
                  width={72}
                  height={72}
                  className="object-contain"
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cptb-gold">Super administration</p>
                <h1 className="font-display text-2xl font-bold sm:text-3xl">{TRANLEFET_SCHOOL.fullName}</h1>
                <p className="mt-1 text-sm text-white/80">Science · Humanisme · Excellence</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin">
                <span className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold backdrop-blur hover:bg-white/20">
                  <FiBook className="h-4 w-4" />
                  Admin établissement
                  <FiExternalLink className="h-3.5 w-3.5 opacity-70" />
                </span>
              </Link>
              <Link href="/">
                <span className="inline-flex items-center gap-2 rounded-xl border border-cptb-gold/40 bg-cptb-gold px-4 py-2.5 text-sm font-bold text-cptb-blue-dark hover:bg-cptb-gold-light">
                  Site public
                </span>
              </Link>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-8 flex flex-wrap gap-2 rounded-2xl bg-black p-2 shadow-lg ring-1 ring-black/20">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  tab === id
                    ? 'bg-white text-black shadow-md'
                    : 'text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="space-y-8">
              {isLoading ? (
                <p className="text-stone-500">Chargement…</p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: 'Utilisateurs actifs', value: overview?.counts.usersActive, color: 'text-cptb-blue' },
                      { label: 'Élèves', value: overview?.counts.students, color: 'text-cptb-green' },
                      { label: 'Enseignants', value: overview?.counts.teachers, color: 'text-brand-600' },
                      { label: 'Frais ouverts', value: overview?.counts.tuitionOpen, color: 'text-cptb-red' },
                    ].map((kpi) => (
                      <Card key={kpi.label} className="border-l-4 border-cptb-gold bg-white/90">
                        <p className="text-xs font-bold uppercase tracking-wider text-stone-500">{kpi.label}</p>
                        <p className={`mt-2 font-display text-3xl font-bold tabular-nums ${kpi.color}`}>
                          {kpi.value ?? '—'}
                        </p>
                      </Card>
                    ))}
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <h2 className="font-display text-lg font-semibold text-stone-900">Répartition par rôle</h2>
                      <ul className="mt-4 space-y-2">
                        {(overview?.usersByRole ?? []).map((r) => (
                          <li key={r.role} className="flex items-center justify-between text-sm">
                            <span className="font-medium text-stone-700">{ROLE_LABELS[r.role] ?? r.role}</span>
                            <Badge variant="info">{r.count}</Badge>
                          </li>
                        ))}
                      </ul>
                    </Card>
                    <Card>
                      <h2 className="font-display text-lg font-semibold text-stone-900">Derniers comptes</h2>
                      <ul className="mt-4 divide-y divide-stone-100">
                        {(overview?.recentUsers ?? []).map((u) => (
                          <li key={u.id} className="flex items-center justify-between py-3 text-sm">
                            <div>
                              <p className="font-medium text-stone-900">
                                {u.firstName} {u.lastName}
                              </p>
                              <p className="text-stone-500">{u.email}</p>
                            </div>
                            <Badge variant={u.isActive ? 'success' : 'warning'}>
                              {ROLE_LABELS[u.role] ?? u.role}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'users' && (
            <div className="grid gap-8 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="font-display text-lg font-semibold">Tous les comptes</h2>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher…"
                      className="rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-cptb-blue focus:outline-none focus:ring-2 focus:ring-cptb-blue/20"
                    />
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
                    >
                      <option value="">Tous les rôles</option>
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => refetchUsers()}
                      className="rounded-xl border border-stone-200 p-2 text-stone-600 hover:bg-stone-50"
                      aria-label="Actualiser"
                    >
                      <FiRefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-left text-stone-500">
                        <th className="pb-2 pr-4">Nom</th>
                        <th className="pb-2 pr-4">E-mail</th>
                        <th className="pb-2 pr-4">Rôle</th>
                        <th className="pb-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(usersData?.users ?? []).map((u) => (
                        <tr key={u.id} className="border-b border-stone-100">
                          <td className="py-3 pr-4 font-medium">
                            {u.firstName} {u.lastName}
                          </td>
                          <td className="py-3 pr-4 text-stone-600">{u.email}</td>
                          <td className="py-3 pr-4">{ROLE_LABELS[u.role] ?? u.role}</td>
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={() =>
                                toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive })
                              }
                              className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                                u.isActive
                                  ? 'bg-cptb-green/15 text-cptb-green'
                                  : 'bg-cptb-red/10 text-cptb-red'
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
              </Card>

              <Card className="h-fit border-t-4 border-cptb-gold bg-gradient-to-b from-amber-50/80 to-white">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <FiUserPlus className="h-5 w-5 text-cptb-blue" />
                  Nouveau compte
                </h2>
                <form
                  className="mt-4 space-y-3"
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
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-cptb-blue focus:outline-none focus:ring-2 focus:ring-cptb-blue/20"
                    />
                  ))}
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
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
              </Card>
            </div>
          )}

          {tab === 'system' && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-l-4 border-cptb-blue">
                <div className="flex items-start gap-3">
                  <FiDatabase className="mt-1 h-6 w-6 text-cptb-blue" />
                  <div>
                    <h2 className="font-display text-lg font-semibold">Sauvegarde MongoDB</h2>
                    <p className="mt-2 text-sm text-stone-600">
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
              </Card>
              <Card className="border-l-4 border-cptb-gold">
                <div className="flex items-start gap-3">
                  <FiSettings className="mt-1 h-6 w-6 text-cptb-gold-dark" />
                  <div>
                    <h2 className="font-display text-lg font-semibold">Charte & paramètres</h2>
                    <p className="mt-2 text-sm text-stone-600">
                      Logos, titre et coordonnées de l&apos;établissement.
                    </p>
                    <Link href="/admin?tab=settings">
                      <Button variant="secondary" className="mt-4">
                        Ouvrir les paramètres admin
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
              <Card className="md:col-span-2 border-l-4 border-cptb-green">
                <div className="flex items-start gap-3">
                  <FiShield className="mt-1 h-6 w-6 text-cptb-green" />
                  <div>
                    <h2 className="font-display text-lg font-semibold">Sécurité plateforme</h2>
                    <p className="mt-2 text-sm text-stone-600">
                      Le super administrateur gère les comptes globaux et accède à tous les modules admin.
                      Limitez le nombre de comptes SUPER_ADMIN.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
