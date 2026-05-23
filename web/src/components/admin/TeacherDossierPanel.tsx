import { useState } from 'react';
import { DEFAULT_SCHEDULE_START } from '../../lib/scheduleTimeSlots';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import {
  FiClock,
  FiAward,
  FiTrendingUp,
  FiBookOpen,
  FiTrash2,
  FiPlus,
  FiStar,
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';

const DAYS_FR: Record<number, string> = {
  0: 'Dimanche',
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
};

type TeacherDossierPanelProps = {
  teacherId: string;
};

const TeacherDossierPanel: React.FC<TeacherDossierPanelProps> = ({ teacherId }) => {
  const queryClient = useQueryClient();
  const { data: teacher } = useQuery({
    queryKey: ['teacher', teacherId],
    queryFn: () => adminApi.getTeacher(teacherId),
  });

  const [qualForm, setQualForm] = useState({
    title: '',
    institution: '',
    field: '',
    obtainedAt: '',
    notes: '',
  });
  const [careerForm, setCareerForm] = useState({
    institution: '',
    role: '',
    startDate: '',
    endDate: '',
    country: '',
    notes: '',
  });
  const [trainForm, setTrainForm] = useState({
    title: '',
    organization: '',
    hours: '',
    completedAt: '',
    notes: '',
  });
  const [availForm, setAvailForm] = useState({
    dayOfWeek: '1',
    startTime: DEFAULT_SCHEDULE_START,
    endTime: '09:00',
    label: '',
  });
  const [reviewForm, setReviewForm] = useState({
    periodLabel: '',
    academicYear: '',
    overallScore: '',
    objectives: '',
    achievements: '',
    improvements: '',
    reviewerName: '',
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['teacher', teacherId] });

  const addQual = useMutation({
    mutationFn: () =>
      adminApi.addTeacherQualification(teacherId, {
        title: qualForm.title.trim(),
        institution: qualForm.institution.trim() || undefined,
        field: qualForm.field.trim() || undefined,
        obtainedAt: qualForm.obtainedAt ? new Date(qualForm.obtainedAt).toISOString() : undefined,
        notes: qualForm.notes.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Diplôme enregistré');
      setQualForm({ title: '', institution: '', field: '', obtainedAt: '', notes: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const delQual = useMutation({
    mutationFn: (id: string) => adminApi.deleteTeacherQualification(teacherId, id),
    onSuccess: () => {
      invalidate();
      toast.success('Supprimé');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const addCareer = useMutation({
    mutationFn: () =>
      adminApi.addTeacherCareerHistory(teacherId, {
        institution: careerForm.institution.trim(),
        role: careerForm.role.trim(),
        startDate: new Date(careerForm.startDate).toISOString(),
        endDate: careerForm.endDate ? new Date(careerForm.endDate).toISOString() : undefined,
        country: careerForm.country.trim() || undefined,
        notes: careerForm.notes.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Expérience ajoutée');
      setCareerForm({
        institution: '',
        role: '',
        startDate: '',
        endDate: '',
        country: '',
        notes: '',
      });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const delCareer = useMutation({
    mutationFn: (id: string) => adminApi.deleteTeacherCareerHistoryEntry(teacherId, id),
    onSuccess: () => {
      invalidate();
      toast.success('Supprimé');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const addTrain = useMutation({
    mutationFn: () =>
      adminApi.addTeacherProfessionalTraining(teacherId, {
        title: trainForm.title.trim(),
        organization: trainForm.organization.trim() || undefined,
        hours: trainForm.hours ? parseFloat(trainForm.hours) : undefined,
        completedAt: trainForm.completedAt
          ? new Date(trainForm.completedAt).toISOString()
          : undefined,
        notes: trainForm.notes.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Formation enregistrée');
      setTrainForm({ title: '', organization: '', hours: '', completedAt: '', notes: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const delTrain = useMutation({
    mutationFn: (id: string) => adminApi.deleteTeacherProfessionalTraining(teacherId, id),
    onSuccess: () => {
      invalidate();
      toast.success('Supprimé');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const addAvail = useMutation({
    mutationFn: () =>
      adminApi.createTeacherScheduleAvailability(teacherId, {
        dayOfWeek: parseInt(availForm.dayOfWeek, 10),
        startTime: availForm.startTime,
        endTime: availForm.endTime,
        label: availForm.label.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Disponibilité ajoutée');
      setAvailForm({ dayOfWeek: '1', startTime: DEFAULT_SCHEDULE_START, endTime: '09:00', label: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const delAvail = useMutation({
    mutationFn: (slotId: string) => adminApi.deleteTeacherScheduleAvailability(teacherId, slotId),
    onSuccess: () => {
      invalidate();
      toast.success('Créneau supprimé');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const addReview = useMutation({
    mutationFn: () => {
      let overallScore: number | null = null;
      if (reviewForm.overallScore.trim()) {
        const n = parseFloat(reviewForm.overallScore.replace(',', '.'));
        overallScore = Number.isNaN(n) ? null : n;
      }
      return adminApi.createTeacherPerformanceReview(teacherId, {
        periodLabel: reviewForm.periodLabel.trim(),
        academicYear: reviewForm.academicYear.trim(),
        overallScore,
        objectives: reviewForm.objectives.trim() || null,
        achievements: reviewForm.achievements.trim() || null,
        improvements: reviewForm.improvements.trim() || null,
        reviewerName: reviewForm.reviewerName.trim() || null,
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success('Évaluation enregistrée');
      setReviewForm({
        periodLabel: '',
        academicYear: '',
        overallScore: '',
        objectives: '',
        achievements: '',
        improvements: '',
        reviewerName: '',
      });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const t = teacher as any;
  const workload = t?.workloadSummary as
    | { programmedWeeklyHours: number; courseCount: number; maxWeeklyHours: number | null }
    | undefined;
  const quals = (t?.qualifications || []) as Array<{
    id: string;
    title: string;
    institution?: string | null;
    field?: string | null;
    obtainedAt?: string | null;
    notes?: string | null;
  }>;
  const career = (t?.careerHistory || []) as Array<{
    id: string;
    institution: string;
    role: string;
    startDate: string;
    endDate?: string | null;
    country?: string | null;
    notes?: string | null;
  }>;
  const trainings = (t?.professionalTrainings || []) as Array<{
    id: string;
    title: string;
    organization?: string | null;
    hours?: number | null;
    completedAt?: string | null;
    notes?: string | null;
  }>;
  const slots = (t?.scheduleAvailabilitySlots || []) as Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    label?: string | null;
  }>;
  const reviews = (t?.performanceReviews || []) as Array<{
    id: string;
    periodLabel: string;
    academicYear: string;
    overallScore?: number | null;
    objectives?: string | null;
    achievements?: string | null;
    improvements?: string | null;
    reviewerName?: string | null;
    createdAt: string;
  }>;

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <FiClock className="text-indigo-600" aria-hidden />
          Charge horaire
        </h3>
        {workload ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
              <p className="text-xs text-indigo-800 font-medium">Volume programme (cours)</p>
              <p className="text-2xl font-bold text-indigo-950">
                {workload.programmedWeeklyHours.toFixed(1)} h
              </p>
              <p className="text-xs text-indigo-700">{workload.courseCount} cours</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <p className="text-xs text-amber-900 font-medium">Plafond contractuel</p>
              <p className="text-2xl font-bold text-amber-950">
                {workload.maxWeeklyHours != null ? `${workload.maxWeeklyHours} h` : '—'}
              </p>
              <p className="text-xs text-amber-800">Défini dans la fiche enseignant</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 leading-relaxed">
              Le volume « programme » additionne le champ volume horaire hebdomadaire de chaque cours assigné à
              l&apos;enseignant.
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Données de charge non disponibles.</p>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FiAward className="text-amber-700" aria-hidden />
          Qualifications &amp; diplômes
        </h3>
        <div className="space-y-2 mb-4">
          {quals.length ? (
            quals.map((q) => (
              <div
                key={q.id}
                className="flex flex-wrap justify-between gap-2 border border-gray-100 rounded-lg p-2 bg-gray-50 text-sm"
              >
                <div>
                  <span className="font-semibold text-gray-900">{q.title}</span>
                  {q.institution ? <span className="text-gray-600"> — {q.institution}</span> : null}
                  {q.field ? <div className="text-xs text-gray-500">Discipline : {q.field}</div> : null}
                  {q.obtainedAt ? (
                    <div className="text-xs text-gray-500">
                      Obtenu : {format(new Date(q.obtainedAt), 'MMM yyyy', { locale: fr })}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="text-red-600 p-1 hover:bg-red-50 rounded shrink-0"
                  aria-label="Supprimer la qualification"
                  onClick={() => {
                    if (window.confirm('Supprimer cette qualification ?')) delQual.mutate(q.id);
                  }}
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">Aucune qualification enregistrée.</p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <input
            className="border rounded px-2 py-1.5 md:col-span-2"
            placeholder="Intitulé du diplôme *"
            value={qualForm.title}
            onChange={(e) => setQualForm((s) => ({ ...s, title: e.target.value }))}
            aria-label="Intitulé du diplôme"
          />
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Établissement"
            value={qualForm.institution}
            onChange={(e) => setQualForm((s) => ({ ...s, institution: e.target.value }))}
            aria-label="Établissement"
          />
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Discipline / domaine"
            value={qualForm.field}
            onChange={(e) => setQualForm((s) => ({ ...s, field: e.target.value }))}
            aria-label="Discipline"
          />
          <input
            type="date"
            className="border rounded px-2 py-1.5"
            value={qualForm.obtainedAt}
            onChange={(e) => setQualForm((s) => ({ ...s, obtainedAt: e.target.value }))}
            aria-label="Date d'obtention"
          />
          <textarea
            className="border rounded px-2 py-1.5 md:col-span-2"
            rows={2}
            placeholder="Notes"
            value={qualForm.notes}
            onChange={(e) => setQualForm((s) => ({ ...s, notes: e.target.value }))}
            aria-label="Notes qualification"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-2"
          disabled={!qualForm.title.trim() || addQual.isPending}
          onClick={() => addQual.mutate()}
        >
          <FiPlus className="inline mr-1" aria-hidden />
          Ajouter
        </Button>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FiTrendingUp className="text-teal-700" aria-hidden />
          Historique professionnel
        </h3>
        <div className="space-y-2 mb-4">
          {career.length ? (
            career.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap justify-between gap-2 border border-gray-100 rounded-lg p-2 bg-stone-50 text-sm"
              >
                <div>
                  <span className="font-semibold">{c.role}</span>
                  <span className="text-gray-600"> — {c.institution}</span>
                  <div className="text-xs text-gray-500">
                    {format(new Date(c.startDate), 'MMM yyyy', { locale: fr })}
                    {c.endDate ? ` → ${format(new Date(c.endDate), 'MMM yyyy', { locale: fr })}` : ' → …'}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-red-600 p-1 hover:bg-red-50 rounded shrink-0"
                  aria-label="Supprimer l'entrée"
                  onClick={() => {
                    if (window.confirm('Supprimer cette entrée ?')) delCareer.mutate(c.id);
                  }}
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">Aucun poste antérieur enregistré.</p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Établissement *"
            value={careerForm.institution}
            onChange={(e) => setCareerForm((s) => ({ ...s, institution: e.target.value }))}
            aria-label="Établissement historique"
          />
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Fonction *"
            value={careerForm.role}
            onChange={(e) => setCareerForm((s) => ({ ...s, role: e.target.value }))}
            aria-label="Fonction"
          />
          <input
            type="date"
            className="border rounded px-2 py-1.5"
            value={careerForm.startDate}
            onChange={(e) => setCareerForm((s) => ({ ...s, startDate: e.target.value }))}
            aria-label="Date de début"
          />
          <input
            type="date"
            className="border rounded px-2 py-1.5"
            value={careerForm.endDate}
            onChange={(e) => setCareerForm((s) => ({ ...s, endDate: e.target.value }))}
            aria-label="Date de fin"
          />
          <input
            className="border rounded px-2 py-1.5 md:col-span-2"
            placeholder="Pays (optionnel)"
            value={careerForm.country}
            onChange={(e) => setCareerForm((s) => ({ ...s, country: e.target.value }))}
            aria-label="Pays"
          />
          <textarea
            className="border rounded px-2 py-1.5 md:col-span-2"
            rows={2}
            placeholder="Notes"
            value={careerForm.notes}
            onChange={(e) => setCareerForm((s) => ({ ...s, notes: e.target.value }))}
            aria-label="Notes carrière"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-2"
          disabled={
            !careerForm.institution.trim() || !careerForm.role.trim() || !careerForm.startDate || addCareer.isPending
          }
          onClick={() => addCareer.mutate()}
        >
          <FiPlus className="inline mr-1" aria-hidden />
          Ajouter une expérience
        </Button>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FiBookOpen className="text-violet-700" aria-hidden />
          Formation continue
        </h3>
        <div className="space-y-2 mb-4">
          {trainings.length ? (
            trainings.map((tr) => (
              <div
                key={tr.id}
                className="flex flex-wrap justify-between gap-2 border border-gray-100 rounded-lg p-2 bg-violet-50/40 text-sm"
              >
                <div>
                  <span className="font-semibold">{tr.title}</span>
                  {tr.organization ? <span className="text-gray-600"> — {tr.organization}</span> : null}
                  <div className="text-xs text-gray-500">
                    {tr.hours != null ? `${tr.hours} h` : ''}
                    {tr.completedAt
                      ? ` · ${format(new Date(tr.completedAt), 'd MMM yyyy', { locale: fr })}`
                      : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-red-600 p-1 hover:bg-red-50 rounded shrink-0"
                  aria-label="Supprimer la formation"
                  onClick={() => {
                    if (window.confirm('Supprimer cette formation ?')) delTrain.mutate(tr.id);
                  }}
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">Aucune formation listée.</p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <input
            className="border rounded px-2 py-1.5 md:col-span-2"
            placeholder="Intitulé *"
            value={trainForm.title}
            onChange={(e) => setTrainForm((s) => ({ ...s, title: e.target.value }))}
            aria-label="Intitulé formation"
          />
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Organisme"
            value={trainForm.organization}
            onChange={(e) => setTrainForm((s) => ({ ...s, organization: e.target.value }))}
            aria-label="Organisme formation"
          />
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Heures (nombre)"
            value={trainForm.hours}
            onChange={(e) => setTrainForm((s) => ({ ...s, hours: e.target.value }))}
            aria-label="Heures de formation"
          />
          <input
            type="date"
            className="border rounded px-2 py-1.5 md:col-span-2"
            value={trainForm.completedAt}
            onChange={(e) => setTrainForm((s) => ({ ...s, completedAt: e.target.value }))}
            aria-label="Date de fin de formation"
          />
          <textarea
            className="border rounded px-2 py-1.5 md:col-span-2"
            rows={2}
            placeholder="Notes"
            value={trainForm.notes}
            onChange={(e) => setTrainForm((s) => ({ ...s, notes: e.target.value }))}
            aria-label="Notes formation"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-2"
          disabled={!trainForm.title.trim() || addTrain.isPending}
          onClick={() => addTrain.mutate()}
        >
          <FiPlus className="inline mr-1" aria-hidden />
          Ajouter une formation
        </Button>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FiClock className="text-sky-700" aria-hidden />
          Disponibilités (créneaux récurrents)
        </h3>
        <ul className="space-y-1 mb-4 text-sm">
          {slots.length ? (
            slots.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap justify-between gap-2 border border-sky-100 rounded-lg px-2 py-1.5 bg-sky-50/50"
              >
                <span>
                  {DAYS_FR[s.dayOfWeek] ?? `J${s.dayOfWeek}`} · {s.startTime}–{s.endTime}
                  {s.label ? <span className="text-gray-600"> — {s.label}</span> : null}
                </span>
                <button
                  type="button"
                  className="text-red-600 text-xs hover:underline"
                  onClick={() => {
                    if (window.confirm('Supprimer ce créneau ?')) delAvail.mutate(s.id);
                  }}
                >
                  Supprimer
                </button>
              </li>
            ))
          ) : (
            <p className="text-gray-500">Aucune disponibilité saisie.</p>
          )}
        </ul>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <select
            className="border rounded px-2 py-1.5"
            value={availForm.dayOfWeek}
            onChange={(e) => setAvailForm((s) => ({ ...s, dayOfWeek: e.target.value }))}
            aria-label="Jour de la semaine"
          >
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={String(d)}>
                {DAYS_FR[d]}
              </option>
            ))}
          </select>
          <input
            type="time"
            className="border rounded px-2 py-1.5"
            value={availForm.startTime}
            onChange={(e) => setAvailForm((s) => ({ ...s, startTime: e.target.value }))}
            aria-label="Heure de début"
          />
          <input
            type="time"
            className="border rounded px-2 py-1.5"
            value={availForm.endTime}
            onChange={(e) => setAvailForm((s) => ({ ...s, endTime: e.target.value }))}
            aria-label="Heure de fin"
          />
          <input
            className="border rounded px-2 py-1.5 col-span-2 md:col-span-4"
            placeholder="Libellé (optionnel)"
            value={availForm.label}
            onChange={(e) => setAvailForm((s) => ({ ...s, label: e.target.value }))}
            aria-label="Libellé disponibilité"
          />
        </div>
        <Button type="button" size="sm" className="mt-2" disabled={addAvail.isPending} onClick={() => addAvail.mutate()}>
          Ajouter un créneau
        </Button>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FiStar className="text-amber-600" aria-hidden />
          Évaluations RH
        </h3>
        <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
          {reviews.length ? (
            reviews.map((r) => (
              <div key={r.id} className="border border-amber-100 rounded-lg p-2 text-sm bg-amber-50/30">
                <div className="font-semibold text-gray-900">
                  {r.periodLabel} · {r.academicYear}
                  {r.overallScore != null ? (
                    <span className="text-amber-800 ml-2">Note {r.overallScore}/20</span>
                  ) : null}
                </div>
                {r.reviewerName ? <div className="text-xs text-gray-500">Évaluateur : {r.reviewerName}</div> : null}
                <div className="text-xs text-gray-400">
                  {format(new Date(r.createdAt), 'd MMM yyyy', { locale: fr })}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">Aucune évaluation enregistrée.</p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Période * (ex. T1 2025)"
            value={reviewForm.periodLabel}
            onChange={(e) => setReviewForm((s) => ({ ...s, periodLabel: e.target.value }))}
            aria-label="Période d'évaluation"
          />
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Année scolaire *"
            value={reviewForm.academicYear}
            onChange={(e) => setReviewForm((s) => ({ ...s, academicYear: e.target.value }))}
            aria-label="Année scolaire"
          />
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Note globale /20"
            value={reviewForm.overallScore}
            onChange={(e) => setReviewForm((s) => ({ ...s, overallScore: e.target.value }))}
            aria-label="Note globale"
          />
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Nom évaluateur"
            value={reviewForm.reviewerName}
            onChange={(e) => setReviewForm((s) => ({ ...s, reviewerName: e.target.value }))}
            aria-label="Nom évaluateur"
          />
          <textarea
            className="border rounded px-2 py-1.5 md:col-span-2"
            rows={2}
            placeholder="Objectifs"
            value={reviewForm.objectives}
            onChange={(e) => setReviewForm((s) => ({ ...s, objectives: e.target.value }))}
            aria-label="Objectifs évaluation"
          />
          <textarea
            className="border rounded px-2 py-1.5 md:col-span-2"
            rows={2}
            placeholder="Réalisations"
            value={reviewForm.achievements}
            onChange={(e) => setReviewForm((s) => ({ ...s, achievements: e.target.value }))}
            aria-label="Réalisations"
          />
          <textarea
            className="border rounded px-2 py-1.5 md:col-span-2"
            rows={2}
            placeholder="Axes de progrès"
            value={reviewForm.improvements}
            onChange={(e) => setReviewForm((s) => ({ ...s, improvements: e.target.value }))}
            aria-label="Axes de progrès"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-2"
          disabled={
            !reviewForm.periodLabel.trim() || !reviewForm.academicYear.trim() || addReview.isPending
          }
          onClick={() => addReview.mutate()}
        >
          Enregistrer une évaluation
        </Button>
      </Card>
    </div>
  );
};

export default TeacherDossierPanel;
