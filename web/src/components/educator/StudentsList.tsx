import { Fragment, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { educatorApi } from '../../services/api';
import Card from '../ui/Card';
import SearchBar from '../ui/SearchBar';
import Badge from '../ui/Badge';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { FiEye, FiUsers } from 'react-icons/fi';
import StudentDetailsModal from '../admin/StudentDetailsModal';
import {
  ENROLLMENT_STATUS_LABELS,
  enrollmentBadgeVariant,
  type EnrollmentStatusValue,
} from '../../lib/enrollmentStatus';

interface StudentsListProps {
  searchQuery?: string;
}

type StudentRow = {
  id: string;
  studentId: string;
  classId?: string | null;
  enrollmentStatus?: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string | null;
  };
  class?: { id: string; name: string; level?: string } | null;
};

type ClassGroup = {
  key: string;
  label: string;
  level?: string;
  students: StudentRow[];
};

function sortStudentsByName(list: StudentRow[]): StudentRow[] {
  return [...list].sort((a, b) => {
    const na = `${a.user.lastName} ${a.user.firstName}`;
    const nb = `${b.user.lastName} ${b.user.firstName}`;
    return na.localeCompare(nb, 'fr');
  });
}

function groupStudentsByClass(students: StudentRow[]): ClassGroup[] {
  const byClass = new Map<string, ClassGroup>();

  for (const student of students) {
    if (!student.classId || !student.class) {
      continue;
    }
    const key = student.class.id;
    const existing = byClass.get(key);
    if (existing) {
      existing.students.push(student);
    } else {
      byClass.set(key, {
        key,
        label: student.class.name,
        level: student.class.level,
        students: [student],
      });
    }
  }

  const groups = [...byClass.values()]
    .map((g) => ({ ...g, students: sortStudentsByName(g.students) }))
    .sort((a, b) => {
      const la = `${a.level ?? ''} ${a.label}`.trim();
      const lb = `${b.level ?? ''} ${b.label}`.trim();
      return la.localeCompare(lb, 'fr');
    });

  const unassigned = sortStudentsByName(
    students.filter((s) => !s.classId || !s.class)
  );
  if (unassigned.length > 0) {
    groups.push({
      key: '__unassigned__',
      label: 'Sans classe',
      students: unassigned,
    });
  }

  return groups;
}

const StudentsList = ({ searchQuery = '' }: StudentsListProps) => {
  const [searchTerm, setSearchTerm] = useState(searchQuery);
  const [classFilter, setClassFilter] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ['educator-classes'],
    queryFn: educatorApi.getClasses,
  });

  const hasClassScope = ((classes as { id?: string }[] | undefined)?.length ?? 0) > 0;

  const { data: students, isLoading } = useQuery({
    queryKey: ['educator-students', classFilter],
    queryFn: () =>
      educatorApi.getStudents(classFilter ? { classId: classFilter } : undefined),
  });

  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!students) return [] as StudentRow[];
    if (!term) return students as StudentRow[];

    return (students as StudentRow[]).filter((student) => {
      return (
        student.user.firstName.toLowerCase().includes(term) ||
        student.user.lastName.toLowerCase().includes(term) ||
        student.user.email.toLowerCase().includes(term) ||
        student.studentId.toLowerCase().includes(term) ||
        (student.class?.name && student.class.name.toLowerCase().includes(term))
      );
    });
  }, [students, searchTerm]);

  const classGroups = useMemo(
    () => groupStudentsByClass(filteredStudents),
    [filteredStudents]
  );

  const handleViewStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsDetailsModalOpen(true);
  };

  const renderStudentRow = (student: StudentRow) => (
    <tr
      key={student.id}
      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
    >
      <td className="py-3 px-4">
        <div className="flex items-center space-x-3">
          <Avatar
            src={student.user.avatar}
            name={`${student.user.firstName} ${student.user.lastName}`}
            size="md"
          />
          <div>
            <p className="font-medium text-gray-900">
              {student.user.firstName} {student.user.lastName}
            </p>
            <p className="text-sm text-gray-500">{student.user.email}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-gray-600">{student.studentId}</td>
      <td className="py-3 px-4">
        <Badge
          variant={enrollmentBadgeVariant(
            (student.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE'
          )}
        >
          {
            ENROLLMENT_STATUS_LABELS[
              (student.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE'
            ]
          }
        </Badge>
      </td>
      <td className="py-3 px-4">
        <Button variant="secondary" size="sm" onClick={() => handleViewStudent(student.id)}>
          <FiEye className="w-4 h-4 mr-2" />
          Voir
        </Button>
      </td>
    </tr>
  );

  if (isLoading) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Chargement des élèves...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {!hasClassScope && !isLoading && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-950">
            Aucune classe ne vous est assignée. L&apos;administration doit configurer votre périmètre
            (fiche éducateur → classes) pour consulter les élèves.
          </p>
        </Card>
      )}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Rechercher un élève..."
            />
          </div>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            aria-label="Filtrer par classe"
          >
            <option value="">Toutes les classes</option>
            {((classes as { id: string; name: string; level?: string }[]) ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.level}
              </option>
            ))}
          </select>
          <div className="flex items-center space-x-2 text-gray-600">
            <FiUsers className="w-5 h-5" />
            <span className="font-medium">{filteredStudents.length} élève(s)</span>
            {classGroups.length > 1 && (
              <span className="text-sm text-gray-500">
                · {classGroups.length} groupe{classGroups.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Liste des élèves par classe ({filteredStudents.length})
        </h2>
        {classGroups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Élève</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Inscription
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {classGroups.map((group) => {
                  const isUnassigned = group.key === '__unassigned__';
                  return (
                    <Fragment key={group.key}>
                      <tr
                        className={
                          isUnassigned
                            ? 'border-b border-amber-100 bg-amber-50/80'
                            : 'border-b border-violet-100 bg-violet-50/70'
                        }
                      >
                        <td
                          colSpan={4}
                          className={`py-2.5 px-4 text-xs font-semibold uppercase tracking-wide ${
                            isUnassigned ? 'text-amber-950' : 'text-violet-900'
                          }`}
                        >
                          {group.label}
                          {group.level && !isUnassigned ? (
                            <span className="font-normal normal-case ml-2 text-violet-700">
                              — {group.level}
                            </span>
                          ) : null}
                          <span className="ml-2 font-normal normal-case opacity-80">
                            ({group.students.length} élève{group.students.length > 1 ? 's' : ''})
                          </span>
                        </td>
                      </tr>
                      {group.students.map(renderStudentRow)}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">Aucun élève trouvé</div>
        )}
      </Card>

      {selectedStudentId && (
        <StudentDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedStudentId(null);
          }}
          studentId={selectedStudentId}
          mode="educator"
        />
      )}
    </div>
  );
};

export default StudentsList;
