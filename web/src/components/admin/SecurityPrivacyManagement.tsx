import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import SearchBar from '../ui/SearchBar';
import FilterDropdown from '../ui/FilterDropdown';
import toast from 'react-hot-toast';
import { ADM } from './adminModuleLayout';
import {
  FiShield,
  FiLock,
  FiEye,
  FiEyeOff,
  FiAlertCircle,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiUser,
  FiGlobe,
  FiDatabase,
  FiKey,
  FiRefreshCw,
  FiDownload,
  FiSearch,
  FiFilter,
  FiTrash2,
  FiEdit,
  FiUnlock,
  FiLock as FiLockIcon,
  FiFileText,
  FiBarChart,
  FiActivity,
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import GdprUserRightsPanel from '../gdpr/GdprUserRightsPanel';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type SecurityTab =
  | 'overview'
  | 'login-logs'
  | 'security-events'
  | 'audit-trail'
  | 'users'
  | 'privacy'
  | 'compliance';

const SecurityPrivacyManagement = () => {
  const [activeTab, setActiveTab] = useState<SecurityTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isEventDetailsModalOpen, setIsEventDetailsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isLogDetailsModalOpen, setIsLogDetailsModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [auditSkip, setAuditSkip] = useState(0);
  const auditPageSize = 50;
  const queryClient = useQueryClient();

  // Fetch data
  const { data: securityStats } = useQuery({
    queryKey: ['admin-security-stats'],
    queryFn: adminApi.getSecurityStats,
    staleTime: 60_000,
  });

  const { data: loginLogs } = useQuery({
    queryKey: ['admin-login-logs'],
    queryFn: () => adminApi.getLoginLogs({ limit: 50 }),
    enabled: activeTab === 'login-logs' || activeTab === 'overview',
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: securityEvents } = useQuery({
    queryKey: ['admin-security-events', selectedSeverity],
    queryFn: () =>
      adminApi.getSecurityEvents({
        ...(selectedSeverity !== 'all' && { severity: selectedSeverity }),
        limit: 50,
      }),
    enabled:
      activeTab === 'security-events' ||
      activeTab === 'overview' ||
      activeTab === 'privacy' ||
      activeTab === 'compliance',
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getAllUsers(),
    enabled: activeTab === 'users',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['admin-audit-logs', auditSkip],
    queryFn: () => adminApi.getAuditLogs({ limit: auditPageSize, skip: auditSkip }),
    enabled: activeTab === 'audit-trail',
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const { data: dataProtection, refetch: refetchDataProtection, isFetching: isFetchingDataProtection } = useQuery({
    queryKey: ['admin-data-protection-summary'],
    queryFn: () => adminApi.getDataProtectionSummary(),
    enabled: activeTab === 'privacy' || activeTab === 'compliance',
  });
  const { data: rolePermissions } = useQuery({
    queryKey: ['admin-role-permissions'],
    queryFn: () => adminApi.getRolePermissionsOverview(),
    enabled: activeTab === 'compliance',
  });
  const { data: twoFactorUsers } = useQuery({
    queryKey: ['admin-two-factor-users'],
    queryFn: () => adminApi.getTwoFactorUsers(),
    enabled: activeTab === 'compliance' || activeTab === 'users',
  });
  const { data: slowEndpoints, refetch: refetchSlowEndpoints, isFetching: isFetchingSlowEndpoints } = useQuery({
    queryKey: ['admin-slow-endpoints'],
    queryFn: () => adminApi.getSlowEndpoints({ limit: 5 }),
    enabled: activeTab === 'compliance' || activeTab === 'overview',
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Mutations
  const changePasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      adminApi.changeUserPassword(userId, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-security-events'] });
      toast.success('Mot de passe modifié avec succès');
      setIsPasswordModalOpen(false);
      setSelectedUser(null);
      setNewPassword('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la modification du mot de passe');
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminApi.changeUserStatus(userId, isActive),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-security-events'] });
      toast.success(`Compte ${variables.isActive ? 'activé' : 'désactivé'} avec succès`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la modification du statut');
    },
  });
  const runBackupMutation = useMutation({
    mutationFn: () => adminApi.runMongoBackupNow(),
    onSuccess: (resp: any) => {
      toast.success(resp?.ok ? 'Sauvegarde lancée avec succès' : 'Sauvegarde terminée');
      queryClient.invalidateQueries({ queryKey: ['admin-data-protection-summary'] });
      queryClient.invalidateQueries({ queryKey: ['admin-security-events'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Échec de la sauvegarde');
    },
  });
  const disableUser2FAMutation = useMutation({
    mutationFn: (userId: string) => adminApi.setUserTwoFactorEnabled(userId, false),
    onSuccess: () => {
      toast.success('2FA désactivée pour le compte');
      queryClient.invalidateQueries({ queryKey: ['admin-two-factor-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-security-events'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erreur 2FA');
    },
  });

  const tabs = [
    { id: 'overview' as SecurityTab, label: 'Vue d\'ensemble', icon: FiBarChart },
    { id: 'login-logs' as SecurityTab, label: 'Logs de Connexion', icon: FiActivity },
    { id: 'security-events' as SecurityTab, label: 'Événements Sécurité', icon: FiShield },
    {
      id: 'audit-trail' as SecurityTab,
      label: 'Traçabilité',
      icon: FiFileText,
    },
    { id: 'users' as SecurityTab, label: 'Gestion Utilisateurs', icon: FiUser },
    { id: 'privacy' as SecurityTab, label: 'Confidentialité', icon: FiLock },
    { id: 'compliance' as SecurityTab, label: 'Conformité', icon: FiCheckCircle },
  ];

  const filteredLoginLogs = loginLogs?.filter((log: any) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      log.email.toLowerCase().includes(searchLower) ||
      log.user?.firstName?.toLowerCase().includes(searchLower) ||
      log.user?.lastName?.toLowerCase().includes(searchLower) ||
      log.ipAddress?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const filteredSecurityEvents = securityEvents?.filter((event: any) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      event.description.toLowerCase().includes(searchLower) ||
      event.user?.email?.toLowerCase().includes(searchLower) ||
      event.type.toLowerCase().includes(searchLower) ||
      event.ipAddress?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const filteredUsers = users?.filter((user: any) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      user.firstName.toLowerCase().includes(searchLower) ||
      user.lastName.toLowerCase().includes(searchLower)
    );
  }) || [];

  const filteredAuditItems =
    auditData?.items.filter((row) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        row.summary.toLowerCase().includes(q) ||
        row.entityType.toLowerCase().includes(q) ||
        row.entityId.toLowerCase().includes(q) ||
        (row.actorEmail?.toLowerCase().includes(q) ?? false) ||
        row.action.toLowerCase().includes(q)
      );
    }) ?? [];

  const getSeverityBadge = (severity: string) => {
    const severityMap: Record<string, { label: string; color: string }> = {
      info: { label: 'Info', color: 'bg-blue-100 text-blue-800' },
      warning: { label: 'Avertissement', color: 'bg-yellow-100 text-yellow-800' },
      error: { label: 'Erreur', color: 'bg-orange-100 text-orange-800' },
      critical: { label: 'Critique', color: 'bg-red-100 text-red-800' },
    };
    const severityInfo = severityMap[severity] || { label: severity, color: 'bg-gray-100 text-gray-800' };
    return <Badge className={severityInfo.color}>{severityInfo.label}</Badge>;
  };

  const handleChangePassword = () => {
    if (!selectedUser || !newPassword || newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    changePasswordMutation.mutate({ userId: selectedUser.id, password: newPassword });
  };

  // Export functions for Login Logs
  const exportLoginLogsToCSV = () => {
    try {
      const headers = ['Utilisateur', 'Email', 'Statut', 'Adresse IP', 'Date', 'Raison'];
      const csvContent =
        '\ufeff' +
        '# School Manager - Logs de Connexion\n' +
        `# Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}\n` +
        '#\n' +
        headers.join(';') +
        '\n' +
        (filteredLoginLogs || [])
          .map((log: any) =>
            [
              log.user ? `${log.user.firstName} ${log.user.lastName}` : 'N/A',
              log.email || 'N/A',
              log.success ? 'Réussi' : 'Échoué',
              log.ipAddress || 'N/A',
              format(new Date(log.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr }),
              log.reason || '-',
            ].join(';')
          )
          .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `logs-connexion-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Export CSV réussi !');
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const exportLoginLogsToJSON = () => {
    try {
      const jsonData = {
        application: 'School Manager',
        logo: 'SM',
        dateExport: format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        total: filteredLoginLogs?.length || 0,
        logs: (filteredLoginLogs || []).map((log: any) => ({
          utilisateur: log.user ? `${log.user.firstName} ${log.user.lastName}` : null,
          email: log.email,
          statut: log.success ? 'Réussi' : 'Échoué',
          adresseIP: log.ipAddress,
          date: format(new Date(log.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr }),
          raison: log.reason || null,
        })),
      };

      const jsonString = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `logs-connexion-${format(new Date(), 'yyyy-MM-dd')}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Export JSON réussi !');
    } catch (error) {
      console.error('Erreur lors de l\'export JSON:', error);
      toast.error('Erreur lors de l\'export JSON');
    }
  };

  const exportLoginLogsToPDF = () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const currentDate = new Date().toLocaleDateString('fr-FR');

      // Logo textuel stylisé
      doc.setFillColor(220, 38, 38);
      doc.roundedRect(14, 10, 40, 12, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SM', 34, 18, { align: 'center' });
      
      // Titre
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('School Manager', 60, 18);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text('Logs de Connexion', 60, 25);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Généré le ${currentDate}`, 60, 30);

      const useAutoTable = (options: any) => {
        if (typeof (doc as any).autoTable === 'function') {
          (doc as any).autoTable(options);
        } else if (typeof autoTable === 'function') {
          autoTable(doc, options);
        } else {
          throw new Error('autoTable is not available');
        }
      };

      const tableData = (filteredLoginLogs || []).map((log: any) => [
        log.user ? `${log.user.firstName} ${log.user.lastName}` : 'N/A',
        log.email || 'N/A',
        log.success ? 'Réussi' : 'Échoué',
        log.ipAddress || 'N/A',
        format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr }),
      ]);

      useAutoTable({
        startY: 38,
        head: [['Utilisateur', 'Email', 'Statut', 'Adresse IP', 'Date']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });

      doc.save(`logs-connexion-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Export PDF réussi !');
    } catch (error: any) {
      console.error('Erreur lors de l\'export PDF:', error);
      toast.error(`Erreur lors de l'export PDF: ${error.message || 'Erreur inconnue'}`);
    }
  };

  // Export functions for Security Events
  const exportSecurityEventsToCSV = () => {
    try {
      const headers = ['Type', 'Sévérité', 'Description', 'Utilisateur', 'Adresse IP', 'Date'];
      const csvContent =
        '\ufeff' +
        '# School Manager - Événements de Sécurité\n' +
        `# Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}\n` +
        '#\n' +
        headers.join(';') +
        '\n' +
        (filteredSecurityEvents || [])
          .map((event: any) =>
            [
              event.type || 'N/A',
              event.severity || 'N/A',
              event.description || 'N/A',
              event.user?.email || 'N/A',
              event.ipAddress || 'N/A',
              format(new Date(event.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr }),
            ].join(';')
          )
          .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `evenements-securite-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Export CSV réussi !');
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const exportSecurityEventsToJSON = () => {
    try {
      const jsonData = {
        application: 'School Manager',
        logo: 'SM',
        dateExport: format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        total: filteredSecurityEvents?.length || 0,
        événements: (filteredSecurityEvents || []).map((event: any) => ({
          type: event.type,
          sévérité: event.severity,
          description: event.description,
          utilisateur: event.user?.email || null,
          adresseIP: event.ipAddress || null,
          date: format(new Date(event.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        })),
      };

      const jsonString = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `evenements-securite-${format(new Date(), 'yyyy-MM-dd')}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Export JSON réussi !');
    } catch (error) {
      console.error('Erreur lors de l\'export JSON:', error);
      toast.error('Erreur lors de l\'export JSON');
    }
  };

  const exportSecurityEventsToPDF = () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const currentDate = new Date().toLocaleDateString('fr-FR');

      // Logo textuel stylisé
      doc.setFillColor(220, 38, 38);
      doc.roundedRect(14, 10, 40, 12, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SM', 34, 18, { align: 'center' });
      
      // Titre
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('School Manager', 60, 18);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text('Événements de Sécurité', 60, 25);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Généré le ${currentDate}`, 60, 30);

      const useAutoTable = (options: any) => {
        if (typeof (doc as any).autoTable === 'function') {
          (doc as any).autoTable(options);
        } else if (typeof autoTable === 'function') {
          autoTable(doc, options);
        } else {
          throw new Error('autoTable is not available');
        }
      };

      const tableData = (filteredSecurityEvents || []).map((event: any) => [
        event.type || 'N/A',
        event.severity || 'N/A',
        event.description?.substring(0, 40) + (event.description?.length > 40 ? '...' : '') || 'N/A',
        event.user?.email || 'N/A',
        format(new Date(event.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr }),
      ]);

      useAutoTable({
        startY: 38,
        head: [['Type', 'Sévérité', 'Description', 'Utilisateur', 'Date']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });

      doc.save(`evenements-securite-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Export PDF réussi !');
    } catch (error: any) {
      console.error('Erreur lors de l\'export PDF:', error);
      toast.error(`Erreur lors de l'export PDF: ${error.message || 'Erreur inconnue'}`);
    }
  };

  // Export functions for Users
  const exportUsersToCSV = () => {
    try {
      const headers = ['Nom', 'Prénom', 'Email', 'Rôle', 'Statut'];
      const csvContent =
        '\ufeff' +
        '# School Manager - Liste des Utilisateurs\n' +
        `# Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}\n` +
        '#\n' +
        headers.join(';') +
        '\n' +
        (filteredUsers || [])
          .map((user: any) =>
            [
              user.lastName || 'N/A',
              user.firstName || 'N/A',
              user.email || 'N/A',
              user.role || 'N/A',
              user.isActive ? 'Actif' : 'Inactif',
            ].join(';')
          )
          .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `utilisateurs-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Export CSV réussi !');
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const exportUsersToJSON = () => {
    try {
      const jsonData = {
        application: 'School Manager',
        logo: 'SM',
        dateExport: format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        total: filteredUsers?.length || 0,
        utilisateurs: (filteredUsers || []).map((user: any) => ({
          nom: user.lastName,
          prénom: user.firstName,
          email: user.email,
          rôle: user.role,
          statut: user.isActive ? 'Actif' : 'Inactif',
        })),
      };

      const jsonString = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `utilisateurs-${format(new Date(), 'yyyy-MM-dd')}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Export JSON réussi !');
    } catch (error) {
      console.error('Erreur lors de l\'export JSON:', error);
      toast.error('Erreur lors de l\'export JSON');
    }
  };

  const exportUsersToPDF = () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const currentDate = new Date().toLocaleDateString('fr-FR');

      // Logo textuel stylisé
      doc.setFillColor(220, 38, 38);
      doc.roundedRect(14, 10, 40, 12, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SM', 34, 18, { align: 'center' });
      
      // Titre
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('School Manager', 60, 18);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text('Liste des Utilisateurs', 60, 25);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Généré le ${currentDate}`, 60, 30);

      const useAutoTable = (options: any) => {
        if (typeof (doc as any).autoTable === 'function') {
          (doc as any).autoTable(options);
        } else if (typeof autoTable === 'function') {
          autoTable(doc, options);
        } else {
          throw new Error('autoTable is not available');
        }
      };

      const tableData = (filteredUsers || []).map((user: any) => [
        `${user.firstName || ''} ${user.lastName || ''}`,
        user.email || 'N/A',
        user.role || 'N/A',
        user.isActive ? 'Actif' : 'Inactif',
      ]);

      useAutoTable({
        startY: 38,
        head: [['Nom complet', 'Email', 'Rôle', 'Statut']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });

      doc.save(`utilisateurs-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Export PDF réussi !');
    } catch (error: any) {
      console.error('Erreur lors de l\'export PDF:', error);
      toast.error(`Erreur lors de l'export PDF: ${error.message || 'Erreur inconnue'}`);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      {/* Header */}
      <Card className="bg-gradient-to-r from-red-600 to-rose-600 p-3 text-white sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black leading-tight text-red-50 sm:text-xl">
              Sécurité & Confidentialité
            </h2>
            <p className="mt-0.5 text-xs leading-snug text-red-100/95 sm:text-sm">
              Protection des données avec authentification robuste
            </p>
          </div>
          <div className="hidden shrink-0 items-center space-x-3 md:flex">
            <div className="text-center">
              <div className="text-base font-bold tabular-nums text-red-50 sm:text-lg">
                {securityStats?.totalLogins || 0}
              </div>
              <div className="text-[10px] text-red-100 sm:text-xs">Connexions</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold tabular-nums text-red-50 sm:text-lg">
                {securityStats?.recentEvents || 0}
              </div>
              <div className="text-[10px] text-red-100 sm:text-xs">Événements (7j)</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold tabular-nums text-red-50 sm:text-lg">
                {securityStats?.criticalEvents || 0}
              </div>
              <div className="text-[10px] text-red-100 sm:text-xs">Critiques</div>
            </div>
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
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'audit-trail') setAuditSkip(0);
                }}
                className={ADM.bigTabBtn(isActive, 'bg-gradient-to-r from-red-600 to-rose-600')}
              >
                <Icon className={ADM.bigTabIcon} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Filters */}
      {(activeTab === 'login-logs' ||
        activeTab === 'security-events' ||
        activeTab === 'users' ||
        activeTab === 'audit-trail') && (
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col gap-2 md:flex-row md:gap-3">
            <div className="flex-1">
              <SearchBar
                compact
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Rechercher..."
              />
            </div>
            {activeTab === 'security-events' && (
              <FilterDropdown
                compact
                label="Sévérité"
                value={selectedSeverity}
                onChange={setSelectedSeverity}
                options={[
                  { value: 'all', label: 'Toutes' },
                  { value: 'info', label: 'Info' },
                  { value: 'warning', label: 'Avertissement' },
                  { value: 'error', label: 'Erreur' },
                  { value: 'critical', label: 'Critique' },
                ]}
              />
            )}
          </div>
        </Card>
      )}

      {/* Content */}
      <div className="animate-slide-up">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Statistiques de sécurité */}
            <div className={ADM.grid4}>
              <Card className={`border-l-4 border-green-500 bg-gradient-to-br from-green-50 to-green-100 ${ADM.statCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={ADM.statLabel}>Taux de réussite</p>
                    <p className={`${ADM.statVal} text-green-600`}>
                      {securityStats?.successRate?.toFixed(1) || '0.0'}%
                    </p>
                    <p className={ADM.statHint}>
                      {securityStats?.successfulLogins || 0} / {securityStats?.totalLogins || 0}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white">
                    <FiCheckCircle className="h-4 w-4" />
                  </div>
                </div>
              </Card>

              <Card className={`border-l-4 border-red-500 bg-gradient-to-br from-red-50 to-red-100 ${ADM.statCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={ADM.statLabel}>Échecs de connexion</p>
                    <p className={`${ADM.statVal} text-red-600`}>{securityStats?.failedLogins || 0}</p>
                    <p className={ADM.statHint}>Tentatives échouées</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white">
                    <FiXCircle className="h-4 w-4" />
                  </div>
                </div>
              </Card>

              <Card className={`border-l-4 border-yellow-500 bg-gradient-to-br from-yellow-50 to-yellow-100 ${ADM.statCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={ADM.statLabel}>Événements récents</p>
                    <p className={`${ADM.statVal} text-yellow-700`}>{securityStats?.recentEvents || 0}</p>
                    <p className={ADM.statHint}>7 derniers jours</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-600 text-white">
                    <FiActivity className="h-4 w-4" />
                  </div>
                </div>
              </Card>

              <Card className={`border-l-4 border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100 ${ADM.statCard}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={ADM.statLabel}>Événements critiques</p>
                    <p className={`${ADM.statVal} text-orange-600`}>{securityStats?.criticalEvents || 0}</p>
                    <p className={ADM.statHint}>À surveiller</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-white">
                    <FiAlertCircle className="h-4 w-4" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Recommandations de sécurité */}
            <Card className="p-3 sm:p-4">
              <h3 className={`${ADM.h2} mb-3 text-gray-800`}>Recommandations de sécurité</h3>
              <div className="space-y-2">
                <div className="flex items-start space-x-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <FiShield className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <div>
                    <h4 className="mb-0.5 text-sm font-semibold text-gray-800">Authentification à deux facteurs</h4>
                    <p className="text-xs text-gray-600">
                      Activez l&apos;authentification à deux facteurs pour renforcer la sécurité des comptes administrateurs.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 rounded-lg border border-green-200 bg-green-50 p-3">
                  <FiLock className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <div>
                    <h4 className="mb-0.5 text-sm font-semibold text-gray-800">Mots de passe forts</h4>
                    <p className="text-xs text-gray-600">
                      Mots de passe complexes (minimum 8 caractères) pour tous les utilisateurs.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <FiClock className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                  <div>
                    <h4 className="mb-0.5 text-sm font-semibold text-gray-800">Sessions actives</h4>
                    <p className="text-xs text-gray-600">
                      Définissez un délai d&apos;expiration des sessions pour limiter les risques.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'login-logs' && (
          <Card className="p-3 sm:p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className={`${ADM.h2} text-gray-800`}>
                Logs de connexion ({filteredLoginLogs.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" onClick={exportLoginLogsToCSV}>
                  <FiDownload className="mr-1.5 h-3.5 w-3.5" />
                  CSV
                </Button>
                <Button variant="secondary" size="sm" onClick={exportLoginLogsToJSON}>
                  <FiDownload className="mr-1.5 h-3.5 w-3.5" />
                  JSON
                </Button>
                <Button variant="secondary" size="sm" onClick={exportLoginLogsToPDF}>
                  <FiDownload className="mr-1.5 h-3.5 w-3.5" />
                  PDF
                </Button>
              </div>
            </div>
            {filteredLoginLogs.length === 0 ? (
              <div className="py-8 text-center">
                <FiActivity className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-sm text-gray-600">Aucun log de connexion trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Utilisateur</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Statut</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Adresse IP</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Raison</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLoginLogs.map((log: any) => (
                      <tr key={log.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="flex items-center space-x-2">
                            <FiUser className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-xs font-medium sm:text-sm">
                              {log.user?.firstName} {log.user?.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 sm:text-sm">{log.email}</td>
                        <td className="px-3 py-2">
                          {log.success ? (
                            <Badge className="bg-green-100 text-green-800">
                              <FiCheckCircle className="w-3 h-3 mr-1 inline" />
                              Réussi
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">
                              <FiXCircle className="w-3 h-3 mr-1 inline" />
                              Échoué
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 sm:text-sm">{log.ipAddress || 'N/A'}</td>
                        <td className="px-3 py-2 text-xs text-gray-600 sm:text-sm">
                          {format(new Date(log.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                        </td>
                        <td className="max-w-[140px] truncate px-3 py-2 text-xs text-gray-600 sm:text-sm">
                          {log.reason || '-'}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLog(log);
                              setIsLogDetailsModalOpen(true);
                            }}
                            className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
                            title="Voir les détails"
                          >
                            <FiEye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'security-events' && (
          <Card className="p-3 sm:p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className={`${ADM.h2} text-gray-800`}>
                Événements de sécurité ({filteredSecurityEvents.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" onClick={exportSecurityEventsToCSV}>
                  <FiDownload className="mr-1.5 h-3.5 w-3.5" />
                  CSV
                </Button>
                <Button variant="secondary" size="sm" onClick={exportSecurityEventsToJSON}>
                  <FiDownload className="mr-1.5 h-3.5 w-3.5" />
                  JSON
                </Button>
                <Button variant="secondary" size="sm" onClick={exportSecurityEventsToPDF}>
                  <FiDownload className="mr-1.5 h-3.5 w-3.5" />
                  PDF
                </Button>
              </div>
            </div>
            {filteredSecurityEvents.length === 0 ? (
              <div className="py-8 text-center">
                <FiShield className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-sm text-gray-600">Aucun événement de sécurité trouvé</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSecurityEvents.map((event: any) => (
                  <div
                    key={event.id}
                    className={`rounded-lg border p-3 ${
                      event.severity === 'critical'
                        ? 'border-red-200 bg-red-50'
                        : event.severity === 'error'
                        ? 'border-orange-200 bg-orange-50'
                        : event.severity === 'warning'
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-blue-200 bg-blue-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          {getSeverityBadge(event.severity)}
                          <span className="text-xs font-semibold text-gray-800 sm:text-sm">{event.type}</span>
                        </div>
                        <p className="text-xs text-gray-700 sm:text-sm">{event.description}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500 sm:text-xs">
                          {event.user && (
                            <div className="flex items-center">
                              <FiUser className="w-3 h-3 mr-1" />
                              {event.user.email}
                            </div>
                          )}
                          {event.ipAddress && (
                            <div className="flex items-center">
                              <FiGlobe className="w-3 h-3 mr-1" />
                              {event.ipAddress}
                            </div>
                          )}
                          <div className="flex items-center">
                            <FiClock className="w-3 h-3 mr-1" />
                            {format(new Date(event.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEvent(event);
                          setIsEventDetailsModalOpen(true);
                        }}
                        className="shrink-0 rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
                        title="Voir les détails"
                      >
                        <FiEye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'audit-trail' && (
          <Card className="p-3 sm:p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className={`${ADM.h2} text-gray-800`}>Traçabilité des modifications</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Créations, mises à jour et suppressions enregistrées (élèves, utilisateurs, etc.).
                  {auditData != null && (
                    <span className="ml-1">
                      {auditData.total} entrée{auditData.total !== 1 ? 's' : ''} au total.
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={auditSkip === 0}
                  onClick={() => setAuditSkip((s) => Math.max(0, s - auditPageSize))}
                >
                  Précédent
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={
                    !auditData || auditSkip + auditData.items.length >= auditData.total
                  }
                  onClick={() => setAuditSkip((s) => s + auditPageSize)}
                >
                  Suivant
                </Button>
              </div>
            </div>
            {auditLoading ? (
              <div className="py-10 text-center text-sm text-gray-500">Chargement…</div>
            ) : filteredAuditItems.length === 0 ? (
              <div className="py-8 text-center">
                <FiFileText className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-sm text-gray-600">Aucune entrée sur cette page</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Action</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Entité</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Auteur</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Résumé</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Détails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditItems.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">
                          {format(new Date(row.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            className={
                              row.action === 'DELETE'
                                ? 'bg-red-100 text-red-800'
                                : row.action === 'CREATE'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }
                          >
                            {row.action}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-800">
                          <span className="font-medium">{row.entityType}</span>
                          <span className="mt-0.5 block truncate max-w-[120px] text-[10px] text-gray-500" title={row.entityId}>
                            {row.entityId}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {row.actorEmail || '—'}
                          {row.actorRole && (
                            <span className="mt-0.5 block text-[10px] text-gray-400">{row.actorRole}</span>
                          )}
                        </td>
                        <td className="max-w-[280px] px-3 py-2 text-xs text-gray-700">{row.summary}</td>
                        <td className="px-3 py-2">
                          {row.changes && Object.keys(row.changes).length > 0 ? (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-blue-600 hover:underline">
                                Champs modifiés
                              </summary>
                              <pre className="mt-2 max-h-40 max-w-[320px] overflow-auto rounded bg-gray-100 p-2 text-[10px]">
                                {JSON.stringify(row.changes, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'users' && (
          <Card className="p-3 sm:p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className={`${ADM.h2} text-gray-800`}>
                Gestion des utilisateurs ({filteredUsers.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" onClick={exportUsersToCSV}>
                  <FiDownload className="mr-1.5 h-3.5 w-3.5" />
                  CSV
                </Button>
                <Button variant="secondary" size="sm" onClick={exportUsersToJSON}>
                  <FiDownload className="mr-1.5 h-3.5 w-3.5" />
                  JSON
                </Button>
                <Button variant="secondary" size="sm" onClick={exportUsersToPDF}>
                  <FiDownload className="mr-1.5 h-3.5 w-3.5" />
                  PDF
                </Button>
              </div>
            </div>
            {filteredUsers.length === 0 ? (
              <div className="py-8 text-center">
                <FiUser className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-sm text-gray-600">Aucun utilisateur trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Utilisateur</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Rôle</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Statut</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user: any) => (
                      <tr key={user.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="flex items-center space-x-2">
                            <FiUser className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-xs font-medium sm:text-sm">
                              {user.firstName} {user.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 sm:text-sm">{user.email}</td>
                        <td className="px-3 py-2">
                          <Badge className="bg-indigo-100 text-xs text-indigo-800">{user.role}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          {user.isActive ? (
                            <Badge className="bg-green-100 text-green-800">
                              <FiCheckCircle className="w-3 h-3 mr-1 inline" />
                              Actif
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">
                              <FiXCircle className="w-3 h-3 mr-1 inline" />
                              Inactif
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUser(user);
                                setIsPasswordModalOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
                              title="Changer le mot de passe"
                            >
                              <FiKey className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                changeStatusMutation.mutate({
                                  userId: user.id,
                                  isActive: !user.isActive,
                                })
                              }
                              className={`rounded-lg p-1.5 transition-colors ${
                                user.isActive
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-green-600 hover:bg-green-50'
                              }`}
                              title={user.isActive ? 'Désactiver' : 'Activer'}
                            >
                              {user.isActive ? (
                                <FiLockIcon className="h-4 w-4" />
                              ) : (
                                <FiUnlock className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-3 sm:p-4">
              <h3 className={`${ADM.h2} mb-3 text-gray-800`}>Protection des données</h3>
              <div className="space-y-2">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="mb-1 flex items-center space-x-2">
                    <FiDatabase className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-semibold text-gray-800">Chiffrement des données</h4>
                  </div>
                  <p className="text-xs text-gray-600">
                    {dataProtection?.sensitiveEncryptionConfigured
                      ? 'Clé de chiffrement des champs sensibles configurée (SENSITIVE_FIELD_ENCRYPTION_KEY).'
                      : 'Clé de chiffrement absente: configurez SENSITIVE_FIELD_ENCRYPTION_KEY pour protéger les champs sensibles.'}
                  </p>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <div className="mb-1 flex items-center space-x-2">
                    <FiLock className="h-4 w-4 text-green-600" />
                    <h4 className="text-sm font-semibold text-gray-800">Mots de passe sécurisés</h4>
                  </div>
                  <p className="text-xs text-gray-600">
                    Les mots de passe sont hachés avec bcrypt avant stockage.
                  </p>
                </div>
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <div className="mb-1 flex items-center space-x-2">
                    <FiShield className="h-4 w-4 text-purple-600" />
                    <h4 className="text-sm font-semibold text-gray-800">Contrôle d&apos;accès</h4>
                  </div>
                  <p className="text-xs text-gray-600">
                    Système RBAC pour limiter l&apos;accès aux données selon les rôles.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-3 sm:p-4">
              <h3 className={`${ADM.h2} mb-3 text-gray-800`}>Confidentialité</h3>
              <div className="space-y-2">
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <div className="mb-1 flex items-center space-x-2">
                    <FiEye className="h-4 w-4 text-yellow-600" />
                    <h4 className="text-sm font-semibold text-gray-800">Visibilité des données</h4>
                  </div>
                  <p className="text-xs text-gray-600">
                    Seuls les utilisateurs autorisés peuvent accéder aux données.
                  </p>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                  <div className="mb-1 flex items-center space-x-2">
                    <FiFileText className="h-4 w-4 text-indigo-600" />
                    <h4 className="text-sm font-semibold text-gray-800">Journalisation</h4>
                  </div>
                  <p className="text-xs text-gray-600">
                    Tous les accès et modifications sont enregistrés dans les logs.
                  </p>
                </div>
                <div className="rounded-lg border border-pink-200 bg-pink-50 p-3">
                  <div className="mb-1 flex items-center space-x-2">
                    <FiRefreshCw className="h-4 w-4 text-pink-600" />
                    <h4 className="text-sm font-semibold text-gray-800">Sauvegarde automatique</h4>
                  </div>
                  <p className="text-xs text-gray-600">
                    {dataProtection?.scheduledBackupsEnabled
                      ? `Activée (cron: ${dataProtection?.backupCron || '0 3 * * *'}, rétention: ${dataProtection?.backupRetentionDays ?? 14} jours).`
                      : 'Non activée: définissez ENABLE_SCHEDULED_MONGODB_BACKUPS=true pour activer les sauvegardes planifiées.'}
                  </p>
                </div>
              </div>
            </Card>
          </div>
          <Card className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className={`${ADM.h2} text-gray-800`}>Sauvegardes & restauration</h3>
                <p className="text-xs text-gray-600">
                  Archives MongoDB disponibles: {dataProtection?.backupArchiveCount ?? 0}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => refetchDataProtection()}
                  disabled={isFetchingDataProtection}
                >
                  <FiRefreshCw className="mr-2 h-4 w-4" />
                  Actualiser
                </Button>
                <Button
                  type="button"
                  onClick={() => runBackupMutation.mutate()}
                  disabled={runBackupMutation.isPending}
                >
                  <FiDownload className="mr-2 h-4 w-4" />
                  Lancer une sauvegarde
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-600">
              Dernier événement sauvegarde:{' '}
              {dataProtection?.lastBackupEvent
                ? `${dataProtection.lastBackupEvent.type} (${format(new Date(dataProtection.lastBackupEvent.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })})`
                : 'Aucun'}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              La sauvegarde manuelle et la restauration complète sont réservées aux comptes ADMIN /
              SUPER_ADMIN (Paramètres → Système).
            </p>
          </Card>
          <GdprUserRightsPanel />
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="space-y-4">
            <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-600">
                  <FiCheckCircle className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-gray-800 sm:text-xl">Conformité RGPD</h3>
                  <p className="mt-1 text-xs text-gray-600 sm:text-sm">
                    L&apos;application respecte les exigences du Règlement Général sur la Protection des Données (RGPD).
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
                    <div className="rounded-lg bg-white p-2.5">
                      <h4 className="mb-0.5 text-xs font-semibold text-gray-800 sm:text-sm">Effacement / limitation</h4>
                      <p className="text-[11px] text-gray-600 sm:text-xs">
                        Demande enregistrée (événement sécurité + e-mail au contact GDPR_CONTACT_EMAIL si configuré)
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2.5">
                      <h4 className="mb-0.5 text-xs font-semibold text-gray-800 sm:text-sm">Portabilité</h4>
                      <p className="text-[11px] text-gray-600 sm:text-xs">
                        Export JSON côté utilisateur (GET /auth/gdpr/export) et politique /privacy
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2.5">
                      <h4 className="mb-0.5 text-xs font-semibold text-gray-800 sm:text-sm">Traçabilité</h4>
                      <p className="text-[11px] text-gray-600 sm:text-xs">
                        Journal d&apos;audit admin et trace des exports RGPD (événements sécurité)
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2.5">
                      <h4 className="mb-0.5 text-xs font-semibold text-gray-800 sm:text-sm">Transparence</h4>
                      <p className="text-[11px] text-gray-600 sm:text-xs">
                        Politique de confidentialité: {dataProtection?.privacyPolicyUrl || '/privacy'} et droits CNIL
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            <Card className="p-3 sm:p-4">
              <h3 className={`${ADM.h2} mb-3 text-gray-800`}>Consentements & droit à l’oubli</h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Consentements total</p>
                  <p className="text-lg font-bold text-gray-900">{dataProtection?.consent?.total ?? 0}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <p className="text-xs text-gray-600">Consentements accordés</p>
                  <p className="text-lg font-bold text-green-700">{dataProtection?.consent?.granted ?? 0}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-xs text-gray-600">Refus / en attente</p>
                  <p className="text-lg font-bold text-amber-700">{dataProtection?.consent?.deniedOrPending ?? 0}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-600">
                Demandes RGPD tracées (export + effacement): {dataProtection?.gdprRequestsTracked ?? 0}
              </p>
            </Card>
            <Card className="p-3 sm:p-4">
              <h3 className={`${ADM.h2} mb-3 text-gray-800`}>Contrôle des permissions par rôle</h3>
              <div className="space-y-2">
                {((rolePermissions?.roles as any[]) || []).length === 0 ? (
                  <p className="text-xs text-gray-600">Aucun rôle trouvé.</p>
                ) : (
                  (rolePermissions?.roles as any[]).map((r: any) => (
                    <div key={r.role} className="rounded-lg border border-gray-200 p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">{r.role}</p>
                        <Badge className="bg-blue-100 text-blue-800 text-xs">{r.users} utilisateur(s)</Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-600">{(r.permissions || []).join(' · ') || '—'}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className={`${ADM.h2} text-gray-800`}>Authentification forte (2FA)</h3>
                <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                  {Math.round(Number(twoFactorUsers?.summary?.rate || 0))}% activé
                </Badge>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                Comptes protégés: {twoFactorUsers?.summary?.enabled2FA ?? 0} / {twoFactorUsers?.summary?.totalUsers ?? 0}
              </p>
              <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                {((twoFactorUsers?.users as any[]) || [])
                  .filter((u: any) => u.twoFactorSettings?.enabled)
                  .slice(0, 30)
                  .map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-[11px] text-gray-600">
                          {u.email} · {u.role} ·
                          {' '}
                          {u.twoFactorSettings?.lastVerifiedAt
                            ? `vérifié le ${format(new Date(u.twoFactorSettings.lastVerifiedAt), 'dd/MM/yyyy HH:mm', { locale: fr })}`
                            : 'jamais vérifié'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => disableUser2FAMutation.mutate(u.id)}
                        disabled={disableUser2FAMutation.isPending}
                      >
                        Désactiver
                      </Button>
                    </div>
                  ))}
              </div>
            </Card>

            <Card className="p-3 sm:p-4">
              <h3 className={`${ADM.h2} mb-3 text-gray-800`}>Audit de sécurité</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">Dernière vérification</h4>
                    <p className="text-xs text-gray-600">15/01/2024</p>
                  </div>
                  <Badge className="bg-green-100 text-xs text-green-800">Conforme</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">Prochaine vérification</h4>
                    <p className="text-xs text-gray-600">15/04/2024</p>
                  </div>
                  <Badge className="bg-blue-100 text-xs text-blue-800">Planifiée</Badge>
                </div>
              </div>
            </Card>
            <Card className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className={`${ADM.h2} text-gray-800`}>Performance API (Top endpoints lents)</h3>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => refetchSlowEndpoints()}
                  disabled={isFetchingSlowEndpoints}
                >
                  <FiRefreshCw className="mr-2 h-4 w-4" />
                  Actualiser
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                Endpoints suivis: {slowEndpoints?.summary?.endpointsTracked ?? 0} · Requêtes observées: {slowEndpoints?.summary?.requestsTracked ?? 0}
              </p>
              <div className="mt-3 space-y-2">
                {((slowEndpoints?.topSlowEndpoints as any[]) || []).length === 0 ? (
                  <p className="text-xs text-gray-600">Pas assez de trafic mesuré pour établir un top.</p>
                ) : (
                  ((slowEndpoints?.topSlowEndpoints as any[]) || []).map((e: any) => (
                    <div key={e.endpoint} className="rounded-lg border border-gray-200 p-2.5">
                      <p className="text-sm font-semibold text-gray-800">{e.endpoint}</p>
                      <p className="mt-1 text-[11px] text-gray-600">
                        avg {e.avgMs} ms · p95 {e.p95Ms} ms · max {e.maxMs} ms · volume {e.count} · erreurs {e.errorRate}%
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Password Change Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setSelectedUser(null);
          setNewPassword('');
        }}
        title="Changer le mot de passe"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Utilisateur</p>
              <p className="font-semibold text-gray-800">
                {selectedUser.firstName} {selectedUser.lastName}
              </p>
              <p className="text-sm text-gray-600">{selectedUser.email}</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nouveau mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Le mot de passe doit contenir au moins 6 caractères
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setSelectedUser(null);
                  setNewPassword('');
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={handleChangePassword}
                disabled={changePasswordMutation.isPending || newPassword.length < 6}
                className="bg-red-600 hover:bg-red-700"
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Modification...
                  </>
                ) : (
                  <>
                    <FiKey className="w-4 h-4 mr-2" />
                    Modifier
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Log Details Modal */}
      <Modal
        isOpen={isLogDetailsModalOpen}
        onClose={() => {
          setIsLogDetailsModalOpen(false);
          setSelectedLog(null);
        }}
        title="Détails du Log de Connexion"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Utilisateur</p>
                <p className="font-semibold text-gray-800">
                  {selectedLog.user ? `${selectedLog.user.firstName} ${selectedLog.user.lastName}` : 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Email</p>
                <p className="font-semibold text-gray-800">{selectedLog.email}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Statut</p>
                {selectedLog.success ? (
                  <Badge className="bg-green-100 text-green-800">
                    <FiCheckCircle className="w-3 h-3 mr-1 inline" />
                    Réussi
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">
                    <FiXCircle className="w-3 h-3 mr-1 inline" />
                    Échoué
                  </Badge>
                )}
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Adresse IP</p>
                <p className="font-semibold text-gray-800">{selectedLog.ipAddress || 'N/A'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Date</p>
                <p className="font-semibold text-gray-800">
                  {format(new Date(selectedLog.createdAt), 'dd/MM/yyyy à HH:mm:ss', { locale: fr })}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Raison</p>
                <p className="font-semibold text-gray-800">{selectedLog.reason || '-'}</p>
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsLogDetailsModalOpen(false);
                  setSelectedLog(null);
                }}
              >
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Event Details Modal */}
      <Modal
        isOpen={isEventDetailsModalOpen}
        onClose={() => {
          setIsEventDetailsModalOpen(false);
          setSelectedEvent(null);
        }}
        title="Détails de l'Événement de Sécurité"
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Type</p>
              <p className="font-semibold text-gray-800">{selectedEvent.type}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Sévérité</p>
              <div className="mt-1">{getSeverityBadge(selectedEvent.severity)}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Description</p>
              <p className="font-semibold text-gray-800">{selectedEvent.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Utilisateur</p>
                <p className="font-semibold text-gray-800">
                  {selectedEvent.user?.email || 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Adresse IP</p>
                <p className="font-semibold text-gray-800">{selectedEvent.ipAddress || 'N/A'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg col-span-2">
                <p className="text-sm text-gray-600 mb-1">Date</p>
                <p className="font-semibold text-gray-800">
                  {format(new Date(selectedEvent.createdAt), 'dd/MM/yyyy à HH:mm:ss', { locale: fr })}
                </p>
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEventDetailsModalOpen(false);
                  setSelectedEvent(null);
                }}
              >
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SecurityPrivacyManagement;

