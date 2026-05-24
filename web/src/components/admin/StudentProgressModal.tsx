import { useQuery } from '@tanstack/react-query';
import { getEvaluationTypeLabel } from '@/lib/evaluationTypes';
import { adminApi } from '../../services/api';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchoolReady, schoolQueryKey } from '@/hooks/useSchoolReady';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Avatar from '../ui/Avatar';
import {
  FiX,
  FiUser,
  FiBook,
  FiCalendar,
  FiAward,
  FiTrendingUp,
  FiTrendingDown,
  FiLoader,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface StudentProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
}

const StudentProgressModal: React.FC<StudentProgressModalProps> = ({
  isOpen,
  onClose,
  studentId,
}) => {
  const { activeSchoolId } = useSchool();
  const schoolReady = useSchoolReady();
  const studentQueryKey = schoolQueryKey(['student', studentId], activeSchoolId);

  const { data: studentProgress, isLoading: isLoadingProgress } = useQuery({
    queryKey: schoolQueryKey(['student-progress', studentId], activeSchoolId),
    queryFn: () => adminApi.getStudentProgress(studentId),
    enabled: isOpen && !!studentId && schoolReady,
  });

  const { data: student } = useQuery({
    queryKey: studentQueryKey,
    queryFn: () => adminApi.getStudent(studentId),
    enabled: isOpen && !!studentId && schoolReady,
  });

  const { data: allGrades } = useQuery({
    queryKey: ['admin-grades'],
    queryFn: () => adminApi.getAllGrades(),
    enabled: isOpen && !!studentId,
  });

  // Filter grades for this student
  const grades = allGrades?.filter((g: any) => g.studentId === student?.id) || [];

  if (!isOpen) return null;

  // Calculer les statistiques
  const stats = studentProgress
    ? {
        average: studentProgress.length > 0
          ? studentProgress.reduce((sum: number, p: any) => sum + p.score, 0) / studentProgress.length
          : 0,
        highest: studentProgress.length > 0
          ? Math.max(...studentProgress.map((p: any) => p.score))
          : 0,
        lowest: studentProgress.length > 0
          ? Math.min(...studentProgress.map((p: any) => p.score))
          : 0,
        trend: studentProgress.length >= 2
          ? studentProgress[studentProgress.length - 1].score - studentProgress[0].score
          : 0,
      }
    : null;

  // Grouper par matière
  const progressByCourse = studentProgress
    ? studentProgress.reduce((acc: any, item: any) => {
        if (!acc[item.course]) {
          acc[item.course] = [];
        }
        acc[item.course].push(item);
        return acc;
      }, {})
    : {};

  if (isLoadingProgress) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Chargement..." size="xl">
        <div className="flex items-center justify-center py-12">
          <FiLoader className="w-8 h-8 animate-spin text-blue-500" />
          <p className="ml-3 text-gray-600">Chargement de la progression...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div className="flex items-center space-x-4">
            {student && (
              <>
                <Avatar
                  src={student.user?.avatar}
                  name={`${student.user?.firstName || ''} ${student.user?.lastName || ''}`}
                  size="lg"
                />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {student.user?.firstName} {student.user?.lastName}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {student.class?.name || 'N/A'} - ID: {student.studentId}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Moyenne</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.average.toFixed(2)}/20</p>
                </div>
                <FiAward className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Meilleure note</p>
                  <p className="text-2xl font-bold text-green-600">{stats.highest.toFixed(2)}/20</p>
                </div>
                <FiTrendingUp className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Note la plus basse</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.lowest.toFixed(2)}/20</p>
                </div>
                <FiTrendingDown className="w-8 h-8 text-yellow-400" />
              </div>
            </div>
            <div className={`p-4 rounded-lg border ${
              stats.trend >= 0
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Évolution</p>
                  <p className={`text-2xl font-bold ${
                    stats.trend >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stats.trend >= 0 ? '+' : ''}{stats.trend.toFixed(2)}
                  </p>
                </div>
                {stats.trend >= 0 ? (
                  <FiTrendingUp className="w-8 h-8 text-green-400" />
                ) : (
                  <FiTrendingDown className="w-8 h-8 text-red-400" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Progress Chart */}
        {studentProgress && studentProgress.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Évolution des Notes</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={studentProgress}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: fr })}
                />
                <YAxis domain={[0, 20]} />
                <Tooltip 
                  labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy', { locale: fr })}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#8B5CF6" 
                  strokeWidth={2}
                  name="Note (/20)"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Progress by Course */}
        {Object.keys(progressByCourse).length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Progression par Matière</h3>
            <div className="space-y-4">
              {Object.entries(progressByCourse).map(([course, data]: [string, any]) => {
                const courseAverage = data.reduce((sum: number, item: any) => sum + item.score, 0) / data.length;
                return (
                  <div key={course} className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-800 flex items-center">
                        <FiBook className="w-4 h-4 mr-2 text-purple-600" />
                        {course}
                      </h4>
                      <Badge
                        className={
                          courseAverage >= 16
                            ? 'bg-green-100 text-green-800'
                            : courseAverage >= 12
                            ? 'bg-blue-100 text-blue-800'
                            : courseAverage >= 10
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }
                      >
                        Moyenne: {courseAverage.toFixed(2)}/20
                      </Badge>
                    </div>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: fr })}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis domain={[0, 20]} tick={{ fontSize: 10 }} />
                        <Tooltip 
                          labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy', { locale: fr })}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#8B5CF6" 
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Grades */}
        {grades && grades.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Notes Récentes</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Matière</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Note</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Coefficient</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.slice(0, 10).map((grade: any) => {
                    const score = (grade.score / grade.maxScore) * 20;
                    return (
                      <tr key={grade.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-sm text-gray-700">
                          {format(new Date(grade.date), 'dd/MM/yyyy', { locale: fr })}
                        </td>
                        <td className="py-2 px-3 text-sm text-gray-700">{grade.course?.name || 'N/A'}</td>
                        <td className="py-2 px-3">
                          <Badge
                            className={
                              score >= 16
                                ? 'bg-green-100 text-green-800'
                                : score >= 12
                                ? 'bg-blue-100 text-blue-800'
                                : score >= 10
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }
                          >
                            {score.toFixed(2)}/20
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-sm text-gray-700">{grade.coefficient}</td>
                        <td className="py-2 px-3 text-sm text-gray-700">{getEvaluationTypeLabel(grade.evaluationType)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <Button onClick={onClose} variant="secondary">
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default StudentProgressModal;

