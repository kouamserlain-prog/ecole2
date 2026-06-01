import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import CompleteManagement from './CompleteManagement';
import GradeAveragesPanel from './GradeAveragesPanel';
import GenerateReportCardModal from './GenerateReportCardModal';
import GenerateReportModal from './GenerateReportModal';
import GradingAdvancedPanel from './GradingAdvancedPanel';
import AcademicValidationPanel from '../academic/AcademicValidationPanel';
import Button from '../ui/Button';
import {
  FiGrid,
  FiEdit3,
  FiBarChart2,
  FiFileText,
  FiAward,
  FiBookOpen,
  FiSliders,
  FiCheckCircle,
} from 'react-icons/fi';
import { ADM } from './adminModuleLayout';

type GradingTab = 'overview' | 'notation' | 'averages' | 'reports' | 'advanced' | 'validations';

const GradingEvaluationManagement: React.FC = () => {
  const [tab, setTab] = useState<GradingTab>('overview');
  const [reportCardOpen, setReportCardOpen] = useState(false);
  const [institutionalReportOpen, setInstitutionalReportOpen] = useState(false);

  const { data: grades } = useQuery({
    queryKey: ['admin-grades-overview'],
    queryFn: () => adminApi.getAllGrades(),
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: adminApi.getClasses,
  });

  const gradeCount = grades?.length ?? 0;
  const classCount = classes?.length ?? 0;

  const subTabs: { id: GradingTab; label: string; icon: typeof FiGrid }[] = [
    { id: 'overview', label: 'Vue d’ensemble', icon: FiGrid },
    { id: 'notation', label: 'Notes & bulletins', icon: FiEdit3 },
    { id: 'averages', label: 'Moyennes', icon: FiBarChart2 },
    { id: 'advanced', label: 'Conseils & classement', icon: FiSliders },
    { id: 'validations', label: 'Validations', icon: FiCheckCircle },
    { id: 'reports', label: 'Relevés & rapports', icon: FiFileText },
  ];

  return (
    <div className={ADM.root}>
      <div>
        <h2 className={ADM.h2}>Notation et évaluation</h2>
        <p className={ADM.intro}>
          Saisie des notes par matière, calcul des moyennes, bulletins, relevés PDF et rapports
          d’établissement.
        </p>
      </div>

      <div className={`${ADM.tabRow} max-w-full`}>
        {subTabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={ADM.tabBtn(active, 'bg-violet-50 text-violet-900 ring-1 ring-violet-200')}
            >
              <Icon className={ADM.tabIcon} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            <Card className="p-2.5 sm:p-3 border border-gray-200">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight">
                Notes enregistrées
              </p>
              <p className="text-lg font-bold text-gray-900 mt-0.5 tabular-nums leading-none">
                {gradeCount}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Évaluations saisies (toutes classes)
              </p>
            </Card>
            <Card className="p-2.5 sm:p-3 border border-gray-200">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight">
                Classes
              </p>
              <p className="text-lg font-bold text-gray-900 mt-0.5 tabular-nums leading-none">
                {classCount}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Pour filtrer la saisie et les moyennes
              </p>
            </Card>
            <Card className="p-2.5 sm:p-3 border border-violet-100 bg-violet-50/50">
              <p className="text-[10px] font-medium text-violet-800 uppercase flex items-center gap-1 tracking-wide leading-tight">
                <FiAward className="w-3 h-3 shrink-0" /> Parcours type
              </p>
              <ol className="text-[11px] text-gray-700 mt-1.5 space-y-0.5 list-decimal list-inside leading-snug">
                <li>Saisir les notes (onglet Notes & bulletins)</li>
                <li>Contrôler les moyennes (onglet Moyennes)</li>
                <li>Générer bulletins PDF (onglet Relevés & rapports)</li>
              </ol>
            </Card>
          </div>

          <Card className="p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
              <FiBookOpen className="w-4 h-4 text-violet-600 shrink-0" />
              Rappels
            </h3>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside leading-relaxed">
              <li>
                Les <strong>moyennes par matière</strong> sur un trimestre figurent sur le{' '}
                <strong>bulletin PDF</strong> (période et année scolaire à choisir).
              </li>
              <li>
                L’onglet <strong>Moyennes</strong> affiche la moyenne générale pondérée sur{' '}
                <em>toutes</em> les notes saisies (hors filtre de période).
              </li>
              <li>
                Les <strong>rapports institutionnels</strong> (effectifs, synthèses) complètent les
                bulletins individuels.
              </li>
            </ul>
          </Card>
        </div>
      )}

      {tab === 'notation' && <CompleteManagement gradingModule compact />}

      {tab === 'averages' && <GradeAveragesPanel compact />}

      {tab === 'advanced' && <GradingAdvancedPanel compact />}

      {tab === 'validations' && (
        <AcademicValidationPanel title="Validations (directeur des études)" />
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 border border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Bulletins & relevés PDF</h3>
              <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                Génération par classe : moyennes par matière sur la période choisie, appréciations et
                rang. Le document PDF sert de <strong>bulletin</strong> et de{' '}
                <strong>relevé de notes</strong> officiel pour les familles.
              </p>
              <Button size="sm" onClick={() => setReportCardOpen(true)} className="w-full sm:w-auto">
                <FiFileText className="w-4 h-4 mr-2 inline" />
                Ouvrir la génération de bulletins PDF
              </Button>
            </Card>
            <Card className="p-4 border border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Rapports académiques</h3>
              <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                Exports synthétiques : listes d’élèves, classes, enseignants, notes ou absences selon
                les filtres disponibles dans l’assistant.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setInstitutionalReportOpen(true)}
                className="w-full sm:w-auto"
              >
                <FiBookOpen className="w-4 h-4 mr-2 inline" />
                Assistant rapports d’établissement
              </Button>
            </Card>
          </div>
        </div>
      )}

      <GenerateReportCardModal isOpen={reportCardOpen} onClose={() => setReportCardOpen(false)} />
      <GenerateReportModal
        isOpen={institutionalReportOpen}
        onClose={() => setInstitutionalReportOpen(false)}
      />
    </div>
  );
};

export default GradingEvaluationManagement;
