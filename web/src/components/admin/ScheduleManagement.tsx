/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import FilterDropdown from '../ui/FilterDropdown';
import SearchBar from '../ui/SearchBar';
import ScheduleDetailsModal from './ScheduleDetailsModal';
import toast from 'react-hot-toast';
import {
  FiCalendar,
  FiPlus,
  FiEdit,
  FiTrash2,
  FiClock,
  FiMapPin,
  FiCheck,
  FiRefreshCw,
  FiEye,
  FiDownload,
  FiFileText,
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
];

import { DEFAULT_SCHEDULE_START, SCHEDULE_TIME_SLOTS } from '../../lib/scheduleTimeSlots';

const getTeacherDisplayName = (teacher?: any) =>
  teacher?.user ? `${teacher.user.firstName ?? ''} ${teacher.user.lastName ?? ''}`.trim() : '';

type ScheduleManagementProps = {
  compact?: boolean;
};

const ScheduleManagement = ({ compact = false }: ScheduleManagementProps) => {
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [availabilityTeacherId, setAvailabilityTeacherId] = useState<string>('');
  const [availabilityForm, setAvailabilityForm] = useState({
    dayOfWeek: '1',
    startTime: DEFAULT_SCHEDULE_START,
    endTime: '09:00',
    label: '',
  });
  const [roomBlockForm, setRoomBlockForm] = useState({
    room: '',
    dayOfWeek: '1',
    startTime: DEFAULT_SCHEDULE_START,
    endTime: '09:00',
    reason: '',
  });
  const [scheduleForm, setScheduleForm] = useState({
    classId: '',
    courseId: '',
    dayOfWeek: '1',
    startTime: DEFAULT_SCHEDULE_START,
    endTime: '09:00',
    room: '',
    substituteTeacherId: '',
    replacementNote: '',
  });

  const queryClient = useQueryClient();

  // Fetch data
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['admin-schedules', selectedClass],
    queryFn: () => adminApi.getSchedules(selectedClass !== 'all' ? { classId: selectedClass } : {}),
    refetchInterval: 15000,
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: adminApi.getClasses,
  });

  const { data: courses } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: () => adminApi.getAllCourses(),
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: adminApi.getTeachers,
  });

  const { data: teacherAvailabilitySlots } = useQuery({
    queryKey: ['teacher-schedule-availability', availabilityTeacherId],
    queryFn: () => adminApi.getTeacherScheduleAvailability(availabilityTeacherId),
    enabled: Boolean(availabilityTeacherId),
  });

  const { data: roomBlocks } = useQuery({
    queryKey: ['schedule-room-blocks'],
    queryFn: adminApi.getScheduleRoomBlocks,
  });

  // Mutations
  const createScheduleMutation = useMutation({
    mutationFn: adminApi.createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-schedules'] });
      toast.success('Emploi du temps créé avec succès');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateSchedule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-schedules'] });
      toast.success('Emploi du temps mis à jour avec succès');
      setIsModalOpen(false);
      setEditingSchedule(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: adminApi.deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-schedules'] });
      toast.success('Emploi du temps supprimé avec succès');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression');
    },
  });

  const autoGenerateMutation = useMutation({
    mutationFn: () =>
      adminApi.autoGenerateSchedules({
        classId: selectedClass,
        clearExisting: false,
      }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-schedules'] });
      const created = result?.created ?? 0;
      const errors = Array.isArray(result?.errors) ? result.errors : [];
      if (created > 0) {
        toast.success(`Génération automatique terminée (${created} créneaux créés)`);
      } else {
        toast('Aucun créneau créé automatiquement');
      }
      if (errors.length > 0) {
        toast.error(errors[0]);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la génération automatique');
    },
  });

  const createAvailabilityMutation = useMutation({
    mutationFn: () =>
      adminApi.createTeacherScheduleAvailability(availabilityTeacherId, {
        dayOfWeek: parseInt(availabilityForm.dayOfWeek, 10),
        startTime: availabilityForm.startTime,
        endTime: availabilityForm.endTime,
        label: availabilityForm.label || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-schedule-availability', availabilityTeacherId] });
      setAvailabilityForm({ dayOfWeek: '1', startTime: DEFAULT_SCHEDULE_START, endTime: '09:00', label: '' });
      toast.success('Disponibilité ajoutée');
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Erreur disponibilité'),
  });

  const deleteAvailabilityMutation = useMutation({
    mutationFn: (slotId: string) => adminApi.deleteTeacherScheduleAvailability(availabilityTeacherId, slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-schedule-availability', availabilityTeacherId] });
      toast.success('Disponibilité supprimée');
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Erreur suppression'),
  });

  const createRoomBlockMutation = useMutation({
    mutationFn: () =>
      adminApi.createScheduleRoomBlock({
        room: roomBlockForm.room,
        dayOfWeek: parseInt(roomBlockForm.dayOfWeek, 10),
        startTime: roomBlockForm.startTime,
        endTime: roomBlockForm.endTime,
        reason: roomBlockForm.reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-room-blocks'] });
      setRoomBlockForm({ room: '', dayOfWeek: '1', startTime: DEFAULT_SCHEDULE_START, endTime: '09:00', reason: '' });
      toast.success('Bloc salle ajouté');
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Erreur bloc salle'),
  });

  const deleteRoomBlockMutation = useMutation({
    mutationFn: (blockId: string) => adminApi.deleteScheduleRoomBlock(blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-room-blocks'] });
      toast.success('Bloc salle supprimé');
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Erreur suppression'),
  });

  const resetForm = () => {
    setScheduleForm({
      classId: '',
      courseId: '',
      dayOfWeek: '1',
      startTime: DEFAULT_SCHEDULE_START,
      endTime: '09:00',
      room: '',
      substituteTeacherId: '',
      replacementNote: '',
    });
  };

  const handleSubmit = () => {
    if (!scheduleForm.classId || !scheduleForm.courseId) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    if (editingSchedule) {
      updateScheduleMutation.mutate({ id: editingSchedule.id, data: scheduleForm });
    } else {
      createScheduleMutation.mutate(scheduleForm);
    }
  };

  const handleView = (schedule: any) => {
    setSelectedScheduleId(schedule.id);
    setIsDetailsModalOpen(true);
  };

  const handleEdit = (schedule: any) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      classId: schedule.classId,
      courseId: schedule.courseId,
      dayOfWeek: schedule.dayOfWeek.toString(),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      room: schedule.room || '',
      substituteTeacherId: schedule.substituteTeacherId || '',
      replacementNote: schedule.replacementNote || '',
    });
    setIsModalOpen(true);
    setIsDetailsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet emploi du temps ?')) {
      deleteScheduleMutation.mutate(id);
    }
  };

  // Obtenir toutes les salles uniques
  const uniqueRooms: string[] = Array.from(
    new Set((schedules || []).map((s: any) => s.room).filter(Boolean) as string[]),
  ).sort();

  // Filtrer les emplois du temps
  let filteredSchedulesList = schedules || [];

  // Filtre par classe
  if (selectedClass !== 'all') {
    filteredSchedulesList = filteredSchedulesList.filter(
      (s: any) => s.classId === selectedClass
    );
  }

  // Filtre par enseignant
  if (selectedTeacher !== 'all') {
    filteredSchedulesList = filteredSchedulesList.filter(
      (s: any) => s.course?.teacher?.id === selectedTeacher || s.substituteTeacher?.id === selectedTeacher
    );
  }

  // Filtre par salle
  if (selectedRoom !== 'all') {
    filteredSchedulesList = filteredSchedulesList.filter(
      (s: any) => s.room === selectedRoom
    );
  }

  // Filtre par recherche
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredSchedulesList = filteredSchedulesList.filter(
      (s: any) =>
        s.course?.name?.toLowerCase().includes(query) ||
        s.class?.name?.toLowerCase().includes(query) ||
        s.course?.teacher?.user?.firstName?.toLowerCase().includes(query) ||
        s.course?.teacher?.user?.lastName?.toLowerCase().includes(query) ||
        s.room?.toLowerCase().includes(query)
    );
  }

  // Organiser les horaires par jour et classe
  const organizedSchedules = filteredSchedulesList.reduce((acc: any, schedule: any) => {
    const dayKey = schedule.dayOfWeek;
    const classKey = schedule.class?.name || 'Autre';

    if (!acc[classKey]) {
      acc[classKey] = {};
    }
    if (!acc[classKey][dayKey]) {
      acc[classKey][dayKey] = [];
    }
    acc[classKey][dayKey].push(schedule);
    return acc;
  }, {});

  // Export functions
  const exportSchedulesToCSV = () => {
    try {
      const headers = ['Jour', 'Heure', 'Matière', 'Classe', 'Enseignant', 'Remplaçant', 'Note remplacement', 'Salle'];
      const csvContent =
        '\ufeff' + // BOM for UTF-8
        headers.join(';') +
        '\n' +
        (filteredSchedulesList || [])
          .map((s: any) =>
            [
              DAYS.find((d) => d.value === s.dayOfWeek)?.label || 'Inconnu',
              `${s.startTime} - ${s.endTime}`,
              s.course?.name || 'N/A',
              s.class?.name || 'N/A',
              s.course?.teacher?.user
                ? `${s.course.teacher.user.firstName} ${s.course.teacher.user.lastName}`
                : 'N/A',
              getTeacherDisplayName(s.substituteTeacher) || '—',
              s.replacementNote || '—',
              s.room || 'N/A',
            ].join(';')
          )
          .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `emploi-du-temps-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Emploi du temps exporté en CSV avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const exportSchedulesToJSON = () => {
    try {
      const jsonData = {
        dateExport: format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        emploisDuTemps: (filteredSchedulesList || []).map((s: any) => ({
          jour: DAYS.find((d) => d.value === s.dayOfWeek)?.label || 'Inconnu',
          heureDebut: s.startTime,
          heureFin: s.endTime,
          matiere: s.course?.name || 'N/A',
          codeMatiere: s.course?.code || 'N/A',
          classe: s.class?.name || 'N/A',
          niveau: s.class?.level || 'N/A',
          enseignant: s.course?.teacher?.user
            ? `${s.course.teacher.user.firstName} ${s.course.teacher.user.lastName}`
            : 'N/A',
          emailEnseignant: s.course?.teacher?.user?.email || 'N/A',
          remplacant: getTeacherDisplayName(s.substituteTeacher) || null,
          noteRemplacement: s.replacementNote || null,
          salle: s.room || 'N/A',
        })),
      };

      const jsonString = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `emploi-du-temps-${format(new Date(), 'yyyy-MM-dd')}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Emploi du temps exporté en JSON avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export JSON:', error);
      toast.error('Erreur lors de l\'export JSON');
    }
  };

  const exportSchedulesToPDF = () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const currentDate = new Date().toLocaleDateString('fr-FR');

      doc.setFontSize(20);
      doc.setTextColor(249, 115, 22);
      doc.text('School Manager', 14, 20);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Emploi du Temps', 14, 30);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Généré le ${currentDate}`, 14, 37);

      const runAutoTable = (options: any) => {
        if (typeof (doc as any).autoTable === 'function') {
          (doc as any).autoTable(options);
        } else if (typeof autoTable === 'function') {
          autoTable(doc, options);
        } else {
          throw new Error('autoTable is not available');
        }
      };

      const tableData = (filteredSchedulesList || []).map((s: any) => [
        DAYS.find((d) => d.value === s.dayOfWeek)?.label || 'Inconnu',
        `${s.startTime} - ${s.endTime}`,
        s.course?.name || 'N/A',
        s.class?.name || 'N/A',
        s.course?.teacher?.user
          ? `${s.course.teacher.user.firstName} ${s.course.teacher.user.lastName}`
          : 'N/A',
        getTeacherDisplayName(s.substituteTeacher) || '—',
        s.replacementNote || '—',
        s.room || 'N/A',
      ]);

      runAutoTable({
        startY: 45,
        head: [['Jour', 'Heure', 'Matière', 'Classe', 'Enseignant', 'Remplaçant', 'Note', 'Salle']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });

      doc.save(`emploi-du-temps-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Emploi du temps exporté en PDF avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de l\'export PDF:', error);
      toast.error(`Erreur lors de l'export PDF: ${error.message || 'Erreur inconnue'}`);
    }
  };
  return (
    <div className={`space-y-6 ${compact ? 'text-xs' : 'text-sm'}`}>
      {/* Header */}
      <Card
        className={`relative z-50 overflow-visible bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 text-white transform-gpu perspective-1000 ${
          compact ? 'p-3 sm:p-4' : ''
        }`}
      >
        {/* Effet 3D de fond animé */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        
        {/* Ombres 3D */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 30% 30%, rgba(255, 255, 255, 0.2) 0%, transparent 50%)',
            mixBlendMode: 'overlay',
          }}
        ></div>
        
        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="transform-gpu min-w-0" style={{ transform: 'translateZ(20px)' }}>
            <h2 
              className={
                compact
                  ? 'text-lg font-black mb-0.5 relative leading-tight'
                  : 'text-2xl font-black mb-1.5 relative'
              }
              style={{
                textShadow: '0 4px 8px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 255, 255, 0.2)',
                transform: 'perspective(500px) rotateX(2deg)',
              }}
            >
              Emploi du Temps
            </h2>
            <p
              className={
                compact
                  ? 'text-orange-100 text-[11px] leading-snug'
                  : 'text-orange-100 text-sm'
              }
              style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}
            >
              Calendrier interactif et gestion intelligente des cours
            </p>
          </div>
          <div className={`flex items-center shrink-0 ${compact ? 'gap-2' : 'space-x-3'}`}>
            <div className="relative">
              <Button
                variant="outline"
                size={compact ? 'sm' : 'md'}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                onClick={() => {
                  const menu = document.getElementById('export-schedule-menu');
                  menu?.classList.toggle('hidden');
                }}
              >
                <FiDownload className="w-4 h-4 mr-2" />
                Exporter
              </Button>
              <div
                id="export-schedule-menu"
                className="hidden absolute right-0 top-full z-[60] mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg"
              >
                <button
                  onClick={() => {
                    exportSchedulesToCSV();
                    document.getElementById('export-schedule-menu')?.classList.add('hidden');
                  }}
                  className="flex w-full items-center space-x-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100"
                >
                  <FiFileText className="h-3.5 w-3.5 shrink-0 text-green-600" />
                  <span>Exporter en CSV</span>
                </button>
                <button
                  onClick={() => {
                    exportSchedulesToJSON();
                    document.getElementById('export-schedule-menu')?.classList.add('hidden');
                  }}
                  className="flex w-full items-center space-x-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100"
                >
                  <FiFileText className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                  <span>Exporter en JSON</span>
                </button>
                <button
                  onClick={() => {
                    exportSchedulesToPDF();
                    document.getElementById('export-schedule-menu')?.classList.add('hidden');
                  }}
                  className="flex w-full items-center space-x-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100"
                >
                  <FiFileText className="h-3.5 w-3.5 shrink-0 text-red-600" />
                  <span>Exporter en PDF</span>
                </button>
              </div>
            </div>
            <Button
              variant="outline"
              size={compact ? 'sm' : 'md'}
              onClick={() => {
                if (selectedClass === 'all') {
                  toast.error('Sélectionnez une classe pour la génération automatique');
                  return;
                }
                autoGenerateMutation.mutate();
              }}
              disabled={autoGenerateMutation.isPending}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <FiRefreshCw className={`w-4 h-4 mr-2 ${autoGenerateMutation.isPending ? 'animate-spin' : ''}`} />
              Auto
            </Button>
            <Button
              size={compact ? 'sm' : 'md'}
              onClick={() => {
                resetForm();
                setEditingSchedule(null);
                setIsModalOpen(true);
              }}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <FiPlus className="w-4 h-4 mr-2" />
              Nouvel horaire
            </Button>
          </div>
        </div>
      </Card>

      {/* Filters — z-40 pour que les déroulants passent au-dessus du tableau (cartes suivantes en z-10) */}
      <Card className="relative z-40">
        <div className="space-y-4">
          <SearchBar
            compact={compact}
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Rechercher par matière, classe, enseignant ou salle..."
          />
          <div className="flex flex-col md:flex-row gap-4">
            <FilterDropdown
              compact={compact}
              label="Classe"
              value={selectedClass}
              onChange={setSelectedClass}
              options={[
                { value: 'all', label: 'Toutes les classes' },
                ...(classes?.map((c: any) => ({ value: c.id, label: c.name })) || []),
              ]}
            />
            <FilterDropdown
              compact={compact}
              label="Enseignant"
              value={selectedTeacher}
              onChange={setSelectedTeacher}
              options={[
                { value: 'all', label: 'Tous les enseignants' },
                ...(teachers?.map((t: any) => ({
                  value: t.id,
                  label: `${t.user?.firstName} ${t.user?.lastName}`,
                })) || []),
              ]}
            />
            <FilterDropdown
              compact={compact}
              label="Salle"
              value={selectedRoom}
              onChange={setSelectedRoom}
              options={[
                { value: 'all', label: 'Toutes les salles' },
                ...(uniqueRooms.map((r) => ({ value: r, label: r }))),
              ]}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 relative z-40">
        <Card>
          <h3 className="mb-3 font-semibold text-gray-800">Disponibilités enseignants</h3>
          <div className="space-y-3">
            <FilterDropdown
              variant="field"
              label="Enseignant"
              value={availabilityTeacherId}
              onChange={setAvailabilityTeacherId}
              options={[
                { value: '', label: 'Sélectionner un enseignant' },
                ...(teachers?.map((t: any) => ({
                  value: t.id,
                  label: `${t.user?.firstName} ${t.user?.lastName}`,
                })) || []),
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <FilterDropdown
                variant="field"
                label="Jour"
                value={availabilityForm.dayOfWeek}
                onChange={(value) => setAvailabilityForm({ ...availabilityForm, dayOfWeek: value })}
                options={DAYS.map((d) => ({ value: String(d.value), label: d.label }))}
              />
              <Input
                value={availabilityForm.label}
                onChange={(e) => setAvailabilityForm({ ...availabilityForm, label: e.target.value })}
                placeholder="Label (optionnel)"
              />
              <FilterDropdown
                variant="field"
                label="Début"
                value={availabilityForm.startTime}
                onChange={(value) => setAvailabilityForm({ ...availabilityForm, startTime: value })}
                options={SCHEDULE_TIME_SLOTS.map((t) => ({ value: t, label: t }))}
              />
              <FilterDropdown
                variant="field"
                label="Fin"
                value={availabilityForm.endTime}
                onChange={(value) => setAvailabilityForm({ ...availabilityForm, endTime: value })}
                options={SCHEDULE_TIME_SLOTS.filter((t) => t > availabilityForm.startTime).map((t) => ({ value: t, label: t }))}
              />
            </div>
            <Button
              onClick={() => {
                if (!availabilityTeacherId) {
                  toast.error('Choisissez un enseignant');
                  return;
                }
                createAvailabilityMutation.mutate();
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Ajouter disponibilité
            </Button>
            <div className="max-h-44 overflow-y-auto rounded border border-gray-200 p-2 text-xs">
              {(teacherAvailabilitySlots || []).length === 0 ? (
                <p className="text-gray-500">Aucun créneau déclaré.</p>
              ) : (
                (teacherAvailabilitySlots || []).map((slot: any) => (
                  <div key={slot.id} className="mb-1 flex items-center justify-between rounded bg-gray-50 px-2 py-1">
                    <span>
                      {DAYS.find((d) => d.value === slot.dayOfWeek)?.label} {slot.startTime}-{slot.endTime}
                      {slot.label ? ` (${slot.label})` : ''}
                    </span>
                    <button
                      onClick={() => deleteAvailabilityMutation.mutate(slot.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <FiTrash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 font-semibold text-gray-800">Indisponibilités salles</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={roomBlockForm.room}
                onChange={(e) => setRoomBlockForm({ ...roomBlockForm, room: e.target.value })}
                placeholder="Salle (ex: A101)"
              />
              <FilterDropdown
                variant="field"
                label="Jour"
                value={roomBlockForm.dayOfWeek}
                onChange={(value) => setRoomBlockForm({ ...roomBlockForm, dayOfWeek: value })}
                options={DAYS.map((d) => ({ value: String(d.value), label: d.label }))}
              />
              <FilterDropdown
                variant="field"
                label="Début"
                value={roomBlockForm.startTime}
                onChange={(value) => setRoomBlockForm({ ...roomBlockForm, startTime: value })}
                options={SCHEDULE_TIME_SLOTS.map((t) => ({ value: t, label: t }))}
              />
              <FilterDropdown
                variant="field"
                label="Fin"
                value={roomBlockForm.endTime}
                onChange={(value) => setRoomBlockForm({ ...roomBlockForm, endTime: value })}
                options={SCHEDULE_TIME_SLOTS.filter((t) => t > roomBlockForm.startTime).map((t) => ({ value: t, label: t }))}
              />
              <div className="col-span-2">
                <Input
                  value={roomBlockForm.reason}
                  onChange={(e) => setRoomBlockForm({ ...roomBlockForm, reason: e.target.value })}
                  placeholder="Motif (maintenance, examen...)"
                />
              </div>
            </div>
            <Button
              onClick={() => {
                if (!roomBlockForm.room.trim()) {
                  toast.error('Renseignez une salle');
                  return;
                }
                createRoomBlockMutation.mutate();
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Ajouter bloc salle
            </Button>
            <div className="max-h-44 overflow-y-auto rounded border border-gray-200 p-2 text-xs">
              {(roomBlocks || []).length === 0 ? (
                <p className="text-gray-500">Aucun bloc salle.</p>
              ) : (
                (roomBlocks || []).map((block: any) => (
                  <div key={block.id} className="mb-1 flex items-center justify-between rounded bg-gray-50 px-2 py-1">
                    <span>
                      {block.roomKey} - {DAYS.find((d) => d.value === block.dayOfWeek)?.label}{' '}
                      {block.startTime}-{block.endTime}
                      {block.reason ? ` (${block.reason})` : ''}
                    </span>
                    <button
                      onClick={() => deleteRoomBlockMutation.mutate(block.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <FiTrash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Schedule Display */}
      {isLoading ? (
        <Card>
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            <p className={compact ? 'mt-4 text-xs text-gray-600' : 'mt-4 text-sm text-gray-600'}>
              Chargement des emplois du temps...
            </p>
          </div>
        </Card>
      ) : Object.keys(organizedSchedules).length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FiCalendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className={compact ? 'text-xs text-gray-600' : 'text-sm text-gray-600'}>
              Aucun emploi du temps configuré
            </p>
            <Button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="mt-4"
            >
              <FiPlus className="w-4 h-4 mr-2" />
              Créer le premier horaire
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(organizedSchedules).map(([className, days]: [string, any]) => (
            <Card 
              key={className}
              className="relative z-10 overflow-hidden group perspective-3d transform-gpu transition-all duration-300 hover:shadow-2xl"
              style={{
                transform: 'translateZ(0)',
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Effet 3D de fond animé */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Ombres 3D */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(249, 115, 22, 0.1) 0%, transparent 70%)',
                  transform: 'translateZ(-30px)',
                  filter: 'blur(30px)',
                }}
              ></div>
              
              <div className="relative z-10">
                <div className="mb-4 flex items-center justify-between">
                  <h3 
                    className={
                      compact
                        ? 'text-base font-bold text-gray-800 relative'
                        : 'text-lg font-bold text-gray-800 relative'
                    }
                    style={{
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      transform: 'perspective(300px) translateZ(10px)',
                    }}
                  >
                    {className}
                  </h3>
                  <Badge 
                    className="bg-gradient-to-r from-orange-500 to-amber-500 px-2 py-0.5 text-xs text-white shadow-lg transform-gpu transition-transform duration-300 hover:scale-110"
                    style={{
                      boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                      transform: 'translateZ(10px)',
                    }}
                  >
                    {Object.values(days).flat().length} cours
                  </Badge>
                </div>

              {/* Weekly Schedule Grid */}
              <div className="overflow-x-auto">
                <table className={compact ? 'w-full border-collapse text-[11px]' : 'w-full border-collapse text-xs'}>
                  <thead>
                    <tr>
                      <th 
                        className="relative border border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200 px-1.5 py-1.5 text-[11px] font-semibold text-gray-700 sm:text-xs"
                        style={{
                          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 0 rgba(255, 255, 255, 0.5)',
                          transform: 'perspective(200px) rotateX(5deg)',
                        }}
                      >
                        Heure
                      </th>
                      {DAYS.map((day) => (
                        <th
                          key={day.value}
                          className="relative min-w-[118px] border border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200 px-1.5 py-1.5 text-[11px] font-semibold text-gray-700 sm:min-w-[128px] sm:text-xs"
                          style={{
                            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 0 rgba(255, 255, 255, 0.5)',
                            transform: 'perspective(200px) rotateX(5deg)',
                          }}
                        >
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SCHEDULE_TIME_SLOTS.map((time, idx) => {
                      if (idx % 2 !== 0) return null; // Afficher seulement les heures pleines
                      return (
                        <tr key={time}>
                          <td 
                            className={
                              compact
                                ? 'relative border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-1.5 text-[11px] font-medium text-gray-600'
                                : 'relative border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-1.5 text-xs font-medium text-gray-600'
                            }
                            style={{
                              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                            }}
                          >
                            {time}
                          </td>
                          {DAYS.map((day) => {
                            const scheduleForSlot = days[day.value]?.find((s: any) => {
                              const start = s.startTime;
                              const end = s.endTime;
                              return start <= time && end > time;
                            });

                            return (
                              <td
                                key={day.value}
                                className="border border-gray-200 p-1 align-top sm:p-1.5"
                              >
                                {scheduleForSlot ? (
                                  <div 
                                    className="relative mb-1 cursor-pointer rounded-lg border-2 border-orange-300 bg-gradient-to-br from-orange-100 via-amber-50 to-orange-50 p-1.5 transform-gpu transition-all duration-300 group/course hover:scale-[1.02] hover:shadow-xl sm:p-2"
                                    style={{
                                      boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                                      transform: 'perspective(500px) translateZ(0) rotateX(2deg)',
                                      transformStyle: 'preserve-3d',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'perspective(500px) translateZ(15px) rotateX(0deg) scale(1.02)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'perspective(500px) translateZ(0) rotateX(2deg) scale(1)';
                                    }}
                                  >
                                    {/* Effet de brillance 3D */}
                                    <div 
                                      className="absolute inset-0 opacity-0 group-hover/course:opacity-100 transition-opacity duration-300 rounded-lg"
                                      style={{
                                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%)',
                                        mixBlendMode: 'overlay',
                                      }}
                                    ></div>
                                    
                                    {/* Ombres 3D au survol */}
                                    <div 
                                      className="absolute inset-0 opacity-0 group-hover/course:opacity-100 transition-opacity duration-300 rounded-lg"
                                      style={{
                                        background: 'radial-gradient(ellipse at 30% 30%, rgba(249, 115, 22, 0.2) 0%, transparent 70%)',
                                        transform: 'translateZ(-10px)',
                                        filter: 'blur(10px)',
                                      }}
                                    ></div>
                                    
                                    <div className="relative z-10 flex items-start justify-between">
                                      <div className="flex-1">
                                        <p 
                                          className={
                                            compact
                                              ? 'relative text-[11px] font-bold leading-snug text-gray-800'
                                              : 'relative text-xs font-bold leading-snug text-gray-800 sm:text-[13px]'
                                          }
                                          style={{
                                            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                            transform: 'translateZ(5px)',
                                          }}
                                        >
                                          {scheduleForSlot.course?.name}
                                        </p>
                                        <p
                                          className={
                                            compact
                                              ? 'mt-0.5 text-[10px] leading-snug text-gray-600'
                                              : 'mt-0.5 text-[11px] leading-snug text-gray-600'
                                          }
                                        >
                                          {getTeacherDisplayName(scheduleForSlot.substituteTeacher) ||
                                            getTeacherDisplayName(scheduleForSlot.course?.teacher)}
                                        </p>
                                        {scheduleForSlot.substituteTeacher && (
                                          <p className="mt-0.5 text-[10px] text-amber-700">
                                            Remplacement
                                          </p>
                                        )}
                                        {scheduleForSlot.room && (
                                          <div className="mt-0.5 flex items-center text-[10px] text-gray-500">
                                            <FiMapPin className="mr-0.5 h-2.5 w-2.5 shrink-0" />
                                            {scheduleForSlot.room}
                                          </div>
                                        )}
                                        <div className="mt-0.5 flex items-center text-[10px] text-gray-500">
                                          <FiClock className="mr-0.5 h-2.5 w-2.5 shrink-0" />
                                          {scheduleForSlot.startTime} - {scheduleForSlot.endTime}
                                        </div>
                                      </div>
                                      <div className="ml-1 flex shrink-0 items-center space-x-0.5">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleView(scheduleForSlot);
                                          }}
                                          className="rounded-md p-1 text-green-600 transition-all duration-200 transform-gpu hover:scale-110 hover:bg-green-100 hover:shadow-md"
                                          style={{
                                            boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)',
                                          }}
                                          title="Voir les détails"
                                        >
                                          <FiEye className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEdit(scheduleForSlot);
                                          }}
                                          className="rounded-md p-1 text-blue-600 transition-all duration-200 transform-gpu hover:scale-110 hover:bg-blue-100 hover:shadow-md"
                                          style={{
                                            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                                          }}
                                          title="Modifier"
                                        >
                                          <FiEdit className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(scheduleForSlot.id);
                                          }}
                                          className="rounded-md p-1 text-red-600 transition-all duration-200 transform-gpu hover:scale-110 hover:bg-red-100 hover:shadow-md"
                                          style={{
                                            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
                                          }}
                                          title="Supprimer"
                                        >
                                          <FiTrash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div 
                                    className="h-12 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50 opacity-50 sm:h-14"
                                    style={{
                                      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
                                    }}
                                  ></div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Styles CSS pour les effets 3D */}
      <style>{`
        @keyframes float3d {
          0%, 100% {
            transform: translateY(0px) translateZ(0);
          }
          50% {
            transform: translateY(-10px) translateZ(10px);
          }
        }
        
        .perspective-3d {
          perspective: 1000px;
        }
        
        .perspective-1000 {
          perspective: 1000px;
        }
        
        .transform-gpu {
          transform: translateZ(0);
          will-change: transform;
          backface-visibility: hidden;
        }
      `}</style>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSchedule(null);
          resetForm();
        }}
        title={editingSchedule ? 'Modifier l\'horaire' : 'Nouvel horaire'}
        size="lg"
        compact
      >
        <div className="space-y-4 text-sm">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
              Classe <span className="text-red-500">*</span>
            </label>
            <FilterDropdown
              variant="field"
              label="Classe"
              value={scheduleForm.classId}
              onChange={(value) => setScheduleForm({ ...scheduleForm, classId: value })}
              options={[
                { value: '', label: 'Sélectionner une classe' },
                ...(classes?.map((c: any) => ({ value: c.id, label: c.name })) || []),
              ]}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
              Matière <span className="text-red-500">*</span>
            </label>
            <FilterDropdown
              variant="field"
              label="Matière"
              value={scheduleForm.courseId}
              onChange={(value) => setScheduleForm({ ...scheduleForm, courseId: value })}
              options={[
                { value: '', label: 'Sélectionner une matière' },
                ...(courses?.map((c: any) => ({ value: c.id, label: c.name })) || []),
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                Jour <span className="text-red-500">*</span>
              </label>
              <FilterDropdown
                variant="field"
                label="Jour"
                value={scheduleForm.dayOfWeek}
                onChange={(value) => setScheduleForm({ ...scheduleForm, dayOfWeek: value })}
                options={DAYS.map((d) => ({ value: d.value.toString(), label: d.label }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">Salle</label>
              <Input
                value={scheduleForm.room}
                onChange={(e) => setScheduleForm({ ...scheduleForm, room: e.target.value })}
                placeholder="Ex: A101"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">Remplaçant</label>
              <FilterDropdown
                variant="field"
                label="Remplaçant"
                value={scheduleForm.substituteTeacherId}
                onChange={(value) => setScheduleForm({ ...scheduleForm, substituteTeacherId: value })}
                options={[
                  { value: '', label: 'Aucun remplaçant' },
                  ...(teachers?.map((t: any) => ({
                    value: t.id,
                    label: `${t.user?.firstName} ${t.user?.lastName}`,
                  })) || []),
                ]}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">Note de remplacement</label>
              <Input
                value={scheduleForm.replacementNote}
                onChange={(e) => setScheduleForm({ ...scheduleForm, replacementNote: e.target.value })}
                placeholder="Motif ou précision"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                Heure de début <span className="text-red-500">*</span>
              </label>
              <FilterDropdown
                variant="field"
                label="Heure de début"
                value={scheduleForm.startTime}
                onChange={(value) => setScheduleForm({ ...scheduleForm, startTime: value })}
                options={SCHEDULE_TIME_SLOTS.map((t) => ({ value: t, label: t }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                Heure de fin <span className="text-red-500">*</span>
              </label>
              <FilterDropdown
                variant="field"
                label="Heure de fin"
                value={scheduleForm.endTime}
                onChange={(value) => setScheduleForm({ ...scheduleForm, endTime: value })}
                options={SCHEDULE_TIME_SLOTS.filter((t) => t > scheduleForm.startTime).map((t) => ({
                  value: t,
                  label: t,
                }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                setEditingSchedule(null);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createScheduleMutation.isPending || updateScheduleMutation.isPending
              }
              className="bg-orange-600 hover:bg-orange-700"
            >
              {createScheduleMutation.isPending || updateScheduleMutation.isPending ? (
                <>
                  <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {editingSchedule ? 'Mise à jour...' : 'Création...'}
                </>
              ) : (
                <>
                  <FiCheck className="w-4 h-4 mr-2" />
                  {editingSchedule ? 'Modifier' : 'Créer'}
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Schedule Details Modal */}
      <ScheduleDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedScheduleId(null);
        }}
        scheduleId={selectedScheduleId}
        onEdit={() => {
          if (selectedScheduleId) {
            const schedule = schedules?.find((s: any) => s.id === selectedScheduleId);
            if (schedule) {
              handleEdit(schedule);
            }
          }
        }}
      />
    </div>
  );

};

export default ScheduleManagement;
