import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppBranding } from '../../contexts/AppBrandingContext';
import { authApi, adminApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  applyDocumentTheme,
  parseUserUiPreferences,
  type UserUiPreferences,
} from '@/lib/userUiPreferences';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import toast from 'react-hot-toast';
import HomePageImagesPanel from './HomePageImagesPanel';
import { getCurrentAcademicYear } from '@/utils/academicYear';
import {
  DEFAULT_DIRECTOR_CLOSING,
  DEFAULT_DIRECTOR_MESSAGE_TITLE,
  DEFAULT_DIRECTOR_NAME,
  DEFAULT_DIRECTOR_OCCASION,
  DEFAULT_DIRECTOR_FOOTER,
  DEFAULT_DIRECTOR_MESSAGE_PARAGRAPHS,
  directorMessageBodyFromParagraphs,
  resolveDirectorMessageContent,
} from '@/lib/homeDirectorMessage';
import {
  FiBriefcase,
  FiBook, 
  FiBell,
  FiShield,
  FiUser,
  FiDatabase,
  FiSave,
  FiLoader,
  FiCheck,
  FiX,
  FiMail,
  FiPhone,
  FiMapPin,
  FiCalendar,
  FiLock,
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiTrash2,
  FiDownload,
  FiUpload,
  FiImage,
} from 'react-icons/fi';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Onglet affiché à l’ouverture (ex. depuis « Logo de l’onglet »). */
  initialTab?: SettingsTab;
}

type SettingsTab = 'school' | 'academic' | 'notifications' | 'security' | 'user' | 'system';

interface TabOption {
  id: SettingsTab;
  label: string;
  icon: typeof FiBriefcase;
  color: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab = 'school' }) => {
  const { user, refreshUser, uiPreferences: savedUiPreferences } = useAuth();
  const {
    refreshBranding,
    branding,
    navigationLogoAbsolute,
    loginLogoAbsolute,
    faviconAbsolute,
    studiesDirectorPhotoAbsolute,
  } = useAppBranding();
  const [activeTab, setActiveTab] = useState<SettingsTab>('school');
  const [isSaving, setIsSaving] = useState(false);
  const [brandingUploading, setBrandingUploading] = useState<
    'navigation' | 'login' | 'favicon' | 'studiesDirector' | null
  >(null);
  const [homeImageUploading, setHomeImageUploading] = useState<string | null>(null);
  const [appTitleDraft, setAppTitleDraft] = useState('');
  const [appTaglineDraft, setAppTaglineDraft] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorQr, setTwoFactorQr] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [selectedBackupFilename, setSelectedBackupFilename] = useState('');
  const [restoreConfirmPhrase, setRestoreConfirmPhrase] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: backupsData, isLoading: backupsLoading } = useQuery({
    queryKey: ['mongo-backups'],
    queryFn: () => adminApi.listMongoBackups(),
    enabled: isOpen && activeTab === 'system',
  });

  const backupMutation = useMutation({
    mutationFn: () => adminApi.runMongoBackupNow(),
    onSuccess: async (data) => {
      if (data?.ok && data.filename) {
        toast.success(`Sauvegarde créée : ${data.filename}`);
        queryClient.invalidateQueries({ queryKey: ['mongo-backups'] });
        setSelectedBackupFilename(data.filename);
        try {
          const blob = await adminApi.downloadMongoBackup(data.filename);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = data.filename;
          a.click();
          URL.revokeObjectURL(url);
        } catch {
          toast('Archive enregistrée sur le serveur (téléchargement manuel possible).', {
            icon: 'ℹ️',
          });
        }
      } else {
        toast.error(data?.error || 'Échec de la sauvegarde');
      }
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Échec de la sauvegarde');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () =>
      adminApi.restoreMongoBackup({
        confirmPhrase: restoreConfirmPhrase.trim(),
        filename: restoreFile ? undefined : selectedBackupFilename || undefined,
        file: restoreFile ?? undefined,
      }),
    onSuccess: (data) => {
      if (data?.ok) {
        toast.success(data.message || 'Base restaurée');
        setRestoreConfirmPhrase('');
        setRestoreFile(null);
        queryClient.invalidateQueries();
      } else {
        toast.error(data?.error || 'Échec de la restauration');
      }
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Échec de la restauration');
    },
  });

  // School settings (persistés via AppBranding côté serveur)
  const [schoolSettings, setSchoolSettings] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    principal: '',
    code: '',
  });

  const [directorMessageDraft, setDirectorMessageDraft] = useState({
    name: '',
    occasionBadge: '',
    messageTitle: '',
    message: '',
    closing: '',
    footerLine: '',
  });

  // Academic settings
  const [academicSettings, setAcademicSettings] = useState({
    currentYear: getCurrentAcademicYear(),
    startDate: `${new Date().getFullYear()}-09-01`,
    endDate: `${new Date().getFullYear() + 1}-06-30`,
    trimesters: [
      { name: 'Trimestre 1', start: `${new Date().getFullYear()}-09-01`, end: `${new Date().getFullYear()}-12-20` },
      { name: 'Trimestre 2', start: `${new Date().getFullYear()}-12-21`, end: `${new Date().getFullYear() + 1}-03-20` },
      { name: 'Trimestre 3', start: `${new Date().getFullYear() + 1}-03-21`, end: `${new Date().getFullYear() + 1}-06-30` },
    ],
    maxAbsences: 10,
    passingGrade: 10,
  });

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    gradeAlerts: true,
    absenceAlerts: true,
    assignmentReminders: true,
    reportCardReady: true,
  });

  // Security settings
  const [securitySettings, setSecuritySettings] = useState({
    sessionTimeout: 30,
    requirePasswordChange: false,
    twoFactorAuth: false,
    ipWhitelist: false,
  });

  const [userSettings, setUserSettings] = useState<UserUiPreferences>(() =>
    parseUserUiPreferences(null)
  );

  // Password change
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const tabs: TabOption[] = [
    { id: 'school', label: 'Établissement', icon: FiBriefcase, color: 'from-blue-500 to-blue-600' },
    { id: 'academic', label: 'Académique', icon: FiBook, color: 'from-green-500 to-green-600' },
    { id: 'notifications', label: 'Notifications', icon: FiBell, color: 'from-yellow-500 to-yellow-600' },
    { id: 'security', label: 'Sécurité', icon: FiShield, color: 'from-red-500 to-red-600' },
    { id: 'user', label: 'Utilisateur', icon: FiUser, color: 'from-purple-500 to-purple-600' },
    { id: 'system', label: 'Système', icon: FiDatabase, color: 'from-gray-500 to-gray-600' },
  ];

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    setUserSettings(savedUiPreferences);
  }, [isOpen, savedUiPreferences]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const b = await adminApi.getAppBranding();
        if (!cancelled) {
          setAppTitleDraft(typeof b.appTitle === 'string' ? b.appTitle : '');
          setAppTaglineDraft(typeof b.appTagline === 'string' ? b.appTagline : '');
          setAcademicSettings((prev) => ({
            ...prev,
            currentYear:
              typeof b.currentAcademicYear === 'string' && b.currentAcademicYear.trim()
                ? b.currentAcademicYear
                : getCurrentAcademicYear(),
          }));
          setSchoolSettings({
            name: typeof b.schoolDisplayName === 'string' ? b.schoolDisplayName : '',
            address: typeof b.schoolAddress === 'string' ? b.schoolAddress : '',
            phone: typeof b.schoolPhone === 'string' ? b.schoolPhone : '',
            email: typeof b.schoolEmail === 'string' ? b.schoolEmail : '',
            website: typeof b.schoolWebsite === 'string' ? b.schoolWebsite : '',
            principal: typeof b.schoolPrincipal === 'string' ? b.schoolPrincipal : '',
            code: typeof b.schoolCode === 'string' ? b.schoolCode : '',
          });
          const resolvedDirector = resolveDirectorMessageContent({
            studiesDirectorName:
              typeof b.studiesDirectorName === 'string' ? b.studiesDirectorName : null,
            studiesDirectorOccasionBadge:
              typeof b.studiesDirectorOccasionBadge === 'string'
                ? b.studiesDirectorOccasionBadge
                : null,
            studiesDirectorMessageTitle:
              typeof b.studiesDirectorMessageTitle === 'string'
                ? b.studiesDirectorMessageTitle
                : null,
            studiesDirectorMessage:
              typeof b.studiesDirectorMessage === 'string' ? b.studiesDirectorMessage : null,
            studiesDirectorClosing:
              typeof b.studiesDirectorClosing === 'string' ? b.studiesDirectorClosing : null,
            studiesDirectorFooterLine:
              typeof b.studiesDirectorFooterLine === 'string'
                ? b.studiesDirectorFooterLine
                : null,
            schoolDisplayName:
              typeof b.schoolDisplayName === 'string' ? b.schoolDisplayName : null,
          });
          setDirectorMessageDraft({
            name:
              typeof b.studiesDirectorName === 'string'
                ? b.studiesDirectorName
                : resolvedDirector.name,
            occasionBadge:
              typeof b.studiesDirectorOccasionBadge === 'string'
                ? b.studiesDirectorOccasionBadge
                : resolvedDirector.occasionBadge,
            messageTitle:
              typeof b.studiesDirectorMessageTitle === 'string'
                ? b.studiesDirectorMessageTitle
                : resolvedDirector.messageTitle,
            message:
              typeof b.studiesDirectorMessage === 'string'
                ? b.studiesDirectorMessage
                : directorMessageBodyFromParagraphs(resolvedDirector.paragraphs),
            closing:
              typeof b.studiesDirectorClosing === 'string'
                ? b.studiesDirectorClosing
                : resolvedDirector.closing,
            footerLine:
              typeof b.studiesDirectorFooterLine === 'string'
                ? b.studiesDirectorFooterLine
                : resolvedDirector.footerLine,
          });
        }
      } catch {
        if (!cancelled) {
          setAppTitleDraft('');
          setAppTaglineDraft('');
          setAcademicSettings((prev) => ({ ...prev, currentYear: getCurrentAcademicYear() }));
          setSchoolSettings({
            name: '',
            address: '',
            phone: '',
            email: '',
            website: '',
            principal: '',
            code: '',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const triggerBrandingUpload = (slot: 'navigation' | 'login' | 'favicon' | 'studiesDirector') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/jpg,image/webp,image/gif,image/x-icon,.ico';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Fichier trop volumineux (max 5 Mo)');
        return;
      }
      setBrandingUploading(slot);
      try {
        await adminApi.uploadAppBrandingFile(slot, file);
        await refreshBranding();
        toast.success(
          slot === 'navigation'
            ? 'Logo barre de navigation mis à jour'
            : slot === 'login'
              ? 'Logo page de connexion mis à jour'
              : slot === 'studiesDirector'
                ? 'Photo de la directrice des études mise à jour'
                : 'Logo de l’onglet mis à jour'
        );
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string }; status?: number }; message?: string };
        const detail =
          err?.response?.data?.error ||
          (err?.response?.status === 401
            ? 'Session expirée — reconnectez-vous.'
            : null) ||
          err?.message;
        toast.error(detail || "Erreur lors de l'envoi du fichier");
      } finally {
        setBrandingUploading(null);
      }
    };
    input.click();
  };

  const clearBrandingAsset = async (
    field: 'navigationLogoUrl' | 'loginLogoUrl' | 'faviconUrl' | 'studiesDirectorPhotoUrl',
  ) => {
    try {
      await adminApi.updateAppBranding({ [field]: null });
      await refreshBranding();
      toast.success('Image réinitialisée');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error || 'Impossible de supprimer');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const academicYear = academicSettings.currentYear.trim();
      if (!/^\d{4}-\d{4}$/.test(academicYear)) {
        toast.error('Année scolaire invalide. Format attendu : 2026-2027');
        return;
      }
      const [startYear, endYear] = academicYear.split('-').map((v) => parseInt(v, 10));
      if (endYear !== startYear + 1) {
        toast.error('Année scolaire invalide : l’année de fin doit suivre l’année de début.');
        return;
      }
      await adminApi.updateAppBranding({
        appTitle: appTitleDraft.trim() || null,
        appTagline: appTaglineDraft.trim() || null,
        currentAcademicYear: academicYear,
        schoolDisplayName: schoolSettings.name.trim() || null,
        schoolAddress: schoolSettings.address.trim() || null,
        schoolPhone: schoolSettings.phone.trim() || null,
        schoolEmail: schoolSettings.email.trim() || null,
        schoolWebsite: schoolSettings.website.trim() || null,
        schoolPrincipal: schoolSettings.principal.trim() || null,
        schoolCode: schoolSettings.code.trim() || null,
        studiesDirectorName: directorMessageDraft.name.trim() || null,
        studiesDirectorOccasionBadge: directorMessageDraft.occasionBadge.trim() || null,
        studiesDirectorMessageTitle: directorMessageDraft.messageTitle.trim() || null,
        studiesDirectorMessage: directorMessageDraft.message.trim() || null,
        studiesDirectorClosing: directorMessageDraft.closing.trim() || null,
        studiesDirectorFooterLine: directorMessageDraft.footerLine.trim() || null,
      });
      if (user) {
        await authApi.updateMe({ uiPreferences: userSettings });
        await refreshUser();
        applyDocumentTheme(userSettings.theme);
      }
      await refreshBranding();
      await new Promise((resolve) => setTimeout(resolve, 400));
      
      toast.success('Paramètres sauvegardés avec succès !');
      handleClose();
    } catch (error: any) {
      toast.error('Erreur lors de la sauvegarde des paramètres');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsSaving(true);
    
    try {
      // Simuler un changement de mot de passe (dans une vraie app, on appellerait l'API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Mot de passe modifié avec succès !');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      toast.error('Erreur lors du changement de mot de passe');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = () => {
    backupMutation.mutate();
  };

  const handleDownloadBackup = async () => {
    if (!selectedBackupFilename) {
      toast.error('Sélectionnez une archive à télécharger');
      return;
    }
    try {
      const blob = await adminApi.downloadMongoBackup(selectedBackupFilename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedBackupFilename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Téléchargement lancé');
    } catch {
      toast.error('Impossible de télécharger cette archive');
    }
  };

  const handleRestore = () => {
    if (!restoreFile && !selectedBackupFilename) {
      toast.error('Choisissez une archive sur le serveur ou importez un fichier');
      return;
    }
    if (restoreConfirmPhrase.trim() !== 'RESTAURER') {
      toast.error('Tapez RESTAURER pour confirmer la restauration');
      return;
    }
    const label = restoreFile?.name || selectedBackupFilename;
    if (
      !window.confirm(
        `ATTENTION : toutes les données actuelles seront remplacées par l’archive « ${label} ».\n\nContinuer ?`
      )
    ) {
      return;
    }
    restoreMutation.mutate();
  };

  const formatBackupSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const handleSetup2FA = async () => {
    setTwoFactorBusy(true);
    try {
      const setup = await authApi.setupTwoFactor();
      setTwoFactorQr(setup.qrCodeDataUrl);
      toast.success('QR code 2FA généré');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de préparer la 2FA');
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const handleEnable2FA = async () => {
    if (twoFactorCode.trim().length !== 6) {
      toast.error('Code 2FA invalide');
      return;
    }
    setTwoFactorBusy(true);
    try {
      await authApi.verifyTwoFactor(twoFactorCode.trim());
      setTwoFactorEnabled(true);
      setTwoFactorCode('');
      toast.success('2FA activée');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Code 2FA invalide');
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!passwordData.currentPassword) {
      toast.error('Mot de passe actuel requis');
      return;
    }
    setTwoFactorBusy(true);
    try {
      await authApi.disableTwoFactor(passwordData.currentPassword);
      setTwoFactorEnabled(false);
      setTwoFactorQr(null);
      setTwoFactorCode('');
      toast.success('2FA désactivée');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de désactiver la 2FA');
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const handleClose = () => {
    setActiveTab('school');
    setIsSaving(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Paramètres" size="xl">
      <div className="space-y-6">
        {/* Tabs Navigation */}
        <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide pb-2 border-b border-gray-200">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 whitespace-nowrap ${
                  isActive
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span>{tab.label}</span>
                {isActive && (
                  <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-white rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {/* School Settings */}
          {activeTab === 'school' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Informations de l'établissement</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nom de l'établissement <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiBriefcase className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={schoolSettings.name}
                        onChange={(e) => setSchoolSettings({ ...schoolSettings, name: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="Nom de l'établissement"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Adresse
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiMapPin className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={schoolSettings.address}
                        onChange={(e) => setSchoolSettings({ ...schoolSettings, address: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="Adresse complète"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Téléphone
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiPhone className="text-gray-400" />
                        </div>
                        <input
                          type="tel"
                          value={schoolSettings.phone}
                          onChange={(e) => setSchoolSettings({ ...schoolSettings, phone: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          placeholder="+33 1 23 45 67 89"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiMail className="text-gray-400" />
                        </div>
                        <input
                          type="email"
                          value={schoolSettings.email}
                          onChange={(e) => setSchoolSettings({ ...schoolSettings, email: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          placeholder="contact@ecole.fr"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Site web
                      </label>
                      <input
                        type="text"
                        value={schoolSettings.website}
                        onChange={(e) => setSchoolSettings({ ...schoolSettings, website: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="www.ecole.fr"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Directeur
                      </label>
                      <input
                        type="text"
                        value={schoolSettings.principal}
                        onChange={(e) => setSchoolSettings({ ...schoolSettings, principal: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="M. Directeur"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Code établissement (MENA)
                      </label>
                      <input
                        type="text"
                        value={schoolSettings.code}
                        onChange={(e) => setSchoolSettings({ ...schoolSettings, code: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                        placeholder="253798"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <FiImage className="text-gray-600" aria-hidden />
                  Identité visuelle (logos)
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Titres affichés dans la barre du haut pour tous les rôles, et images pour la navigation,
                  la page de connexion et l’icône du navigateur (PNG, JPG, WEBP, SVG, ICO — max 5 Mo).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Titre dans la barre (ex. nom court de l’établissement)
                    </label>
                    <input
                      type="text"
                      value={appTitleDraft}
                      onChange={(e) => setAppTitleDraft(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Gestion scolaire"
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Sous-titre (ligne secondaire)
                    </label>
                    <input
                      type="text"
                      value={appTaglineDraft}
                      onChange={(e) => setAppTaglineDraft(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Espace sécurisé"
                      maxLength={160}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-violet-50/80 rounded-xl border-2 border-violet-200/80">
                    <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-lg bg-white border border-violet-200 overflow-hidden">
                      {studiesDirectorPhotoAbsolute ? (
                        <img
                          src={studiesDirectorPhotoAbsolute}
                          alt=""
                          className="h-full w-full object-cover object-[center_18%]"
                        />
                      ) : (
                        <span className="text-xs text-gray-400 text-center px-1">Photo par défaut</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">Photo — Directrice des études</p>
                      <p className="text-xs text-gray-500">
                        Affichée sur la page d’accueil publique (section « Mot de la Directrice des Études »).
                        Portrait vertical recommandé (JPG ou PNG, max 5 Mo).
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => triggerBrandingUpload('studiesDirector')}
                        disabled={!!brandingUploading}
                      >
                        {brandingUploading === 'studiesDirector' ? (
                          <FiLoader className="w-4 h-4 animate-spin" />
                        ) : (
                          <FiUpload className="w-4 h-4" />
                        )}
                        <span className="ml-1.5">Changer la photo</span>
                      </Button>
                      {studiesDirectorPhotoAbsolute ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => clearBrandingAsset('studiesDirectorPhotoUrl')}
                          disabled={!!brandingUploading}
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 bg-violet-50/50 rounded-xl border-2 border-violet-200/80 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">Mot de la Directrice des Études</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Texte affiché sur la page d&apos;accueil publique. Séparez les paragraphes par une
                          ligne vide.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setDirectorMessageDraft({
                            name: DEFAULT_DIRECTOR_NAME,
                            occasionBadge: DEFAULT_DIRECTOR_OCCASION,
                            messageTitle: DEFAULT_DIRECTOR_MESSAGE_TITLE,
                            message: directorMessageBodyFromParagraphs(
                              DEFAULT_DIRECTOR_MESSAGE_PARAGRAPHS,
                            ),
                            closing: DEFAULT_DIRECTOR_CLOSING,
                            footerLine: DEFAULT_DIRECTOR_FOOTER,
                          })
                        }
                      >
                        <FiRefreshCw className="w-4 h-4" />
                        <span className="ml-1.5">Texte par défaut</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Nom de la directrice
                        </label>
                        <input
                          type="text"
                          value={directorMessageDraft.name}
                          onChange={(e) =>
                            setDirectorMessageDraft((prev) => ({ ...prev, name: e.target.value }))
                          }
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                          placeholder={DEFAULT_DIRECTOR_NAME}
                          maxLength={120}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Badge d&apos;occasion
                        </label>
                        <input
                          type="text"
                          value={directorMessageDraft.occasionBadge}
                          onChange={(e) =>
                            setDirectorMessageDraft((prev) => ({
                              ...prev,
                              occasionBadge: e.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                          placeholder={DEFAULT_DIRECTOR_OCCASION}
                          maxLength={160}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Titre du message
                      </label>
                      <input
                        type="text"
                        value={directorMessageDraft.messageTitle}
                        onChange={(e) =>
                          setDirectorMessageDraft((prev) => ({
                            ...prev,
                            messageTitle: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                        placeholder={DEFAULT_DIRECTOR_MESSAGE_TITLE}
                        maxLength={160}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Corps du message
                      </label>
                      <textarea
                        value={directorMessageDraft.message}
                        onChange={(e) =>
                          setDirectorMessageDraft((prev) => ({ ...prev, message: e.target.value }))
                        }
                        rows={12}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all resize-y min-h-[12rem] text-sm leading-relaxed"
                        placeholder="Un paragraphe par bloc, séparés par une ligne vide…"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Formule de clôture
                        </label>
                        <input
                          type="text"
                          value={directorMessageDraft.closing}
                          onChange={(e) =>
                            setDirectorMessageDraft((prev) => ({ ...prev, closing: e.target.value }))
                          }
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                          placeholder={DEFAULT_DIRECTOR_CLOSING}
                          maxLength={500}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Ligne de pied de page
                        </label>
                        <input
                          type="text"
                          value={directorMessageDraft.footerLine}
                          onChange={(e) =>
                            setDirectorMessageDraft((prev) => ({
                              ...prev,
                              footerLine: e.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                          placeholder={DEFAULT_DIRECTOR_FOOTER}
                          maxLength={300}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-indigo-50/80 rounded-xl border-2 border-indigo-200/80">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white border border-indigo-200 overflow-hidden">
                      {faviconAbsolute ? (
                        <img src={faviconAbsolute} alt="" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-xs text-gray-400 text-center px-1">Défaut</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">Logo de l’onglet du navigateur</p>
                      <p className="text-xs text-gray-500">
                        Favicon : icône dans l’onglet et les favoris (PNG ou ICO carré, 32×32 recommandé)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => triggerBrandingUpload('favicon')}
                        disabled={!!brandingUploading}
                      >
                        {brandingUploading === 'favicon' ? (
                          <FiLoader className="w-4 h-4 animate-spin" />
                        ) : (
                          <FiUpload className="w-4 h-4" />
                        )}
                        <span className="ml-1.5">Changer</span>
                      </Button>
                      {faviconAbsolute ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => clearBrandingAsset('faviconUrl')}
                          disabled={!!brandingUploading}
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 overflow-hidden">
                      {navigationLogoAbsolute ? (
                        <img src={navigationLogoAbsolute} alt="" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-xs text-gray-400 text-center px-1">Défaut</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">Logo barre de navigation</p>
                      <p className="text-xs text-gray-500">Carré recommandé (ex. 256×256)</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => triggerBrandingUpload('navigation')}
                        disabled={!!brandingUploading}
                      >
                        {brandingUploading === 'navigation' ? (
                          <FiLoader className="w-4 h-4 animate-spin" />
                        ) : (
                          <FiUpload className="w-4 h-4" />
                        )}
                        <span className="ml-1.5">Changer</span>
                      </Button>
                      {navigationLogoAbsolute ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => clearBrandingAsset('navigationLogoUrl')}
                          disabled={!!brandingUploading}
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200 overflow-hidden">
                      {loginLogoAbsolute ? (
                        <img src={loginLogoAbsolute} alt="" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-xs text-gray-400 text-center px-1">Défaut</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">Logo page de connexion</p>
                      <p className="text-xs text-gray-500">Si vide, le logo navigation est réutilisé</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => triggerBrandingUpload('login')}
                        disabled={!!brandingUploading}
                      >
                        {brandingUploading === 'login' ? (
                          <FiLoader className="w-4 h-4 animate-spin" />
                        ) : (
                          <FiUpload className="w-4 h-4" />
                        )}
                        <span className="ml-1.5">Changer</span>
                      </Button>
                      {loginLogoAbsolute && branding.loginLogoUrl ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => clearBrandingAsset('loginLogoUrl')}
                          disabled={!!brandingUploading}
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                </div>

                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h4 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <FiImage className="text-amber-600" aria-hidden />
                    Images de la page d’accueil
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Bannière, piliers, communauté et campus — visibles sur la page publique avant connexion
                    (JPG, PNG ou WEBP — max 5 Mo). La photo de la directrice se gère juste au-dessus.
                  </p>
                  <HomePageImagesPanel
                    uploadingSlot={homeImageUploading}
                    onUploadStart={setHomeImageUploading}
                    onUploadEnd={() => setHomeImageUploading(null)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Academic Settings */}
          {activeTab === 'academic' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Paramètres académiques</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Année scolaire active
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiCalendar className="text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={academicSettings.currentYear}
                          onChange={(e) => setAcademicSettings({ ...academicSettings, currentYear: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all"
                          placeholder="2026-2027"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Utilisée par défaut dans les inscriptions, frais, bulletins et affichages.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Note de passage
                      </label>
                      <input
                        type="number"
                        value={academicSettings.passingGrade}
                        onChange={(e) => setAcademicSettings({ ...academicSettings, passingGrade: parseFloat(e.target.value) })}
                        min="0"
                        max="20"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all"
                        placeholder="10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Absences maximales autorisées
                    </label>
                    <input
                      type="number"
                      value={academicSettings.maxAbsences}
                      onChange={(e) => setAcademicSettings({ ...academicSettings, maxAbsences: parseInt(e.target.value) })}
                      min="0"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all"
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-4">
                      Trimestres
                    </label>
                    <div className="space-y-3">
                      {academicSettings.trimesters.map((trimester, index) => (
                        <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{trimester.name}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(trimester.start).toLocaleDateString('fr-FR')} - {new Date(trimester.end).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Préférences de notifications</h3>
                <div className="space-y-4">
                  {Object.entries(notificationSettings).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900">
                          {key === 'emailNotifications' && 'Notifications par email'}
                          {key === 'smsNotifications' && 'Notifications par SMS'}
                          {key === 'gradeAlerts' && 'Alertes de notes'}
                          {key === 'absenceAlerts' && 'Alertes d\'absences'}
                          {key === 'assignmentReminders' && 'Rappels de devoirs'}
                          {key === 'reportCardReady' && 'Bulletins prêts'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {key === 'emailNotifications' && 'Recevoir des notifications par email'}
                          {key === 'smsNotifications' && 'Recevoir des notifications par SMS'}
                          {key === 'gradeAlerts' && 'Être alerté lors de nouvelles notes'}
                          {key === 'absenceAlerts' && 'Être alerté lors d\'absences'}
                          {key === 'assignmentReminders' && 'Recevoir des rappels pour les devoirs'}
                          {key === 'reportCardReady' && 'Être notifié quand un bulletin est prêt'}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={value as boolean}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, [key]: e.target.checked })}
                          className="sr-only peer"
                          aria-label={`Activer ${key}`}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Paramètres de sécurité</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Délai d'expiration de session (minutes)
                    </label>
                    <input
                      type="number"
                      value={securitySettings.sessionTimeout}
                      onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: parseInt(e.target.value) })}
                      min="5"
                      max="1440"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all"
                      placeholder="30"
                    />
                  </div>

                  <div className="space-y-3">
                    {Object.entries(securitySettings).filter(([key]) => key !== 'sessionTimeout').map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                          <p className="font-medium text-gray-900">
                            {key === 'requirePasswordChange' && 'Exiger le changement de mot de passe'}
                            {key === 'twoFactorAuth' && 'Authentification à deux facteurs'}
                            {key === 'ipWhitelist' && 'Liste blanche d\'adresses IP'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {key === 'requirePasswordChange' && 'Forcer les utilisateurs à changer leur mot de passe régulièrement'}
                            {key === 'twoFactorAuth' && 'Activer l\'authentification à deux facteurs pour plus de sécurité'}
                            {key === 'ipWhitelist' && 'Restreindre l\'accès à certaines adresses IP'}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={value as boolean}
                            onChange={(e) => setSecuritySettings({ ...securitySettings, [key]: e.target.checked })}
                            className="sr-only peer"
                            aria-label={`Activer ${key}`}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Change Password */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Changer le mot de passe</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Mot de passe actuel
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiLock className="text-gray-400" />
                      </div>
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        placeholder="Mot de passe actuel"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nouveau mot de passe
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiLock className="text-gray-400" />
                        </div>
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all"
                          placeholder="Nouveau mot de passe"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Confirmer le mot de passe
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiLock className="text-gray-400" />
                        </div>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all"
                          placeholder="Confirmer le mot de passe"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handlePasswordChange}
                    disabled={isSaving || !passwordData.currentPassword || !passwordData.newPassword}
                    className="w-full md:w-auto"
                  >
                    {isSaving ? (
                      <>
                        <FiLoader className="w-5 h-5 mr-2 animate-spin inline" />
                        Modification...
                      </>
                    ) : (
                      <>
                        <FiLock className="w-5 h-5 mr-2 inline" />
                        Changer le mot de passe
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Authentification forte (2FA)</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className={twoFactorEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                      {twoFactorEnabled ? '2FA activée' : '2FA désactivée'}
                    </Badge>
                  </div>
                  {!twoFactorEnabled && (
                    <Button type="button" variant="secondary" onClick={handleSetup2FA} disabled={twoFactorBusy}>
                      Générer un QR code 2FA
                    </Button>
                  )}
                  {twoFactorQr && !twoFactorEnabled && (
                    <div className="rounded-xl border border-gray-200 p-3 bg-white">
                      <p className="text-sm text-gray-700 mb-2">Scannez ce QR code avec Google Authenticator, Authy ou équivalent :</p>
                      <img src={twoFactorQr} alt="QR code 2FA" className="w-44 h-44 border border-gray-200 rounded" />
                      <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <Input
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Code 6 chiffres"
                          aria-label="Code de vérification 2FA"
                        />
                        <Button type="button" onClick={handleEnable2FA} disabled={twoFactorBusy || twoFactorCode.length !== 6}>
                          Activer 2FA
                        </Button>
                      </div>
                    </div>
                  )}
                  {twoFactorEnabled && (
                    <Button type="button" variant="danger" onClick={handleDisable2FA} disabled={twoFactorBusy}>
                      Désactiver 2FA (mot de passe actuel)
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* User Settings */}
          {activeTab === 'user' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Préférences utilisateur</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Langue
                      </label>
                      <select
                        value={userSettings.language}
                        onChange={(e) => setUserSettings({ ...userSettings, language: e.target.value })}
                        aria-label="Langue"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                      >
                        <option value="fr">Français</option>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Thème
                      </label>
                      <select
                        value={userSettings.theme}
                        onChange={(e) => {
                          const theme = e.target.value as UserUiPreferences['theme'];
                          setUserSettings({ ...userSettings, theme });
                          applyDocumentTheme(theme);
                        }}
                        aria-label="Thème"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                      >
                        <option value="light">Clair</option>
                        <option value="dark">Sombre</option>
                        <option value="auto">Automatique</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Fuseau horaire
                      </label>
                      <select
                        value={userSettings.timezone}
                        onChange={(e) => setUserSettings({ ...userSettings, timezone: e.target.value })}
                        aria-label="Fuseau horaire"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                      >
                        <option value="Europe/Paris">Europe/Paris (GMT+1)</option>
                        <option value="Europe/London">Europe/London (GMT+0)</option>
                        <option value="America/New_York">America/New_York (GMT-5)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Format de date
                      </label>
                      <select
                        value={userSettings.dateFormat}
                        onChange={(e) => setUserSettings({ ...userSettings, dateFormat: e.target.value })}
                        aria-label="Format de date"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Format d'heure
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="timeFormat"
                          value="24h"
                          checked={userSettings.timeFormat === '24h'}
                          onChange={() =>
                            setUserSettings({ ...userSettings, timeFormat: '24h' })
                          }
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-gray-700">24 heures</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="timeFormat"
                          value="12h"
                          checked={userSettings.timeFormat === '12h'}
                          onChange={() =>
                            setUserSettings({ ...userSettings, timeFormat: '12h' })
                          }
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-gray-700">12 heures (AM/PM)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Settings */}
          {activeTab === 'system' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Paramètres système</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 md:col-span-2">
                      <div className="flex items-center space-x-3 mb-2">
                        <FiDatabase className="w-6 h-6 text-blue-600 shrink-0" />
                        <h4 className="font-semibold text-gray-900">Base de données MongoDB</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Sauvegarde complète via <code className="text-xs">mongodump</code> (fichier
                        .archive.gz). La restauration remplace toutes les données — réservée aux
                        administrateurs.
                      </p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleBackup}
                          disabled={backupMutation.isPending || restoreMutation.isPending}
                        >
                          {backupMutation.isPending ? (
                            <FiLoader className="w-4 h-4 mr-2 inline animate-spin" />
                          ) : (
                            <FiDownload className="w-4 h-4 mr-2 inline" />
                          )}
                          Sauvegarder
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleDownloadBackup}
                          disabled={!selectedBackupFilename || backupMutation.isPending}
                        >
                          <FiDownload className="w-4 h-4 mr-2 inline" />
                          Télécharger
                        </Button>
                      </div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Archives sur le serveur
                      </label>
                      <select
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm mb-3"
                        value={selectedBackupFilename}
                        onChange={(e) => setSelectedBackupFilename(e.target.value)}
                        disabled={backupsLoading}
                      >
                        <option value="">
                          {backupsLoading
                            ? 'Chargement…'
                            : (backupsData?.backups?.length ?? 0) === 0
                              ? 'Aucune archive — lancez une sauvegarde'
                              : 'Choisir une archive…'}
                        </option>
                        {(backupsData?.backups ?? []).map((b) => (
                          <option key={b.filename} value={b.filename}>
                            {b.filename} ({formatBackupSize(b.size)})
                          </option>
                        ))}
                      </select>
                      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-3">
                        <p className="text-xs text-amber-900 font-medium">Restauration (destructive)</p>
                        <input
                          ref={restoreFileInputRef}
                          type="file"
                          accept=".archive.gz,application/gzip"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setRestoreFile(file);
                            if (file) setSelectedBackupFilename('');
                          }}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => restoreFileInputRef.current?.click()}
                          >
                            <FiUpload className="w-4 h-4 mr-2 inline" />
                            {restoreFile ? restoreFile.name : 'Importer une archive'}
                          </Button>
                          {restoreFile ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setRestoreFile(null);
                                if (restoreFileInputRef.current) {
                                  restoreFileInputRef.current.value = '';
                                }
                              }}
                            >
                              <FiX className="w-4 h-4" />
                            </Button>
                          ) : null}
                        </div>
                        <Input
                          label='Confirmation (tapez « RESTAURER »)'
                          value={restoreConfirmPhrase}
                          onChange={(e) => setRestoreConfirmPhrase(e.target.value)}
                          placeholder="RESTAURER"
                          autoComplete="off"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleRestore}
                          disabled={
                            restoreMutation.isPending ||
                            backupMutation.isPending ||
                            restoreConfirmPhrase.trim() !== 'RESTAURER' ||
                            (!restoreFile && !selectedBackupFilename)
                          }
                          className="w-full bg-red-600 hover:bg-red-700 text-white border-red-700"
                        >
                          {restoreMutation.isPending ? (
                            <FiLoader className="w-4 h-4 mr-2 inline animate-spin" />
                          ) : (
                            <FiUpload className="w-4 h-4 mr-2 inline" />
                          )}
                          Restaurer la base
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="flex items-center space-x-3 mb-2">
                        <FiRefreshCw className="w-6 h-6 text-green-600" />
                        <h4 className="font-semibold text-gray-900">Cache</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">Vider le cache de l'application</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          localStorage.clear();
                          toast.success('Cache vidé avec succès !');
                        }}
                        className="w-full"
                      >
                        <FiRefreshCw className="w-4 h-4 mr-2 inline" />
                        Vider le cache
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <div className="flex items-center space-x-3 mb-2">
                      <FiTrash2 className="w-6 h-6 text-red-600" />
                      <h4 className="font-semibold text-gray-900">Zone de danger</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Actions irréversibles. Utilisez avec précaution.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => toast.error('Fonctionnalité désactivée pour la sécurité')}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <FiTrash2 className="w-4 h-4 mr-2 inline" />
                      Réinitialiser les données
                    </Button>
                  </div>

                  {/* System Info */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">Informations système</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Version de l'application</span>
                        <span className="font-medium text-gray-900">1.0.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Base de données</span>
                        <span className="font-medium text-gray-900">MongoDB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Environnement</span>
                        <Badge variant="info" size="sm">Développement</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSaving}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="min-w-[140px]"
          >
            {isSaving ? (
              <>
                <FiLoader className="w-5 h-5 mr-2 animate-spin inline" />
                Sauvegarde...
              </>
            ) : (
              <>
                <FiSave className="w-5 h-5 mr-2 inline" />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;

