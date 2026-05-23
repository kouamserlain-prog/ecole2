'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';
import { FiEdit2, FiHome, FiPlus } from 'react-icons/fi';

type SchoolRow = {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  isDefault: boolean;
  _count?: { classes: number; students: number; admissions: number; members: number };
};

const emptyForm = {
  name: '',
  shortName: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  principalName: '',
  isDefault: false,
};

export default function SchoolsManagementPanel() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-schools-manage'],
    queryFn: () => adminApi.listSchoolsManage() as Promise<SchoolRow[]>,
  });

  const list = data ?? [];

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        shortName: form.shortName.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        principalName: form.principalName.trim() || null,
        isDefault: form.isDefault,
      };
      if (editId) return adminApi.updateSchool(editId, payload);
      return adminApi.createSchool(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-schools-manage'] });
      queryClient.invalidateQueries({ queryKey: ['admin-schools'] });
      toast.success(editId ? 'Établissement mis à jour' : 'Établissement créé');
      setModalOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Erreur');
    },
  });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row: SchoolRow) => {
    setEditId(row.id);
    setForm({
      name: row.name,
      shortName: row.shortName || '',
      address: row.address || '',
      phone: row.phone || '',
      email: row.email || '',
      website: '',
      principalName: '',
      isDefault: row.isDefault,
    });
    setModalOpen(true);
  };

  if (isLoading) {
    return <p className="text-stone-500 text-sm">Chargement des établissements…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <FiHome className="text-amber-700" />
            Établissements (multi-collèges)
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            Chaque collège dispose de ses classes, élèves, pré-inscriptions et charte graphique. Lien public
            : <code className="text-xs bg-stone-100 px-1 rounded">/inscription?school=slug</code>
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <FiPlus className="mr-2" />
          Nouvel établissement
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {list.map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex justify-between gap-2">
              <div>
                <h3 className="font-semibold text-stone-900">{row.name}</h3>
                <p className="text-xs text-stone-500 mt-0.5">slug : {row.slug}</p>
              </div>
              <div className="flex gap-1">
                {row.isDefault && <Badge variant="info">Par défaut</Badge>}
                {!row.isActive && <Badge variant="warning">Inactif</Badge>}
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-600">
              <div>
                <dt className="font-medium">Classes</dt>
                <dd>{row._count?.classes ?? 0}</dd>
              </div>
              <div>
                <dt className="font-medium">Élèves</dt>
                <dd>{row._count?.students ?? 0}</dd>
              </div>
              <div>
                <dt className="font-medium">Pré-inscriptions</dt>
                <dd>{row._count?.admissions ?? 0}</dd>
              </div>
              <div>
                <dt className="font-medium">Admins</dt>
                <dd>{row._count?.members ?? 0}</dd>
              </div>
            </dl>
            <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => openEdit(row)}>
              <FiEdit2 className="mr-1" />
              Modifier
            </Button>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Modifier l’établissement' : 'Nouvel établissement'}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate();
          }}
        >
          <div>
            <label className="block text-sm font-medium text-stone-700">Nom *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Nom court</label>
            <input
              value={form.shortName}
              onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Adresse</label>
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            />
            Établissement par défaut (nouveaux utilisateurs)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
