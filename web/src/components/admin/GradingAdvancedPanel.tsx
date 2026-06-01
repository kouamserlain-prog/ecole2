/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiDownload, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { adminApi } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { useSchoolReady, schoolQueryKey } from '../../hooks/useSchoolReady';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import FilterDropdown from '../ui/FilterDropdown';
import Input from '../ui/Input';

function BulletinFilterField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-0">
      <span className="block text-xs font-medium text-stone-700 mb-1">{label}</span>
      <FilterDropdown variant="field" label={label} value={value} onChange={onChange} options={options} />
    </div>
  );
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const PERIODS = [
  { value: 'trim1', label: 'Trimestre 1' },
  { value: 'trim2', label: 'Trimestre 2' },
  { value: 'trim3', label: 'Trimestre 3' },
  { value: 'sem1', label: 'Semestre 1' },
  { value: 'sem2', label: 'Semestre 2' },
];

const YEARS = ['2024-2025', '2025-2026', '2026-2027'];

const DEFAULT_FOOTER = "Document officiel de l'établissement.";

type BulletinToggles = {
  showTeacherAppreciations: boolean;
  showClassRank: boolean;
  showConduct: boolean;
  showCharts: boolean;
};

function runAutoTable(doc: jsPDF, options: any) {
  if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(options);
  } else if (typeof autoTable === 'function') {
    autoTable(doc, options);
  } else {
    throw new Error('autoTable indisponible');
  }
}

function applyServerTemplateToState(
  template: any,
  setters: {
    setName: (v: string) => void;
    setDescription: (v: string) => void;
    setToggles: (v: BulletinToggles) => void;
    setFooterNote: (v: string) => void;
    setSettingsExtraJson: (v: string) => void;
    setShowAdvancedJson: (v: boolean) => void;
  }
) {
  const s = template?.settings && typeof template.settings === 'object' ? template.settings : {};
  setters.setName(template?.name || 'Template bulletin par défaut');
  setters.setDescription(template?.description || '');
  setters.setToggles({
    showTeacherAppreciations: s.showTeacherAppreciations !== false,
    showClassRank: s.showClassRank !== false,
    showConduct: s.showConduct !== false,
    showCharts: s.showCharts !== false,
  });
  setters.setFooterNote(typeof s.footerNote === 'string' && s.footerNote ? s.footerNote : DEFAULT_FOOTER);

  const known = new Set([
    'showTeacherAppreciations',
    'showClassRank',
    'showConduct',
    'showCharts',
    'footerNote',
  ]);
  const rest: Record<string, unknown> = {};
  Object.keys(s).forEach((k) => {
    if (!known.has(k)) rest[k] = s[k];
  });
  if (Object.keys(rest).length > 0) {
    setters.setSettingsExtraJson(JSON.stringify(rest, null, 2));
    setters.setShowAdvancedJson(true);
  } else {
    setters.setSettingsExtraJson('{}');
    setters.setShowAdvancedJson(false);
  }
}

const GradingAdvancedPanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const queryClient = useQueryClient();
  const { activeSchoolId } = useSchool();
  const schoolReady = useSchoolReady();
  const [classId, setClassId] = useState('');
  const [period, setPeriod] = useState('trim1');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [studentId, setStudentId] = useState('');
  const [editingCouncilId, setEditingCouncilId] = useState<string | null>(null);

  const [templateName, setTemplateName] = useState('Template bulletin par défaut');
  const [templateDescription, setTemplateDescription] = useState('');
  const [toggles, setToggles] = useState<BulletinToggles>({
    showTeacherAppreciations: true,
    showClassRank: true,
    showConduct: true,
    showCharts: true,
  });
  const [footerNote, setFooterNote] = useState(DEFAULT_FOOTER);
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [settingsExtraJson, setSettingsExtraJson] = useState('{}');

  const hydratedFromServer = useRef(false);

  const [councilForm, setCouncilForm] = useState({
    title: '',
    meetingDate: '',
    summary: '',
    decisions: '',
    recommendations: '',
  });

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: schoolQueryKey(['classes'], activeSchoolId),
    queryFn: adminApi.getClasses,
    enabled: schoolReady,
  });

  const { data: rankings } = useQuery({
    queryKey: ['grades-rankings', classId, period, academicYear],
    queryFn: () => adminApi.getGradeRankings({ classId, period, academicYear }),
    enabled: Boolean(classId),
  });

  const rankingRows = rankings?.rows || [];
  const apiPeriodLabel = rankings?.periodLabel as string | undefined;

  const { data: history } = useQuery({
    queryKey: ['grade-history', studentId],
    queryFn: () => adminApi.getGradeHistory(studentId),
    enabled: Boolean(studentId),
  });

  const { data: template } = useQuery({
    queryKey: ['default-report-card-template'],
    queryFn: adminApi.getDefaultReportCardTemplate,
  });

  const { data: councils } = useQuery({
    queryKey: ['class-councils', classId, period, academicYear],
    queryFn: () => adminApi.getClassCouncils({ classId, period, academicYear }),
    enabled: Boolean(classId),
  });

  useEffect(() => {
    if (!template || hydratedFromServer.current) return;
    applyServerTemplateToState(template, {
      setName: setTemplateName,
      setDescription: setTemplateDescription,
      setToggles,
      setFooterNote,
      setSettingsExtraJson,
      setShowAdvancedJson,
    });
    hydratedFromServer.current = true;
  }, [template]);

  const buildSettingsForSave = useCallback(() => {
    let extra: Record<string, unknown> = {};
    const raw = settingsExtraJson.trim();
    if (raw && raw !== '{}') {
      try {
        const parsed = JSON.parse(settingsExtraJson) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          extra = parsed as Record<string, unknown>;
        } else {
          throw new Error('Le JSON avancé doit être un objet');
        }
      } catch {
        throw new Error('JSON avancé invalide');
      }
    }
    return {
      ...extra,
      ...toggles,
      footerNote,
    };
  }, [toggles, footerNote, settingsExtraJson]);

  const saveTemplate = useMutation({
    mutationFn: () => {
      const settings = buildSettingsForSave();
      return adminApi.saveDefaultReportCardTemplate({
        name: templateName,
        description: templateDescription,
        settings,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['default-report-card-template'] });
      toast.success('Template bulletin sauvegardé');
    },
    onError: (err: any) => toast.error(err?.message || 'Erreur template'),
  });

  const saveCouncil = useMutation({
    mutationFn: () => {
      if (!classId) throw new Error('Sélectionnez une classe');
      if (!councilForm.meetingDate) throw new Error('Date de conseil requise');

      const payload = {
        classId,
        period,
        academicYear,
        title: councilForm.title,
        meetingDate: councilForm.meetingDate,
        summary: councilForm.summary,
        decisions: councilForm.decisions,
        recommendations: councilForm.recommendations,
      };

      if (editingCouncilId) {
        const { title, meetingDate, summary, decisions, recommendations } = payload;
        return adminApi.updateClassCouncil(editingCouncilId, {
          title,
          meetingDate,
          summary,
          decisions,
          recommendations,
        });
      }
      return adminApi.createClassCouncil(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-councils', classId, period, academicYear] });
      toast.success(editingCouncilId ? 'Conseil de classe mis à jour' : 'Conseil de classe créé');
      setEditingCouncilId(null);
      setCouncilForm({
        title: '',
        meetingDate: '',
        summary: '',
        decisions: '',
        recommendations: '',
      });
    },
    onError: (err: any) => toast.error(err?.message || 'Erreur conseil de classe'),
  });

  const selectedClass = classes?.find((c: any) => c.id === classId);
  const selectedClassLabel = selectedClass?.name || 'Classe';
  const selectedClassFull = selectedClass
    ? `${selectedClass.name} (${selectedClass.level})`
    : selectedClassLabel;
  const progressionData = history?.progression || [];
  const periodLabel = apiPeriodLabel || PERIODS.find((p) => p.value === period)?.label || period;

  const top3 = useMemo(() => rankingRows.slice(0, 3), [rankingRows]);

  const exportRankingsPdf = () => {
    if (!classId || rankingRows.length === 0) {
      toast.error('Sélectionnez une classe avec des notes sur la période');
      return;
    }
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageW = doc.internal.pageSize.getWidth();
      doc.setFontSize(16);
      doc.setTextColor(124, 58, 237);
      doc.text('Classement — bulletin', 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(selectedClassFull, 14, 26);
      doc.text(`${periodLabel} · ${academicYear}`, 14, 32);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`, 14, 38);

      const body = rankingRows.map((r: any) => [
        String(r.rank ?? ''),
        r.student?.user?.lastName ?? '—',
        r.student?.user?.firstName ?? '—',
        `${(r.average ?? 0).toFixed(2)}/20`,
      ]);

      runAutoTable(doc, {
        head: [['Rang', 'Nom', 'Prénom', 'Moyenne /20']],
        body,
        startY: 44,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });

      const safeName = selectedClassLabel.replace(/\s+/g, '_');
      doc.save(`classement_${safeName}_${period}_${academicYear}.pdf`);
      toast.success('PDF exporté');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erreur export PDF');
    }
  };

  const exportRankingsCsv = () => {
    if (!classId || rankingRows.length === 0) {
      toast.error('Aucune donnée à exporter');
      return;
    }
    const headers = ['Rang', 'Nom', 'Prénom', 'Moyenne/20', 'Période', 'Année'];
    const rows = rankingRows.map((r: any) =>
      [
        r.rank,
        r.student?.user?.lastName ?? '',
        r.student?.user?.firstName ?? '',
        (r.average ?? 0).toFixed(2),
        periodLabel,
        academicYear,
      ].join(';')
    );
    const csv = '\ufeff' + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `classement_${selectedClassLabel.replace(/\s+/g, '_')}_${period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('CSV exporté');
  };

  const reloadTemplateFromServer = () => {
    if (!template) {
      toast.error('Template non chargé');
      return;
    }
    applyServerTemplateToState(template, {
      setName: setTemplateName,
      setDescription: setTemplateDescription,
      setToggles,
      setFooterNote,
      setSettingsExtraJson,
      setShowAdvancedJson,
    });
    toast.success('Formulaire rechargé depuis le serveur');
  };

  const toggleRow = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 cursor-pointer hover:bg-stone-50/80">
      <span className="text-sm text-stone-800">{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-stone-300 text-violet-600 focus:ring-violet-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );

  return (
    <div className={`min-w-0 max-w-full overflow-x-hidden ${compact ? 'space-y-4 text-sm' : 'space-y-5'}`}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
        <Card className="min-w-0 overflow-hidden p-3 border border-violet-100 bg-violet-50/30">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-800 mb-2">
            Étape 1 — Contexte bulletin
          </p>
          <p className="text-xs text-stone-600 mb-3 leading-relaxed">
            Ces trois filtres définissent la <strong>période officielle</strong> pour le classement, les conseils
            de classe et la cohérence avec les bulletins PDF.
          </p>
          <div className="grid grid-cols-1 gap-3">
            <BulletinFilterField
              label="Classe"
              value={classId}
              onChange={(id) => {
                setClassId(id);
                setStudentId('');
              }}
              options={[
                {
                  value: '',
                  label: classesLoading
                    ? 'Chargement des classes…'
                    : (classes?.length ?? 0) === 0
                      ? 'Aucune classe disponible'
                      : 'Choisir une classe…',
                },
                ...(classes || []).map((c: any) => ({ value: c.id, label: `${c.name} (${c.level})` })),
              ]}
            />
            <BulletinFilterField label="Période" value={period} onChange={setPeriod} options={PERIODS} />
            <BulletinFilterField
              label="Année scolaire"
              value={academicYear}
              onChange={setAcademicYear}
              options={YEARS.map((y) => ({ value: y, label: y }))}
            />
          </div>
        </Card>

        <Card className="min-w-0 overflow-hidden p-3 border border-amber-100 bg-amber-50/25">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900 mb-2">
            Étape 2 — Progression par élève
          </p>
          <p className="text-xs text-stone-600 mb-3 leading-relaxed">
            La liste des élèves provient du <strong>classement</strong> de la classe sélectionnée (même période).
            Choisissez un élève pour afficher le graphique d’historique.
          </p>
          <BulletinFilterField
            label="Élève (graphique progression)"
            value={studentId}
            onChange={setStudentId}
            options={[
              {
                value: '',
                label: !classId
                  ? 'D’abord choisir une classe (étape 1)'
                  : rankingRows.length === 0
                    ? 'Aucun élève classé sur cette période'
                    : 'Choisir un élève…',
              },
              ...rankingRows.map((r: any) => ({
                value: r.studentId,
                label:
                  `${r.student?.user?.firstName || ''} ${r.student?.user?.lastName || ''}`.trim() ||
                  r.studentId,
              })),
            ]}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
        <Card className="min-w-0 overflow-hidden p-3 border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 min-w-0">
            <h3 className="font-semibold text-gray-900">Classements et rangs</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{rankingRows.length} élèves</Badge>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!rankingRows.length}
                onClick={exportRankingsCsv}
              >
                CSV
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-violet-600 hover:bg-violet-700"
                disabled={!rankingRows.length}
                onClick={exportRankingsPdf}
              >
                <FiDownload className="w-4 h-4 mr-1.5 inline" />
                PDF
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {selectedClassFull} · {periodLabel} · {academicYear}
          </p>

          {top3.length > 0 && (
            <div className="space-y-1.5 mb-3">
              <p className="text-[10px] font-medium uppercase text-gray-500">Podium</p>
              {top3.map((r: any) => (
                <div
                  key={r.studentId}
                  className="flex items-center justify-between rounded bg-gray-50 px-2 py-1.5 text-xs"
                >
                  <span className="font-medium">
                    #{r.rank} {r.student?.user?.firstName} {r.student?.user?.lastName}
                  </span>
                  <span className="font-semibold tabular-nums">{(r.average || 0).toFixed(2)}/20</span>
                </div>
              ))}
            </div>
          )}

          {!classId ? (
            <p className="text-xs text-gray-500">Choisissez une classe pour charger le classement.</p>
          ) : rankingRows.length === 0 ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-2">
              Aucune moyenne calculable sur cette période (pas assez de notes ou classe vide).
            </p>
          ) : (
            <div className="max-h-56 overflow-x-auto overflow-y-auto rounded border border-gray-100">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-left text-gray-600 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 font-medium w-10">#</th>
                    <th className="px-2 py-2 font-medium">Élève</th>
                    <th className="px-2 py-2 font-medium text-right">Moy. /20</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rankingRows.map((r: any) => (
                    <tr key={r.studentId} className="hover:bg-gray-50/80">
                      <td className="px-2 py-1.5 text-gray-500 tabular-nums">{r.rank}</td>
                      <td className="px-2 py-1.5 font-medium text-gray-900">
                        {r.student?.user?.firstName} {r.student?.user?.lastName}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-violet-800">
                        {(r.average ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="min-w-0 overflow-hidden p-3 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-2">Progression élève</h3>
          {progressionData.length === 0 ? (
            <p className="text-xs text-gray-500 leading-relaxed">
              Sélectionnez un élève ci-dessus. Le graphique agrège les moyennes mensuelles renvoyées par
              l’API d’historique.
            </p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressionData}>
                  <XAxis dataKey="month" fontSize={10} />
                  <YAxis domain={[0, 20]} fontSize={10} />
                  <Tooltip />
                  <Line type="monotone" dataKey="average" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden p-3 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-1">Template bulletin</h3>
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">
          Options visibles pour les familles sur le bulletin : cochez ou décochez sans toucher au JSON. Le bloc
          JSON reste réservé aux paramètres personnalisés supplémentaires.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nom du template" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
          <Input
            label="Description"
            value={templateDescription}
            onChange={(e) => setTemplateDescription(e.target.value)}
            placeholder="Optionnel"
          />
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {toggleRow('Appréciations enseignants', toggles.showTeacherAppreciations, (v) =>
            setToggles((t) => ({ ...t, showTeacherAppreciations: v }))
          )}
          {toggleRow('Rang de classe', toggles.showClassRank, (v) => setToggles((t) => ({ ...t, showClassRank: v })))}
          {toggleRow('Conduite / comportement', toggles.showConduct, (v) =>
            setToggles((t) => ({ ...t, showConduct: v }))
          )}
          {toggleRow('Graphiques / visuels', toggles.showCharts, (v) => setToggles((t) => ({ ...t, showCharts: v })))}
        </div>

        <div className="mt-3">
          <Input
            label="Pied de page (texte libre)"
            value={footerNote}
            onChange={(e) => setFooterNote(e.target.value)}
            placeholder={DEFAULT_FOOTER}
          />
        </div>

        <div className="mt-3 border border-stone-200 rounded-lg overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-stone-800 bg-stone-50 hover:bg-stone-100/90"
            onClick={() => setShowAdvancedJson((x) => !x)}
          >
            <span>JSON avancé (optionnel)</span>
            {showAdvancedJson ? <FiChevronUp className="shrink-0" /> : <FiChevronDown className="shrink-0" />}
          </button>
          {showAdvancedJson && (
            <div className="p-2 border-t border-stone-200 bg-white">
              <textarea
                value={settingsExtraJson}
                onChange={(e) => setSettingsExtraJson(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono min-h-[100px]"
                aria-label="Paramètres JSON supplémentaires pour le template bulletin"
                placeholder='{"customLogoUrl": "..."}'
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Objet JSON uniquement ; fusionné avec les options ci-dessus (les bascules priment sur les clés en
                conflit).
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => saveTemplate.mutate()} className="bg-orange-600 hover:bg-orange-700">
            Sauvegarder
          </Button>
          <Button size="sm" variant="secondary" type="button" onClick={reloadTemplateFromServer}>
            Recharger depuis le serveur
          </Button>
        </div>
      </Card>

      <Card className="min-w-0 overflow-hidden p-3 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-2">Conseils de classe</h3>
        <p className="text-xs text-gray-500 mb-3">
          Liés à la classe et à la période choisies en haut de page. La date est obligatoire pour créer un
          conseil.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Titre (optionnel)"
            value={councilForm.title}
            onChange={(e) => setCouncilForm({ ...councilForm, title: e.target.value })}
            placeholder="Ex. Conseil de fin T1"
          />
          <Input
            label="Date et heure du conseil"
            type="datetime-local"
            value={councilForm.meetingDate}
            onChange={(e) => setCouncilForm({ ...councilForm, meetingDate: e.target.value })}
          />
        </div>
        <textarea
          value={councilForm.summary}
          onChange={(e) => setCouncilForm({ ...councilForm, summary: e.target.value })}
          className="mt-3 w-full rounded-lg border border-gray-300 p-2 text-xs min-h-[70px]"
          placeholder="Synthèse"
          aria-label="Synthèse du conseil de classe"
        />
        <textarea
          value={councilForm.decisions}
          onChange={(e) => setCouncilForm({ ...councilForm, decisions: e.target.value })}
          className="mt-2 w-full rounded-lg border border-gray-300 p-2 text-xs min-h-[70px]"
          placeholder="Décisions"
          aria-label="Décisions du conseil de classe"
        />
        <textarea
          value={councilForm.recommendations}
          onChange={(e) => setCouncilForm({ ...councilForm, recommendations: e.target.value })}
          className="mt-2 w-full rounded-lg border border-gray-300 p-2 text-xs min-h-[70px]"
          placeholder="Recommandations"
          aria-label="Recommandations du conseil de classe"
        />
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={() => saveCouncil.mutate()} className="bg-orange-600 hover:bg-orange-700">
            {editingCouncilId ? 'Mettre à jour le conseil' : 'Créer le conseil'}
          </Button>
          {editingCouncilId && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditingCouncilId(null);
                setCouncilForm({
                  title: '',
                  meetingDate: '',
                  summary: '',
                  decisions: '',
                  recommendations: '',
                });
              }}
            >
              Annuler édition
            </Button>
          )}
        </div>

        <div className="mt-4 max-h-56 overflow-y-auto border border-gray-200 rounded p-2 space-y-2">
          {(councils || []).length === 0 ? (
            <p className="text-xs text-gray-500">Aucun conseil de classe pour ce filtre.</p>
          ) : (
            (councils || []).map((c: any) => (
              <div key={c.id} className="rounded bg-gray-50 px-2 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <strong className="truncate">{c.title || 'Conseil de classe'}</strong>
                  <span className="shrink-0 text-gray-600">
                    {new Date(c.meetingDate).toLocaleString('fr-FR')}
                  </span>
                </div>
                <p className="mt-1 text-gray-600 line-clamp-2">{c.summary || '—'}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    setEditingCouncilId(c.id);
                    setCouncilForm({
                      title: c.title || '',
                      meetingDate: c.meetingDate ? new Date(c.meetingDate).toISOString().slice(0, 16) : '',
                      summary: c.summary || '',
                      decisions: c.decisions || '',
                      recommendations: c.recommendations || '',
                    });
                  }}
                >
                  Éditer
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default GradingAdvancedPanel;
