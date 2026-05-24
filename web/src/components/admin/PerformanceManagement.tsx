import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';

function formatUptime(totalSeconds: number): string {
  if (totalSeconds < 1) return '0 min';
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { ADM } from './adminModuleLayout';
import {
  FiZap,
  FiTrendingUp,
  FiTrendingDown,
  FiActivity,
  FiClock,
  FiServer,
  FiDatabase,
  FiGlobe,
  FiBarChart,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertCircle,
  FiCpu,
  FiHardDrive,
  FiWifi,
  FiDownload,
  FiUpload,
  FiUsers,
  FiSettings,
} from 'react-icons/fi';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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
} from 'recharts';
import {
  chartBlueRed,
  CHART_BLUE,
  CHART_RED,
  CHART_ANIMATION_MS,
  PremiumTooltip,
  PremiumChartCard,
  RechartsViewport,
  CHART_GRID_SOFT,
  CHART_AXIS_TICK,
  CHART_MARGIN_COMPACT,
  LineAreaGradient,
  BarGradientsMulti,
  PieGradients,
  PremiumPieActiveShape,
  PremiumLegend,
  PREMIUM_BAR_RADIUS_TOP,
  PREMIUM_BAR_MAX_SIZE,
  PREMIUM_CHART_ANIMATION,
  PREMIUM_LINE_PROPS,
  PREMIUM_LEGEND_STYLE,
  premiumPieGeometry,
  premiumLegendFormatter,
  CHART_CURSOR,
} from '../charts';

type PerformanceTab = 'overview' | 'metrics' | 'usage' | 'optimization' | 'monitoring';

const PerformanceManagement = () => {
  const [activeTab, setActiveTab] = useState<PerformanceTab>('overview');
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 secondes par défaut
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Simuler des métriques de performance (dans un vrai projet, cela viendrait de l'API)
  const performanceMetrics = {
    responseTime: Math.random() * 200 + 50, // 50-250ms
    serverLoad: Math.random() * 30 + 20, // 20-50%
    databaseQueries: Math.floor(Math.random() * 1000 + 500), // 500-1500
    activeUsers: Math.floor(Math.random() * 50 + 10), // 10-60
    requestsPerMinute: Math.floor(Math.random() * 200 + 100), // 100-300
    cacheHitRate: Math.random() * 20 + 75, // 75-95%
    uptime: 99.9,
    memoryUsage: Math.random() * 20 + 40, // 40-60%
    cpuUsage: Math.random() * 15 + 10, // 10-25%
  };

  // Données pour les graphiques
  const responseTimeData = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}h`,
    responseTime: Math.random() * 200 + 50,
    requests: Math.floor(Math.random() * 200 + 100),
  }));

  const serverLoadData = Array.from({ length: 12 }, (_, i) => ({
    month: `M${i + 1}`,
    load: Math.random() * 30 + 20,
    memory: Math.random() * 20 + 40,
    cpu: Math.random() * 15 + 10,
  }));

  // Récupérer les statistiques réelles du dashboard
  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: adminApi.getDashboard,
  });

  const { data: sysMetrics, isLoading: sysLoading } = useQuery({
    queryKey: ['admin-system-metrics'],
    queryFn: adminApi.getSystemMetrics,
    refetchInterval: refreshInterval,
  });

  const usageData = [
    { name: 'Élèves', value: stats?.totalStudents || 0, color: '#3B82F6' },
    { name: 'Enseignants', value: stats?.totalTeachers || 0, color: '#10B981' },
    { name: 'Éducateurs', value: stats?.totalEducators || 0, color: '#8B5CF6' },
    { name: 'Parents', value: stats?.totalParents || 0, color: '#F59E0B' },
    { name: 'Administrateurs', value: 1, color: '#EF4444' },
  ];

  const optimizationData = [
    { name: 'Cache actif', value: 85, color: '#10B981' },
    { name: 'Optimisations', value: 92, color: '#3B82F6' },
    { name: 'Compression', value: 78, color: '#F59E0B' },
    { name: 'CDN', value: 65, color: '#8B5CF6' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const tabs = [
    { id: 'overview' as PerformanceTab, label: 'Vue d\'ensemble', icon: FiBarChart },
    { id: 'metrics' as PerformanceTab, label: 'Métriques', icon: FiActivity },
    { id: 'usage' as PerformanceTab, label: 'Utilisation', icon: FiUsers },
    { id: 'optimization' as PerformanceTab, label: 'Optimisation', icon: FiZap },
    { id: 'monitoring' as PerformanceTab, label: 'Monitoring', icon: FiServer },
  ];

  const getPerformanceStatus = (value: number, threshold: number, type: 'lower' | 'higher' = 'lower') => {
    if (type === 'lower') {
      return value < threshold ? 'good' : value < threshold * 1.5 ? 'warning' : 'critical';
    } else {
      return value > threshold ? 'good' : value > threshold * 0.5 ? 'warning' : 'critical';
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      good: { label: 'Excellent', color: 'bg-green-100 text-green-800' },
      warning: { label: 'Attention', color: 'bg-yellow-100 text-yellow-800' },
      critical: { label: 'Critique', color: 'bg-red-100 text-red-800' },
    };
    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return <Badge className={statusInfo.color}>{statusInfo.label}</Badge>;
  };

  return (
    <div className="space-y-4 text-sm">
      {/* Header */}
      <Card className="bg-gradient-to-r from-yellow-500 to-orange-500 p-3 text-white sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black leading-tight text-amber-50 sm:text-xl">
              Performance & Rapidité
            </h2>
            <p className="mt-0.5 text-xs leading-snug text-yellow-100/95 sm:text-sm">
              Interface rapide et réactive pour une expérience fluide
            </p>
          </div>
          <div className="hidden shrink-0 items-center space-x-3 md:flex">
            <div className="text-center">
              <div className="text-base font-bold tabular-nums text-amber-50 sm:text-lg">
                {sysLoading ? '…' : sysMetrics ? formatUptime(sysMetrics.uptimeSeconds) : '—'}
              </div>
              <div className="text-[10px] text-yellow-100 sm:text-xs">Uptime processus</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold tabular-nums text-amber-50 sm:text-lg">
                {sysMetrics?.memory?.heapUsedMb != null ? `${sysMetrics.memory.heapUsedMb}` : '—'}
              </div>
              <div className="text-[10px] text-yellow-100 sm:text-xs">Heap (Mo)</div>
            </div>
            <div className="text-center max-w-[7rem]">
              <div className="text-[10px] font-bold tabular-nums text-amber-50 sm:text-xs leading-tight truncate">
                {sysMetrics?.nodeVersion ?? '—'}
              </div>
              <div className="text-[10px] text-yellow-100 sm:text-xs">
                {sysMetrics?.env ?? '—'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Refresh Control */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              size="sm"
              onClick={() => setLastUpdate(new Date())}
              className="bg-yellow-500 hover:bg-yellow-600"
            >
              <FiRefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Actualiser
            </Button>
            <div className="text-xs text-gray-600 sm:text-sm">
              Dernière mise à jour : {lastUpdate.toLocaleTimeString('fr-FR')}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="perf-refresh-interval" className="text-xs text-gray-600 sm:text-sm">
              Intervalle :
            </label>
            <select
              id="perf-refresh-interval"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs sm:text-sm"
            >
              <option value={5000}>5 secondes</option>
              <option value={10000}>10 secondes</option>
              <option value={30000}>30 secondes</option>
              <option value={60000}>1 minute</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Card className="p-2 sm:p-3">
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
                  'bg-gradient-to-r from-yellow-500 to-orange-500'
                )}
              >
                <Icon className={ADM.bigTabIcon} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Content */}
      <div className="animate-slide-up">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <Card className="p-3 border border-blue-100 bg-blue-50/50">
              <p className="text-xs text-gray-700 leading-snug">
                <strong>Données réelles</strong> : temps de fonctionnement du processus Node, mémoire et
                version (endpoint <code className="text-[10px] bg-white/80 px-1 rounded">/api/admin/system/metrics</code>
                ). Les cartes et graphiques « charge serveur / cache » ci-dessous restent des{' '}
                <strong>illustrations</strong> tant qu’aucun outil APM n’est branché.
              </p>
            </Card>

            <div className={ADM.grid4}>
              <Card className={`border-l-4 border-slate-600 bg-gradient-to-br from-slate-50 to-slate-100 ${ADM.statCard}`}>
                <div className="min-w-0">
                  <p className={ADM.statLabel}>Uptime (API)</p>
                  <p className={`${ADM.statVal} text-slate-800`}>
                    {sysMetrics ? formatUptime(sysMetrics.uptimeSeconds) : sysLoading ? '…' : '—'}
                  </p>
                </div>
              </Card>
              <Card className={`border-l-4 border-indigo-500 bg-gradient-to-br from-indigo-50 to-indigo-100 ${ADM.statCard}`}>
                <div className="min-w-0">
                  <p className={ADM.statLabel}>Mémoire RSS (Mo)</p>
                  <p className={`${ADM.statVal} text-indigo-700`}>
                    {sysMetrics?.memory?.rssMb ?? (sysLoading ? '…' : '—')}
                  </p>
                </div>
              </Card>
              <Card className={`border-l-4 border-cyan-500 bg-gradient-to-br from-cyan-50 to-cyan-100 ${ADM.statCard}`}>
                <div className="min-w-0">
                  <p className={ADM.statLabel}>Heap utilisé / total</p>
                  <p className={`${ADM.statVal} text-cyan-800 text-base`}>
                    {sysMetrics
                      ? `${sysMetrics.memory.heapUsedMb} / ${sysMetrics.memory.heapTotalMb}`
                      : sysLoading
                        ? '…'
                        : '—'}
                  </p>
                </div>
              </Card>
              <Card className={`border-l-4 border-gray-500 bg-gradient-to-br from-gray-50 to-gray-100 ${ADM.statCard}`}>
                <div className="min-w-0">
                  <p className={ADM.statLabel}>Plateforme</p>
                  <p className={`${ADM.statVal} text-gray-800 text-sm`}>
                    {sysMetrics ? `${sysMetrics.platform} · ${sysMetrics.nodeVersion}` : sysLoading ? '…' : '—'}
                  </p>
                </div>
              </Card>
            </div>

            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Illustration (démonstration)
            </p>
            {/* Métriques principales */}
            <div className={ADM.grid4}>
              <Card className={`border-l-4 border-green-500 bg-gradient-to-br from-green-50 to-green-100 ${ADM.statCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={ADM.statLabel}>Temps de réponse</p>
                    <p className={`${ADM.statVal} text-green-600`}>
                      {performanceMetrics.responseTime.toFixed(0)}ms
                    </p>
                    {getPerformanceStatus(performanceMetrics.responseTime, 200, 'lower') === 'good' ? (
                      <FiTrendingDown className="mt-0.5 h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <FiTrendingUp className="mt-0.5 h-3.5 w-3.5 text-red-600" />
                    )}
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white">
                    <FiZap className="h-4 w-4" />
                  </div>
                </div>
              </Card>

              <Card className={`border-l-4 border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 ${ADM.statCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={ADM.statLabel}>Charge serveur</p>
                    <p className={`${ADM.statVal} text-blue-600`}>
                      {performanceMetrics.serverLoad.toFixed(1)}%
                    </p>
                    {getPerformanceStatus(performanceMetrics.serverLoad, 70, 'lower') === 'good' ? (
                      <FiCheckCircle className="mt-0.5 h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <FiAlertCircle className="mt-0.5 h-3.5 w-3.5 text-yellow-600" />
                    )}
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <FiServer className="h-4 w-4" />
                  </div>
                </div>
              </Card>

              <Card className={`border-l-4 border-purple-500 bg-gradient-to-br from-purple-50 to-purple-100 ${ADM.statCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={ADM.statLabel}>Taux de cache</p>
                    <p className={`${ADM.statVal} text-purple-600`}>
                      {performanceMetrics.cacheHitRate.toFixed(1)}%
                    </p>
                    {getPerformanceStatus(performanceMetrics.cacheHitRate, 80, 'higher') === 'good' ? (
                      <FiTrendingUp className="mt-0.5 h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <FiTrendingDown className="mt-0.5 h-3.5 w-3.5 text-yellow-600" />
                    )}
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white">
                    <FiDatabase className="h-4 w-4" />
                  </div>
                </div>
              </Card>

              <Card className={`border-l-4 border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100 ${ADM.statCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={ADM.statLabel}>Requêtes/min</p>
                    <p className={`${ADM.statVal} text-orange-600`}>
                      {performanceMetrics.requestsPerMinute}
                    </p>
                    <p className={ADM.statHint}>Actif</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-white">
                    <FiActivity className="h-4 w-4" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Graphiques de performance */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PremiumChartCard
                title="Temps de réponse (24h)"
                subtitle="Latence moyenne par créneau horaire"
                icon={FiClock}
                accent="sky"
                height={220}
              >
                <RechartsViewport height={200}>
                  <AreaChart data={responseTimeData} margin={CHART_MARGIN_COMPACT}>
                    <LineAreaGradient id="perf-response-area" colorFrom={CHART_BLUE} colorTo="#a5b4fc" />
                    <CartesianGrid {...CHART_GRID_SOFT} />
                    <XAxis dataKey="time" tick={CHART_AXIS_TICK} />
                    <YAxis width={32} tick={CHART_AXIS_TICK} />
                    <Tooltip content={(p) => <PremiumTooltip {...p} valueSuffix=" ms" />} cursor={CHART_CURSOR} />
                    <Area
                      type="monotone"
                      dataKey="responseTime"
                      stroke={CHART_BLUE}
                      strokeWidth={2.5}
                      fill="url(#perf-response-area)"
                      {...PREMIUM_CHART_ANIMATION}
                    />
                  </AreaChart>
                </RechartsViewport>
              </PremiumChartCard>

              <PremiumChartCard
                title="Charge serveur"
                subtitle="CPU, mémoire et charge globale"
                icon={FiServer}
                accent="rose"
                height={220}
              >
                <RechartsViewport height={200}>
                  <LineChart data={serverLoadData} margin={CHART_MARGIN_COMPACT}>
                    <CartesianGrid {...CHART_GRID_SOFT} />
                    <XAxis dataKey="month" tick={CHART_AXIS_TICK} />
                    <YAxis width={32} tick={CHART_AXIS_TICK} />
                    <Tooltip content={(p) => <PremiumTooltip {...p} valueSuffix="%" />} cursor={CHART_CURSOR} />
                    <Legend {...PREMIUM_LEGEND_STYLE} formatter={premiumLegendFormatter} />
                    <Line dataKey="load" stroke={CHART_RED} name="Charge" {...PREMIUM_LINE_PROPS} />
                    <Line dataKey="memory" stroke={CHART_BLUE} name="Mémoire" {...PREMIUM_LINE_PROPS} />
                    <Line
                      dataKey="cpu"
                      stroke={CHART_BLUE}
                      strokeDasharray="6 4"
                      name="CPU"
                      {...PREMIUM_LINE_PROPS}
                    />
                  </LineChart>
                </RechartsViewport>
              </PremiumChartCard>
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="space-y-4">
            <div className={ADM.grid3}>
              <Card className="p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">Temps de réponse</h4>
                  {getStatusBadge(getPerformanceStatus(performanceMetrics.responseTime, 200, 'lower'))}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Moyenne</span>
                    <span className="font-semibold">{performanceMetrics.responseTime.toFixed(0)}ms</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(performanceMetrics.responseTime / 500) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500">Objectif : &lt; 200ms</p>
                </div>
              </Card>

              <Card className="p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">Utilisation CPU</h4>
                  {getStatusBadge(getPerformanceStatus(performanceMetrics.cpuUsage, 70, 'lower'))}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Actuel</span>
                    <span className="font-semibold">{performanceMetrics.cpuUsage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${performanceMetrics.cpuUsage}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500">Objectif : &lt; 70%</p>
                </div>
              </Card>

              <Card className="p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">Utilisation mémoire</h4>
                  {getStatusBadge(getPerformanceStatus(performanceMetrics.memoryUsage, 80, 'lower'))}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Actuel</span>
                    <span className="font-semibold">{performanceMetrics.memoryUsage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${performanceMetrics.memoryUsage}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500">Objectif : &lt; 80%</p>
                </div>
              </Card>

              <Card className="p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">Requêtes base de données</h4>
                  {getStatusBadge('good')}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total</span>
                    <span className="font-semibold">{performanceMetrics.databaseQueries}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <FiDatabase className="w-4 h-4" />
                    <span>Optimisées</span>
                  </div>
                </div>
              </Card>

              <Card className="p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">Taux de cache</h4>
                  {getStatusBadge(getPerformanceStatus(performanceMetrics.cacheHitRate, 80, 'higher'))}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Actuel</span>
                    <span className="font-semibold">{performanceMetrics.cacheHitRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-600 h-2 rounded-full"
                      style={{ width: `${performanceMetrics.cacheHitRate}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500">Objectif : &gt; 80%</p>
                </div>
              </Card>

              <Card className="p-3 sm:p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">Disponibilité</h4>
                  {getStatusBadge('good')}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Uptime</span>
                    <span className="font-semibold">{performanceMetrics.uptime.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <FiCheckCircle className="w-4 h-4 text-green-600" />
                    <span>Système opérationnel</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PremiumChartCard
                title="Répartition des utilisateurs"
                subtitle="Par profil connecté"
                icon={FiUsers}
                accent="indigo"
                height={256}
                footer={
                  <PremiumLegend
                    items={usageData.map((d, i) => {
                      const total = usageData.reduce((s, x) => s + x.value, 0);
                      return {
                        name: d.name,
                        value: d.value,
                        color: chartBlueRed(i),
                        pct: total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0,
                      };
                    })}
                  />
                }
              >
                <RechartsViewport height={220}>
                  <PieChart>
                    <PieGradients count={usageData.length} idPrefix="perf-usage-pie" />
                    <Pie
                      data={usageData}
                      cx="50%"
                      cy="50%"
                      dataKey="value"
                      activeShape={PremiumPieActiveShape}
                      {...premiumPieGeometry(usageData.length)}
                    >
                      {usageData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#perf-usage-pie-${index})`} />
                      ))}
                    </Pie>
                    <Tooltip content={(p) => <PremiumTooltip {...p} />} />
                  </PieChart>
                </RechartsViewport>
              </PremiumChartCard>

              <PremiumChartCard
                title="Activité par heure"
                subtitle="Volume de requêtes"
                icon={FiActivity}
                accent="violet"
                height={256}
              >
                <RechartsViewport height={220}>
                  <BarChart data={responseTimeData} margin={CHART_MARGIN_COMPACT}>
                    <BarGradientsMulti count={1} idPrefix="perf-requests-bar" />
                    <CartesianGrid {...CHART_GRID_SOFT} />
                    <XAxis dataKey="time" tick={CHART_AXIS_TICK} />
                    <YAxis width={32} tick={CHART_AXIS_TICK} />
                    <Tooltip content={(p) => <PremiumTooltip {...p} />} cursor={CHART_CURSOR} />
                    <Bar
                      dataKey="requests"
                      fill="url(#perf-requests-bar-0)"
                      radius={PREMIUM_BAR_RADIUS_TOP}
                      maxBarSize={PREMIUM_BAR_MAX_SIZE}
                      {...PREMIUM_CHART_ANIMATION}
                    />
                  </BarChart>
                </RechartsViewport>
              </PremiumChartCard>
            </div>

            <Card className="p-3 sm:p-4">
              <h3 className={`${ADM.h2} mb-3 text-gray-800`}>Statistiques d&apos;utilisation</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="flex items-center space-x-2">
                    <FiUsers className="h-5 w-5 shrink-0 text-blue-600" />
                    <div>
                      <p className="text-lg font-bold text-gray-800">{performanceMetrics.activeUsers}</p>
                      <p className="text-xs text-gray-600">Utilisateurs actifs</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <div className="flex items-center space-x-2">
                    <FiActivity className="h-5 w-5 shrink-0 text-green-600" />
                    <div>
                      <p className="text-lg font-bold text-gray-800">
                        {performanceMetrics.requestsPerMinute}
                      </p>
                      <p className="text-xs text-gray-600">Requêtes/minute</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-purple-50 p-3">
                  <div className="flex items-center space-x-2">
                    <FiDatabase className="h-5 w-5 shrink-0 text-purple-600" />
                    <div>
                      <p className="text-lg font-bold text-gray-800">
                        {performanceMetrics.databaseQueries}
                      </p>
                      <p className="text-xs text-gray-600">Requêtes DB</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'optimization' && (
          <div className="space-y-4">
            <Card className="p-3 sm:p-4">
              <h3 className={`${ADM.h2} mb-3 text-gray-800`}>État des optimisations</h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
                {optimizationData.map((item, index) => (
                  <div key={index} className="rounded-lg bg-gray-50 p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-800">{item.name}</h4>
                      <Badge className={item.value >= 80 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {item.value}%
                      </Badge>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${item.value}%`, backgroundColor: item.color }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-3 sm:p-4">
              <h3 className={`${ADM.h2} mb-3 text-gray-800`}>Recommandations d&apos;optimisation</h3>
              <div className="space-y-2">
                <div className="flex items-start space-x-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <FiZap className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <div>
                    <h4 className="mb-0.5 text-sm font-semibold text-gray-800">Activer la compression GZIP</h4>
                    <p className="text-xs text-gray-600">
                      Réduire la taille des réponses HTTP de 60-70% pour améliorer les temps de chargement.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 rounded-lg border border-green-200 bg-green-50 p-3">
                  <FiDatabase className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <div>
                    <h4 className="mb-0.5 text-sm font-semibold text-gray-800">Optimiser les requêtes DB</h4>
                    <p className="text-xs text-gray-600">
                      Ajouter des index sur les champs fréquemment utilisés pour accélérer les recherches.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <FiServer className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                  <div>
                    <h4 className="mb-0.5 text-sm font-semibold text-gray-800">Mettre en cache les données statiques</h4>
                    <p className="text-xs text-gray-600">
                      Utiliser Redis ou Memcached pour mettre en cache les données fréquemment accédées.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <FiGlobe className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
                  <div>
                    <h4 className="mb-0.5 text-sm font-semibold text-gray-800">Utiliser un CDN</h4>
                    <p className="text-xs text-gray-600">
                      Distribuer les assets statiques via un CDN pour réduire la latence.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="space-y-4">
            <div className={ADM.grid4}>
              <Card className={`border-l-4 border-red-500 bg-gradient-to-br from-red-50 to-red-100 ${ADM.statCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={ADM.statLabel}>CPU</p>
                    <p className={`${ADM.statVal} text-red-600`}>{performanceMetrics.cpuUsage.toFixed(1)}%</p>
                  </div>
                  <FiCpu className="h-7 w-7 shrink-0 text-red-600" />
                </div>
              </Card>

              <Card className={`border-l-4 border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 ${ADM.statCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={ADM.statLabel}>Mémoire</p>
                    <p className={`${ADM.statVal} text-blue-600`}>
                      {performanceMetrics.memoryUsage.toFixed(1)}%
                    </p>
                  </div>
                  <FiHardDrive className="h-7 w-7 shrink-0 text-blue-600" />
                </div>
              </Card>

              <Card className={`border-l-4 border-green-500 bg-gradient-to-br from-green-50 to-green-100 ${ADM.statCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={ADM.statLabel}>Réseau</p>
                    <p className={`${ADM.statVal} text-base text-green-600`}>Normal</p>
                  </div>
                  <FiWifi className="h-7 w-7 shrink-0 text-green-600" />
                </div>
              </Card>

              <Card className={`border-l-4 border-purple-500 bg-gradient-to-br from-purple-50 to-purple-100 ${ADM.statCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={ADM.statLabel}>Disque</p>
                    <p className={`${ADM.statVal} text-purple-600`}>65%</p>
                  </div>
                  <FiDatabase className="h-7 w-7 shrink-0 text-purple-600" />
                </div>
              </Card>
            </div>

            <PremiumChartCard
              title="Monitoring en temps réel"
              subtitle="Latence et volume de requêtes superposés"
              icon={FiActivity}
              accent="emerald"
              height={300}
              className="w-full"
            >
              <RechartsViewport height={268}>
                <AreaChart data={responseTimeData} margin={CHART_MARGIN_COMPACT}>
                  <LineAreaGradient id="perf-monitor-response" colorFrom={CHART_BLUE} colorTo="#93c5fd" />
                  <LineAreaGradient id="perf-monitor-requests" colorFrom={CHART_RED} colorTo="#fca5a5" />
                  <CartesianGrid {...CHART_GRID_SOFT} />
                  <XAxis dataKey="time" tick={CHART_AXIS_TICK} />
                  <YAxis width={32} tick={CHART_AXIS_TICK} />
                  <Tooltip content={(p) => <PremiumTooltip {...p} />} cursor={CHART_CURSOR} />
                  <Legend {...PREMIUM_LEGEND_STYLE} formatter={premiumLegendFormatter} />
                  <Area
                    type="monotone"
                    dataKey="responseTime"
                    stackId="1"
                    stroke={CHART_BLUE}
                    strokeWidth={2}
                    fill="url(#perf-monitor-response)"
                    name="Temps de réponse"
                    {...PREMIUM_CHART_ANIMATION}
                  />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    stackId="2"
                    stroke={CHART_RED}
                    strokeWidth={2}
                    fill="url(#perf-monitor-requests)"
                    name="Requêtes"
                    {...PREMIUM_CHART_ANIMATION}
                  />
                </AreaChart>
              </RechartsViewport>
            </PremiumChartCard>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceManagement;






