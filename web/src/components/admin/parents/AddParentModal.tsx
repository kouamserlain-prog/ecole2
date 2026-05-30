'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../services/api/admin.api';
import { adminParentGuardiansApi } from '../../../services/api/admin-parent-guardians.api';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import toast from 'react-hot-toast';
import { FiUserPlus } from 'react-icons/fi';

const RELATION_OPTIONS = [
  { value: 'mother', label: 'Mère' },
  { value: 'father', label: 'Père' },
  { value: 'guardian', label: 'Tuteur légal' },
  { value: 'other', label: 'Autre' },
] as const;

interface AddParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (parentId: string) => void;
}

const AddParentModal: React.FC<AddParentModalProps> = ({ isOpen, onClose, onCreated }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    profession: '',
    studentId: '',
    relation: 'guardian' as (typeof RELATION_OPTIONS)[number]['value'],
  });

  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ['admin-students-picker'],
    queryFn: adminApi.getStudents,
    enabled: isOpen,
  });

  const studentOptions = useMemo(() => {
    const list = Array.isArray(students) ? students : [];
    return list.map((s: { id: string; user?: { firstName?: string; lastName?: string }; class?: { name?: string } }) => ({
      id: s.id,
      label: `${s.user?.firstName ?? ''} ${s.user?.lastName ?? ''}`.trim() + (s.class?.name ? ` — ${s.class.name}` : ''),
    }));
  }, [students]);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      profession: '',
      studentId: studentOptions[0]?.id ?? '',
      relation: 'guardian',
    });
  }, [isOpen, studentOptions]);

  const createMut = useMutation({
    mutationFn: () =>
      adminParentGuardiansApi.createParent({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password.trim() || undefined,
        profession: form.profession.trim() || undefined,
        studentId: form.studentId,
        relation: form.relation,
      }),
    onSuccess: (data: { parent?: { id: string }; setupEmailSent?: boolean; linkedExistingUser?: boolean }) => {
      qc.invalidateQueries({ queryKey: ['admin-parents'] });
      const id = data.parent?.id;
      if (data.linkedExistingUser) {
        toast.success('Compte parent existant rattaché à l’élève.');
      } else if (data.setupEmailSent) {
        toast.success('Parent créé — e-mail d’invitation pour définir le mot de passe envoyé.');
      } else {
        toast.success('Compte parent créé.');
      }
      onClose();
      if (id) onCreated?.(id);
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast.error(e.response?.data?.error || 'Impossible de créer le parent');
    },
  });

  const canSubmit =
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.email.trim() &&
    form.studentId &&
    !createMut.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau parent / tuteur" size="lg" compact>
      <p className="text-sm text-stone-600 mb-4">
        Crée un compte avec le rôle <strong>Parent</strong> et le rattache à un élève de l’établissement. Laissez le
        mot de passe vide pour envoyer une invitation par e-mail.
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          createMut.mutate();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Prénom"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            required
          />
          <Input
            label="Nom"
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            required
          />
        </div>
        <Input
          label="E-mail (connexion portail parent)"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
        <Input
          label="Téléphone"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
        <Input
          label="Mot de passe (optionnel)"
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          placeholder="Laisser vide = invitation par e-mail"
        />
        <Input
          label="Profession"
          value={form.profession}
          onChange={(e) => setForm((f) => ({ ...f, profession: e.target.value }))}
        />
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">Élève à rattacher *</label>
          <select
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            aria-label="Élève à rattacher"
            value={form.studentId}
            onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
            required
            disabled={loadingStudents || studentOptions.length === 0}
          >
            {studentOptions.length === 0 ? (
              <option value="">Aucun élève dans cet établissement</option>
            ) : (
              studentOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">Lien de parenté</label>
          <select
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            aria-label="Lien de parenté"
            value={form.relation}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                relation: e.target.value as (typeof RELATION_OPTIONS)[number]['value'],
              }))
            }
          >
            {RELATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            <FiUserPlus className="w-4 h-4 mr-1" aria-hidden />
            Créer le compte
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddParentModal;
