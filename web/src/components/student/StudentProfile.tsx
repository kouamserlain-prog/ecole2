import { useMemo, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi, authApi } from '../../services/api';
import Card from '../ui/Card';
import Avatar from '../ui/Avatar';
import ImageUpload from '../ui/ImageUpload';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  FiMail,
  FiBook,
  FiHash,
  FiCalendar,
  FiMapPin,
  FiPhone,
  FiSearch,
  FiUsers,
  FiAlertTriangle,
  FiSave,
  FiUser,
  FiInfo,
  FiShield,
  FiEdit3,
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import {
  ENROLLMENT_STATUS_LABELS,
  enrollmentBadgeVariant,
  type EnrollmentStatusValue,
} from '../../lib/enrollmentStatus';
import {
  STATE_ASSIGNMENT_LABELS,
  normalizeStateAssignment,
  stateAssignmentBadgeVariant,
} from '../../lib/stateAssignment';
import GdprUserRightsPanel from '../gdpr/GdprUserRightsPanel';

function genderLabel(g?: string) {
  switch (g) {
    case 'MALE':
      return 'Masculin';
    case 'FEMALE':
      return 'Féminin';
    case 'OTHER':
      return 'Autre';
    default:
      return g ? String(g) : '—';
  }
}

function relationLabel(relation?: string) {
  if (!relation) return 'Responsable légal';
  const m: Record<string, string> = {
    father: 'Père',
    mother: 'Mère',
    guardian: 'Tuteur / tutrice',
    parent: 'Parent',
    stepfather: 'Beau-père',
    stepmother: 'Belle-mère',
  };
  return m[relation.toLowerCase()] || relation;
}

function formatDateFr(d: string | Date | undefined | null) {
  if (!d) return '—';
  try {
    return format(new Date(d), 'd MMMM yyyy', { locale: fr });
  } catch {
    return '—';
  }
}

const StudentProfile = ({ searchQuery = '' }: { searchQuery?: string }) => {
  const { refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: studentApi.getProfile,
  });

  const [identity, setIdentity] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [contacts, setContacts] = useState({
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    medicalInfo: '',
  });

  useEffect(() => {
    if (!profile) return;
    setIdentity({
      firstName: profile.user?.firstName ?? '',
      lastName: profile.user?.lastName ?? '',
      phone: profile.user?.phone ?? '',
    });
    setContacts({
      address: profile.address ?? '',
      emergencyContact: profile.emergencyContact ?? '',
      emergencyPhone: profile.emergencyPhone ?? '',
      medicalInfo: profile.medicalInfo ?? '',
    });
  }, [profile]);

  const isDirty = useMemo(() => {
    if (!profile) return false;
    return (
      identity.firstName.trim() !== (profile.user?.firstName ?? '').trim() ||
      identity.lastName.trim() !== (profile.user?.lastName ?? '').trim() ||
      identity.phone.trim() !== (profile.user?.phone ?? '').trim() ||
      contacts.address.trim() !== (profile.address ?? '').trim() ||
      contacts.emergencyContact.trim() !== (profile.emergencyContact ?? '').trim() ||
      contacts.emergencyPhone.trim() !== (profile.emergencyPhone ?? '').trim() ||
      contacts.medicalInfo.trim() !== (profile.medicalInfo ?? '').trim()
    );
  }, [profile, identity, contacts]);

  const handleAvatarUpload = async (url: string) => {
    if (url) {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      return;
    }
    try {
      await authApi.updateMe({ avatar: null });
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      toast.success('Photo supprimée');
    } catch {
      toast.error('Impossible de supprimer la photo');
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await authApi.updateMe({
        firstName: identity.firstName.trim(),
        lastName: identity.lastName.trim(),
        phone: identity.phone.trim() || undefined,
      });
      return studentApi.updateProfile({
        address: contacts.address.trim() || null,
        emergencyContact: contacts.emergencyContact.trim() || null,
        emergencyPhone: contacts.emergencyPhone.trim() || null,
        medicalInfo: contacts.medicalInfo.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      toast.success('Profil enregistré');
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.error || 'Enregistrement impossible');
    },
  });

  const profileMatchesSearch = useMemo(() => {
    if (!searchQuery || !profile) return true;
    const query = searchQuery.toLowerCase();
    const fields = [
      profile.user?.firstName,
      profile.user?.lastName,
      profile.user?.email,
      profile.user?.phone,
      profile.studentId,
      profile.class?.name,
      profile.address,
      profile.emergencyContact,
      profile.emergencyPhone,
      profile.medicalInfo,
      ...(profile.parents?.map((p: any) => [
        p.parent?.user?.firstName,
        p.parent?.user?.lastName,
        p.parent?.user?.email,
      ]) ?? []).flat(),
    ];
    return fields.some((f) => (f && String(f).toLowerCase().includes(query)) ?? false);
  }, [profile, searchQuery]);

  const teacherName = profile?.class?.teacher?.user
    ? `${profile.class.teacher.user.firstName} ${profile.class.teacher.user.lastName}`
    : null;

  const enrollmentKey = ((profile?.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE');
  const stateAssignmentKey = normalizeStateAssignment(profile?.stateAssignment);

  if (isLoading) {
    return (
      <Card>
        <div className="text-center py-12">
          <div
            className="inline-block animate-spin rounded-full h-12 w-12 border-2 border-amber-200 border-t-amber-700"
            aria-hidden
          />
          <p className="mt-4 text-stone-600">Chargement du profil…</p>
        </div>
      </Card>
    );
  }

  if (!profileMatchesSearch && searchQuery) {
    return (
      <Card>
        <div className="text-center py-12 text-stone-600">
          <FiSearch className="w-16 h-16 mx-auto mb-4 text-stone-400" aria-hidden />
          <p className="text-lg font-semibold text-stone-900 mb-2">Aucun résultat dans le profil</p>
          <p className="text-sm">Essayez d&apos;autres mots-clés</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {searchQuery && (
        <Card className="bg-gradient-to-r from-violet-50/90 to-amber-50/50 border border-violet-200/80 ring-1 ring-amber-900/5">
          <div className="flex items-center gap-3">
            <FiSearch className="w-5 h-5 text-violet-700 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold text-stone-900">
                Recherche : <span className="text-violet-800">&quot;{searchQuery}&quot;</span>
              </p>
              <p className="text-sm text-stone-600">Résultats dans le profil</p>
            </div>
          </div>
        </Card>
      )}

      <div className="lux-card-surface px-5 py-6 sm:px-8 sm:py-7">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
          Profil et informations personnelles
        </h1>
        <p className="mt-2 text-sm sm:text-base text-stone-600 max-w-3xl leading-relaxed">
          Mettez à jour l&apos;identité affichée sur votre compte, votre photo et les coordonnées utiles à
          l&apos;établissement. Les données administratives (email scolaire, classe, naissance) sont gérées par
          le secrétariat.
        </p>
      </div>

      {/* —— Profil (identité + photo + infos admin) —— */}
      <Card className="border border-stone-200/90 shadow-sm overflow-hidden">
        <div className="border-b border-stone-200/80 bg-stone-50/90 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <FiUser className="w-5 h-5 text-amber-800" aria-hidden />
            Profil
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            Photo, nom et téléphone élève ; informations de scolarité en lecture seule.
          </p>
        </div>

        <div className="p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-shrink-0 flex flex-col items-center lg:items-start">
              <Avatar
                src={profile?.user.avatar}
                name={`${profile?.user.firstName} ${profile?.user.lastName}`}
                size="xl"
              />
              <div className="mt-4 w-full max-w-[240px]">
                <ImageUpload
                  currentImage={profile?.user.avatar}
                  onUpload={handleAvatarUpload}
                  type="avatar"
                  label="Photo de l'élève"
                />
                <p className="mt-2 text-xs text-stone-500 leading-relaxed">
                  Cette photo apparaît sur votre profil et sur les bulletins scolaires.
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-2 mb-4">
                  <FiEdit3 className="w-4 h-4 text-amber-800" aria-hidden />
                  Identité (modifiable)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="student-firstName" className="block text-sm font-medium text-stone-700 mb-1">
                      Prénom
                    </label>
                    <input
                      id="student-firstName"
                      type="text"
                      value={identity.firstName}
                      onChange={(e) => setIdentity((s) => ({ ...s, firstName: e.target.value }))}
                      className="w-full rounded-xl border border-stone-200/90 px-3 py-2.5 text-stone-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label htmlFor="student-lastName" className="block text-sm font-medium text-stone-700 mb-1">
                      Nom
                    </label>
                    <input
                      id="student-lastName"
                      type="text"
                      value={identity.lastName}
                      onChange={(e) => setIdentity((s) => ({ ...s, lastName: e.target.value }))}
                      className="w-full rounded-xl border border-stone-200/90 px-3 py-2.5 text-stone-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50"
                    />
                  </div>
                  <div className="md:col-span-2 max-w-md">
                    <label htmlFor="student-phone" className="block text-sm font-medium text-stone-700 mb-1">
                      Téléphone (élève)
                    </label>
                    <input
                      id="student-phone"
                      type="tel"
                      value={identity.phone}
                      onChange={(e) => setIdentity((s) => ({ ...s, phone: e.target.value }))}
                      placeholder="Optionnel"
                      className="w-full rounded-xl border border-stone-200/90 px-3 py-2.5 text-stone-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-stone-200/80 bg-stone-50/70 p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-2 mb-4">
                  <FiShield className="w-4 h-4 text-stone-500" aria-hidden />
                  Informations administratives (lecture seule)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <FiMail className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" aria-hidden />
                    <div>
                      <span className="text-stone-500 block text-xs uppercase tracking-wide">Email (connexion)</span>
                      <span className="font-medium text-stone-900 break-all">{profile?.user.email}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FiHash className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" aria-hidden />
                    <div>
                      <span className="text-stone-500 block text-xs uppercase tracking-wide">Numéro élève</span>
                      <span className="font-mono font-semibold text-stone-900">{profile?.studentId}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FiShield className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" aria-hidden />
                    <div>
                      <span className="text-stone-500 block text-xs uppercase tracking-wide">Statut d&apos;inscription</span>
                      <Badge variant={enrollmentBadgeVariant(enrollmentKey)} size="sm" className="mt-1">
                        {ENROLLMENT_STATUS_LABELS[enrollmentKey]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FiInfo className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" aria-hidden />
                    <div>
                      <span className="text-stone-500 block text-xs uppercase tracking-wide">Affectation État</span>
                      <Badge variant={stateAssignmentBadgeVariant(stateAssignmentKey)} size="sm" className="mt-1">
                        {STATE_ASSIGNMENT_LABELS[stateAssignmentKey]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FiCalendar className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" aria-hidden />
                    <div>
                      <span className="text-stone-500 block text-xs uppercase tracking-wide">Date d&apos;inscription</span>
                      <span className="font-medium text-stone-900">{formatDateFr(profile?.enrollmentDate)}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <FiBook className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" aria-hidden />
                    <div>
                      <span className="text-stone-500 block text-xs uppercase tracking-wide">Classe</span>
                      <span className="font-medium text-stone-900">
                        {profile?.class?.name ?? 'Non assigné'}
                        {profile?.class?.level ? (
                          <span className="text-stone-600 font-normal"> — {profile.class.level}</span>
                        ) : null}
                      </span>
                      {teacherName && (
                        <p className="text-xs text-stone-500 mt-1">Professeur principal : {teacherName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <FiCalendar className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" aria-hidden />
                    <div>
                      <span className="text-stone-500 block text-xs uppercase tracking-wide">État civil</span>
                      <p className="font-medium text-stone-900">Naissance : {formatDateFr(profile?.dateOfBirth)}</p>
                      <p className="text-stone-600 mt-0.5">Genre : {genderLabel(profile?.gender)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* —— Informations personnelles (coordonnées) —— */}
      <Card className="border border-stone-200/90 shadow-sm overflow-hidden">
        <div className="border-b border-stone-200/80 bg-stone-50/90 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <FiMapPin className="w-5 h-5 text-amber-800" aria-hidden />
            Informations personnelles
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            Adresse, personne à prévenir et informations médicales utiles en cas d&apos;urgence.
          </p>
        </div>

        <div className="p-5 sm:p-6 lg:p-8 space-y-4">
          <div>
            <label htmlFor="student-address" className="block text-sm font-medium text-stone-700 mb-1">
              Adresse
            </label>
            <input
              id="student-address"
              type="text"
              value={contacts.address}
              onChange={(e) => setContacts((s) => ({ ...s, address: e.target.value }))}
              placeholder="Rue, ville, code postal…"
              className="w-full rounded-xl border border-stone-200/90 px-3 py-2.5 text-stone-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="student-emergency-name" className="block text-sm font-medium text-stone-700 mb-1">
                Personne à contacter en urgence
              </label>
              <input
                id="student-emergency-name"
                type="text"
                value={contacts.emergencyContact}
                onChange={(e) => setContacts((s) => ({ ...s, emergencyContact: e.target.value }))}
                placeholder="Nom et prénom"
                className="w-full rounded-xl border border-stone-200/90 px-3 py-2.5 text-stone-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50"
              />
            </div>
            <div>
              <label htmlFor="student-emergency-phone" className="block text-sm font-medium text-stone-700 mb-1">
                Téléphone urgence
              </label>
              <input
                id="student-emergency-phone"
                type="tel"
                value={contacts.emergencyPhone}
                onChange={(e) => setContacts((s) => ({ ...s, emergencyPhone: e.target.value }))}
                className="w-full rounded-xl border border-stone-200/90 px-3 py-2.5 text-stone-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="student-medical" className="flex flex-wrap items-center gap-2 text-sm font-medium text-stone-700 mb-1">
              <FiAlertTriangle className="w-4 h-4 text-amber-600" aria-hidden />
              Informations médicales utiles (allergies, traitements…)
            </label>
            <textarea
              id="student-medical"
              rows={4}
              value={contacts.medicalInfo}
              onChange={(e) => setContacts((s) => ({ ...s, medicalInfo: e.target.value }))}
              placeholder="Visible par l’établissement pour votre sécurité. Laissez vide si sans objet."
              className="w-full rounded-xl border border-stone-200/90 px-3 py-2.5 text-sm text-stone-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50"
            />
          </div>

          <div className="mt-6 pt-6 border-t border-stone-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs text-stone-600 flex items-start gap-2">
                <FiInfo className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                Les modifications du nom et du téléphone sont appliquées à votre compte ; l&apos;adresse et les
                contacts d&apos;urgence sont enregistrés sur votre dossier élève.
              </p>
              {isDirty && (
                <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
                  Modifications non enregistrées — cliquez sur « Enregistrer » pour les sauvegarder.
                </p>
              )}
            </div>
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !isDirty}
              isLoading={saveMutation.isPending}
              className="inline-flex items-center gap-2 shrink-0"
            >
              <FiSave className="w-4 h-4" />
              Enregistrer les modifications
            </Button>
          </div>
        </div>
      </Card>

      {/* Parents liés (lecture seule) */}
      {profile?.parents && profile.parents.length > 0 && (
        <Card className="border border-stone-200/90 shadow-sm">
          <div className="border-b border-stone-200/80 bg-stone-50/90 px-5 py-4 sm:px-6">
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <FiUsers className="w-5 h-5 text-amber-800" aria-hidden />
              Parents & responsables
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              Comptes rattachés à votre dossier. Pour modifier ces liaisons, contactez le secrétariat.
            </p>
          </div>
          <div className="p-5 sm:p-6">
            <div className="grid gap-4 md:grid-cols-2">
              {profile.parents.map((row: any) => {
                const u = row.parent?.user;
                if (!u) return null;
                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-stone-200/90 bg-gradient-to-br from-white to-amber-50/35 p-4 shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80 mb-2">
                      {relationLabel(row.relation)}
                    </p>
                    <p className="font-semibold text-stone-900">
                      {u.firstName} {u.lastName}
                    </p>
                    <div className="mt-3 space-y-1 text-sm text-stone-600">
                      <p className="flex items-center gap-2">
                        <FiMail className="w-3.5 h-3.5 shrink-0" />
                        {u.email || '—'}
                      </p>
                      <p className="flex items-center gap-2">
                        <FiPhone className="w-3.5 h-3.5 shrink-0" />
                        {u.phone || '—'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <GdprUserRightsPanel />
    </div>
  );
};

export default StudentProfile;
