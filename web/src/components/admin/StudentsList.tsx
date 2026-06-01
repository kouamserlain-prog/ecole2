import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Table from '../ui/Table';
import SearchBar from '../ui/SearchBar';
import FilterDropdown from '../ui/FilterDropdown';
import Badge from '../ui/Badge';
import Avatar from '../ui/Avatar';
import AddStudentModal from './AddStudentModal';
import StudentDetailsModal from './StudentDetailsModal';
import EditStudentModal from './EditStudentModal';
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiEye,
  FiDownload,
  FiUsers,
  FiChevronDown,
  FiChevronUp,
  FiUserCheck,
  FiUserX,
  FiBook,
  FiArchive,
} from 'react-icons/fi';
import { useSchoolReady, schoolQueryKey } from '../../hooks/useSchoolReady';
import { useSchool } from '../../contexts/SchoolContext';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import {
  ENROLLMENT_STATUS_LABELS,
  enrollmentBadgeVariant,
  type EnrollmentStatusValue,
} from '../../lib/enrollmentStatus';
import {
  STATE_ASSIGNMENT_LABELS,
  normalizeStateAssignment,
  stateAssignmentBadgeVariant,
} from '../../lib/stateAssignment';
import {
  buildClassMetaFromApi,
  downloadClassRosterCsv,
  downloadClassRosterPdf,
  mapApiStudentToRosterRow,
  type ClassRosterMeta,
} from '../../lib/classRosterExport';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { canDeleteStudentsOrClasses } from '@/lib/staffDeletionPolicy';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface StudentsListProps {
  searchQuery?: string;
  /** Affiche un filtre par classe (affectation des élèves) */
  showClassFilter?: boolean;
  /** Typographie plus petite (ex. onglet Gestion académique) */
  compact?: boolean;
}

const StudentsList: React.FC<StudentsListProps> = ({
  searchQuery = '',
  showClassFilter = false,
  compact = false,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const allowStudentDelete = canDeleteStudentsOrClasses(user);
  const [searchTerm, setSearchTerm] = useState(searchQuery);
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateAssignmentFilter, setStateAssignmentFilter] = useState('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [groupByClass, setGroupByClass] = useState(true);

  useEffect(() => {
    if (searchQuery) setSearchTerm(searchQuery);
  }, [searchQuery]);

  const { activeSchoolId, activeSchool } = useSchool();
  const schoolReady = useSchoolReady();

  const { data: students, isLoading } = useQuery({
    queryKey: schoolQueryKey(['students'], activeSchoolId),
    queryFn: adminApi.getStudents,
    enabled: schoolReady,
  });

  const { data: classesForFilter } = useQuery({
    queryKey: schoolQueryKey(['classes'], activeSchoolId),
    queryFn: adminApi.getClasses,
    enabled: (showClassFilter || groupByClass) && schoolReady,
  });

  const deleteStudentMutation = useMutation({
    mutationFn: adminApi.deleteStudent,
    onSuccess: (_data, deletedStudentId) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.removeQueries({ queryKey: ['student', deletedStudentId] });
      if (selectedStudentId === deletedStudentId) {
        setIsDetailsModalOpen(false);
        setSelectedStudentId(null);
      }
      if (editingStudentId === deletedStudentId) {
        setIsEditModalOpen(false);
        setEditingStudentId(null);
      }
      toast.success('Élève supprimé avec succès');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Erreur lors de la suppression de l'élève");
    },
  });

  const handleViewStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsDetailsModalOpen(true);
  };

  const handleEditStudent = (studentId: string) => {
    setEditingStudentId(studentId);
    setIsEditModalOpen(true);
  };

  const handleDeleteStudent = (studentId: string, studentName: string) => {
    if (
      window.confirm(
        `Êtes-vous sûr de vouloir supprimer l'élève "${studentName}" ?\n\nCette action est irréversible.`
      )
    ) {
      deleteStudentMutation.mutate(studentId);
    }
  };

  const filteredStudents = students?.filter((student: any) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      student.user.firstName.toLowerCase().includes(term) ||
      student.user.lastName.toLowerCase().includes(term) ||
      student.user.email.toLowerCase().includes(term) ||
      (student.studentId && student.studentId.toLowerCase().includes(term));
    const es = (student.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE';
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'ACTIVE' && es === 'ACTIVE') ||
      (statusFilter === 'SUSPENDED' && es === 'SUSPENDED') ||
      (statusFilter === 'GRADUATED' && es === 'GRADUATED') ||
      (statusFilter === 'ARCHIVED' && es === 'ARCHIVED');
    const sa = normalizeStateAssignment(student.stateAssignment);
    const matchesStateAssignment =
      stateAssignmentFilter === 'all' ||
      (stateAssignmentFilter === 'STATE_ASSIGNED' && sa === 'STATE_ASSIGNED') ||
      (stateAssignmentFilter === 'NOT_STATE_ASSIGNED' && sa === 'NOT_STATE_ASSIGNED');
    const matchesClass =
      !showClassFilter ||
      classFilter === 'all' ||
      (classFilter === 'unassigned' && !student.classId) ||
      (classFilter !== 'unassigned' && student.classId === classFilter);
    return matchesSearch && matchesStatus && matchesStateAssignment && matchesClass;
  });

  const UNASSIGNED_CLASS_LABEL = 'Non assigné';

  const sortStudentsByName = (a: any, b: any) => {
    const nameA = `${a.user.lastName} ${a.user.firstName}`;
    const nameB = `${b.user.lastName} ${b.user.firstName}`;
    return nameA.localeCompare(nameB);
  };

  const studentsByClass = useMemo(() => {
    if (!filteredStudents || !groupByClass) return null;
    const assignedGrouped: { [key: string]: any[] } = {};
    filteredStudents.forEach((student: any) => {
      if (!student.classId) return;
      const className = student.class?.name || 'Classe inconnue';
      if (!assignedGrouped[className]) assignedGrouped[className] = [];
      assignedGrouped[className].push(student);
    });
    const assignedSortedClasses = Object.keys(assignedGrouped).sort((a, b) =>
      a.localeCompare(b)
    );
    assignedSortedClasses.forEach((className) => {
      assignedGrouped[className].sort(sortStudentsByName);
    });
    const unassignedStudents = filteredStudents
      .filter((s: any) => !s.classId)
      .sort(sortStudentsByName);
    return { assignedGrouped, assignedSortedClasses, unassignedStudents };
  }, [filteredStudents, groupByClass]);

  const { assignedToClassList, notAssignedToClassList } = useMemo(() => {
    const list = filteredStudents || [];
    return {
      assignedToClassList: list.filter((s: any) => !!s.classId),
      notAssignedToClassList: list.filter((s: any) => !s.classId),
    };
  }, [filteredStudents]);

  useEffect(() => {
    if (!groupByClass || !studentsByClass) return;
    const { assignedSortedClasses, unassignedStudents } = studentsByClass;
    const toExpand = new Set<string>(assignedSortedClasses);
    if (unassignedStudents.length > 0) toExpand.add(UNASSIGNED_CLASS_LABEL);
    if (expandedClasses.size === 0 && toExpand.size > 0) {
      setExpandedClasses(toExpand);
    }
  }, [
    groupByClass,
    studentsByClass?.assignedSortedClasses.join(','),
    studentsByClass?.unassignedStudents.length,
  ]);

  const toggleClass = (className: string) => {
    const next = new Set(expandedClasses);
    if (next.has(className)) next.delete(className);
    else next.add(className);
    setExpandedClasses(next);
  };

  const downloadClassGroupRoster = (classStudents: any[], format: 'pdf' | 'csv') => {
    if (!classStudents.length) {
      toast.error('Aucun élève dans cette classe');
      return;
    }
    const classId = classStudents[0].classId as string | undefined;
    const fromApi = classesForFilter?.find((c: { id: string }) => c.id === classId);
    const meta: ClassRosterMeta = fromApi
      ? buildClassMetaFromApi(fromApi as Parameters<typeof buildClassMetaFromApi>[0])
      : {
          classId: classId || classStudents[0].class?.id || 'unknown',
          className: classStudents[0].class?.name || 'Classe',
          level: classStudents[0].class?.level ?? null,
          schoolName: null,
        };
    meta.schoolName = activeSchool?.name ?? null;
    const roster = classStudents.map((s) =>
      mapApiStudentToRosterRow(s as Parameters<typeof mapApiStudentToRosterRow>[0])
    );
    if (format === 'pdf') {
      downloadClassRosterPdf(meta, roster);
      toast.success(`Liste PDF — ${meta.className}`);
    } else {
      downloadClassRosterCsv(meta, roster);
      toast.success(`Liste CSV — ${meta.className}`);
    }
  };

  const stats = useMemo(() => {
    const list = filteredStudents || [];
    const enrollmentOf = (st: string) =>
      list.filter((s: any) => ((s.enrollmentStatus as string) || 'ACTIVE') === st).length;
    const classesCount = new Set(list.map((s: any) => s.class?.name || 'Non assigné')).size;
    return {
      total: list.length,
      enrollmentActive: enrollmentOf('ACTIVE'),
      suspended: enrollmentOf('SUSPENDED'),
      graduated: enrollmentOf('GRADUATED'),
      archived: enrollmentOf('ARCHIVED'),
      classes: classesCount,
    };
  }, [filteredStudents]);

  const exportToCSV = () => {
    try {
      const headers = [
        'ID',
        'Nom',
        'Prénom',
        'Email',
        'Téléphone',
        'Classe',
        'Niveau',
        "Statut d'inscription",
        'Affectation État',
        'Fiche',
      ];
      const rows = (filteredStudents || []).map((s: any) => {
        const es = ((s.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE');
        const sa = normalizeStateAssignment(s.stateAssignment);
        return [
          s.studentId || s.id,
          s.user?.lastName || 'N/A',
          s.user?.firstName || 'N/A',
          s.user?.email || 'N/A',
          s.user?.phone || 'N/A',
          s.class?.name || 'N/A',
          s.class?.level || 'N/A',
          ENROLLMENT_STATUS_LABELS[es],
          STATE_ASSIGNMENT_LABELS[sa],
          s.isActive ? 'Fiche active' : 'Fiche inactive',
        ].join(';');
      });
      const csv = '\ufeff# School Manager - Export Élèves\n' + `# ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}\n` + headers.join(';') + '\n' + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `eleves-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Export CSV réussi');
    } catch {
      toast.error("Erreur lors de l'export CSV");
    }
  };

  const exportToJSON = () => {
    try {
      const data = {
        application: 'School Manager',
        dateExport: format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        total: filteredStudents?.length || 0,
        élèves: (filteredStudents || []).map((s: any) => ({
          id: s.id,
          studentId: s.studentId,
          nom: s.user?.lastName,
          prénom: s.user?.firstName,
          email: s.user?.email,
          téléphone: s.user?.phone,
          classe: s.class?.name,
          niveau: s.class?.level,
          statutInscription:
            ENROLLMENT_STATUS_LABELS[(s.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE'],
          affectationÉtat: STATE_ASSIGNMENT_LABELS[normalizeStateAssignment(s.stateAssignment)],
          fiche: s.isActive ? 'Fiche active' : 'Fiche inactive',
        })),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `eleves-${format(new Date(), 'yyyy-MM-dd')}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Export JSON réussi');
    } catch {
      toast.error("Erreur lors de l'export JSON");
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(14, 10, 40, 12, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SM', 34, 18, { align: 'center' });
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(20);
      doc.text('School Manager', 60, 18);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Liste des Élèves', 60, 25);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}`, 60, 30);

      const useAutoTable = (opts: any) => {
        if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(opts);
        else if (typeof autoTable === 'function') autoTable(doc, opts);
      };
      const tableData = (filteredStudents || []).map((s: any) => {
        const es = (s.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE';
        const sa = normalizeStateAssignment(s.stateAssignment);
        return [
          s.studentId || s.id,
          `${s.user?.firstName || ''} ${s.user?.lastName || ''}`,
          s.user?.email || 'N/A',
          s.class?.name || 'N/A',
          ENROLLMENT_STATUS_LABELS[es],
          STATE_ASSIGNMENT_LABELS[sa],
        ];
      });
      useAutoTable({
        startY: 38,
        head: [['ID', 'Nom complet', 'Email', 'Classe', "Statut d'inscription", 'Affectation État']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });
      doc.save(`eleves-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Export PDF réussi');
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'export PDF");
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Nom',
      render: (student: any) => (
        <div className="flex items-center gap-2">
          <Avatar
            src={student.user?.avatar}
            name={`${student.user?.firstName || ''} ${student.user?.lastName || ''}`}
            size="sm"
          />
          <div>
            <p
              className={
                compact
                  ? 'font-medium text-stone-900 text-xs leading-tight'
                  : 'font-medium text-stone-900 text-sm leading-tight'
              }
            >
              {student.user?.firstName} {student.user?.lastName}
            </p>
            <p className="text-[11px] text-stone-500 leading-tight">ID: {student.studentId || student.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (student: any) => (
        <span className="text-stone-600 text-xs">{student.user?.email || '—'}</span>
      ),
    },
    {
      key: 'class',
      header: 'Classe',
      render: (student: any) => (
        <Badge variant={student.class ? 'info' : 'default'}>
          {student.class?.name || 'Non assigné'}
        </Badge>
      ),
    },
    {
      key: 'stateAssignment',
      header: 'Affectation',
      render: (student: any) => {
        const sa = normalizeStateAssignment(student.stateAssignment);
        return (
          <Badge variant={stateAssignmentBadgeVariant(sa)} className="text-[10px]">
            {STATE_ASSIGNMENT_LABELS[sa]}
          </Badge>
        );
      },
    },
    {
      key: 'enrollment',
      header: "Inscription",
      render: (student: any) => {
        const es = (student.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE';
        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge variant={enrollmentBadgeVariant(es)}>
              {ENROLLMENT_STATUS_LABELS[es]}
            </Badge>
            <span className="text-[10px] text-stone-500">
              Fiche {student.isActive ? 'active' : 'inactive'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (student: any) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleViewStudent(student.id)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Voir les détails"
            aria-label="Voir les détails"
          >
            <FiEye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleEditStudent(student.id)}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Modifier"
            aria-label="Modifier"
          >
            <FiEdit className="w-4 h-4" />
          </button>
          {allowStudentDelete ? (
            <button
              type="button"
              onClick={() =>
                handleDeleteStudent(
                  student.id,
                  `${student.user?.firstName || ''} ${student.user?.lastName || ''}`
                )
              }
              disabled={deleteStudentMutation.isPending}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              title="Supprimer"
              aria-label="Supprimer"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className={`space-y-6 ${compact ? 'text-sm' : ''}`}>
        <div>
          <h1
            className={
              compact
                ? 'font-display text-lg font-semibold tracking-[0.04em] text-stone-900'
                : 'font-display text-xl font-semibold tracking-[0.04em] text-stone-900'
            }
          >
            Élèves
          </h1>
          <p className="text-xs text-stone-500 mt-1 uppercase tracking-[0.14em]">Chargement des élèves…</p>
        </div>
        <Card className="p-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-600/40 border-t-amber-800" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${compact ? 'text-sm' : ''}`}>
      {/* En-tête */}
      <div>
        <h1
          className={
            compact
              ? 'font-display text-lg sm:text-xl font-semibold tracking-[0.04em] text-stone-900'
              : 'font-display text-xl sm:text-2xl font-semibold tracking-[0.04em] text-stone-900'
          }
        >
          {showClassFilter ? 'Élèves et affectation aux classes' : 'Élèves'}
        </h1>
        <p className="text-xs text-stone-500 mt-1.5 max-w-3xl leading-relaxed">
          {showClassFilter
            ? 'Filtrez par classe et modifiez la classe d’un élève via « Modifier » (onglet scolarité).'
            : 'Gérez les élèves, leurs classes et leur statut. Recherchez, filtrez et exportez la liste.'}
        </p>
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <Card className="p-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-stone-100/90 ring-1 ring-stone-200/80 shrink-0">
              <FiUsers className="w-3.5 h-3.5 text-amber-800" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.12em] leading-tight">
                Total
              </p>
              <p
                className={
                  compact
                    ? 'text-sm font-bold text-stone-900 tabular-nums leading-tight'
                    : 'text-base font-bold text-stone-900 tabular-nums leading-tight'
                }
              >
                {stats.total}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-emerald-950/10 ring-1 ring-emerald-900/10 shrink-0">
              <FiUserCheck className="w-3.5 h-3.5 text-emerald-800" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.12em] leading-tight">
                Inscr. active
              </p>
              <p
                className={
                  compact
                    ? 'text-sm font-bold text-stone-900 tabular-nums leading-tight'
                    : 'text-base font-bold text-stone-900 tabular-nums leading-tight'
                }
              >
                {stats.enrollmentActive}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-rose-950/10 ring-1 ring-rose-900/10 shrink-0">
              <FiUserX className="w-3.5 h-3.5 text-rose-800" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.12em] leading-tight">
                Suspendus
              </p>
              <p
                className={
                  compact
                    ? 'text-sm font-bold text-stone-900 tabular-nums leading-tight'
                    : 'text-base font-bold text-stone-900 tabular-nums leading-tight'
                }
              >
                {stats.suspended}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-sky-950/10 ring-1 ring-sky-900/10 shrink-0">
              <FiUserCheck className="w-3.5 h-3.5 text-sky-800" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.12em] leading-tight">
                Diplômés
              </p>
              <p
                className={
                  compact
                    ? 'text-sm font-bold text-stone-900 tabular-nums leading-tight'
                    : 'text-base font-bold text-stone-900 tabular-nums leading-tight'
                }
              >
                {stats.graduated}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-950/10 ring-1 ring-amber-900/15 shrink-0">
              <FiArchive className="w-3.5 h-3.5 text-amber-900" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.12em] leading-tight">
                Archivés
              </p>
              <p
                className={
                  compact
                    ? 'text-sm font-bold text-stone-900 tabular-nums leading-tight'
                    : 'text-base font-bold text-stone-900 tabular-nums leading-tight'
                }
              >
                {stats.archived}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-stone-100/90 ring-1 ring-amber-900/10 shrink-0">
              <FiBook className="w-3.5 h-3.5 text-amber-900" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-[0.12em] leading-tight">
                Classes
              </p>
              <p
                className={
                  compact
                    ? 'text-sm font-bold text-stone-900 tabular-nums leading-tight'
                    : 'text-base font-bold text-stone-900 tabular-nums leading-tight'
                }
              >
                {stats.classes}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtres et actions */}
      <Card className="p-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="flex-1 min-w-0">
            <SearchBar
              compact
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Rechercher par nom, email ou ID..."
            />
          </div>
          <FilterDropdown
            compact
            options={[
              { label: 'Tous', value: 'all' },
              { label: 'Inscription active', value: 'ACTIVE' },
              { label: 'Inscription suspendue', value: 'SUSPENDED' },
              { label: 'Diplômé·e', value: 'GRADUATED' },
              { label: 'Archivés', value: 'ARCHIVED' },
            ]}
            selected={statusFilter}
            onChange={setStatusFilter}
            label="Inscription"
          />
          <FilterDropdown
            compact
            options={[
              { label: 'Toutes', value: 'all' },
              { label: "Affecté de l'État", value: 'STATE_ASSIGNED' },
              { label: 'Non affecté', value: 'NOT_STATE_ASSIGNED' },
            ]}
            selected={stateAssignmentFilter}
            onChange={setStateAssignmentFilter}
            label="État"
          />
          {showClassFilter && (
            <FilterDropdown
              compact
              options={[
                { label: 'Toutes les classes', value: 'all' },
                { label: 'Non assigné', value: 'unassigned' },
                ...(classesForFilter || []).map((cl: any) => ({
                  label: `${cl.name} (${cl.level})`,
                  value: cl.id,
                })),
              ]}
              selected={classFilter}
              onChange={setClassFilter}
              label="Classe"
            />
          )}
          <Button
            variant={groupByClass ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              setGroupByClass(!groupByClass);
              if (!groupByClass && studentsByClass) {
                const next = new Set<string>(studentsByClass.assignedSortedClasses);
                if (studentsByClass.unassignedStudents.length > 0) {
                  next.add(UNASSIGNED_CLASS_LABEL);
                }
                if (next.size > 0) setExpandedClasses(next);
              }
            }}
            className="!py-2 shrink-0"
          >
            <FiUsers className="w-4 h-4 mr-1.5 inline" aria-hidden />
            {groupByClass ? 'Par classe' : 'Liste simple'}
          </Button>
          <div className="flex items-center gap-1 flex-wrap shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={exportToCSV}
              className="!px-2 !py-1.5 text-xs !font-medium"
            >
              <FiDownload className="w-3.5 h-3.5 mr-0.5 inline" aria-hidden />
              CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={exportToJSON}
              className="!px-2 !py-1.5 text-xs !font-medium"
            >
              <FiDownload className="w-3.5 h-3.5 mr-0.5 inline" aria-hidden />
              JSON
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={exportToPDF}
              className="!px-2 !py-1.5 text-xs !font-medium"
            >
              <FiDownload className="w-3.5 h-3.5 mr-0.5 inline" aria-hidden />
              PDF
            </Button>
          </div>
          <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="!py-2 shrink-0">
            <FiPlus className="w-4 h-4 mr-1.5 inline" aria-hidden />
            Ajouter un élève
          </Button>
        </div>
      </Card>

      {/* Liste */}
      <Card className="overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-amber-200/25 bg-gradient-to-r from-stone-50/80 to-amber-50/30 flex items-center justify-between">
          <h2
            className={
              compact
                ? 'text-[10px] font-semibold text-stone-700 uppercase tracking-[0.14em]'
                : 'text-xs font-semibold text-stone-700 uppercase tracking-[0.14em]'
            }
          >
            Liste des élèves ({filteredStudents?.length ?? 0})
          </h2>
        </div>

        {groupByClass && studentsByClass ? (
          <div className="divide-y divide-stone-200/70">
            {(filteredStudents?.length ?? 0) === 0 ? (
              <div
                className={
                  compact
                    ? 'py-12 text-center text-stone-500 text-xs'
                    : 'py-12 text-center text-stone-500 text-sm'
                }
              >
                Aucun élève trouvé
              </div>
            ) : (
              <>
                <div className="px-4 py-3 bg-emerald-50/50 border-b border-emerald-200/30">
                  <h3
                    className={
                      compact
                        ? 'text-[10px] font-semibold text-emerald-900 uppercase tracking-[0.14em]'
                        : 'text-xs font-semibold text-emerald-900 uppercase tracking-[0.14em]'
                    }
                  >
                    Élèves affectés à une classe
                    <span className="ml-2 font-bold tabular-nums text-emerald-800 normal-case tracking-normal">
                      {` (${studentsByClass.assignedSortedClasses.reduce(
                        (n, cn) => n + studentsByClass.assignedGrouped[cn].length,
                        0
                      )})`}
                    </span>
                  </h3>
                  <p className="text-[11px] text-emerald-800/80 mt-1 font-normal normal-case tracking-normal">
                    Répartis par classe ci-dessous.
                  </p>
                </div>
                {studentsByClass.assignedSortedClasses.length === 0 ? (
                  <div
                    className={
                      compact
                        ? 'py-8 text-center text-stone-500 text-xs px-4'
                        : 'py-8 text-center text-stone-500 text-sm px-4'
                    }
                  >
                    Aucun élève affecté à une classe dans cette vue.
                  </div>
                ) : (
                  studentsByClass.assignedSortedClasses.map((className) => {
                    const classStudents = studentsByClass.assignedGrouped[className];
                    const isExpanded = expandedClasses.has(className);
                    const classLevel = classStudents[0]?.class?.level || '';

                    return (
                      <div key={className}>
                        <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50/25 transition-colors gap-2">
                          <button
                            type="button"
                            onClick={() => toggleClass(className)}
                            className="flex-1 flex items-center gap-3 text-left min-w-0"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {isExpanded ? (
                                <FiChevronUp className="w-5 h-5 text-stone-500 shrink-0" aria-hidden />
                              ) : (
                                <FiChevronDown className="w-5 h-5 text-stone-500 shrink-0" aria-hidden />
                              )}
                              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                <FiBook className="w-5 h-5 text-indigo-600" aria-hidden />
                              </div>
                              <div className="min-w-0">
                                <span
                                  className={
                                    compact
                                      ? 'font-medium text-stone-900 text-xs'
                                      : 'font-medium text-stone-900 text-sm'
                                  }
                                >
                                  {className}
                                </span>
                                {classLevel && (
                                  <span className="text-xs text-stone-500 ml-2">— {classLevel}</span>
                                )}
                              </div>
                            </div>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className={compact ? 'text-[10px] px-2 py-1' : undefined}
                              onClick={() => downloadClassGroupRoster(classStudents, 'pdf')}
                              title="Télécharger la liste PDF"
                            >
                              <FiDownload className="w-3.5 h-3.5 mr-1" aria-hidden />
                              PDF
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className={compact ? 'text-[10px] px-2 py-1' : undefined}
                              onClick={() => downloadClassGroupRoster(classStudents, 'csv')}
                              title="Télécharger la liste CSV"
                            >
                              CSV
                            </Button>
                            <Badge variant="info">{classStudents.length} élève(s)</Badge>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="bg-stone-50/60 border-t border-amber-100/40">
                            <Table
                              dense
                              data={classStudents}
                              columns={columns}
                              emptyMessage="Aucun élève dans cette classe"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-200/40 border-t-2 border-t-amber-300/50">
                  <h3
                    className={
                      compact
                        ? 'text-[10px] font-semibold text-amber-950 uppercase tracking-[0.14em]'
                        : 'text-xs font-semibold text-amber-950 uppercase tracking-[0.14em]'
                    }
                  >
                    Sans classe (non affectés)
                    <span className="ml-2 font-bold tabular-nums text-amber-900 normal-case tracking-normal">
                      ({studentsByClass.unassignedStudents.length})
                    </span>
                  </h3>
                  <p className="text-[11px] text-amber-900/85 mt-1 font-normal normal-case tracking-normal">
                    Assignez une classe via « Modifier » → scolarité.
                  </p>
                </div>
                {studentsByClass.unassignedStudents.length === 0 ? (
                  <div
                    className={
                      compact
                        ? 'py-8 text-center text-stone-500 text-xs px-4'
                        : 'py-8 text-center text-stone-500 text-sm px-4'
                    }
                  >
                    Tous les élèves de cette vue sont affectés à une classe.
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleClass(UNASSIGNED_CLASS_LABEL)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50/40 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {expandedClasses.has(UNASSIGNED_CLASS_LABEL) ? (
                          <FiChevronUp className="w-5 h-5 text-stone-500 shrink-0" aria-hidden />
                        ) : (
                          <FiChevronDown className="w-5 h-5 text-stone-500 shrink-0" aria-hidden />
                        )}
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                          <FiUserX className="w-5 h-5 text-amber-900" aria-hidden />
                        </div>
                        <div>
                          <span
                            className={
                              compact
                                ? 'font-medium text-stone-900 text-xs'
                                : 'font-medium text-stone-900 text-sm'
                            }
                          >
                            {UNASSIGNED_CLASS_LABEL}
                          </span>
                        </div>
                      </div>
                      <Badge variant="default">
                        {studentsByClass.unassignedStudents.length} élève(s)
                      </Badge>
                    </button>
                    {expandedClasses.has(UNASSIGNED_CLASS_LABEL) && (
                      <div className="bg-stone-50/60 border-t border-amber-100/40">
                        <Table
                          dense
                          data={studentsByClass.unassignedStudents}
                          columns={columns}
                          emptyMessage="Aucun élève sans classe"
                        />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-stone-200/70">
            {(filteredStudents?.length ?? 0) === 0 ? (
              <Table
                dense
                data={[]}
                columns={columns}
                emptyMessage="Aucun élève trouvé"
              />
            ) : (
              <>
                <div className="px-4 py-2.5 bg-emerald-50/40 border-b border-emerald-200/25">
                  <h3
                    className={
                      compact
                        ? 'text-[10px] font-semibold text-emerald-900 uppercase tracking-[0.14em]'
                        : 'text-xs font-semibold text-emerald-900 uppercase tracking-[0.14em]'
                    }
                  >
                    Affectés à une classe ({assignedToClassList.length})
                  </h3>
                </div>
                <Table
                  dense
                  data={assignedToClassList}
                  columns={columns}
                  emptyMessage="Aucun élève affecté dans cette vue"
                />
                <div className="px-4 py-2.5 bg-amber-50/50 border-t border-stone-200/60">
                  <h3
                    className={
                      compact
                        ? 'text-[10px] font-semibold text-amber-950 uppercase tracking-[0.14em]'
                        : 'text-xs font-semibold text-amber-950 uppercase tracking-[0.14em]'
                    }
                  >
                    Sans classe ({notAssignedToClassList.length})
                  </h3>
                </div>
                <Table
                  dense
                  data={notAssignedToClassList}
                  columns={columns}
                  emptyMessage="Aucun élève sans classe dans cette vue"
                />
              </>
            )}
          </div>
        )}
      </Card>

      <AddStudentModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

      {selectedStudentId && (
        <StudentDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedStudentId(null);
          }}
          studentId={selectedStudentId}
          onEdit={() => {
            setIsDetailsModalOpen(false);
            setEditingStudentId(selectedStudentId);
            setIsEditModalOpen(true);
          }}
        />
      )}

      {editingStudentId && (
        <EditStudentModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingStudentId(null);
          }}
          studentId={editingStudentId}
        />
      )}
    </div>
  );
};

export default StudentsList;
