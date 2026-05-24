'use client';

import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminTuitionCatalogApi } from '../../services/api/admin-tuition-catalog.api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import { ADM } from './adminModuleLayout';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiEdit2, FiSend, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { getCurrentAcademicYear } from '../../utils/academicYear';
import { formatFCFA } from '../../utils/currency';

const FEE_TYPES: { id: string; label: string }[] = [
  { id: 'ENROLLMENT', label: 'Inscription' },
  { id: 'TUITION', label: 'Scolarité' },
  { id: 'CANTEEN', label: 'Cantine' },
  { id: 'TRANSPORT', label: 'Transport' },
  { id: 'ACTIVITY', label: 'Activités' },
  { id: 'MATERIAL', label: 'Matériel' },
  { id: 'OTHER', label: 'Autre' },
];

const BILLING: { id: string; label: string }[] = [
  { id: 'ONE_TIME', label: 'Ponctuel' },
  { id: 'MONTHLY', label: 'Mensuel' },
  { id: 'QUARTERLY', label: 'Trimestriel' },
  { id: 'SEMIANNUAL', label: 'Semestriel' },
  { id: 'ANNUAL', label: 'Annuel' },
];

const SCOPES: { id: string; label: string }[] = [
  { id: 'BY_LEVEL', label: 'Par niveau' },
  { id: 'BY_CLASS', label: 'Par classe' },
  { id: 'ALL_STUDENTS', label: 'Tous (filtre classe à l’application)' },
];

type ScheduleLine = { label: string; percentOfTotal: number; dueOffsetDays: number };

const DEFAULT_SCHEDULE_LINES: ScheduleLine[] = [
  { label: 'Acompte', percentOfTotal: 40, dueOffsetDays: 0 },
  { label: '2e versement', percentOfTotal: 30, dueOffsetDays: 90 },
  { label: 'Solde', percentOfTotal: 30, dueOffsetDays: 180 },
];

const PRESET_TRIMESTERS: ScheduleLine[] = [
  { label: 'Trimestre 1', percentOfTotal: 33.34, dueOffsetDays: 0 },
  { label: 'Trimestre 2', percentOfTotal: 33.33, dueOffsetDays: 90 },
  { label: 'Trimestre 3', percentOfTotal: 33.33, dueOffsetDays: 180 },
];

const PRESET_SEMESTERS: ScheduleLine[] = [
  { label: 'Semestre 1', percentOfTotal: 50, dueOffsetDays: 0 },
  { label: 'Semestre 2', percentOfTotal: 50, dueOffsetDays: 180 },
];

const PRESET_ACOMPTE_SOLDE: ScheduleLine[] = [
  { label: 'Acompte', percentOfTotal: 40, dueOffsetDays: 0 },
  { label: 'Solde', percentOfTotal: 60, dueOffsetDays: 120 },
];

function sumPercents(lines: ScheduleLine[]): number {
  return lines.reduce((s, l) => s + (Number.isFinite(l.percentOfTotal) ? l.percentOfTotal : 0), 0);
}

type StudentLite = {
  id: string;
  classId?: string | null;
  user?: { firstName?: string | null; lastName?: string | null };
};

type ClassLite = { id: string; name?: string; level?: string | null };

type Props = {
  students: StudentLite[] | undefined;
  classes: ClassLite[] | undefined;
};

const TuitionFeeCatalogAndSchedulesPanel: React.FC<Props> = ({ students, classes }) => {
  const qc = useQueryClient();
  const [sub, setSub] = useState<'levelRates' | 'classRates' | 'catalog' | 'schedules' | 'apply'>(
    'levelRates'
  );
  const [levelRatesYear, setLevelRatesYear] = useState(getCurrentAcademicYear());
  const [levelAmounts, setLevelAmounts] = useState<Record<string, string>>({});
  const [classRatesYear, setClassRatesYear] = useState(getCurrentAcademicYear());
  const [classAmounts, setClassAmounts] = useState<Record<string, string>>({});
  const [guideOpen, setGuideOpen] = useState(true);

  const { data: catalog, isLoading: loadCat } = useQuery({
    queryKey: ['admin-tuition-fee-catalog'],
    queryFn: adminTuitionCatalogApi.getTuitionFeeCatalog,
  });

  const { data: templates, isLoading: loadTpl } = useQuery({
    queryKey: ['admin-tuition-schedule-templates'],
    queryFn: adminTuitionCatalogApi.getScheduleTemplates,
  });

  const { data: levelRatesData, isLoading: loadLevelRates } = useQuery({
    queryKey: ['admin-tuition-level-rates', levelRatesYear],
    queryFn: () => adminTuitionCatalogApi.getLevelTuitionRates(levelRatesYear),
    enabled: sub === 'levelRates',
  });

  const { data: classRatesData, isLoading: loadClassRates } = useQuery({
    queryKey: ['admin-tuition-class-rates', classRatesYear],
    queryFn: () => adminTuitionCatalogApi.getClassTuitionRates(classRatesYear),
    enabled: sub === 'classRates',
  });

  useEffect(() => {
    if (!levelRatesData?.rates) return;
    const next: Record<string, string> = {};
    for (const r of levelRatesData.rates) {
      next[r.level] = r.amount != null ? String(r.amount) : '';
    }
    setLevelAmounts(next);
  }, [levelRatesData]);

  useEffect(() => {
    if (!classRatesData?.rates) return;
    const next: Record<string, string> = {};
    for (const r of classRatesData.rates) {
      next[r.classId] = r.amount != null ? String(r.amount) : '';
    }
    setClassAmounts(next);
  }, [classRatesData]);

  const saveLevelRatesMut = useMutation({
    mutationFn: () =>
      adminTuitionCatalogApi.saveLevelTuitionRates({
        academicYear: levelRatesYear,
        rates: Object.entries(levelAmounts)
          .filter(([, v]) => v.trim() !== '' && !Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0)
          .map(([level, v]) => ({ level, amount: Math.round(parseFloat(v)) })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tuition-level-rates'] });
      qc.invalidateQueries({ queryKey: ['admin-tuition-fee-catalog'] });
      toast.success('Montants de scolarité par niveau enregistrés');
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || 'Erreur'),
  });

  const saveClassRatesMut = useMutation({
    mutationFn: () =>
      adminTuitionCatalogApi.saveClassTuitionRates({
        academicYear: classRatesYear,
        rates: Object.entries(classAmounts)
          .filter(([, v]) => v.trim() !== '' && !Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0)
          .map(([classId, v]) => ({ classId, amount: Math.round(parseFloat(v)) })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tuition-class-rates'] });
      qc.invalidateQueries({ queryKey: ['admin-tuition-fee-catalog'] });
      toast.success('Montants de scolarité par classe enregistrés');
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || 'Erreur'),
  });

  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Record<string, unknown> | null>(null);
  const [catForm, setCatForm] = useState({
    label: '',
    academicYear: getCurrentAcademicYear(),
    scope: 'BY_LEVEL',
    classLevel: '',
    classId: '',
    programLabel: '',
    feeType: 'TUITION',
    billingPeriod: 'ONE_TIME',
    defaultAmount: '',
    periodLabelHint: '',
    sortOrder: '0',
    isActive: true,
  });

  const [tplModal, setTplModal] = useState(false);
  const [editingTpl, setEditingTpl] = useState<Record<string, unknown> | null>(null);
  const [tplForm, setTplForm] = useState({
    name: '',
    description: '',
    academicYear: getCurrentAcademicYear(),
    isActive: true,
  });
  const [tplScheduleLines, setTplScheduleLines] = useState<ScheduleLine[]>(DEFAULT_SCHEDULE_LINES);
  const [tplShowJson, setTplShowJson] = useState(false);
  const [tplLinesJson, setTplLinesJson] = useState('');

  const [applyCat, setApplyCat] = useState({
    catalogId: '',
    academicYear: getCurrentAcademicYear(),
    anchorDueDate: '',
    applyScope: 'BY_CLASS' as 'BY_CLASS' | 'BY_LEVEL',
    classId: '',
    classLevel: '',
    discountAmount: '',
    descriptionExtra: '',
  });

  const [applySched, setApplySched] = useState({
    scheduleTemplateId: '',
    studentId: '',
    academicYear: getCurrentAcademicYear(),
    anchorDueDate: '',
    totalAmount: '',
    discountAmount: '',
    feeType: 'TUITION',
    catalogId: '',
  });

  const saveCat = useMutation({
    mutationFn: () =>
      editingCat
        ? adminTuitionCatalogApi.updateTuitionFeeCatalog(String(editingCat.id), {
            ...catForm,
            defaultAmount: parseFloat(catForm.defaultAmount),
            sortOrder: parseInt(catForm.sortOrder, 10) || 0,
            classId: catForm.classId || null,
            classLevel: catForm.classLevel || null,
            programLabel: catForm.programLabel || null,
            academicYear: catForm.academicYear || null,
          })
        : adminTuitionCatalogApi.createTuitionFeeCatalog({
            ...catForm,
            defaultAmount: parseFloat(catForm.defaultAmount),
            sortOrder: parseInt(catForm.sortOrder, 10) || 0,
            classId: catForm.classId || null,
            classLevel: catForm.classLevel || null,
            programLabel: catForm.programLabel || null,
            academicYear: catForm.academicYear || null,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tuition-fee-catalog'] });
      toast.success('Enregistré');
      setCatModal(false);
      setEditingCat(null);
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || 'Erreur'),
  });

  const delCat = useMutation({
    mutationFn: adminTuitionCatalogApi.deleteTuitionFeeCatalog,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tuition-fee-catalog'] });
      toast.success('Supprimé');
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || 'Erreur'),
  });

  const saveTpl = useMutation({
    mutationFn: () => {
      const sum = sumPercents(tplScheduleLines);
      if (Math.abs(sum - 100) > 0.02) {
        throw new Error(`La somme des pourcentages doit être 100 (actuellement ${sum.toFixed(2)}).`);
      }
      if (tplScheduleLines.length === 0) throw new Error('Au moins une ligne d’échéance est requise.');
      for (const ln of tplScheduleLines) {
        if (!ln.label.trim()) throw new Error('Chaque ligne doit avoir un libellé.');
        if (ln.dueOffsetDays < 0 || Number.isNaN(ln.dueOffsetDays)) {
          throw new Error('Décalage en jours invalide.');
        }
      }
      return editingTpl
        ? adminTuitionCatalogApi.updateScheduleTemplate(String(editingTpl.id), {
            name: tplForm.name,
            description: tplForm.description || null,
            academicYear: tplForm.academicYear || null,
            lines: tplScheduleLines,
            isActive: tplForm.isActive,
          })
        : adminTuitionCatalogApi.createScheduleTemplate({
            name: tplForm.name,
            description: tplForm.description || undefined,
            academicYear: tplForm.academicYear || undefined,
            lines: tplScheduleLines,
            isActive: tplForm.isActive,
          });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tuition-schedule-templates'] });
      toast.success('Enregistré');
      setTplModal(false);
      setEditingTpl(null);
    },
    onError: (e: Error & { response?: { data?: { error?: string } } }) =>
      toast.error(e?.message || e.response?.data?.error || 'Erreur'),
  });

  const delTpl = useMutation({
    mutationFn: adminTuitionCatalogApi.deleteScheduleTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tuition-schedule-templates'] });
      toast.success('Supprimé');
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || 'Erreur'),
  });

  const applyCatMut = useMutation({
    mutationFn: () =>
      adminTuitionCatalogApi.applyCatalogToStudents({
        catalogId: applyCat.catalogId,
        academicYear: applyCat.academicYear,
        anchorDueDate: applyCat.anchorDueDate,
        ...(applyCat.applyScope === 'BY_CLASS'
          ? { classId: applyCat.classId }
          : { classLevel: applyCat.classLevel }),
        discountAmount: applyCat.discountAmount ? parseFloat(applyCat.discountAmount) : undefined,
        descriptionExtra: applyCat.descriptionExtra || undefined,
      }),
    onSuccess: (d: { created?: number; skipped?: number; details?: { skipped?: { reason: string }[] } }) => {
      qc.invalidateQueries({ queryKey: ['admin-tuition-fees'] });
      qc.invalidateQueries({ queryKey: ['admin-tuition-fees-grouped'] });
      const skipped = d.skipped ?? 0;
      toast.success(
        `${d.created ?? 0} frais créé(s)${skipped > 0 ? ` · ${skipped} ignoré(s) (doublon ou filtre)` : ''}`,
      );
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || 'Erreur'),
  });

  const applySchedMut = useMutation({
    mutationFn: () =>
      adminTuitionCatalogApi.applyScheduleToStudent({
        scheduleTemplateId: applySched.scheduleTemplateId,
        studentId: applySched.studentId,
        academicYear: applySched.academicYear,
        anchorDueDate: applySched.anchorDueDate,
        totalAmount: parseFloat(applySched.totalAmount),
        discountAmount: applySched.discountAmount ? parseFloat(applySched.discountAmount) : undefined,
        feeType: applySched.feeType,
        catalogId: applySched.catalogId || undefined,
      }),
    onSuccess: (d: { created?: number; skipped?: number }) => {
      qc.invalidateQueries({ queryKey: ['admin-tuition-fees'] });
      qc.invalidateQueries({ queryKey: ['admin-tuition-fees-grouped'] });
      const skipped = d.skipped ?? 0;
      toast.success(
        `${d.created ?? 0} échéance(s)${skipped > 0 ? ` · ${skipped} ignorée(s)` : ''}`,
      );
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error || 'Erreur'),
  });

  const levels = useMemo(() => {
    const s = new Set<string>();
    (classes ?? []).forEach((c) => {
      if (c.level) s.add(c.level);
    });
    return Array.from(s).sort();
  }, [classes]);

  const openNewCat = () => {
    setEditingCat(null);
    setCatForm({
      label: '',
      academicYear: getCurrentAcademicYear(),
      scope: 'BY_LEVEL',
      classLevel: levels[0] ?? '',
      classId: '',
      programLabel: '',
      feeType: 'TUITION',
      billingPeriod: 'QUARTERLY',
      defaultAmount: '',
      periodLabelHint: 'Trimestre',
      sortOrder: '0',
      isActive: true,
    });
    setCatModal(true);
  };

  const openEditCat = (row: Record<string, unknown>) => {
    setEditingCat(row);
    setCatForm({
      label: String(row.label ?? ''),
      academicYear: (row.academicYear as string) ?? getCurrentAcademicYear(),
      scope: String(row.scope ?? 'BY_LEVEL'),
      classLevel: (row.classLevel as string) ?? '',
      classId: (row.classId as string) ?? '',
      programLabel: (row.programLabel as string) ?? '',
      feeType: String(row.feeType ?? 'TUITION'),
      billingPeriod: String(row.billingPeriod ?? 'ONE_TIME'),
      defaultAmount: String(row.defaultAmount ?? ''),
      periodLabelHint: (row.periodLabelHint as string) ?? '',
      sortOrder: String(row.sortOrder ?? 0),
      isActive: row.isActive !== false,
    });
    setCatModal(true);
  };

  const openNewTpl = () => {
    setEditingTpl(null);
    setTplForm({
      name: '',
      description: '',
      academicYear: getCurrentAcademicYear(),
      isActive: true,
    });
    setTplScheduleLines(DEFAULT_SCHEDULE_LINES.map((l) => ({ ...l })));
    setTplShowJson(false);
    setTplLinesJson(JSON.stringify(DEFAULT_SCHEDULE_LINES, null, 2));
    setTplModal(true);
  };

  const openEditTpl = (row: {
    name?: string;
    description?: string | null;
    academicYear?: string | null;
    lines?: unknown;
    isActive?: boolean;
  }) => {
    setEditingTpl(row as Record<string, unknown>);
    setTplForm({
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      academicYear: (row.academicYear as string) ?? getCurrentAcademicYear(),
      isActive: row.isActive !== false,
    });
    const raw = Array.isArray(row.lines) ? row.lines : [];
    const parsed: ScheduleLine[] = raw
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((r) => ({
        label: String(r.label ?? ''),
        percentOfTotal: Number(r.percentOfTotal),
        dueOffsetDays: Number(r.dueOffsetDays),
      }));
    setTplScheduleLines(parsed.length > 0 ? parsed : DEFAULT_SCHEDULE_LINES.map((l) => ({ ...l })));
    setTplShowJson(false);
    setTplLinesJson(JSON.stringify(parsed.length > 0 ? parsed : DEFAULT_SCHEDULE_LINES, null, 2));
    setTplModal(true);
  };

  const applyJsonToTplLines = () => {
    try {
      const arr = JSON.parse(tplLinesJson) as unknown;
      if (!Array.isArray(arr)) throw new Error('Le JSON doit être un tableau.');
      const next: ScheduleLine[] = arr.map((r: Record<string, unknown>) => ({
        label: String(r.label ?? ''),
        percentOfTotal: Number(r.percentOfTotal),
        dueOffsetDays: Number(r.dueOffsetDays),
      }));
      setTplScheduleLines(next);
      toast.success('Lignes importées depuis le JSON');
    } catch {
      toast.error('JSON invalide');
    }
  };

  const pctSum = sumPercents(tplScheduleLines);
  const catalogRows = (catalog ?? []) as Array<Record<string, unknown> & { id: string }>;
  /** Barèmes applicables en lot (hors scolarité — attribuée via « Attribuer des frais »). */
  const applyCatalogRows = catalogRows.filter((c) => String(c.feeType ?? '') !== 'TUITION');

  return (
    <div className="space-y-4">
      <Card className="border border-amber-100 bg-gradient-to-br from-amber-50/90 to-stone-50 p-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setGuideOpen((o) => !o)}
        >
          <span className="text-sm font-bold text-amber-950">Frais de scolarité — guide rapide</span>
          {guideOpen ? <FiChevronUp className="shrink-0" /> : <FiChevronDown className="shrink-0" />}
        </button>
        {guideOpen && (
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-stone-700">
            <li>
              <strong>Montants par niveau</strong> : scolarité (FCFA) pour chaque niveau (6ème → Terminale).
            </li>
            <li>
              <strong>Montants par classe</strong> : montant spécifique à une classe (prioritaire sur le niveau
              à l’inscription).
            </li>
            <li>
              <strong>Barèmes</strong> : autres postes (inscription, cantine, transport…) par classe ou programme.
            </li>
            <li>
              <strong>Application</strong> : générez les lignes pour inscription, cantine, etc. (pas la scolarité — utilisez
              « Attribuer des frais » pour la scolarité).
            </li>
            <li>
              <strong>Échéanciers</strong> : gabarits en % (somme = 100) et délais en jours ; appliquez-les à un élève
              avec montant brut et remise globale répartie au prorata sur chaque versement.
            </li>
          </ul>
        )}
      </Card>

      <div className={ADM.tabRow}>
        {(
          [
            ['levelRates', 'Scolarité par niveau'],
            ['classRates', 'Scolarité par classe'],
            ['catalog', 'Autres barèmes'],
            ['schedules', 'Gabarits d’échéancier'],
            ['apply', 'Application classe / niveau'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(id)}
            className={ADM.tabBtn(sub === id, 'bg-amber-50 text-amber-950 ring-1 ring-amber-200')}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === 'levelRates' && (
        <Card className="space-y-4 p-4">
          <p className="text-sm text-stone-600">
            Définissez le <strong>montant fixe de scolarité</strong> pour chaque niveau. Ce barème est utilisé
            uniquement lorsque vous cliquez sur <strong>« Attribuer des frais »</strong> (par classe ou par niveau) —
            aucune ligne n’est créée automatiquement pour les élèves.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[10rem]">
              <label className="mb-1 block text-xs font-medium text-stone-600">Année scolaire</label>
              <Input
                value={levelRatesYear}
                onChange={(e) => setLevelRatesYear(e.target.value)}
                placeholder="2025-2026"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => saveLevelRatesMut.mutate()}
              disabled={saveLevelRatesMut.isPending || loadLevelRates}
            >
              Enregistrer les montants
            </Button>
          </div>
          {loadLevelRates ? (
            <p className="text-sm text-stone-500">Chargement…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="min-w-full text-sm">
                <thead className="bg-stone-50 text-left text-[10px] uppercase text-stone-600">
                  <tr>
                    <th className="px-3 py-2">Niveau</th>
                    <th className="px-3 py-2">Montant scolarité (FCFA)</th>
                  </tr>
                </thead>
                <tbody>
                  {(levelRatesData?.rates ?? []).map((row) => (
                    <tr key={row.level} className="border-t border-stone-100">
                      <td className="px-3 py-2 font-medium text-stone-900">{row.level}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={levelAmounts[row.level] ?? ''}
                          onChange={(e) =>
                            setLevelAmounts((prev) => ({ ...prev, [row.level]: e.target.value }))
                          }
                          placeholder="Ex. 150000"
                          className="w-full max-w-xs rounded-lg border border-stone-300 px-3 py-2 tabular-nums focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {sub === 'classRates' && (
        <Card className="space-y-4 p-4">
          <p className="text-sm text-stone-600">
            Définissez un <strong>montant fixe par classe</strong>. À l&apos;inscription, ce montant
            s&apos;affiche en priorité ; sinon le barème du <strong>niveau</strong> de la classe est utilisé.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[10rem]">
              <label className="mb-1 block text-xs font-medium text-stone-600">Année scolaire</label>
              <Input
                value={classRatesYear}
                onChange={(e) => setClassRatesYear(e.target.value)}
                placeholder="2025-2026"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => saveClassRatesMut.mutate()}
              disabled={saveClassRatesMut.isPending || loadClassRates}
            >
              Enregistrer les montants
            </Button>
          </div>
          {loadClassRates ? (
            <p className="text-sm text-stone-500">Chargement…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-stone-200 max-h-[28rem] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-stone-50 text-left text-[10px] uppercase text-stone-600 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Classe</th>
                    <th className="px-3 py-2">Niveau</th>
                    <th className="px-3 py-2">Montant scolarité (FCFA)</th>
                  </tr>
                </thead>
                <tbody>
                  {(classRatesData?.rates ?? []).map((row) => (
                    <tr key={row.classId} className="border-t border-stone-100">
                      <td className="px-3 py-2 font-medium text-stone-900">{row.className}</td>
                      <td className="px-3 py-2 text-stone-600">{row.classLevel}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={classAmounts[row.classId] ?? ''}
                          onChange={(e) =>
                            setClassAmounts((prev) => ({ ...prev, [row.classId]: e.target.value }))
                          }
                          placeholder="Ex. 175000"
                          className="w-full max-w-xs rounded-lg border border-stone-300 px-3 py-2 tabular-nums focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {sub === 'catalog' && (
        <Card className="space-y-3 p-3">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="max-w-xl text-xs text-stone-600">
              Postes réutilisables : combinez type de frais, rythme (mensuel, trimestriel…) et portée. L’onglet
              « Application » crée les lignes élèves.
            </p>
            <Button type="button" size="sm" onClick={openNewCat}>
              <FiPlus className="mr-1 inline h-4 w-4" />
              Nouveau barème
            </Button>
          </div>
          {loadCat ? (
            <p className="text-sm text-stone-500">Chargement…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="min-w-full text-sm">
                <thead className="bg-stone-50 text-left text-[10px] uppercase text-stone-600">
                  <tr>
                    <th className="px-2 py-2">Libellé</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Rythme</th>
                    <th className="px-2 py-2">Année</th>
                    <th className="px-2 py-2">Portée</th>
                    <th className="px-2 py-2 text-right">Montant</th>
                    <th className="px-2 py-2">Actif</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogRows.map((row) => {
                    const cls = row.class as { name?: string } | undefined;
                    return (
                      <tr key={row.id} className="border-t border-stone-100">
                        <td className="px-2 py-2 font-medium text-stone-900">{String(row.label)}</td>
                        <td className="px-2 py-2">
                          <Badge className="text-[10px]">
                            {FEE_TYPES.find((f) => f.id === row.feeType)?.label ?? String(row.feeType)}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-xs text-stone-600">
                          {BILLING.find((b) => b.id === row.billingPeriod)?.label ?? String(row.billingPeriod)}
                        </td>
                        <td className="px-2 py-2 text-xs text-stone-500">
                          {(row.academicYear as string) || '—'}
                        </td>
                        <td className="px-2 py-2 text-xs text-stone-600">
                          {SCOPES.find((s) => s.id === String(row.scope))?.label}
                          {row.classLevel != null && String(row.classLevel) !== '' ? ` · ${String(row.classLevel)}` : ''}
                          {cls?.name != null && String(cls.name) !== '' ? ` · ${String(cls.name)}` : ''}
                          {row.programLabel != null && String(row.programLabel) !== ''
                            ? ` · ${String(row.programLabel)}`
                            : ''}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatFCFA(Number(row.defaultAmount))}
                        </td>
                        <td className="px-2 py-2">
                          {row.isActive !== false ? (
                            <span className="text-[10px] font-medium text-emerald-700">Oui</span>
                          ) : (
                            <span className="text-[10px] text-stone-400">Non</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            className="p-1 text-stone-600"
                            title="Modifier"
                            onClick={() => openEditCat(row)}
                          >
                            <FiEdit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1 text-red-600"
                            title="Supprimer"
                            onClick={() => {
                              if (window.confirm('Supprimer ce barème ?')) delCat.mutate(row.id);
                            }}
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {sub === 'schedules' && (
        <Card className="space-y-3 p-3">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="max-w-xl text-xs text-stone-600">
              Versements en pourcentage du total (100 %) et décalage en jours depuis la date d’ancrage à
              l’application.
            </p>
            <Button type="button" size="sm" onClick={openNewTpl}>
              <FiPlus className="mr-1 inline h-4 w-4" />
              Nouveau gabarit
            </Button>
          </div>
          {loadTpl ? (
            <p className="text-sm text-stone-500">Chargement…</p>
          ) : (
            <ul className="space-y-2">
              {((templates ?? []) as Array<{ id: string; name?: string; lines?: unknown[] }>).map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 px-3 py-2"
                >
                  <div>
                    <p className="font-semibold text-stone-900">{t.name}</p>
                    <p className="text-[11px] text-stone-500">
                      {Array.isArray(t.lines) ? `${t.lines.length} versement(s)` : '—'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="secondary" onClick={() => openEditTpl(t)}>
                      Modifier
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="text-red-700"
                      onClick={() => {
                        if (window.confirm('Supprimer ce gabarit ?')) delTpl.mutate(t.id);
                      }}
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {sub === 'apply' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-3 p-3">
            <h3 className="text-sm font-bold text-stone-900">Depuis un barème</h3>
            <p className="text-xs text-stone-600">
              Une ligne de frais par élève actif : sélectionnez une classe ou un niveau. Le montant provient du barème
              (moins la remise éventuelle).
            </p>
            <div>
              <label className="text-xs font-medium text-stone-700">Barème</label>
              <select
                aria-label="Barème à appliquer"
                className="mt-1 w-full rounded-xl border-2 border-stone-200 px-3 py-2 text-sm"
                value={applyCat.catalogId}
                onChange={(e) => setApplyCat((a) => ({ ...a, catalogId: e.target.value }))}
              >
                <option value="">—</option>
                {applyCatalogRows.map((c) => (
                  <option key={c.id} value={c.id}>
                    {String(c.label)} ({formatFCFA(Number(c.defaultAmount))})
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Année scolaire"
              value={applyCat.academicYear}
              onChange={(e) => setApplyCat((a) => ({ ...a, academicYear: e.target.value }))}
            />
            <Input
              label="Date d’échéance"
              type="date"
              value={applyCat.anchorDueDate}
              onChange={(e) => setApplyCat((a) => ({ ...a, anchorDueDate: e.target.value }))}
            />
            <div className="flex gap-2 rounded-lg border border-stone-200 p-1">
              <button
                type="button"
                onClick={() =>
                  setApplyCat((a) => ({ ...a, applyScope: 'BY_CLASS', classLevel: '' }))
                }
                className={`flex-1 rounded-md px-3 py-2 text-xs font-medium ${
                  applyCat.applyScope === 'BY_CLASS'
                    ? 'bg-amber-600 text-white'
                    : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                Par classe
              </button>
              <button
                type="button"
                onClick={() =>
                  setApplyCat((a) => ({ ...a, applyScope: 'BY_LEVEL', classId: '' }))
                }
                className={`flex-1 rounded-md px-3 py-2 text-xs font-medium ${
                  applyCat.applyScope === 'BY_LEVEL'
                    ? 'bg-amber-600 text-white'
                    : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                Par niveau
              </button>
            </div>
            {applyCat.applyScope === 'BY_CLASS' ? (
              <div>
                <label className="text-xs font-medium text-stone-700">Classe</label>
                <select
                  aria-label="Classe cible"
                  className="mt-1 w-full rounded-xl border-2 border-stone-200 px-3 py-2 text-sm"
                  value={applyCat.classId}
                  onChange={(e) => setApplyCat((a) => ({ ...a, classId: e.target.value }))}
                >
                  <option value="">— Sélectionner une classe</option>
                  {(classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.level})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-stone-700">Niveau</label>
                <select
                  aria-label="Niveau cible"
                  className="mt-1 w-full rounded-xl border-2 border-stone-200 px-3 py-2 text-sm"
                  value={applyCat.classLevel}
                  onChange={(e) => setApplyCat((a) => ({ ...a, classLevel: e.target.value }))}
                >
                  <option value="">— Sélectionner un niveau</option>
                  {levels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Input
              label="Remise (FCFA, optionnel)"
              value={applyCat.discountAmount}
              onChange={(e) => setApplyCat((a) => ({ ...a, discountAmount: e.target.value }))}
            />
            <Input
              label="Note complémentaire (optionnel)"
              value={applyCat.descriptionExtra}
              onChange={(e) => setApplyCat((a) => ({ ...a, descriptionExtra: e.target.value }))}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!applyCat.catalogId || !applyCat.academicYear || !applyCat.anchorDueDate) {
                  toast.error('Barème, année et date sont requis');
                  return;
                }
                if (applyCat.applyScope === 'BY_CLASS' && !applyCat.classId) {
                  toast.error('Sélectionnez une classe');
                  return;
                }
                if (applyCat.applyScope === 'BY_LEVEL' && !applyCat.classLevel) {
                  toast.error('Sélectionnez un niveau');
                  return;
                }
                applyCatMut.mutate();
              }}
              disabled={applyCatMut.isPending}
            >
              <FiSend className="mr-1 inline h-4 w-4" />
              Générer les frais
            </Button>
          </Card>

          <Card className="space-y-3 p-3">
            <h3 className="text-sm font-bold text-stone-900">Échéancier personnalisé (un élève)</h3>
            <p className="text-xs text-stone-600">
              Montant <strong>brut</strong> réparti selon le gabarit. Une <strong>remise globale</strong> est ventilée
              sur chaque ligne au même prorata que les pourcentages du gabarit ; le net à payer suit les parts du
              gabarit.
            </p>
            <div>
              <label className="text-xs font-medium text-stone-700">Gabarit</label>
              <select
                aria-label="Gabarit d’échéancier"
                className="mt-1 w-full rounded-xl border-2 border-stone-200 px-3 py-2 text-sm"
                value={applySched.scheduleTemplateId}
                onChange={(e) => setApplySched((a) => ({ ...a, scheduleTemplateId: e.target.value }))}
              >
                <option value="">—</option>
                {((templates ?? []) as Array<{ id: string; name?: string }>).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-700">Élève</label>
              <select
                aria-label="Élève"
                className="mt-1 w-full rounded-xl border-2 border-stone-200 px-3 py-2 text-sm"
                value={applySched.studentId}
                onChange={(e) => setApplySched((a) => ({ ...a, studentId: e.target.value }))}
              >
                <option value="">—</option>
                {(students ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.user?.firstName} {s.user?.lastName}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Année scolaire"
              value={applySched.academicYear}
              onChange={(e) => setApplySched((a) => ({ ...a, academicYear: e.target.value }))}
            />
            <Input
              label="Date d’ancrage"
              type="date"
              value={applySched.anchorDueDate}
              onChange={(e) => setApplySched((a) => ({ ...a, anchorDueDate: e.target.value }))}
            />
            <Input
              label="Montant brut à répartir (FCFA)"
              value={applySched.totalAmount}
              onChange={(e) => setApplySched((a) => ({ ...a, totalAmount: e.target.value }))}
            />
            <Input
              label="Remise globale (FCFA, optionnel)"
              value={applySched.discountAmount}
              onChange={(e) => setApplySched((a) => ({ ...a, discountAmount: e.target.value }))}
            />
            <div>
              <label className="text-xs font-medium text-stone-700">Type de frais</label>
              <select
                aria-label="Type de frais"
                className="mt-1 w-full rounded-xl border-2 border-stone-200 px-3 py-2 text-sm"
                value={applySched.feeType}
                onChange={(e) => setApplySched((a) => ({ ...a, feeType: e.target.value }))}
              >
                {FEE_TYPES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-700">Lier au barème (optionnel)</label>
              <select
                aria-label="Barème lié"
                className="mt-1 w-full rounded-xl border-2 border-stone-200 px-3 py-2 text-sm"
                value={applySched.catalogId}
                onChange={(e) => setApplySched((a) => ({ ...a, catalogId: e.target.value }))}
              >
                <option value="">—</option>
                {catalogRows.map((c) => (
                  <option key={c.id} value={c.id}>
                    {String(c.label)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (
                  !applySched.scheduleTemplateId ||
                  !applySched.studentId ||
                  !applySched.academicYear ||
                  !applySched.anchorDueDate ||
                  !applySched.totalAmount
                ) {
                  toast.error('Tous les champs obligatoires doivent être remplis');
                  return;
                }
                applySchedMut.mutate();
              }}
              disabled={applySchedMut.isPending}
            >
              <FiSend className="mr-1 inline h-4 w-4" />
              Créer les échéances
            </Button>
          </Card>
        </div>
      )}

      <Modal
        isOpen={catModal}
        onClose={() => {
          setCatModal(false);
          setEditingCat(null);
        }}
        title={editingCat ? 'Modifier le barème' : 'Nouveau barème'}
        size="lg"
        compact
      >
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Input label="Libellé" value={catForm.label} onChange={(e) => setCatForm((f) => ({ ...f, label: e.target.value }))} />
          <Input
            label="Année scolaire (optionnel)"
            value={catForm.academicYear}
            onChange={(e) => setCatForm((f) => ({ ...f, academicYear: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-stone-700">Portée</label>
            <select
              aria-label="Portée du barème"
              className="mt-1 w-full rounded-xl border-2 border-stone-200 px-3 py-2"
              value={catForm.scope}
              onChange={(e) => setCatForm((f) => ({ ...f, scope: e.target.value }))}
            >
              {SCOPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {catForm.scope === 'BY_LEVEL' && (
            <div className="sm:col-span-2">
              <Input
                label="Niveau scolaire"
                list="tuition-fee-catalog-levels"
                value={catForm.classLevel}
                onChange={(e) => setCatForm((f) => ({ ...f, classLevel: e.target.value }))}
                placeholder="Ex. 6ème, Terminale…"
              />
              <datalist id="tuition-fee-catalog-levels">
                {levels.map((lv) => (
                  <option key={lv} value={lv} />
                ))}
              </datalist>
            </div>
          )}
          {catForm.scope === 'BY_CLASS' && (
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-stone-700">Classe</label>
              <select
                aria-label="Classe du barème"
                className="mt-1 w-full rounded-xl border-2 border-stone-200 px-3 py-2"
                value={catForm.classId}
                onChange={(e) => setCatForm((f) => ({ ...f, classId: e.target.value }))}
              >
                <option value="">—</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Input
            label="Programme / filière (optionnel)"
            value={catForm.programLabel}
            onChange={(e) => setCatForm((f) => ({ ...f, programLabel: e.target.value }))}
          />
          <div>
            <label className="text-xs font-medium text-stone-700">Type de frais</label>
            <select
              aria-label="Type de frais"
              className="mt-1 w-full rounded-xl border-2 border-stone-200 px-3 py-2"
              value={catForm.feeType}
              onChange={(e) => setCatForm((f) => ({ ...f, feeType: e.target.value }))}
            >
              {FEE_TYPES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-stone-700">Rythme</label>
            <select
              aria-label="Rythme de facturation"
              className="mt-1 w-full rounded-xl border-2 border-stone-200 px-3 py-2"
              value={catForm.billingPeriod}
              onChange={(e) => setCatForm((f) => ({ ...f, billingPeriod: e.target.value }))}
            >
              {BILLING.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Montant de référence (FCFA)"
            value={catForm.defaultAmount}
            onChange={(e) => setCatForm((f) => ({ ...f, defaultAmount: e.target.value }))}
          />
          <Input
            label="Indice libellé période (optionnel)"
            value={catForm.periodLabelHint}
            onChange={(e) => setCatForm((f) => ({ ...f, periodLabelHint: e.target.value }))}
          />
          <Input
            label="Ordre"
            value={catForm.sortOrder}
            onChange={(e) => setCatForm((f) => ({ ...f, sortOrder: e.target.value }))}
          />
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={catForm.isActive}
              onChange={(e) => setCatForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Actif
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setCatModal(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (!catForm.label.trim() || !catForm.defaultAmount) {
                toast.error('Libellé et montant requis');
                return;
              }
              saveCat.mutate();
            }}
            disabled={saveCat.isPending}
          >
            Enregistrer
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={tplModal}
        onClose={() => {
          setTplModal(false);
          setEditingTpl(null);
        }}
        title={editingTpl ? 'Modifier le gabarit' : 'Nouveau gabarit'}
        size="lg"
        compact
      >
        <div className="space-y-3 text-sm">
          <Input label="Nom" value={tplForm.name} onChange={(e) => setTplForm((f) => ({ ...f, name: e.target.value }))} />
          <Input
            label="Description"
            value={tplForm.description}
            onChange={(e) => setTplForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Input
            label="Année (optionnel)"
            value={tplForm.academicYear}
            onChange={(e) => setTplForm((f) => ({ ...f, academicYear: e.target.value }))}
          />

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-stone-700">Versements</span>
              <span
                className={`text-xs font-semibold tabular-nums ${Math.abs(pctSum - 100) > 0.02 ? 'text-red-600' : 'text-emerald-700'}`}
              >
                Σ % = {pctSum.toFixed(2)} / 100
              </span>
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => setTplScheduleLines(PRESET_TRIMESTERS.map((l) => ({ ...l })))}>
                3 trimestres
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setTplScheduleLines(PRESET_SEMESTERS.map((l) => ({ ...l })))}>
                2 semestres
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setTplScheduleLines(PRESET_ACOMPTE_SOLDE.map((l) => ({ ...l })))}>
                Acompte + solde
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setTplScheduleLines(DEFAULT_SCHEDULE_LINES.map((l) => ({ ...l })))}>
                40 / 30 / 30
              </Button>
            </div>
            <div className="space-y-2 rounded-xl border-2 border-stone-200 p-2">
              {tplScheduleLines.map((line, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-12 sm:items-end">
                  <div className="sm:col-span-5">
                    <Input
                      label={idx === 0 ? 'Libellé' : '\u00A0'}
                      value={line.label}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTplScheduleLines((rows) => rows.map((r, i) => (i === idx ? { ...r, label: v } : r)));
                      }}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Input
                      label={idx === 0 ? '% du total' : '\u00A0'}
                      type="number"
                      step="0.01"
                      value={String(line.percentOfTotal)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setTplScheduleLines((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, percentOfTotal: Number.isFinite(v) ? v : 0 } : r)),
                        );
                      }}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Input
                      label={idx === 0 ? 'Jours après ancrage' : '\u00A0'}
                      type="number"
                      value={String(line.dueOffsetDays)}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setTplScheduleLines((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, dueOffsetDays: Number.isFinite(v) ? v : 0 } : r)),
                        );
                      }}
                    />
                  </div>
                  <div className="flex sm:col-span-1 sm:justify-end">
                    <button
                      type="button"
                      className="p-2 text-red-600 disabled:opacity-30"
                      title="Supprimer la ligne"
                      disabled={tplScheduleLines.length <= 1}
                      onClick={() => setTplScheduleLines((rows) => rows.filter((_, i) => i !== idx))}
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setTplScheduleLines((rows) => [...rows, { label: 'Nouveau', percentOfTotal: 0, dueOffsetDays: 0 }])
                }
              >
                <FiPlus className="mr-1 inline h-4 w-4" />
                Ligne
              </Button>
            </div>
          </div>

          <button
            type="button"
            className="text-xs font-medium text-amber-800 underline"
            onClick={() => {
              setTplLinesJson(JSON.stringify(tplScheduleLines, null, 2));
              setTplShowJson((s) => !s);
            }}
          >
            {tplShowJson ? 'Masquer le JSON' : 'Afficher / importer JSON'}
          </button>
          {tplShowJson && (
            <div className="space-y-2">
              <textarea
                aria-label="Lignes du gabarit au format JSON"
                className="min-h-[120px] w-full rounded-xl border-2 border-stone-200 px-3 py-2 font-mono text-xs"
                value={tplLinesJson}
                onChange={(e) => setTplLinesJson(e.target.value)}
              />
              <Button type="button" size="sm" variant="secondary" onClick={applyJsonToTplLines}>
                Appliquer le JSON aux lignes
              </Button>
            </div>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={tplForm.isActive}
              onChange={(e) => setTplForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Actif
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setTplModal(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (!tplForm.name.trim()) {
                toast.error('Nom requis');
                return;
              }
              saveTpl.mutate();
            }}
            disabled={saveTpl.isPending}
          >
            Enregistrer
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default TuitionFeeCatalogAndSchedulesPanel;
