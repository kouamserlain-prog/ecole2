import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import SearchBar from '../ui/SearchBar';
import FilterDropdown from '../ui/FilterDropdown';
import Avatar from '../ui/Avatar';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiAward,
  FiAlertCircle,
  FiBook,
  FiUsers,
  FiBarChart,
  FiTarget,
  FiActivity,
  FiCheckCircle,
  FiXCircle,
  FiEye,
  FiDownload,
  FiRefreshCw,
  FiCalendar,
  FiUser,
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import toast from 'react-hot-toast';
import StudentProgressModal from './StudentProgressModal';
import { ADM } from './adminModuleLayout';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';
import {
  chartBlueRed,
  CHART_BLUE,
  CHART_RED,
  PremiumTooltip,
  PremiumChartCard,
  RechartsViewport,
  CHART_GRID_SOFT,
  CHART_AXIS_TICK,
  CHART_MARGIN_COMPACT,
  CHART_MARGIN_TILTED,
  LineAreaGradient,
  BarGradientsMulti,
  PieGradients,
  PremiumPieActiveShape,
  PremiumLegend,
  PREMIUM_BAR_RADIUS_TOP,
  PREMIUM_BAR_MAX_SIZE,
  PREMIUM_CHART_ANIMATION,
  PREMIUM_LEGEND_STYLE,
  premiumPieGeometry,
  premiumLegendFormatter,
  CHART_CURSOR,
} from '../charts';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type TrackingTab = 'overview' | 'students' | 'classes' | 'courses' | 'at-risk';

const PedagogicalTracking = () => {
  const [activeTab, setActiveTab] = useState<TrackingTab>('overview');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [isStudentProgressModalOpen, setIsStudentProgressModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: adminApi.getClasses,
  });

  const { data: courses } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: () => adminApi.getAllCourses(),
  });

  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: adminApi.getStudents,
  });

  const { data: classStats } = useQuery({
    queryKey: ['class-stats', selectedClass],
    queryFn: () => adminApi.getClassStats(selectedClass),
    enabled: selectedClass !== 'all' && activeTab === 'classes' && !!selectedClass,
  });

  const { data: courseStats } = useQuery({
    queryKey: ['course-stats', selectedCourse, selectedClass],
    queryFn: () =>
      adminApi.getCourseStats({
        ...(selectedCourse !== 'all' && { courseId: selectedCourse }),
        ...(selectedClass !== 'all' && { classId: selectedClass }),
      }),
    enabled: activeTab === 'courses',
  });

  const { data: atRiskStudents } = useQuery({
    queryKey: ['students-at-risk', selectedClass],
    queryFn: () => adminApi.getStudentsAtRisk(selectedClass !== 'all' ? selectedClass : undefined),
    enabled: activeTab === 'at-risk',
  });

  const { data: studentProgress } = useQuery({
    queryKey: ['student-progress', selectedStudent],
    queryFn: () => adminApi.getStudentProgress(selectedStudent!),
    enabled: !!selectedStudent && activeTab === 'students',
  });

  const { data: allGrades } = useQuery({
    queryKey: ['admin-grades'],
    queryFn: () => adminApi.getAllGrades(),
  });

  const { data: allAbsences } = useQuery({
    queryKey: ['admin-absences'],
    queryFn: () => adminApi.getAllAbsences(),
  });

  // Calculer les statistiques globales
  const overallStats = {
    totalStudents: students?.length || 0,
    averageGrade: allGrades?.length
      ? allGrades.reduce((sum: number, g: any) => sum + (g.score / g.maxScore) * 20, 0) / allGrades.length
      : 0,
    totalAbsences: allAbsences?.filter((a: any) => !a.excused).length || 0,
    successRate:
      allGrades?.length && students?.length
        ? (allGrades.filter((g: any) => (g.score / g.maxScore) * 20 >= 10).length / allGrades.length) * 100
        : 0,
  };

  // Préparer les données pour les graphiques
  const gradeDistribution = allGrades
    ? [
        {
          name: 'Excellent (≥16)',
          count: allGrades.filter((g: any) => (g.score / g.maxScore) * 20 >= 16).length,
        },
        {
          name: 'Bien (12-16)',
          count: allGrades.filter(
            (g: any) => (g.score / g.maxScore) * 20 >= 12 && (g.score / g.maxScore) * 20 < 16
          ).length,
        },
        {
          name: 'Moyen (10-12)',
          count: allGrades.filter(
            (g: any) => (g.score / g.maxScore) * 20 >= 10 && (g.score / g.maxScore) * 20 < 12
          ).length,
        },
        {
          name: 'Faible (<10)',
          count: allGrades.filter((g: any) => (g.score / g.maxScore) * 20 < 10).length,
        },
      ]
    : [];

  const classPerformanceData = classStats
    ? classStats.map((s: any) => ({
        name: `${s.firstName} ${s.lastName}`,
        moyenne: s.average.toFixed(2),
        absences: s.absences,
      }))
    : [];

  const tabs = [
    { id: 'overview' as TrackingTab, label: 'Vue d\'ensemble', icon: FiBarChart },
    { id: 'students' as TrackingTab, label: 'Élèves', icon: FiUsers },
    { id: 'classes' as TrackingTab, label: 'Classes', icon: FiBook },
    { id: 'courses' as TrackingTab, label: 'Matières', icon: FiTarget },
    { id: 'at-risk' as TrackingTab, label: 'Élèves à risque', icon: FiAlertCircle },
  ];

  const getRiskBadge = (level: string) => {
    if (level === 'high')
      return (
        <Badge className="bg-red-100 text-red-800">
          <FiAlertCircle className="w-3 h-3 mr-1 inline" />
          Risque élevé
        </Badge>
      );
    if (level === 'medium')
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          <FiAlertCircle className="w-3 h-3 mr-1 inline" />
          Risque moyen
        </Badge>
      );
    return null;
  };

  // Export functions for at-risk students
  const exportAtRiskStudentsToCSV = () => {
    if (!atRiskStudents || atRiskStudents.length === 0) {
      toast.error('Aucun élève à risque à exporter');
      return;
    }

    try {
      const headers = ['Élève', 'Classe', 'Moyenne', 'Absences non justifiées', 'Niveau de risque'];
      const csvContent =
        '\ufeff' + // BOM for UTF-8
        headers.join(';') +
        '\n' +
        atRiskStudents
          .map((student: any) =>
            [
              `"${student.firstName} ${student.lastName}"`,
              `"${student.class}"`,
              `${student.average.toFixed(2)}/20`,
              student.unexcusedAbsences,
              student.riskLevel,
            ].join(';')
          )
          .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `eleves_a_risque_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Rapport exporté en CSV avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const exportAtRiskStudentsToJSON = () => {
    if (!atRiskStudents || atRiskStudents.length === 0) {
      toast.error('Aucun élève à risque à exporter');
      return;
    }

    try {
      const jsonData = atRiskStudents.map((student: any) => ({
        élève: `${student.firstName} ${student.lastName}`,
        classe: student.class,
        moyenne: `${student.average.toFixed(2)}/20`,
        absencesNonJustifiées: student.unexcusedAbsences,
        niveauDeRisque: student.riskLevel,
      }));

      const jsonString = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `eleves_a_risque_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Rapport exporté en JSON avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export JSON:', error);
      toast.error('Erreur lors de l\'export JSON');
    }
  };

  const exportAtRiskStudentsToPDF = () => {
    if (!atRiskStudents || atRiskStudents.length === 0) {
      toast.error('Aucun élève à risque à exporter');
      return;
    }

    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const currentDate = new Date().toLocaleDateString('fr-FR');
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(139, 92, 246);
      doc.text('School Manager', 14, 20);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Rapport des Élèves à Risque', 14, 30);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Généré le ${currentDate}`, 14, 37);

      const tableData = atRiskStudents.map((student: any) => [
        `${student.firstName} ${student.lastName}`,
        student.class,
        `${student.average.toFixed(2)}/20`,
        student.unexcusedAbsences.toString(),
        student.riskLevel === 'high' ? 'Élevé' : 'Moyen',
      ]);

      const useAutoTable = (options: any) => {
        if (typeof (doc as any).autoTable === 'function') {
          (doc as any).autoTable(options);
        } else if (typeof autoTable === 'function') {
          autoTable(doc, options);
        } else {
          throw new Error('autoTable is not available');
        }
      };

      useAutoTable({
        head: [['Élève', 'Classe', 'Moyenne', 'Absences non justifiées', 'Niveau de risque']],
        body: tableData,
        startY: 45,
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });

      doc.save(`eleves_a_risque_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Rapport exporté en PDF avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de l\'export PDF:', error);
      toast.error(`Erreur lors de l'export PDF: ${error.message || 'Erreur inconnue'}`);
    }
  };

  return (
    <div className={ADM.pageRoot}>
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className={`text-purple-50 ${ADM.heroTitle}`}>Suivi Pédagogique</h2>
            <p className="text-purple-100/95 text-sm leading-snug mt-0.5">
              Analysez les performances et la progression des élèves
            </p>
          </div>
          <div className="hidden md:flex items-center space-x-4 shrink-0">
            <div className="text-center">
              <div className={`text-purple-50 ${ADM.heroStatNum}`}>{overallStats.averageGrade.toFixed(2)}</div>
              <div className={`text-purple-100 ${ADM.heroStatLbl}`}>Moyenne générale</div>
            </div>
            <div className="text-center">
              <div className={`text-purple-50 ${ADM.heroStatNum}`}>{overallStats.successRate.toFixed(1)}%</div>
              <div className={`text-purple-100 ${ADM.heroStatLbl}`}>Taux de réussite</div>
            </div>
            <div className="text-center">
              <div className={`text-purple-50 ${ADM.heroStatNum}`}>{overallStats.totalAbsences}</div>
              <div className={`text-purple-100 ${ADM.heroStatLbl}`}>Absences non justifiées</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Card>
        <div className={ADM.bigTabRow}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={ADM.bigTabBtn(
                  isActive,
                  'bg-gradient-to-r from-purple-600 to-pink-600'
                )}
              >
                <Icon className={ADM.bigTabIcon} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Filters */}
      {(activeTab === 'classes' || activeTab === 'courses' || activeTab === 'at-risk') && (
        <Card>
          <div className="flex flex-col md:flex-row gap-4">
            <FilterDropdown
              label="Classe"
              value={selectedClass}
              onChange={setSelectedClass}
              options={[
                { value: 'all', label: 'Toutes les classes' },
                ...(classes?.map((c: any) => ({ value: c.id, label: c.name })) || []),
              ]}
            />
            {activeTab === 'courses' && (
              <FilterDropdown
                label="Matière"
                value={selectedCourse}
                onChange={setSelectedCourse}
                options={[
                  { value: 'all', label: 'Toutes les matières' },
                  ...(courses?.map((c: any) => ({ value: c.id, label: c.name })) || []),
                ]}
              />
            )}
          </div>
        </Card>
      )}

      {/* Content */}
      <div className="animate-slide-up">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PremiumChartCard
              title="Distribution des notes"
              subtitle="Répartition par tranche"
              icon={FiAward}
              accent="indigo"
              height={300}
              footer={
                <PremiumLegend
                  items={gradeDistribution.map((d: { name: string; count: number }, i: number) => {
                    const total = gradeDistribution.reduce((s: number, x: { count: number }) => s + x.count, 0);
                    return {
                      name: d.name,
                      value: d.count,
                      color: chartBlueRed(i),
                      pct: total > 0 ? Math.round((d.count / total) * 1000) / 10 : 0,
                    };
                  })}
                />
              }
            >
              <RechartsViewport height={260}>
                <PieChart>
                  <PieGradients count={gradeDistribution.length} idPrefix="ped-grade-pie" />
                  <Pie
                    data={gradeDistribution}
                    cx="50%"
                    cy="50%"
                    dataKey="count"
                    activeShape={PremiumPieActiveShape}
                    {...premiumPieGeometry(gradeDistribution.length)}
                  >
                    {gradeDistribution.map((_: unknown, index: number) => (
                      <Cell key={`cell-${index}`} fill={`url(#ped-grade-pie-${index})`} />
                    ))}
                  </Pie>
                  <Tooltip content={(p) => <PremiumTooltip {...p} />} />
                </PieChart>
              </RechartsViewport>
            </PremiumChartCard>

            <PremiumChartCard
              title="Évolution des performances"
              subtitle="Volume par tranche de notes"
              icon={FiTrendingUp}
              accent="emerald"
              height={300}
            >
              <RechartsViewport height={260}>
                <AreaChart data={gradeDistribution} margin={CHART_MARGIN_COMPACT}>
                  <LineAreaGradient id="ped-grade-area" colorFrom={CHART_BLUE} colorTo="#93c5fd" />
                  <CartesianGrid {...CHART_GRID_SOFT} />
                  <XAxis dataKey="name" tick={CHART_AXIS_TICK} />
                  <YAxis width={32} tick={CHART_AXIS_TICK} />
                  <Tooltip content={(p) => <PremiumTooltip {...p} />} cursor={CHART_CURSOR} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={CHART_BLUE}
                    strokeWidth={2.5}
                    fill="url(#ped-grade-area)"
                    {...PREMIUM_CHART_ANIMATION}
                  />
                </AreaChart>
              </RechartsViewport>
            </PremiumChartCard>

            {/* Statistiques globales */}
            <Card className="lg:col-span-2">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Statistiques Globales</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <FiUsers className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-600">{overallStats.totalStudents}</div>
                  <div className="text-sm text-gray-600">Élèves</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <FiAward className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-600">
                    {overallStats.averageGrade.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600">Moyenne</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <FiTrendingUp className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-yellow-600">
                    {overallStats.successRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Réussite</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <FiAlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-red-600">{overallStats.totalAbsences}</div>
                  <div className="text-sm text-gray-600">Absences</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'classes' && selectedClass !== 'all' && (
          <Card>
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              Performances de la classe{' '}
              {classes?.find((c: any) => c.id === selectedClass)?.name}
            </h3>
            {classStats && classStats.length > 0 ? (
              <div className="space-y-4">
                <RechartsViewport height={380}>
                  <BarChart data={classPerformanceData} margin={CHART_MARGIN_TILTED}>
                    <BarGradientsMulti count={2} idPrefix="ped-class-bar" />
                    <CartesianGrid {...CHART_GRID_SOFT} />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={CHART_AXIS_TICK} />
                    <YAxis width={32} tick={CHART_AXIS_TICK} />
                    <Tooltip content={(p) => <PremiumTooltip {...p} />} cursor={CHART_CURSOR} />
                    <Legend {...PREMIUM_LEGEND_STYLE} formatter={premiumLegendFormatter} />
                    <Bar
                      dataKey="moyenne"
                      fill="url(#ped-class-bar-0)"
                      name="Moyenne"
                      radius={PREMIUM_BAR_RADIUS_TOP}
                      maxBarSize={PREMIUM_BAR_MAX_SIZE}
                      {...PREMIUM_CHART_ANIMATION}
                    />
                    <Bar
                      dataKey="absences"
                      fill="url(#ped-class-bar-1)"
                      name="Absences"
                      radius={PREMIUM_BAR_RADIUS_TOP}
                      maxBarSize={PREMIUM_BAR_MAX_SIZE}
                      {...PREMIUM_CHART_ANIMATION}
                    />
                  </BarChart>
                </RechartsViewport>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Élève</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Moyenne</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Absences</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStats.map((student: any) => (
                        <tr key={student.studentId} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">
                            {student.firstName} {student.lastName}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              className={
                                student.average >= 16
                                  ? 'bg-green-100 text-green-800'
                                  : student.average >= 12
                                  ? 'bg-blue-100 text-blue-800'
                                  : student.average >= 10
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }
                            >
                              {student.average.toFixed(2)}/20
                            </Badge>
                          </td>
                          <td className="py-3 px-4">{student.absences}</td>
                          <td className="py-3 px-4">
                            {student.average >= 10 ? (
                              <Badge className="bg-green-100 text-green-800">
                                <FiCheckCircle className="w-3 h-3 mr-1 inline" />
                                En bonne voie
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">
                                <FiXCircle className="w-3 h-3 mr-1 inline" />
                                En difficulté
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <FiBook className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Sélectionnez une classe pour voir les statistiques</p>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'courses' && (
          <Card>
            <h3 className="text-xl font-bold text-gray-800 mb-6">Statistiques par Matière</h3>
            {courseStats ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{courseStats.totalGrades}</div>
                    <div className="text-sm text-gray-600">Notes totales</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {courseStats.average.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">Moyenne</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {courseStats.distribution.excellent}
                    </div>
                    <div className="text-sm text-gray-600">Excellent</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {courseStats.distribution.weak}
                    </div>
                    <div className="text-sm text-gray-600">Faible</div>
                  </div>
                </div>
                <PremiumChartCard
                  title="Distribution par niveau"
                  subtitle="Répartition des performances sur la matière"
                  icon={FiTarget}
                  accent="violet"
                  height={300}
                >
                  <RechartsViewport height={260}>
                    <BarChart
                      data={[
                        { name: 'Excellent', value: courseStats.distribution.excellent },
                        { name: 'Bien', value: courseStats.distribution.good },
                        { name: 'Moyen', value: courseStats.distribution.average },
                        { name: 'Faible', value: courseStats.distribution.weak },
                      ]}
                      margin={CHART_MARGIN_COMPACT}
                    >
                      <BarGradientsMulti count={4} idPrefix="ped-course-bar" />
                      <CartesianGrid {...CHART_GRID_SOFT} />
                      <XAxis dataKey="name" tick={CHART_AXIS_TICK} />
                      <YAxis width={32} tick={CHART_AXIS_TICK} />
                      <Tooltip content={(p) => <PremiumTooltip {...p} />} cursor={CHART_CURSOR} />
                      <Bar
                        dataKey="value"
                        radius={PREMIUM_BAR_RADIUS_TOP}
                        maxBarSize={PREMIUM_BAR_MAX_SIZE}
                        {...PREMIUM_CHART_ANIMATION}
                      >
                        {[0, 1, 2, 3].map((i) => (
                          <Cell key={i} fill={`url(#ped-course-bar-${i})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </RechartsViewport>
                </PremiumChartCard>
              </div>
            ) : (
              <div className="text-center py-12">
                <FiTarget className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Sélectionnez une matière pour voir les statistiques</p>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'at-risk' && (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">Élèves à Risque</h3>
              <div className="relative">
                <Button 
                  onClick={() => {
                    const menu = document.getElementById('export-at-risk-menu');
                    menu?.classList.toggle('hidden');
                  }}
                  title="Exporter le rapport"
                >
                  <FiDownload className="w-4 h-4 mr-2" />
                  Exporter le rapport
                </Button>
                <div id="export-at-risk-menu" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                  <button
                    onClick={() => {
                      exportAtRiskStudentsToCSV();
                      document.getElementById('export-at-risk-menu')?.classList.add('hidden');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <FiDownload className="w-4 h-4 text-green-600" />
                    <span>Exporter en CSV</span>
                  </button>
                  <button
                    onClick={() => {
                      exportAtRiskStudentsToJSON();
                      document.getElementById('export-at-risk-menu')?.classList.add('hidden');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <FiDownload className="w-4 h-4 text-blue-600" />
                    <span>Exporter en JSON</span>
                  </button>
                  <button
                    onClick={() => {
                      exportAtRiskStudentsToPDF();
                      document.getElementById('export-at-risk-menu')?.classList.add('hidden');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <FiDownload className="w-4 h-4 text-red-600" />
                    <span>Exporter en PDF</span>
                  </button>
                </div>
              </div>
            </div>
            {atRiskStudents && atRiskStudents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Élève</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Classe</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Moyenne</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Absences</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Niveau de risque</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRiskStudents.map((student: any) => (
                      <tr
                        key={student.studentId}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <FiUser className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">
                              {student.firstName} {student.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className="bg-blue-100 text-blue-800">{student.class}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              student.average >= 12
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }
                          >
                            {student.average.toFixed(2)}/20
                          </Badge>
                        </td>
                        <td className="py-3 px-4">{student.unexcusedAbsences}</td>
                        <td className="py-3 px-4">{getRiskBadge(student.riskLevel)}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => {
                              setSelectedStudent(student.studentId);
                              setIsStudentProgressModalOpen(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Voir la progression"
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FiCheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                <p className="text-gray-600">Aucun élève à risque identifié</p>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'students' && (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">Suivi des Élèves</h3>
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Rechercher un élève..."
                className="w-64"
              />
            </div>
            {students && students.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Élève</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Classe</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">ID Élève</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students
                      .filter((student: any) => {
                        const searchLower = searchQuery.toLowerCase();
                        return (
                          student.user.firstName.toLowerCase().includes(searchLower) ||
                          student.user.lastName.toLowerCase().includes(searchLower) ||
                          student.studentId.toLowerCase().includes(searchLower) ||
                          student.class?.name.toLowerCase().includes(searchLower)
                        );
                      })
                      .map((student: any) => (
                        <tr
                          key={student.id}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-3">
                              <Avatar
                                src={student.user.avatar}
                                name={`${student.user.firstName} ${student.user.lastName}`}
                                size="sm"
                              />
                              <div>
                                <div className="font-medium text-gray-800">
                                  {student.user.firstName} {student.user.lastName}
                                </div>
                                <div className="text-sm text-gray-500">{student.user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className="bg-blue-100 text-blue-800">
                              {student.class?.name || 'N/A'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">{student.studentId}</td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => {
                                setSelectedStudent(student.studentId);
                                setIsStudentProgressModalOpen(true);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Voir la progression"
                            >
                              <FiEye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FiUsers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Aucun élève trouvé</p>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Student Progress Modal */}
      {selectedStudent && (
        <StudentProgressModal
          isOpen={isStudentProgressModalOpen}
          onClose={() => {
            setIsStudentProgressModalOpen(false);
            setSelectedStudent(null);
          }}
          studentId={selectedStudent}
        />
      )}
    </div>
  );
};

export default PedagogicalTracking;

