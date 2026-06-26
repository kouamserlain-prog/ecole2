import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import FilterDropdown from '../ui/FilterDropdown';
import toast from 'react-hot-toast';
import { ACADEMIC_CHANGE_VALIDATION_MESSAGE } from '@/lib/academicValidationMessages';
import { useAppBranding } from '@/contexts/AppBrandingContext';
import {
  generateTranlefetReportCardPdf,
  TRANLEFET_DEFAULT_BRANDING,
} from '@/lib/tranlefetReportCardPdf';
import { getCurrentAcademicYear, getCurrentTrimester } from '@/lib/academicCalendar';

import {
  FiFileText,
  FiUsers,
  FiAlertCircle,
  FiLoader,
} from 'react-icons/fi';

interface GenerateReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const periods = [
  { value: 'trim1', label: 'Trimestre 1' },
  { value: 'trim2', label: 'Trimestre 2' },
  { value: 'trim3', label: 'Trimestre 3' },
  { value: 'sem1', label: 'Semestre 1' },
  { value: 'sem2', label: 'Semestre 2' },
];

const academicYears = [
  { value: '2023-2024', label: '2023-2024' },
  { value: '2024-2025', label: '2024-2025' },
  { value: '2025-2026', label: '2025-2026' },
  { value: '2026-2027', label: '2026-2027' },
];

const GenerateReportCardModal: React.FC<GenerateReportCardModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const { branding, navigationLogoAbsolute, loginLogoAbsolute } = useAppBranding();
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => getCurrentTrimester());
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(() => getCurrentAcademicYear());
  const [isGenerating, setIsGenerating] = useState(false);
  /** Après génération PDF : enregistrer en base et rendre visible aux élèves / familles */
  const [publishAfterSave, setPublishAfterSave] = useState(false);

  // Fetch classes
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: adminApi.getClasses,
    enabled: isOpen,
  });

  // Fetch report card data when class is selected
  const { data: reportCardData, isLoading: isLoadingData } = useQuery({
    queryKey: ['report-card-data', selectedClass, selectedPeriod, selectedAcademicYear],
    queryFn: () => adminApi.generateReportCardData({
      classId: selectedClass,
      period: selectedPeriod,
      academicYear: selectedAcademicYear,
    }),
    enabled: isOpen && !!selectedClass && !!selectedPeriod && !!selectedAcademicYear,
  });

  const pdfBranding = useMemo(
    () => ({
      schoolName:
        branding.schoolDisplayName?.trim() || TRANLEFET_DEFAULT_BRANDING.schoolName,
      schoolPhone:
        branding.schoolPhone?.trim() || TRANLEFET_DEFAULT_BRANDING.schoolPhone,
      schoolAddress:
        branding.schoolAddress?.trim() || TRANLEFET_DEFAULT_BRANDING.schoolAddress,
      schoolEmail:
        branding.schoolEmail?.trim() || TRANLEFET_DEFAULT_BRANDING.schoolEmail,
      schoolCode:
        branding.schoolCode?.trim() || TRANLEFET_DEFAULT_BRANDING.schoolCode,
      principalName: branding.schoolPrincipal?.trim() || '',
      studiesDirectorName: branding.studiesDirectorName?.trim() || '',
      logoAbsoluteUrl: navigationLogoAbsolute || loginLogoAbsolute || null,
      city: branding.schoolAddress?.includes('Bouaké')
        ? 'Bouaké'
        : TRANLEFET_DEFAULT_BRANDING.city,
    }),
    [branding, navigationLogoAbsolute, loginLogoAbsolute],
  );

  const periodLabel = useMemo(
    () => periods.find((p) => p.value === selectedPeriod)?.label || selectedPeriod,
    [selectedPeriod],
  );

  // Generate report card mutation
  const generateReportCardMutation = useMutation({
    mutationFn: async () => {
      if (!reportCardData) {
        throw new Error('Données de bulletin non disponibles');
      }

      // Generate PDF for each student
      for (const studentData of reportCardData) {
        await generateTranlefetReportCardPdf(
          studentData as Parameters<typeof generateTranlefetReportCardPdf>[0],
          {
            periodLabel,
            periodKey: selectedPeriod,
            academicYear: selectedAcademicYear,
            branding: pdfBranding,
          },
        );
      }

      const saveResult = await adminApi.saveReportCards({
        classId: selectedClass,
        period: selectedPeriod,
        academicYear: selectedAcademicYear,
        publish: publishAfterSave,
      });

      queryClient.invalidateQueries({ queryKey: ['report-cards'] });
      queryClient.invalidateQueries({ queryKey: ['admin-report-cards-tab'] });
      return { count: reportCardData.length, saveResult };
    },
    onSuccess: ({ count, saveResult }: { count: number; saveResult?: { message?: string } }) => {
      const validationMsg = saveResult?.message ?? ACADEMIC_CHANGE_VALIDATION_MESSAGE;
      toast.success(
        `${count} PDF généré(s). ${validationMsg}`,
        { duration: 8000 }
      );
      handleClose();
    },
    onError: (error: any) => {
      console.error('Error generating report cards:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la génération des bulletins');
    },
    onSettled: () => setIsGenerating(false),
  });

  const handleGenerate = async () => {
    if (!selectedClass) {
      toast.error('Veuillez sélectionner une classe');
      return;
    }
    if (!selectedPeriod) {
      toast.error('Veuillez sélectionner une période');
      return;
    }
    if (!selectedAcademicYear) {
      toast.error('Veuillez sélectionner une année scolaire');
      return;
    }

    setIsGenerating(true);
    generateReportCardMutation.mutate();
  };

  const handleClose = () => {
    setSelectedClass('');
    setSelectedPeriod(getCurrentTrimester());
    setSelectedAcademicYear(getCurrentAcademicYear());
    setPublishAfterSave(false);
    onClose();
  };

  const canGenerate = selectedClass && selectedPeriod && selectedAcademicYear && reportCardData && reportCardData.length > 0;

  const studentsWithoutGrades = useMemo(() => {
    if (!reportCardData) return 0;
    return reportCardData.filter(
      (s: { grades?: unknown[]; courseAverages?: Record<string, { average?: number }> }) => {
        const gradeCount = s.grades?.length ?? 0;
        const hasAverage = s.courseAverages
          ? Object.values(s.courseAverages).some((c) => (c.average ?? 0) > 0)
          : false;
        return gradeCount === 0 && !hasAverage;
      },
    ).length;
  }, [reportCardData]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Génération de Bulletins" size="lg">
      <div className="space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <FiAlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm text-blue-800 font-medium mb-1">Instructions</p>
              <p className="text-sm text-blue-700">
                Sélectionnez une classe, une période et une année scolaire. Le PDF reprend le modèle officiel
                Tranlefet (colonnes Trim. 1–3, bilans lettres/sciences, résumé, distinctions, signatures).
                Pour le <strong>3e trimestre</strong>, les moyennes et rangs des trimestres précédents sont
                inclus automatiquement. L’enregistrement des moyennes en base passe par le{' '}
                <strong>circuit de validation</strong> (prof. principal → éducateur → directeur des
                études). La publication aux familles intervient après approbation.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Classe <span className="text-red-500">*</span>
            </label>
            <FilterDropdown
              options={[
                { value: '', label: 'Sélectionner une classe' },
                ...(classes || []).map((cls: any) => ({
                  value: cls.id,
                  label: `${cls.name} - ${cls.level}`,
                })),
              ]}
              selected={selectedClass}
              onChange={setSelectedClass}
              label="Classe"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Période <span className="text-red-500">*</span>
            </label>
            <FilterDropdown
              options={periods}
              selected={selectedPeriod}
              onChange={setSelectedPeriod}
              label="Période"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Année scolaire <span className="text-red-500">*</span>
            </label>
            <FilterDropdown
              options={academicYears}
              selected={selectedAcademicYear}
              onChange={setSelectedAcademicYear}
              label="Année scolaire"
            />
          </div>
        </div>

        {/* Preview */}
        {isLoadingData && (
          <div className="flex items-center justify-center py-8">
            <FiLoader className="w-6 h-6 animate-spin text-blue-600 mr-3" />
            <span className="text-gray-600">Chargement des données...</span>
          </div>
        )}

        {reportCardData && reportCardData.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <FiUsers className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-800">Aperçu</h3>
            </div>
            <p className="text-sm text-gray-700">
              {reportCardData.length} élève(s) trouvé(s) dans cette classe. Les bulletins seront générés pour tous les élèves.
            </p>
            {studentsWithoutGrades > 0 && (
              <p className="text-sm text-amber-800 mt-2 bg-amber-50 border border-amber-200 rounded-md p-2">
                {studentsWithoutGrades} élève(s) sans note pour <strong>{periodLabel}</strong> ({selectedAcademicYear}).
                Vérifiez l&apos;année et le trimestre, ou rattachez les notes au bon trimestre lors de la saisie.
              </p>
            )}
            {selectedClass && classes && (
              <p className="text-sm text-gray-600 mt-2">
                Classe: {classes.find((c: any) => c.id === selectedClass)?.name}
              </p>
            )}
          </div>
        )}

        {reportCardData && reportCardData.length === 0 && selectedClass && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <FiAlertCircle className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                Aucun élève trouvé dans cette classe pour la période sélectionnée.
              </p>
            </div>
          </div>
        )}

        <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 bg-gray-50/80 p-3">
          <input
            type="checkbox"
            className="mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500"
            checked={publishAfterSave}
            onChange={(e) => setPublishAfterSave(e.target.checked)}
          />
          <span>
            <span className="text-sm font-semibold text-gray-900">Publier les bulletins</span>
            <span className="block text-xs text-gray-600 mt-0.5">
              Sinon ils restent en brouillon : visibles uniquement dans l’administration jusqu’à publication manuelle.
            </span>
          </span>
        </label>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={handleClose} disabled={isGenerating}>
            Annuler
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className="bg-green-600 hover:bg-green-700"
          >
            {isGenerating ? (
              <>
                <FiLoader className="w-4 h-4 mr-2 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <FiFileText className="w-4 h-4 mr-2" />
                Générer les bulletins
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default GenerateReportCardModal;

