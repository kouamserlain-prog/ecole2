import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import SearchBar from '../ui/SearchBar';
import AddClassModal from './AddClassModal';
import EditClassModal, { type AdminClassRow } from './EditClassModal';
import ClassGroupsModal, { type ClassGroupRow } from './ClassGroupsModal';
import ClassRoomAssignmentPanel from './ClassRoomAssignmentPanel';
import {
  FiPlus,
  FiUsers,
  FiBook,
  FiCalendar,
  FiDownload,
  FiLayers,
  FiTrendingUp,
  FiEdit2,
  FiGrid,
  FiTrash2,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { canDeleteStudentsOrClasses } from '@/lib/staffDeletionPolicy';
import { useSchool } from '../../contexts/SchoolContext';
import { useSchoolReady, schoolQueryKey } from '../../hooks/useSchoolReady';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import {
  buildClassMetaFromApi,
  downloadAllClassRostersPdf,
  downloadClassRosterCsv,
  downloadClassRosterPdf,
  mapApiStudentToRosterRow,
} from '@/lib/classRosterExport';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface ClassesListProps {
  searchQuery?: string;
  /** Typographie plus petite (ex. onglet Gestion académique) */
  compact?: boolean;
}

const levelColors: Record<string, string> = {
  '6ème': 'bg-blue-100 text-blue-700',
  '5ème': 'bg-emerald-100 text-emerald-700',
  '4ème': 'bg-amber-100 text-amber-700',
  '3ème': 'bg-orange-100 text-orange-700',
  '2nde': 'bg-violet-100 text-violet-700',
  '1ère': 'bg-pink-100 text-pink-700',
  Terminale: 'bg-red-100 text-red-700',
};

const ClassesList: React.FC<ClassesListProps> = ({ searchQuery = '', compact = false }) => {
  const [searchTerm, setSearchTerm] = useState(searchQuery);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editClass, setEditClass] = useState<AdminClassRow | null>(null);
  const [groupsForClass, setGroupsForClass] = useState<{
    id: string;
    label: string;
    groups: ClassGroupRow[];
  } | null>(null);

  useEffect(() => {
    if (searchQuery) setSearchTerm(searchQuery);
  }, [searchQuery]);

  const { activeSchoolId, activeSchool } = useSchool();
  const schoolReady = useSchoolReady();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const allowClassDelete = canDeleteStudentsOrClasses(user);

  const { data: classes, isLoading } = useQuery({
    queryKey: schoolQueryKey(['classes'], activeSchoolId),
    queryFn: adminApi.getClasses,
    enabled: schoolReady,
  });

  const { data: allStudents } = useQuery({
    queryKey: schoolQueryKey(['students'], activeSchoolId),
    queryFn: adminApi.getStudents,
    enabled: schoolReady,
  });

  const deleteClassMutation = useMutation({
    mutationFn: ({
      id,
      unassignStudents,
    }: {
      id: string;
      unassignStudents?: boolean;
    }) => adminApi.deleteClass(id, { unassignStudents }),
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: schoolQueryKey(['classes'], activeSchoolId) });
      queryClient.invalidateQueries({ queryKey: schoolQueryKey(['students'], activeSchoolId) });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      setEditClass(null);
      toast.success(data?.message || 'Classe supprimée');
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Suppression impossible');
    },
  });

  const studentsByClassId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof mapApiStudentToRosterRow>[]>();
    for (const s of allStudents ?? []) {
      const cid = (s as { classId?: string | null }).classId;
      if (!cid) continue;
      const row = mapApiStudentToRosterRow(s as Parameters<typeof mapApiStudentToRosterRow>[0]);
      const list = map.get(cid) ?? [];
      list.push(row);
      map.set(cid, list);
    }
    return map;
  }, [allStudents]);

  const getClassStudentCount = (classItem: {
    id: string;
    _count?: { students?: number };
    students?: unknown[];
  }) => {
    if (typeof classItem._count?.students === 'number') return classItem._count.students;
    if (Array.isArray(classItem.students)) return classItem.students.length;
    return studentsByClassId.get(classItem.id)?.length ?? 0;
  };

  const handleDeleteClass = (classItem: {
    id: string;
    name: string;
    _count?: { students?: number };
    students?: unknown[];
  }) => {
    const count = getClassStudentCount(classItem);
    const label = classItem.name || 'cette classe';
    let unassignStudents = false;

    if (count > 0) {
      if (
        !window.confirm(
          `La classe « ${label} » contient encore ${count} élève(s).\n\nPour la supprimer, les élèves seront retirés de cette classe (leurs comptes ne seront pas supprimés). Continuer ?`,
        )
      ) {
        return;
      }
      if (
        !window.confirm(
          `Confirmez la suppression de « ${label} » et le retrait des ${count} élève(s).\n\nLes matières, notes, créneaux d'emploi du temps et autres données liées à cette classe seront supprimés. Action irréversible.`,
        )
      ) {
        return;
      }
      unassignStudents = true;
    } else if (
      !window.confirm(
        `Supprimer définitivement la classe « ${label} » ?\n\nLes cours, créneaux d'emploi du temps et données liés à cette classe seront supprimés. Cette action est irréversible.`,
      )
    ) {
      return;
    }

    deleteClassMutation.mutate({ id: classItem.id, unassignStudents });
  };

  const downloadRosterForClass = (classItem: {
    id: string;
    name: string;
    level?: string | null;
    section?: string | null;
    academicYear?: string | null;
    room?: string | null;
    capacity?: number | null;
    track?: { name?: string | null } | null;
    materialRoom?: { name?: string | null } | null;
    teacher?: { user?: { firstName?: string; lastName?: string } | null } | null;
  }, format: 'pdf' | 'csv') => {
    const meta = buildClassMetaFromApi(classItem);
    meta.schoolName = activeSchool?.name ?? null;
    const roster = studentsByClassId.get(classItem.id) ?? [];
    if (roster.length === 0) {
      toast.error('Aucun élève dans cette classe');
      return;
    }
    if (format === 'pdf') {
      downloadClassRosterPdf(meta, roster);
      toast.success(`Liste PDF — ${classItem.name}`);
    } else {
      downloadClassRosterCsv(meta, roster);
      toast.success(`Liste CSV — ${classItem.name}`);
    }
  };

  const downloadAllRosters = () => {
    const metas = (filteredClasses ?? []).map((c: Parameters<typeof buildClassMetaFromApi>[0]) => {
      const m = buildClassMetaFromApi(c);
      m.schoolName = activeSchool?.name ?? null;
      return m;
    });
    const withStudents = metas.filter((m) => (studentsByClassId.get(m.classId)?.length ?? 0) > 0);
    if (withStudents.length === 0) {
      toast.error('Aucune classe avec des élèves à exporter');
      return;
    }
    downloadAllClassRostersPdf(activeSchool?.name, withStudents, studentsByClassId);
    toast.success(`${withStudents.length} liste(s) de classe exportée(s) en PDF`);
  };

  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    const term = searchTerm.toLowerCase();
    return classes.filter(
      (c: any) =>
        (c.name || '').toLowerCase().includes(term) ||
        (c.level || '').toLowerCase().includes(term) ||
        (c.section || '').toLowerCase().includes(term) ||
        (c.academicYear || '').toLowerCase().includes(term) ||
        (c.room || '').toLowerCase().includes(term)
    );
  }, [classes, searchTerm]);

  const stats = useMemo(() => {
    const list = filteredClasses;
    const totalStudents = list.reduce((acc: number, c: any) => acc + (c._count?.students || 0), 0);
    const totalCapacity = list.reduce((acc: number, c: any) => acc + (c.capacity || 0), 0);
    const levels = new Set(list.map((c: any) => c.level).filter(Boolean)).size;
    return {
      total: list.length,
      students: totalStudents,
      levels,
      capacity: totalCapacity,
    };
  }, [filteredClasses]);

  const exportToCSV = () => {
    try {
      const headers = [
        'Nom',
        'Niveau',
        'Section',
        'Année scolaire',
        'Nombre d\'élèves',
        'Capacité',
        'Enseignant principal',
      ];
      const rows = (filteredClasses || []).map((c: any) =>
        [
          c.name,
          c.level || 'N/A',
          c.section || '—',
          c.academicYear || 'N/A',
          c._count?.students || 0,
          c.capacity || 0,
          c.teacher?.user ? `${c.teacher.user.firstName} ${c.teacher.user.lastName}` : 'N/A',
        ].join(';')
      );
      const csv =
        '\ufeff# School Manager - Export Classes\n' +
        `# ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}\n` +
        headers.join(';') +
        '\n' +
        rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `classes-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
        total: filteredClasses?.length || 0,
        classes: (filteredClasses || []).map((c: any) => ({
          nom: c.name,
          niveau: c.level,
          section: c.section || null,
          annéeScolaire: c.academicYear,
          nombreÉlèves: c._count?.students || 0,
          capacité: c.capacity || 0,
          groupes: (c.groups || []).map((g: any) => g.name),
          enseignantPrincipal: c.teacher?.user
            ? `${c.teacher.user.firstName} ${c.teacher.user.lastName}`
            : null,
        })),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `classes-${format(new Date(), 'yyyy-MM-dd')}.json`;
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
      doc.setFillColor(124, 58, 237);
      doc.roundedRect(14, 10, 40, 12, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SM', 34, 18, { align: 'center' });
      doc.setTextColor(124, 58, 237);
      doc.setFontSize(20);
      doc.text('School Manager', 60, 18);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Liste des Classes', 60, 25);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}`, 60, 30);

      const useAutoTable = (opts: any) => {
        if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(opts);
        else if (typeof autoTable === 'function') autoTable(doc, opts);
      };
      const tableData = (filteredClasses || []).map((c: any) => [
        c.name,
        c.level || 'N/A',
        c.section || '—',
        c.academicYear || 'N/A',
        c._count?.students || 0,
        c.capacity || 0,
        c.teacher?.user ? `${c.teacher.user.firstName} ${c.teacher.user.lastName}` : 'N/A',
      ]);
      useAutoTable({
        startY: 38,
        head: [
          ['Nom', 'Niveau', 'Section', 'Année scolaire', 'Élèves', 'Capacité', 'Enseignant principal'],
        ],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });
      doc.save(`classes-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Export PDF réussi');
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'export PDF");
    }
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${compact ? 'text-sm' : ''}`}>
        <div>
          <h1 className={compact ? 'text-lg font-semibold text-gray-900' : 'text-xl font-semibold text-gray-900'}>
            Classes
          </h1>
          <p className={compact ? 'text-xs text-gray-500 mt-1' : 'text-sm text-gray-500 mt-1'}>
            Chargement des classes...
          </p>
        </div>
        <Card className="p-8 border border-gray-200">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${compact ? 'text-sm' : ''}`}>
      <div>
        <h1 className={compact ? 'text-lg font-semibold text-gray-900' : 'text-xl font-semibold text-gray-900'}>
          Classes
        </h1>
        <p className={compact ? 'text-xs text-gray-500 mt-1' : 'text-sm text-gray-500 mt-1'}>
          Organisez par niveau, section et groupes ; gérez les effectifs et les professeurs principaux.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-50">
              <FiLayers className="w-5 h-5 text-violet-600" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total</p>
              <p
                className={
                  compact
                    ? 'text-lg font-bold text-gray-900 tabular-nums'
                    : 'text-xl font-bold text-gray-900 tabular-nums'
                }
              >
                {stats.total}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50">
              <FiUsers className="w-5 h-5 text-indigo-600" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Élèves</p>
              <p
                className={
                  compact
                    ? 'text-lg font-bold text-gray-900 tabular-nums'
                    : 'text-xl font-bold text-gray-900 tabular-nums'
                }
              >
                {stats.students}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50">
              <FiBook className="w-5 h-5 text-blue-600" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Niveaux</p>
              <p
                className={
                  compact
                    ? 'text-lg font-bold text-gray-900 tabular-nums'
                    : 'text-xl font-bold text-gray-900 tabular-nums'
                }
              >
                {stats.levels}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50">
              <FiTrendingUp className="w-5 h-5 text-emerald-600" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Capacité</p>
              <p
                className={
                  compact
                    ? 'text-lg font-bold text-gray-900 tabular-nums'
                    : 'text-xl font-bold text-gray-900 tabular-nums'
                }
              >
                {stats.capacity}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <ClassRoomAssignmentPanel compact={compact} />

      <Card className="p-4 border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1 min-w-0">
            <SearchBar
              compact={compact}
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Rechercher par nom, niveau, section, année ou salle..."
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={exportToCSV}>
              <FiDownload className="w-4 h-4 mr-1" aria-hidden /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={exportToJSON}>
              <FiDownload className="w-4 h-4 mr-1" aria-hidden /> JSON
            </Button>
            <Button variant="secondary" size="sm" onClick={exportToPDF}>
              <FiDownload className="w-4 h-4 mr-1" aria-hidden /> PDF classes
            </Button>
            <Button variant="secondary" size="sm" onClick={downloadAllRosters}>
              <FiUsers className="w-4 h-4 mr-1" aria-hidden /> Listes élèves (PDF)
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <FiPlus className="w-5 h-5 mr-2 inline" aria-hidden />
              Créer une classe
            </Button>
          </div>
        </div>
      </Card>

      <div>
        <h2
          className={
            compact
              ? 'text-xs font-semibold text-gray-700 uppercase tracking-wider mb-4'
              : 'text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4'
          }
        >
          Liste des classes ({filteredClasses.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.map((classItem: any) => {
            const levelStyle = levelColors[classItem.level] || 'bg-gray-100 text-gray-700';
            const count = getClassStudentCount(classItem);
            const cap = classItem.capacity || 1;
            const fillPct = Math.min((count / cap) * 100, 100);
            const barColor =
              fillPct >= 90 ? 'bg-red-500' : fillPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

            const groupCount = (classItem.groups?.length as number | undefined) ?? 0;

            return (
              <Card key={classItem.id} className="border border-gray-200 overflow-hidden">
                <div className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3
                        className={
                          compact ? 'text-sm font-semibold text-gray-900' : 'font-semibold text-gray-900'
                        }
                      >
                        {classItem.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <Badge className={levelStyle} size="sm">
                          {classItem.level || '—'}
                        </Badge>
                        {classItem.section ? (
                          <Badge variant="default" size="sm">
                            Section {classItem.section}
                          </Badge>
                        ) : null}
                        {classItem.track?.name ? (
                          <Badge variant="default" size="sm" className="bg-violet-50 text-violet-800">
                            {classItem.track.name}
                          </Badge>
                        ) : null}
                        {groupCount > 0 ? (
                          <Badge variant="default" size="sm">
                            {groupCount} groupe{groupCount > 1 ? 's' : ''}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {(classItem.materialRoom?.name || classItem.room) && (
                        <Badge variant="default" size="sm">
                          {classItem.materialRoom?.name || classItem.room}
                          {classItem.materialRoom?.building
                            ? ` · ${classItem.materialRoom.building}`
                            : ''}
                        </Badge>
                      )}
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEditClass({
                              id: classItem.id,
                              name: classItem.name,
                              level: classItem.level,
                              section: classItem.section,
                              room: classItem.room,
                              capacity: classItem.capacity,
                              academicYear: classItem.academicYear,
                              teacherId: classItem.teacherId ?? classItem.teacher?.id,
                              trackId: classItem.trackId ?? classItem.track?.id ?? null,
                              materialRoomId:
                                classItem.materialRoomId ?? classItem.materialRoom?.id ?? null,
                              materialRoom: classItem.materialRoom ?? null,
                              _count: { students: getClassStudentCount(classItem) },
                            })
                          }
                          className="p-1.5 rounded-lg text-amber-800 hover:bg-amber-50 border border-transparent hover:border-amber-100"
                          title="Modifier la classe"
                        >
                          <FiEdit2 className="w-4 h-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setGroupsForClass({
                              id: classItem.id,
                              label: [classItem.level, classItem.section, classItem.name]
                                .filter(Boolean)
                                .join(' · '),
                              groups: classItem.groups || [],
                            })
                          }
                          className="p-1.5 rounded-lg text-violet-800 hover:bg-violet-50 border border-transparent hover:border-violet-100"
                          title="Groupes"
                        >
                          <FiGrid className="w-4 h-4" aria-hidden />
                        </button>
                        {allowClassDelete ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteClass(classItem)}
                            disabled={deleteClassMutation.isPending}
                            className="p-1.5 rounded-lg text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 disabled:opacity-50"
                            title="Supprimer la classe"
                            aria-label={`Supprimer la classe ${classItem.name}`}
                          >
                            <FiTrash2 className="w-4 h-4" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div
                    className={
                      compact
                        ? 'flex items-center gap-2 text-xs text-gray-500'
                        : 'flex items-center gap-2 text-sm text-gray-500'
                    }
                  >
                    <FiCalendar className="w-4 h-4 shrink-0" aria-hidden />
                    <span>{classItem.academicYear || '—'}</span>
                  </div>
                  <div className="space-y-1">
                    <div className={compact ? 'flex justify-between text-xs' : 'flex justify-between text-sm'}>
                      <span className="text-gray-600">Élèves</span>
                      <span className="font-medium text-gray-900">
                        {count} / {classItem.capacity || 0}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${barColor}`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>
                  {classItem.teacher?.user && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">Professeur principal</p>
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={classItem.teacher.user.avatar}
                          name={`${classItem.teacher.user.firstName} ${classItem.teacher.user.lastName}`}
                          size="sm"
                        />
                        <span
                          className={
                            compact
                              ? 'text-xs font-medium text-gray-900 truncate'
                              : 'text-sm font-medium text-gray-900 truncate'
                          }
                        >
                          {classItem.teacher.user.firstName} {classItem.teacher.user.lastName}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                    {allowClassDelete ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="!text-xs text-red-700 border-red-200 hover:bg-red-50 min-w-[7rem]"
                        onClick={() => handleDeleteClass(classItem)}
                        disabled={deleteClassMutation.isPending}
                        title={
                          count > 0
                            ? 'Supprimer la classe (les élèves seront retirés de la classe)'
                            : 'Supprimer la classe'
                        }
                      >
                        <FiTrash2 className="w-3.5 h-3.5 mr-1 shrink-0" aria-hidden />
                        Supprimer
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="!text-xs flex-1 min-w-[7rem]"
                      onClick={() => downloadRosterForClass(classItem, 'pdf')}
                    >
                      <FiDownload className="w-3.5 h-3.5 mr-1 shrink-0" aria-hidden />
                      Liste PDF
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="!text-xs flex-1 min-w-[7rem]"
                      onClick={() => downloadRosterForClass(classItem, 'csv')}
                    >
                      <FiDownload className="w-3.5 h-3.5 mr-1 shrink-0" aria-hidden />
                      Liste CSV
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        {filteredClasses.length === 0 && (
          <Card className="p-8 border border-gray-200 text-center text-gray-500">
            Aucune classe trouvée
          </Card>
        )}
      </div>

      <AddClassModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      <EditClassModal
        isOpen={!!editClass}
        onClose={() => setEditClass(null)}
        classItem={editClass}
        studentCount={editClass ? getClassStudentCount(editClass) : 0}
        onDelete={
          editClass && allowClassDelete
            ? () =>
                handleDeleteClass({
                  id: editClass.id,
                  name: editClass.name,
                  _count: editClass._count,
                })
            : undefined
        }
        deletePending={deleteClassMutation.isPending}
      />
      <ClassGroupsModal
        isOpen={!!groupsForClass}
        onClose={() => setGroupsForClass(null)}
        classId={groupsForClass?.id ?? null}
        classLabel={groupsForClass?.label ?? ''}
        groups={groupsForClass?.groups ?? []}
      />
    </div>
  );
};

export default ClassesList;
