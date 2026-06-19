'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Badge from '../../ui/Badge';
import Modal from '../../ui/Modal';
import type { DigitalResourceRow } from '@/services/api/digitalLibrary.api';
import { uploadDigitalLibraryFile } from '@/services/api/upload';
import { useLibraryManagement } from '@/contexts/LibraryManagementContext';
import {
  DIGITAL_AUDIENCE_ROLES,
  DIGITAL_KIND_LABELS,
  DIGITAL_ROLE_LABELS,
  type DigitalLibraryKind,
} from '@/lib/digitalLibraryKinds';
import { FiPlus, FiUpload, FiRotateCcw } from 'react-icons/fi';

const emptyForm = () => ({
  title: '',
  author: '',
  description: '',
  kind: 'PDF' as DigitalLibraryKind,
  subject: '',
  level: '',
  fileUrl: '',
  fileName: '',
  mimeType: '',
  fileSizeBytes: 0,
  onlineAccessEnabled: true,
  tempDownloadEnabled: true,
  downloadTtlHours: 48,
  allowedRoles: [] as string[],
});

export default function DigitalLibraryPanel() {
  const qc = useQueryClient();
  const { digitalApi, scope } = useLibraryManagement();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [uploading, setUploading] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['digital-library-admin', scope],
    queryFn: () => digitalApi.adminList({ isActive: 'all' }),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        allowedRoles: form.allowedRoles,
      };
      if (editId) return digitalApi.adminUpdate(editId, payload);
      return digitalApi.adminCreate(payload);
    },
    onSuccess: () => {
      toast.success(editId ? 'Ressource mise à jour' : 'Ressource publiée');
      qc.invalidateQueries({ queryKey: ['digital-library-admin'] });
      setOpen(false);
      setEditId(null);
      setForm(emptyForm());
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast.error(e.response?.data?.error ?? 'Erreur');
    },
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => digitalApi.adminArchive(id),
    onSuccess: () => {
      toast.success('Ressource archivée');
      qc.invalidateQueries({ queryKey: ['digital-library-admin'] });
    },
  });

  const unarchiveMut = useMutation({
    mutationFn: (id: string) => digitalApi.adminUnarchive(id),
    onSuccess: () => {
      toast.success('Ressource désarchivée');
      qc.invalidateQueries({ queryKey: ['digital-library-admin'] });
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast.error(e.response?.data?.error ?? 'Désarchivage impossible');
    },
  });

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadDigitalLibraryFile(file);
      setForm((f) => ({
        ...f,
        fileUrl: res.url,
        fileName: res.filename || file.name,
        mimeType: res.mimeType || file.type,
        fileSizeBytes: res.size || file.size,
      }));
      toast.success('Fichier déposé');
    } catch {
      toast.error('Échec du dépôt');
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (row: DigitalResourceRow) => {
    setEditId(row.id);
    setForm({
      title: row.title,
      author: row.author || '',
      description: row.description || '',
      kind: row.kind,
      subject: row.subject || '',
      level: row.level || '',
      fileUrl: row.fileUrl || '',
      fileName: row.fileName || '',
      mimeType: row.mimeType || '',
      fileSizeBytes: row.fileSizeBytes || 0,
      onlineAccessEnabled: row.onlineAccessEnabled,
      tempDownloadEnabled: row.tempDownloadEnabled,
      downloadTtlHours: row.downloadTtlHours,
      allowedRoles: row.allowedRoles || [],
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-stone-900">Bibliothèque numérique</h3>
          <p className="text-xs text-stone-600 mt-1">
            E-books, PDF, ressources pédagogiques — accès en ligne et téléchargement temporaire.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setEditId(null);
            setForm(emptyForm());
            setOpen(true);
          }}
        >
          <FiPlus className="w-4 h-4 mr-1" />
          Ajouter
        </Button>
      </Card>

      {isLoading ? (
        <p className="text-sm text-stone-500">Chargement…</p>
      ) : (
        <div className="space-y-2">
          {(rows as DigitalResourceRow[]).map((row) => (
            <Card key={row.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{row.title}</p>
                <p className="text-xs text-stone-500">
                  {DIGITAL_KIND_LABELS[row.kind]}
                  {row.author ? ` · ${row.author}` : ''}
                </p>
              </div>
              <div className="flex gap-2 items-center">
                {row.isActive === false && <Badge variant="warning">Archivé</Badge>}
                <Button type="button" size="sm" variant="outline" onClick={() => openEdit(row)}>
                  Modifier
                </Button>
                {row.isActive !== false && (
                  <Button type="button" size="sm" variant="outline" onClick={() => archiveMut.mutate(row.id)}>
                    Archiver
                  </Button>
                )}
                {row.isActive === false && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={unarchiveMut.isPending}
                    onClick={() => {
                      if (window.confirm('Désarchiver ce document et le rendre à nouveau visible ?')) {
                        unarchiveMut.mutate(row.id);
                      }
                    }}
                  >
                    <FiRotateCcw className="w-4 h-4 mr-1" aria-hidden />
                    Désarchiver
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editId ? 'Modifier la ressource' : 'Nouvelle ressource'} size="lg">
        <div className="grid sm:grid-cols-2 gap-2 text-sm max-h-[70vh] overflow-y-auto pr-1">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium">Titre *</label>
            <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium">Auteur</label>
            <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium">Type *</label>
            <select className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as DigitalLibraryKind })}>
              {Object.entries(DIGITAL_KIND_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium">Description</label>
            <textarea className="w-full border rounded-lg px-2 py-1.5 mt-0.5" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium">Matière</label>
            <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium">Niveau</label>
            <input className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium">Fichier *</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-xs font-medium bg-stone-50 hover:bg-stone-100">
                <FiUpload className="w-4 h-4" />
                {uploading ? 'Envoi…' : 'Déposer'}
                <input type="file" className="sr-only" accept=".pdf,.epub,.mobi,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
              </label>
              {form.fileName && <span className="text-xs text-stone-600">{form.fileName}</span>}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.onlineAccessEnabled} onChange={(e) => setForm({ ...form, onlineAccessEnabled: e.target.checked })} />
              Accès en ligne
            </label>
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.tempDownloadEnabled} onChange={(e) => setForm({ ...form, tempDownloadEnabled: e.target.checked })} />
              Téléchargement temporaire
            </label>
          </div>
          <div>
            <label className="text-xs font-medium">Durée lien (heures)</label>
            <input type="number" min={1} max={168} className="w-full border rounded-lg px-2 py-1.5 mt-0.5" value={form.downloadTtlHours} onChange={(e) => setForm({ ...form, downloadTtlHours: Number(e.target.value) })} />
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium mb-1">Public autorisé (vide = tous)</p>
            <div className="flex flex-wrap gap-2">
              {DIGITAL_AUDIENCE_ROLES.map((role) => (
                <label key={role} className="inline-flex items-center gap-1 text-xs border rounded-lg px-2 py-1">
                  <input
                    type="checkbox"
                    checked={form.allowedRoles.includes(role)}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        allowedRoles: e.target.checked
                          ? [...f.allowedRoles, role]
                          : f.allowedRoles.filter((r) => r !== role),
                      }));
                    }}
                  />
                  {DIGITAL_ROLE_LABELS[role]}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button type="button" disabled={!form.title.trim() || !form.fileUrl || saveMut.isPending} onClick={() => saveMut.mutate()}>
            Enregistrer
          </Button>
        </div>
      </Modal>
    </div>
  );
}

