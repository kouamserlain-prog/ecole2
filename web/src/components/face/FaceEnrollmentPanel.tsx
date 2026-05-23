'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminApi } from '@/services/api';
import { faceApi, type FacePersonType } from '@/services/api/face.api';
import FaceCapture from './FaceCapture';
import Card from '../ui/Card';
import Button from '../ui/Button';

const PERSON_TYPES: { id: FacePersonType; label: string }[] = [
  { id: 'STUDENT', label: 'Élève' },
  { id: 'TEACHER', label: 'Enseignant' },
  { id: 'STAFF', label: 'Personnel' },
];

export default function FaceEnrollmentPanel() {
  const qc = useQueryClient();
  const [personType, setPersonType] = useState<FacePersonType>('STUDENT');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ['face-stats'],
    queryFn: () => faceApi.getStats(),
    staleTime: 30_000,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['admin-students-face'],
    queryFn: () => adminApi.getStudents(),
    enabled: personType === 'STUDENT',
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['admin-teachers-face'],
    queryFn: () => adminApi.getTeachers(),
    enabled: personType === 'TEACHER',
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['admin-staff-face'],
    queryFn: () => adminApi.getStaffMembers(),
    enabled: personType === 'STAFF',
  });

  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (personType === 'STUDENT') {
      return (students as { id: string; user?: { firstName?: string; lastName?: string }; studentId?: string; faceEnrolledAt?: string | null }[])
        .filter((s) => {
          if (!q) return true;
          const name = `${s.user?.firstName ?? ''} ${s.user?.lastName ?? ''}`.toLowerCase();
          return name.includes(q) || (s.studentId ?? '').toLowerCase().includes(q);
        })
        .slice(0, 40);
    }
    if (personType === 'TEACHER') {
      return (teachers as { id: string; user?: { firstName?: string; lastName?: string }; employeeId?: string; faceEnrolledAt?: string | null }[])
        .filter((t) => {
          if (!q) return true;
          const name = `${t.user?.firstName ?? ''} ${t.user?.lastName ?? ''}`.toLowerCase();
          return name.includes(q) || (t.employeeId ?? '').toLowerCase().includes(q);
        })
        .slice(0, 40);
    }
    return (staffList as { id: string; user?: { firstName?: string; lastName?: string }; employeeId?: string; faceEnrolledAt?: string | null }[])
      .filter((s) => {
        if (!q) return true;
        const name = `${s.user?.firstName ?? ''} ${s.user?.lastName ?? ''}`.toLowerCase();
        return name.includes(q) || (s.employeeId ?? '').toLowerCase().includes(q);
      })
      .slice(0, 40);
  }, [personType, search, students, teachers, staffList]);

  const enrollMut = useMutation({
    mutationFn: (descriptor: number[]) =>
      faceApi.enroll({
        personType,
        personId: selectedId!,
        descriptor,
      }),
    onSuccess: () => {
      toast.success('Visage enregistré pour le pointage.');
      qc.invalidateQueries({ queryKey: ['face-stats'] });
      qc.invalidateQueries({ queryKey: ['access-overview'] });
      setSelectedId(null);
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error ?? 'Enregistrement impossible'),
  });

  const removeMut = useMutation({
    mutationFn: () => faceApi.removeEnrollment(personType, selectedId!),
    onSuccess: () => {
      toast.success('Enrôlement facial supprimé.');
      qc.invalidateQueries({ queryKey: ['face-stats'] });
    },
    onError: () => toast.error('Suppression impossible'),
  });

  const selected = people.find((p) => p.id === selectedId);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-stone-900">Enrôlement facial</h3>
        <p className="text-sm text-stone-600">
          {stats?.total ?? 0} profil(s) avec visage enregistré (élèves {stats?.students ?? 0}, enseignants{' '}
          {stats?.teachers ?? 0}, personnel {stats?.staff ?? 0}).
        </p>
        <div className="flex flex-wrap gap-2">
          {PERSON_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setPersonType(t.id);
                setSelectedId(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                personType === t.id
                  ? 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200'
                  : 'bg-stone-100 text-stone-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou matricule…"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          aria-label="Rechercher une personne"
        />
        <ul className="max-h-48 overflow-y-auto divide-y divide-stone-100 border border-stone-100 rounded-lg">
          {people.map((p) => {
            const name = `${p.user?.firstName ?? ''} ${p.user?.lastName ?? ''}`.trim();
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50 ${
                    selectedId === p.id ? 'bg-indigo-50' : ''
                  }`}
                >
                  <span>{name || '—'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-stone-900">Capture</h3>
        {!selectedId ? (
          <p className="text-sm text-stone-500">Sélectionnez une personne dans la liste.</p>
        ) : (
          <>
            <p className="text-sm text-stone-700">
              {`${selected?.user?.firstName ?? ''} ${selected?.user?.lastName ?? ''}`.trim()}
            </p>
            <FaceCapture
              label="Enregistrer ce visage"
              disabled={enrollMut.isPending}
              onError={(msg) => toast.error(msg)}
              onDescriptor={(descriptor) => enrollMut.mutate(descriptor)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={removeMut.isPending}
              onClick={() => removeMut.mutate()}
            >
              Supprimer l&apos;enrôlement facial
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
