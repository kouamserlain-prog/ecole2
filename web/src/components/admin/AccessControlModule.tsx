import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import NFCStudentScanner from './NFCStudentScanner';
import NFCTeacherScanner from './NFCTeacherScanner';
import FaceBiometricHub from '../face/FaceBiometricHub';
import { ADM } from './adminModuleLayout';
import { FiCamera, FiClock, FiShield, FiUserCheck, FiWifi, FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';

type AccessTab = 'overview' | 'badges' | 'biometric' | 'entries' | 'visitors' | 'cctv' | 'alarm';

const ENTRY_TYPES = [
  { value: 'badge_entry', label: 'Badge entrée' },
  { value: 'badge_exit', label: 'Badge sortie' },
  { value: 'biometric_entry', label: 'Biométrie entrée' },
  { value: 'biometric_exit', label: 'Biométrie sortie' },
  { value: 'manual_entry', label: 'Manuel entrée' },
  { value: 'manual_exit', label: 'Manuel sortie' },
  { value: 'visitor_entry', label: 'Visiteur entrée' },
  { value: 'visitor_exit', label: 'Visiteur sortie' },
];

const AccessControlModule: React.FC = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AccessTab>('overview');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('');
  const [newLogOpen, setNewLogOpen] = useState(false);
  const [logForm, setLogForm] = useState({
    type: 'visitor_entry',
    description: '',
    severity: 'info' as 'info' | 'warning' | 'error' | 'critical',
  });

  const { data: overview } = useQuery({
    queryKey: ['access-overview'],
    queryFn: () => adminApi.getAccessControlOverview(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const { data: entryLogs } = useQuery({
    queryKey: ['access-entry-logs', logTypeFilter],
    queryFn: () =>
      adminApi.getAccessControlEntryLogs({
        ...(logTypeFilter && { type: logTypeFilter }),
        limit: 150,
      }),
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
  const { data: appointments } = useQuery({
    queryKey: ['access-appointments'],
    queryFn: () => adminApi.getAccessControlAppointments({}),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const { data: cctv } = useQuery({
    queryKey: ['access-cctv'],
    queryFn: () => adminApi.getAccessControlCctv(),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
  const { data: alarm } = useQuery({
    queryKey: ['access-alarm'],
    queryFn: () => adminApi.getAccessControlAlarm(),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const createLogMutation = useMutation({
    mutationFn: () =>
      adminApi.createAccessControlEntryLog({
        type: logForm.type,
        description: logForm.description,
        severity: logForm.severity,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-entry-logs'] });
      queryClient.invalidateQueries({ queryKey: ['access-overview'] });
      toast.success('Événement d’accès enregistré');
      setNewLogOpen(false);
      setLogForm({ type: 'visitor_entry', description: '', severity: 'info' });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const stats = useMemo(
    () => ({
      badges: Number(overview?.badgesAssigned ?? 0),
      bio: Number(overview?.biometricsEnrolled ?? 0),
      entries: Number(overview?.todayEntries ?? 0),
      exits: Number(overview?.todayExits ?? 0),
      visitors: Number(overview?.activeVisitorsEstimate ?? 0),
      critical: Number(overview?.criticalAlertsToday ?? 0),
    }),
    [overview]
  );

  const tabs: { id: AccessTab; label: string }[] = [
    { id: 'overview', label: "Vue d'ensemble" },
    { id: 'badges', label: 'Badges électroniques' },
    { id: 'biometric', label: 'Reconnaissance faciale' },
    { id: 'entries', label: 'Entrées / sorties' },
    { id: 'visitors', label: 'Visiteurs & rendez-vous' },
    { id: 'cctv', label: 'CCTV' },
    { id: 'alarm', label: "Système d'alarme" },
  ];

  const logs = (entryLogs as any[]) ?? [];
  const rowsAppointments = (appointments as any[]) ?? [];

  return (
    <div className={ADM.root}>
      <div>
        <h2 className={ADM.h2}>Contrôle d’accès</h2>
        <p className={ADM.intro}>
          Badges, biométrie, suivi des entrées/sorties, visiteurs et rendez-vous, supervision CCTV et état alarme.
        </p>
      </div>

      <div className={ADM.tabRow}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={ADM.tabBtn(tab === t.id, 'bg-blue-50 text-blue-900 ring-1 ring-blue-200')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Card className={`${ADM.statCard} border border-sky-100 bg-sky-50/40`}><p className={ADM.statLabel}>Badges</p><p className={ADM.statVal}>{stats.badges}</p></Card>
          <Card className={`${ADM.statCard} border border-indigo-100 bg-indigo-50/40`}><p className={ADM.statLabel}>Biométrie / visage</p><p className={ADM.statVal}>{stats.bio + Number(overview?.faceEnrolled ?? 0)}</p></Card>
          <Card className={`${ADM.statCard} border border-emerald-100 bg-emerald-50/40`}><p className={ADM.statLabel}>Entrées jour</p><p className={ADM.statVal}>{stats.entries}</p></Card>
          <Card className={`${ADM.statCard} border border-teal-100 bg-teal-50/40`}><p className={ADM.statLabel}>Sorties jour</p><p className={ADM.statVal}>{stats.exits}</p></Card>
          <Card className={`${ADM.statCard} border border-amber-100 bg-amber-50/40`}><p className={ADM.statLabel}>Visiteurs présents</p><p className={ADM.statVal}>{stats.visitors}</p></Card>
          <Card className={`${ADM.statCard} border border-rose-100 bg-rose-50/40`}><p className={ADM.statLabel}>Alertes critiques</p><p className={ADM.statVal}>{stats.critical}</p></Card>
        </div>
      )}

      {tab === 'badges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4"><h3 className="font-semibold text-stone-900 mb-2">Scanner NFC — Élèves</h3><NFCStudentScanner /></Card>
          <Card className="p-4"><h3 className="font-semibold text-stone-900 mb-2">Scanner NFC — Enseignants</h3><NFCTeacherScanner /></Card>
        </div>
      )}

      {tab === 'biometric' && <FaceBiometricHub />}

      {tab === 'entries' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtre type de passage"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={logTypeFilter}
              onChange={(e) => setLogTypeFilter(e.target.value)}
            >
              <option value="">Tous types</option>
              {ENTRY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <Button type="button" onClick={() => setNewLogOpen(true)}>Ajouter un passage manuel</Button>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Utilisateur</th>
                    <th className="py-3 px-4">Sévérité</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td className="py-4 px-4 text-gray-500" colSpan={5}>Aucun événement.</td></tr>
                  ) : (
                    logs.map((l: any) => (
                      <tr key={l.id} className="border-b border-gray-100">
                        <td className="py-3 px-4">{new Date(l.createdAt).toLocaleString('fr-FR')}</td>
                        <td className="py-3 px-4">{l.type}</td>
                        <td className="py-3 px-4">{l.description}</td>
                        <td className="py-3 px-4">{l.user ? `${l.user.firstName} ${l.user.lastName}` : 'Système'}</td>
                        <td className="py-3 px-4">{l.severity}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'visitors' && (
        <div className="space-y-3">
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <FiClock className="w-5 h-5 text-amber-600 mt-0.5" />
              <p className="text-sm text-gray-700">Les rendez-vous visiteurs sont actuellement alimentés depuis les rendez-vous parents-enseignants.</p>
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Parent/Visiteur</th>
                    <th className="py-3 px-4">Enseignant</th>
                    <th className="py-3 px-4">Élève</th>
                    <th className="py-3 px-4">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsAppointments.length === 0 ? (
                    <tr><td className="py-4 px-4 text-gray-500" colSpan={5}>Aucun rendez-vous.</td></tr>
                  ) : (
                    rowsAppointments.map((a: any) => (
                      <tr key={a.id} className="border-b border-gray-100">
                        <td className="py-3 px-4">{new Date(a.scheduledStart).toLocaleString('fr-FR')}</td>
                        <td className="py-3 px-4">{a.parent?.user ? `${a.parent.user.firstName} ${a.parent.user.lastName}` : '—'}</td>
                        <td className="py-3 px-4">{a.teacher?.user ? `${a.teacher.user.firstName} ${a.teacher.user.lastName}` : '—'}</td>
                        <td className="py-3 px-4">{a.student?.user ? `${a.student.user.firstName} ${a.student.user.lastName}` : '—'}</td>
                        <td className="py-3 px-4">{a.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'cctv' && (
        <Card className="p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-stone-900 font-semibold"><FiCamera className="w-4 h-4" /> Caméras de surveillance (CCTV)</div>
          <p><strong>Fournisseur :</strong> {cctv?.provider || '—'}</p>
          <p><strong>Statut :</strong> {cctv?.status || '—'}</p>
          <p><strong>Zones monitorées :</strong> {cctv?.monitoredZones ?? 0}</p>
          <p><strong>Alertes récentes :</strong> {(cctv?.lastAlerts as any[])?.length ?? 0}</p>
        </Card>
      )}

      {tab === 'alarm' && (
        <Card className="p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-stone-900 font-semibold"><FiShield className="w-4 h-4" /> Système d’alarme</div>
          <p><strong>Fournisseur :</strong> {alarm?.provider || '—'}</p>
          <p><strong>Armé :</strong> {alarm?.armed ? 'Oui' : 'Non'}</p>
          <p><strong>Mode :</strong> {alarm?.mode || '—'}</p>
          <p><strong>Dernier événement critique :</strong> {alarm?.lastCriticalEvent ? new Date(alarm.lastCriticalEvent.createdAt).toLocaleString('fr-FR') : 'Aucun'}</p>
          <div className="flex items-center gap-2 text-amber-700"><FiAlertTriangle className="w-4 h-4" /> Renseignez `ALARM_PROVIDER`, `ALARM_ARMED` et `ALARM_MODE` dans l’environnement pour un état précis.</div>
          <div className="flex items-center gap-2 text-sky-700"><FiWifi className="w-4 h-4" /> Pour CCTV : `CCTV_PROVIDER`, `CCTV_ENABLED`, `CCTV_ZONE_COUNT`.</div>
        </Card>
      )}

      <Modal isOpen={newLogOpen} onClose={() => setNewLogOpen(false)} title="Nouveau passage manuel">
        <div className="space-y-3">
          <select
            aria-label="Type de passage"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={logForm.type}
            onChange={(e) => setLogForm((f) => ({ ...f, type: e.target.value }))}
          >
            {ENTRY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Description"
            value={logForm.description}
            onChange={(e) => setLogForm((f) => ({ ...f, description: e.target.value }))}
          />
          <select
            aria-label="Sévérité"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={logForm.severity}
            onChange={(e) => setLogForm((f) => ({ ...f, severity: e.target.value as typeof f.severity }))}
          >
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="error">error</option>
            <option value="critical">critical</option>
          </select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setNewLogOpen(false)}>Annuler</Button>
            <Button type="button" onClick={() => createLogMutation.mutate()} disabled={createLogMutation.isPending || !logForm.description.trim()}>
              Enregistrer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AccessControlModule;
