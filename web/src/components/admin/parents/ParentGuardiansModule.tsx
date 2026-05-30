'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminParentGuardiansApi } from '../../../services/api/admin-parent-guardians.api';
import { adminApi } from '../../../services/api/admin.api';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import Badge from '../../ui/Badge';
import SearchBar from '../../ui/SearchBar';
import Input from '../../ui/Input';
import { ADM } from '../adminModuleLayout';
import toast from 'react-hot-toast';
import { FiHeart, FiEye, FiTrash2, FiPlus, FiSave, FiUserPlus } from 'react-icons/fi';
import AddParentModal from './AddParentModal';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';

const CHANNELS = [
  'PHONE',
  'EMAIL',
  'SMS',
  'MEETING',
  'PORTAL_MESSAGE',
  'WHATSAPP',
  'OTHER',
] as const;

const CHANNEL_LABEL: Record<string, string> = {
  PHONE: 'Téléphone',
  EMAIL: 'E-mail',
  SMS: 'SMS',
  MEETING: 'Entretien',
  PORTAL_MESSAGE: 'Message portail',
  WHATSAPP: 'WhatsApp',
  OTHER: 'Autre',
};

const CONSENT_TYPES = [
  'IMAGE_PUBLICATION',
  'SCHOOL_TRIP',
  'MEDICAL_EMERGENCY',
  'DATA_PROCESSING',
  'COMMUNICATION_CHANNELS',
  'AUTHORIZED_PICKUP_POLICY',
] as const;

const CONSENT_LABEL: Record<string, string> = {
  IMAGE_PUBLICATION: 'Publication d’images',
  SCHOOL_TRIP: 'Sorties / voyages',
  MEDICAL_EMERGENCY: 'Urgences médicales',
  DATA_PROCESSING: 'Traitement des données',
  COMMUNICATION_CHANNELS: 'Canaux de communication',
  AUTHORIZED_PICKUP_POLICY: 'Politique de récupération',
};

const RELATION_OPTIONS = [
  { value: 'mother', label: 'Mère' },
  { value: 'father', label: 'Père' },
  { value: 'guardian', label: 'Tuteur légal' },
  { value: 'other', label: 'Autre' },
] as const;

const RELATION_LABEL: Record<string, string> = Object.fromEntries(
  RELATION_OPTIONS.map((o) => [o.value, o.label])
);

type ParentRow = {
  id: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string | null;
    isActive?: boolean;
  };
  _count?: { students?: number; contacts?: number };
};

const ParentGuardiansModule: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addParentOpen, setAddParentOpen] = useState(false);

  const { data: parents, isLoading } = useQuery({
    queryKey: ['admin-parents'],
    queryFn: adminParentGuardiansApi.getParents,
  });

  const { data: detail, isLoading: loadDetail } = useQuery({
    queryKey: ['admin-parent', detailId],
    queryFn: () => adminParentGuardiansApi.getParent(detailId!),
    enabled: !!detailId,
  });

  const { data: allStudents } = useQuery({
    queryKey: ['admin-students-picker'],
    queryFn: adminApi.getStudents,
    enabled: !!detailId,
  });

  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    isActive: true,
    profession: '',
    preferredLocale: '',
    notifyEmail: true,
    notifySms: false,
    portalShowFees: true,
    portalShowGrades: true,
    portalShowAttendance: true,
    internalNotes: '',
  });

  useEffect(() => {
    if (!detail) return;
    const u = (detail as any).user;
    setDraft({
      firstName: u?.firstName ?? '',
      lastName: u?.lastName ?? '',
      phone: u?.phone ?? '',
      isActive: Boolean(u?.isActive),
      profession: (detail as any).profession ?? '',
      preferredLocale: (detail as any).preferredLocale ?? '',
      notifyEmail: Boolean((detail as any).notifyEmail),
      notifySms: Boolean((detail as any).notifySms),
      portalShowFees: Boolean((detail as any).portalShowFees),
      portalShowGrades: Boolean((detail as any).portalShowGrades),
      portalShowAttendance: Boolean((detail as any).portalShowAttendance),
      internalNotes: (detail as any).internalNotes ?? '',
    });
  }, [detail]);

  const [newContact, setNewContact] = useState({ label: '', phone: '', email: '', sortOrder: 0 });
  const [newChildLink, setNewChildLink] = useState({ studentId: '', relation: 'guardian' });
  const [newIx, setNewIx] = useState({ channel: 'PHONE' as string, subject: '', body: '' });
  const [consentForm, setConsentForm] = useState({
    consentType: 'DATA_PROCESSING',
    studentId: '' as string,
    granted: true,
    policyVersion: '',
    notes: '',
  });
  const [pickupForm, setPickupForm] = useState({
    studentId: '' as string,
    authorizedName: '',
    relationship: '',
    phone: '',
    identityNote: '',
    validFrom: '',
    validUntil: '',
  });

  useEffect(() => {
    if (!detailId) return;
    setNewContact({ label: '', phone: '', email: '', sortOrder: 0 });
    setNewIx({ channel: 'PHONE', subject: '', body: '' });
    setConsentForm({
      consentType: 'DATA_PROCESSING',
      studentId: '',
      granted: true,
      policyVersion: '',
      notes: '',
    });
    setPickupForm({
      studentId: '',
      authorizedName: '',
      relationship: '',
      phone: '',
      identityNote: '',
      validFrom: '',
      validUntil: '',
    });
  }, [detailId]);

  const saveMut = useMutation({
    mutationFn: () =>
      adminParentGuardiansApi.updateParent(detailId!, {
        firstName: draft.firstName,
        lastName: draft.lastName,
        phone: draft.phone || null,
        isActive: draft.isActive,
        profession: draft.profession || null,
        preferredLocale: draft.preferredLocale || null,
        notifyEmail: draft.notifyEmail,
        notifySms: draft.notifySms,
        portalShowFees: draft.portalShowFees,
        portalShowGrades: draft.portalShowGrades,
        portalShowAttendance: draft.portalShowAttendance,
        internalNotes: draft.internalNotes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-parent', detailId] });
      qc.invalidateQueries({ queryKey: ['admin-parents'] });
      toast.success('Enregistré');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const addContactMut = useMutation({
    mutationFn: () =>
      adminParentGuardiansApi.addParentContact(detailId!, {
        label: newContact.label,
        phone: newContact.phone || null,
        email: newContact.email || null,
        sortOrder: newContact.sortOrder,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-parent', detailId] });
      setNewContact({ label: '', phone: '', email: '', sortOrder: 0 });
      toast.success('Contact ajouté');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const delContactMut = useMutation({
    mutationFn: ({ cid }: { cid: string }) => adminParentGuardiansApi.deleteParentContact(detailId!, cid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-parent', detailId] });
      toast.success('Contact supprimé');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const addIxMut = useMutation({
    mutationFn: () =>
      adminParentGuardiansApi.addParentInteraction(detailId!, {
        channel: newIx.channel,
        subject: newIx.subject || undefined,
        body: newIx.body || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-parent', detailId] });
      setNewIx({ channel: 'PHONE', subject: '', body: '' });
      toast.success('Interaction enregistrée');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const delIxMut = useMutation({
    mutationFn: (iid: string) => adminParentGuardiansApi.deleteParentInteraction(detailId!, iid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-parent', detailId] });
      toast.success('Supprimé');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const upsertConsentMut = useMutation({
    mutationFn: () =>
      adminParentGuardiansApi.upsertParentConsent(detailId!, {
        consentType: consentForm.consentType,
        granted: consentForm.granted,
        policyVersion: consentForm.policyVersion || null,
        notes: consentForm.notes || null,
        studentId: consentForm.studentId ? consentForm.studentId : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-parent', detailId] });
      toast.success('Consentement enregistré');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const delConsentMut = useMutation({
    mutationFn: (cid: string) => adminParentGuardiansApi.deleteParentConsent(detailId!, cid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-parent', detailId] });
      toast.success('Supprimé');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const addPickupMut = useMutation({
    mutationFn: () =>
      adminParentGuardiansApi.addParentPickupAuthorization(detailId!, {
        studentId: pickupForm.studentId,
        authorizedName: pickupForm.authorizedName,
        relationship: pickupForm.relationship || null,
        phone: pickupForm.phone || null,
        identityNote: pickupForm.identityNote || null,
        validFrom: pickupForm.validFrom || null,
        validUntil: pickupForm.validUntil || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-parent', detailId] });
      setPickupForm({
        studentId: pickupForm.studentId,
        authorizedName: '',
        relationship: '',
        phone: '',
        identityNote: '',
        validFrom: '',
        validUntil: '',
      });
      toast.success('Autorisation créée');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const delPickupMut = useMutation({
    mutationFn: (pickupId: string) => adminParentGuardiansApi.deleteParentPickupAuthorization(detailId!, pickupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-parent', detailId] });
      toast.success('Supprimé');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const togglePickupMut = useMutation({
    mutationFn: ({ pickupId, isActive }: { pickupId: string; isActive: boolean }) =>
      adminParentGuardiansApi.updateParentPickupAuthorization(detailId!, pickupId, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-parent', detailId] }),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const linkChildMut = useMutation({
    mutationFn: () =>
      adminParentGuardiansApi.linkParentStudent(detailId!, {
        studentId: newChildLink.studentId,
        relation: newChildLink.relation as 'father' | 'mother' | 'guardian' | 'other',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-parent', detailId] });
      qc.invalidateQueries({ queryKey: ['admin-parents'] });
      setNewChildLink({ studentId: '', relation: 'guardian' });
      toast.success('Enfant rattaché au portail parent');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const unlinkChildMut = useMutation({
    mutationFn: (studentId: string) => adminParentGuardiansApi.unlinkParentStudent(detailId!, studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-parent', detailId] });
      qc.invalidateQueries({ queryKey: ['admin-parents'] });
      toast.success('Lien supprimé');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const filtered = useMemo(() => {
    const list = (parents as ParentRow[] | undefined) ?? [];
    const t = search.trim().toLowerCase();
    if (!t) return list;
    return list.filter((p) => {
      const u = p.user;
      const name = `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.toLowerCase();
      return name.includes(t) || (u?.email ?? '').toLowerCase().includes(t);
    });
  }, [parents, search]);

  const studentOptions = useMemo(() => {
    const links = ((detail as any)?.students as any[]) ?? [];
    return links.map((sp) => ({
      id: sp.student?.id as string,
      label: `${sp.student?.user?.firstName ?? ''} ${sp.student?.user?.lastName ?? ''}`.trim(),
    }));
  }, [detail]);

  const availableStudents = useMemo(() => {
    const linkedIds = new Set(studentOptions.map((s) => s.id));
    const list = (allStudents as any[] | undefined) ?? [];
    return list
      .filter((s) => s?.id && !linkedIds.has(s.id))
      .map((s) => ({
        id: s.id as string,
        label: `${s.user?.firstName ?? ''} ${s.user?.lastName ?? ''}`.trim() || s.studentId || s.id,
        className: s.class?.name ?? '',
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [allStudents, studentOptions]);

  useEffect(() => {
    if (!studentOptions.length) return;
    setPickupForm((f) => ({
      ...f,
      studentId:
        f.studentId && studentOptions.some((s) => s.id === f.studentId)
          ? f.studentId
          : studentOptions[0].id,
    }));
  }, [detail, studentOptions]);

  return (
    <div className={ADM.root}>
      <div>
        <h2 className={ADM.h2}>Parents &amp; tuteurs</h2>
        <p className={ADM.intro}>
          Profils, préférences du portail, contacts multiples, journal des échanges, consentements et
          personnes autorisées à récupérer les enfants.
        </p>
      </div>

      <Card className="p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="Rechercher par nom ou e-mail…" className="max-w-md flex-1 min-w-[200px]" />
          <Button type="button" onClick={() => setAddParentOpen(true)}>
            <FiUserPlus className="w-4 h-4 mr-1.5" aria-hidden />
            Nouveau parent
          </Button>
        </div>
        {isLoading ? (
          <p className="text-sm text-stone-500">Chargement…</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-left text-[10px] uppercase text-stone-600">
                <tr>
                  <th className="px-2 py-2">Parent / tuteur</th>
                  <th className="px-2 py-2">Enfants</th>
                  <th className="px-2 py-2">Contacts</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-stone-100 hover:bg-stone-50/80">
                    <td className="px-2 py-2">
                      <p className="font-medium text-stone-900">
                        {p.user?.firstName} {p.user?.lastName}
                        {!p.user?.isActive && (
                          <Badge className="ml-2 text-[10px] bg-stone-200 text-stone-700">Inactif</Badge>
                        )}
                      </p>
                      <p className="text-[11px] text-stone-500">{p.user?.email}</p>
                    </td>
                    <td className="px-2 py-2 tabular-nums">{p._count?.students ?? '—'}</td>
                    <td className="px-2 py-2 tabular-nums">{p._count?.contacts ?? '—'}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        className="p-1.5 text-stone-600 hover:text-rose-700"
                        title="Dossier"
                        onClick={() => setDetailId(p.id)}
                      >
                        <FiEye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="p-4 text-sm text-stone-500 text-center">Aucun parent trouvé.</p>
            )}
          </div>
        )}
      </Card>

      <AddParentModal
        isOpen={addParentOpen}
        onClose={() => setAddParentOpen(false)}
        onCreated={(id) => setDetailId(id)}
      />

      <Modal
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
        title="Dossier parent / tuteur"
        size="xl"
        compact
      >
        {loadDetail || !detail ? (
          <p className="text-sm text-stone-500 py-6">Chargement…</p>
        ) : (
          <div className="space-y-6 text-sm max-h-[min(78vh,720px)] overflow-y-auto pr-1">
            <div className="flex items-center gap-2 text-rose-700">
              <FiHeart className="w-4 h-4 shrink-0" aria-hidden />
              <span className="font-semibold text-stone-900">
                {(detail as any).user?.firstName} {(detail as any).user?.lastName}
              </span>
              <span className="text-stone-500 text-xs">{(detail as any).user?.email}</span>
            </div>

            <section className="rounded-xl border border-stone-200/90 p-3 space-y-3 bg-white/90">
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-600">Compte &amp; portail</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                <Input
                  label="Prénom"
                  value={draft.firstName}
                  onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                />
                <Input
                  label="Nom"
                  value={draft.lastName}
                  onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
                />
                <Input
                  label="Téléphone"
                  value={draft.phone}
                  onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                />
                <Input
                  label="Profession"
                  value={draft.profession}
                  onChange={(e) => setDraft((d) => ({ ...d, profession: e.target.value }))}
                />
                <Input
                  label="Locale (ex. fr)"
                  value={draft.preferredLocale}
                  onChange={(e) => setDraft((d) => ({ ...d, preferredLocale: e.target.value }))}
                />
                <label className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
                    className="rounded border-stone-300"
                  />
                  <span>Compte actif</span>
                </label>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                {(
                  [
                    ['notifyEmail', 'Notifications e-mail'],
                    ['notifySms', 'Notifications SMS'],
                    ['portalShowFees', 'Portail : frais'],
                    ['portalShowGrades', 'Portail : notes'],
                    ['portalShowAttendance', 'Portail : présences'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
                      className="rounded border-stone-300"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-800 mb-2">Notes internes (admin)</label>
                <textarea
                  value={draft.internalNotes}
                  onChange={(e) => setDraft((d) => ({ ...d, internalNotes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border-2 rounded-xl border-stone-200/90 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/45"
                  placeholder="Visibles uniquement côté administration…"
                />
              </div>
              <Button type="button" size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                <FiSave className="w-4 h-4 mr-1 inline" />
                Enregistrer
              </Button>
            </section>

            <section className="rounded-xl border border-stone-200/90 p-3 space-y-3 bg-white/90">
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-600">Enfants rattachés</h3>
              <p className="text-xs text-stone-500">
                Seuls les élèves listés ici apparaissent dans le portail parent (notes, frais, présences…).
              </p>
              <ul className="space-y-1.5">
                {(((detail as any).students as any[]) ?? []).length === 0 && (
                  <li className="text-sm text-stone-500 italic">Aucun enfant rattaché — le parent ne verra rien dans son espace.</li>
                )}
                {(((detail as any).students as any[]) ?? []).map((sp: any) => (
                  <li
                    key={sp.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50/80 px-2 py-1.5"
                  >
                    <span>
                      <span className="font-medium text-stone-900">
                        {sp.student?.user?.firstName} {sp.student?.user?.lastName}
                      </span>
                      <span className="text-xs text-stone-500 block">
                        {RELATION_LABEL[sp.relation] ?? sp.relation}
                        {sp.student?.class?.name ? ` · ${sp.student.class.name}` : ''}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Retirer du portail parent"
                      onClick={() => {
                        if (window.confirm('Retirer cet élève du portail de ce parent ?')) {
                          unlinkChildMut.mutate(sp.student.id);
                        }
                      }}
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-stone-100">
                <div>
                  <label className="text-xs font-medium text-stone-700">Élève</label>
                  <select
                    aria-label="Élève à rattacher"
                    value={newChildLink.studentId}
                    onChange={(e) => setNewChildLink((f) => ({ ...f, studentId: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border-2 rounded-xl border-stone-200/90 text-sm"
                  >
                    <option value="">Choisir un élève…</option>
                    {availableStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                        {s.className ? ` (${s.className})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-700">Lien de parenté</label>
                  <select
                    aria-label="Lien de parenté"
                    value={newChildLink.relation}
                    onChange={(e) => setNewChildLink((f) => ({ ...f, relation: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border-2 rounded-xl border-stone-200/90 text-sm"
                  >
                    {RELATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (!newChildLink.studentId) {
                    toast.error('Sélectionnez un élève');
                    return;
                  }
                  linkChildMut.mutate();
                }}
                disabled={linkChildMut.isPending || availableStudents.length === 0}
              >
                <FiPlus className="w-4 h-4 mr-1 inline" />
                Rattacher un enfant
              </Button>
            </section>

            <section className="rounded-xl border border-stone-200/90 p-3 space-y-2 bg-white/90">
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-600">Contacts supplémentaires</h3>
              <ul className="space-y-1.5">
                {(((detail as any).contacts as any[]) ?? []).map((c: any) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50/80 px-2 py-1.5"
                  >
                    <span className="font-medium text-stone-900">{c.label}</span>
                    <span className="text-xs text-stone-600">
                      {c.phone || '—'} · {c.email || '—'}
                    </span>
                    <button
                      type="button"
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Supprimer"
                      onClick={() => {
                        if (window.confirm('Supprimer ce contact ?')) delContactMut.mutate({ cid: c.id });
                      }}
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-stone-100">
                <Input
                  label="Libellé"
                  value={newContact.label}
                  onChange={(e) => setNewContact((n) => ({ ...n, label: e.target.value }))}
                />
                <Input
                  label="Téléphone"
                  value={newContact.phone}
                  onChange={(e) => setNewContact((n) => ({ ...n, phone: e.target.value }))}
                />
                <Input
                  label="E-mail"
                  value={newContact.email}
                  onChange={(e) => setNewContact((n) => ({ ...n, email: e.target.value }))}
                />
                <Input
                  label="Ordre"
                  type="number"
                  value={String(newContact.sortOrder)}
                  onChange={(e) => setNewContact((n) => ({ ...n, sortOrder: Number(e.target.value) || 0 }))}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (!newContact.label.trim()) {
                    toast.error('Libellé requis');
                    return;
                  }
                  addContactMut.mutate();
                }}
                disabled={addContactMut.isPending}
              >
                <FiPlus className="w-4 h-4 mr-1 inline" />
                Ajouter un contact
              </Button>
            </section>

            <section className="rounded-xl border border-stone-200/90 p-3 space-y-2 bg-white/90">
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-600">Journal des interactions</h3>
              <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                {(((detail as any).interactionLogs as any[]) ?? []).map((ix: any) => (
                  <div
                    key={ix.id}
                    className="rounded-lg border border-stone-100 px-2 py-1.5 flex justify-between gap-2"
                  >
                    <div>
                      <span className="font-semibold text-stone-800">
                        {CHANNEL_LABEL[ix.channel] ?? ix.channel}
                      </span>
                      {ix.subject && <span className="text-stone-600"> — {ix.subject}</span>}
                      {ix.body && <p className="text-stone-500 mt-0.5 line-clamp-2">{ix.body}</p>}
                      <p className="text-[10px] text-stone-400 mt-1">
                        {format(new Date(ix.createdAt), "d MMM yyyy HH:mm", { locale: fr })}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 p-1 text-red-600"
                      title="Supprimer"
                      onClick={() => {
                        if (window.confirm('Supprimer cette entrée ?')) delIxMut.mutate(ix.id);
                      }}
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 pt-2 border-t border-stone-100">
                <label className="text-xs font-medium text-stone-700">Canal</label>
                <select
                  aria-label="Canal d’interaction"
                  value={newIx.channel}
                  onChange={(e) => setNewIx((n) => ({ ...n, channel: e.target.value }))}
                  className="w-full px-3 py-2 border-2 rounded-xl border-stone-200/90 text-sm"
                >
                  {CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {CHANNEL_LABEL[ch]}
                    </option>
                  ))}
                </select>
                <Input
                  label="Sujet (optionnel)"
                  value={newIx.subject}
                  onChange={(e) => setNewIx((n) => ({ ...n, subject: e.target.value }))}
                />
                <div>
                  <label htmlFor="admin-parent-new-interaction-body" className="block text-sm font-medium text-stone-800 mb-2">
                    Compte rendu
                  </label>
                  <textarea
                    id="admin-parent-new-interaction-body"
                    aria-label="Compte rendu de l’interaction"
                    value={newIx.body}
                    onChange={(e) => setNewIx((n) => ({ ...n, body: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border-2 rounded-xl border-stone-200/90 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => addIxMut.mutate()}
                  disabled={addIxMut.isPending}
                >
                  Enregistrer une interaction
                </Button>
              </div>
            </section>

            <section className="rounded-xl border border-stone-200/90 p-3 space-y-2 bg-white/90">
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-600">Consentements</h3>
              <ul className="space-y-1 text-xs">
                {(((detail as any).consents as any[]) ?? []).map((c: any) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-stone-50/80 px-2 py-1">
                    <span>
                      {CONSENT_LABEL[c.consentType] ?? c.consentType}
                      {c.studentId ? (
                        <span className="text-stone-500"> (élève lié)</span>
                      ) : (
                        <span className="text-stone-500"> (général)</span>
                      )}{' '}
                      — {c.granted ? 'accordé' : 'refusé'}
                    </span>
                    <button
                      type="button"
                      className="p-1 text-red-600"
                      title="Supprimer ce consentement"
                      aria-label="Supprimer ce consentement"
                      onClick={() => {
                        if (window.confirm('Supprimer ce consentement ?')) delConsentMut.mutate(c.id);
                      }}
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-stone-100">
                <div>
                  <label className="text-xs font-medium text-stone-700">Type</label>
                  <select
                    aria-label="Type de consentement"
                    value={consentForm.consentType}
                    onChange={(e) => setConsentForm((f) => ({ ...f, consentType: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border-2 rounded-xl border-stone-200/90 text-sm"
                  >
                    {CONSENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {CONSENT_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-700">Élève (vide = général)</label>
                  <select
                    aria-label="Élève lié au consentement (optionnel)"
                    value={consentForm.studentId}
                    onChange={(e) => setConsentForm((f) => ({ ...f, studentId: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border-2 rounded-xl border-stone-200/90 text-sm"
                  >
                    <option value="">Tous / non rattaché à un enfant</option>
                    {studentOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={consentForm.granted}
                    onChange={(e) => setConsentForm((f) => ({ ...f, granted: e.target.checked }))}
                    className="rounded border-stone-300"
                  />
                  Consenti
                </label>
                <Input
                  label="Version politique (optionnel)"
                  value={consentForm.policyVersion}
                  onChange={(e) => setConsentForm((f) => ({ ...f, policyVersion: e.target.value }))}
                />
                <Input
                  label="Notes"
                  value={consentForm.notes}
                  onChange={(e) => setConsentForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => upsertConsentMut.mutate()}
                disabled={upsertConsentMut.isPending}
              >
                Enregistrer le consentement
              </Button>
            </section>

            <section className="rounded-xl border border-stone-200/90 p-3 space-y-3 bg-white/90">
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-600">
                Autorisations de récupération
              </h3>
              {studentOptions.map((s) => {
                const link = (((detail as any).students as any[]) ?? []).find((sp) => sp.student?.id === s.id);
                const pickups = (link?.student?.pickupAuthorizations as any[]) ?? [];
                return (
                  <div key={s.id} className="rounded-lg border border-stone-100 p-2 space-y-1">
                    <p className="font-semibold text-stone-900 text-sm">{s.label}</p>
                    <ul className="space-y-1 text-xs">
                      {pickups.map((pu: any) => (
                        <li
                          key={pu.id}
                          className="flex flex-wrap items-center justify-between gap-2 bg-stone-50/80 rounded px-2 py-1"
                        >
                          <span>
                            {pu.authorizedName}
                            {pu.isActive === false && (
                              <Badge className="ml-1 text-[9px] bg-stone-300">Inactive</Badge>
                            )}
                            <span className="text-stone-500 block">
                              {pu.phone || '—'} {pu.relationship ? `· ${pu.relationship}` : ''}
                            </span>
                          </span>
                          <span className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              className="text-[11px] text-amber-800 underline"
                              onClick={() =>
                                togglePickupMut.mutate({ pickupId: pu.id, isActive: !pu.isActive })
                              }
                            >
                              {pu.isActive ? 'Désactiver' : 'Réactiver'}
                            </button>
                            <button
                              type="button"
                              className="p-1 text-red-600"
                              title="Supprimer cette autorisation"
                              aria-label="Supprimer cette autorisation"
                              onClick={() => {
                                if (window.confirm('Supprimer cette autorisation ?')) delPickupMut.mutate(pu.id);
                              }}
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              <div className="border-t border-stone-100 pt-3 space-y-2">
                <p className="text-xs font-semibold text-stone-700">Nouvelle autorisation</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-stone-700">Élève</label>
                    <select
                      aria-label="Élève pour l’autorisation de récupération"
                      value={pickupForm.studentId}
                      onChange={(e) => setPickupForm((f) => ({ ...f, studentId: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border-2 rounded-xl border-stone-200/90 text-sm"
                    >
                      {studentOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Nom autorisé"
                    value={pickupForm.authorizedName}
                    onChange={(e) => setPickupForm((f) => ({ ...f, authorizedName: e.target.value }))}
                  />
                  <Input
                    label="Lien de parenté"
                    value={pickupForm.relationship}
                    onChange={(e) => setPickupForm((f) => ({ ...f, relationship: e.target.value }))}
                  />
                  <Input
                    label="Téléphone"
                    value={pickupForm.phone}
                    onChange={(e) => setPickupForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                  <Input
                    label="Valide du (AAAA-MM-JJ, optionnel)"
                    value={pickupForm.validFrom}
                    onChange={(e) => setPickupForm((f) => ({ ...f, validFrom: e.target.value }))}
                  />
                  <Input
                    label="Valide jusqu’au (optionnel)"
                    value={pickupForm.validUntil}
                    onChange={(e) => setPickupForm((f) => ({ ...f, validUntil: e.target.value }))}
                  />
                  <div className="sm:col-span-2">
                    <label htmlFor="admin-parent-pickup-identity" className="block text-xs font-medium text-stone-700 mb-1">
                      Pièce / remarque identité
                    </label>
                    <textarea
                      id="admin-parent-pickup-identity"
                      aria-label="Pièce ou remarque sur l’identité"
                      value={pickupForm.identityNote}
                      onChange={(e) => setPickupForm((f) => ({ ...f, identityNote: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border-2 rounded-xl border-stone-200/90 text-sm"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (!pickupForm.studentId || !pickupForm.authorizedName.trim()) {
                      toast.error('Élève et nom requis');
                      return;
                    }
                    addPickupMut.mutate();
                  }}
                  disabled={addPickupMut.isPending}
                >
                  <FiPlus className="w-4 h-4 mr-1 inline" />
                  Ajouter
                </Button>
              </div>
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ParentGuardiansModule;
