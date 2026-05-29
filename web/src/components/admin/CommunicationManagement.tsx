'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Avatar from '../ui/Avatar';
import SearchBar from '../ui/SearchBar';
import FilterDropdown from '../ui/FilterDropdown';
import toast from 'react-hot-toast';
import {
  FiBell,
  FiMail,
  FiMessageSquare,
  FiSend,
  FiPlus,
  FiEye,
  FiEdit,
  FiTrash2,
  FiCheck,
  FiAlertCircle,
  FiClock,
  FiUser,
  FiCheckCircle,
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import MessageDetailsModal from './MessageDetailsModal';
import AnnouncementDetailsModal from './AnnouncementDetailsModal';
import MessageRecipientSearch, { type MessageRecipientUser } from '../messaging/MessageRecipientSearch';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';
import { inferPortalCategory, isCircularAnnouncement } from '../../lib/portalCategory';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type CommunicationTab = 'messages' | 'announcements' | 'notifications';

function isRequestsMessage(m: {
  subject?: string | null;
  content?: string;
  category?: string;
  sender?: { role?: string };
}) {
  const role = m.sender?.role;
  const fromFamily = role === 'PARENT' || role === 'STUDENT';
  const urgent = m.category === 'URGENT';
  const text = `${m.subject || ''} ${m.content || ''}`.toLowerCase();
  const keywords = ['réclamation', 'reclamation', 'demande', 'plainte', 'recours'];
  const keywordHit = keywords.some((k) => text.includes(k));
  return fromFamily || urgent || keywordHit;
}

export interface CommunicationManagementProps {
  /** Masque l’en-tête et la barre d’onglets (module Communication hub) */
  embedded?: boolean;
  /** Filtres, listes et modales plus compacts (hub Communication) */
  compact?: boolean;
  /** Onglet affiché en mode embedded */
  embeddedTab?: CommunicationTab;
  /** Sous-filtre annonces : circulaires (titre « Circulaire… ») vs actualités publiées */
  announcementKind?: 'all' | 'circular' | 'news';
  /** Messages : tout le fil ou demandes / réclamations (familles, mots-clés, urgent) */
  messagesMode?: 'all' | 'requests';
}

const CommunicationManagement: React.FC<CommunicationManagementProps> = ({
  embedded = false,
  compact = false,
  embeddedTab = 'messages',
  announcementKind = 'all',
  messagesMode = 'all',
}) => {
  const [activeTab, setActiveTab] = useState<CommunicationTab>(embedded ? embeddedTab : 'messages');

  useEffect(() => {
    if (embedded && embeddedTab) {
      setActiveTab(embeddedTab);
    }
  }, [embedded, embeddedTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [messageStatusFilter, setMessageStatusFilter] = useState<string>('all');
  const [announcementStatusFilter, setAnnouncementStatusFilter] = useState<string>('all');
  const [announcementPriorityFilter, setAnnouncementPriorityFilter] = useState<string>('all');
  const [notificationStatusFilter, setNotificationStatusFilter] = useState<string>('unread');
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [isEditAnnouncementModalOpen, setIsEditAnnouncementModalOpen] = useState(false);
  const [isMessageDetailsModalOpen, setIsMessageDetailsModalOpen] = useState(false);
  const [isAnnouncementDetailsModalOpen, setIsAnnouncementDetailsModalOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [messageForm, setMessageForm] = useState({ 
    receiverId: '', 
    subject: '', 
    content: '',
    category: 'GENERAL',
    channels: ['PLATFORM'] as string[],
  });
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    targetRole: '',
    targetClass: '',
    priority: 'normal',
    expiresAt: '',
    portalCategory: 'auto',
    coverImageUrl: '',
    imageUrls: '',
  });

  const queryClient = useQueryClient();

  // Fetch data
  const { data: messages } = useQuery({
    queryKey: ['admin-messages'],
    queryFn: () => adminApi.getMessages(),
  });

  const { data: announcements } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: () => adminApi.getAnnouncements(),
  });

  const { data: notifications } = useQuery({
    queryKey: ['admin-notifications', notificationStatusFilter],
    queryFn: () => adminApi.getNotifications({ unread: notificationStatusFilter === 'unread' }),
  });

  const { data: allNotifications } = useQuery({
    queryKey: ['admin-all-notifications'],
    queryFn: () => adminApi.getNotifications(),
    enabled: notificationStatusFilter === 'all',
  });

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.getAllUsers(),
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: adminApi.getClasses,
  });

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: adminApi.sendMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-messages'] });
      toast.success('Message envoyé avec succès');
      setIsMessageModalOpen(false);
      setMessageForm({ receiverId: '', subject: '', content: '', category: 'GENERAL', channels: ['PLATFORM'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'envoi du message');
    },
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: adminApi.createAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Annonce créée avec succès');
      setIsAnnouncementModalOpen(false);
      setAnnouncementForm({
        title: '',
        content: '',
        targetRole: '',
        targetClass: '',
        priority: 'normal',
        expiresAt: '',
        portalCategory: 'auto',
        coverImageUrl: '',
        imageUrls: '',
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la création de l\'annonce');
    },
  });

  const updateAnnouncementMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateAnnouncement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Annonce mise à jour avec succès');
      setIsEditAnnouncementModalOpen(false);
      setEditingAnnouncement(null);
      setAnnouncementForm({
        title: '',
        content: '',
        targetRole: '',
        targetClass: '',
        priority: 'normal',
        expiresAt: '',
        portalCategory: 'auto',
        coverImageUrl: '',
        imageUrls: '',
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour de l\'annonce');
    },
  });

  const markMessageReadMutation = useMutation({
    mutationFn: adminApi.markMessageAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-messages'] });
      toast.success('Message marqué comme lu');
    },
  });

  const publishAnnouncementMutation = useMutation({
    mutationFn: adminApi.publishAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Annonce publiée avec succès');
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: adminApi.deleteMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-messages'] });
      toast.success('Message supprimé avec succès');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression du message');
    },
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: adminApi.deleteAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Annonce supprimée avec succès');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression de l\'annonce');
    },
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: adminApi.markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-notifications'] });
      toast.success('Notification marquée comme lue');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors du marquage de la notification');
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: adminApi.deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-notifications'] });
      toast.success('Notification supprimée avec succès');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression de la notification');
    },
  });

  const markAllNotificationsReadMutation = useMutation({
    mutationFn: () => adminApi.markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-notifications'] });
      toast.success('Toutes les notifications ont été marquées comme lues');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors du marquage des notifications');
    },
  });

  const tabs = [
    { id: 'messages' as CommunicationTab, label: 'Messages', icon: FiMail, count: messages?.filter((m: any) => !m.read).length || 0 },
    { id: 'announcements' as CommunicationTab, label: 'Annonces', icon: FiMessageSquare, count: announcements?.filter((a: any) => !a.published).length || 0 },
    { id: 'notifications' as CommunicationTab, label: 'Notifications', icon: FiBell, count: (notificationStatusFilter === 'unread' ? notifications?.length : allNotifications?.filter((n: any) => !n.read).length) || 0 },
  ];

  // Filter data
  const filteredMessages = useMemo(() => {
    if (!messages) return [];
    let filtered = messages;

    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((message: any) =>
        message.subject?.toLowerCase().includes(searchLower) ||
        message.content.toLowerCase().includes(searchLower) ||
        message.sender.firstName.toLowerCase().includes(searchLower) ||
        message.sender.lastName.toLowerCase().includes(searchLower) ||
        message.receiver.firstName.toLowerCase().includes(searchLower) ||
        message.receiver.lastName.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (messageStatusFilter === 'read') {
      filtered = filtered.filter((m: any) => m.read);
    } else if (messageStatusFilter === 'unread') {
      filtered = filtered.filter((m: any) => !m.read);
    }

    if (messagesMode === 'requests') {
      filtered = filtered.filter((m: any) => isRequestsMessage(m));
    }

    return filtered;
  }, [messages, searchQuery, messageStatusFilter, messagesMode]);

  const filteredAnnouncements = useMemo(() => {
    if (!announcements) return [];
    let filtered = announcements;

    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((announcement: any) =>
        announcement.title.toLowerCase().includes(searchLower) ||
        announcement.content.toLowerCase().includes(searchLower) ||
        announcement.author.firstName.toLowerCase().includes(searchLower) ||
        announcement.author.lastName.toLowerCase().includes(searchLower)
      );
    }

    // Role filter
    if (selectedRole !== 'all') {
      filtered = filtered.filter((a: any) => a.targetRole === selectedRole);
    }

    // Status filter
    if (announcementStatusFilter === 'published') {
      filtered = filtered.filter((a: any) => a.published);
    } else if (announcementStatusFilter === 'draft') {
      filtered = filtered.filter((a: any) => !a.published);
    }

    // Priority filter
    if (announcementPriorityFilter !== 'all') {
      filtered = filtered.filter((a: any) => a.priority === announcementPriorityFilter);
    }

    if (announcementKind === 'circular') {
      filtered = filtered.filter((a: any) => isCircularAnnouncement(a));
    } else if (announcementKind === 'news') {
      filtered = filtered.filter(
        (a: any) =>
          a.published && inferPortalCategory(a.title, a.portalCategory) !== 'circular'
      );
    }

    return filtered;
  }, [
    announcements,
    searchQuery,
    selectedRole,
    announcementStatusFilter,
    announcementPriorityFilter,
    announcementKind,
  ]);

  const filteredNotifications = useMemo(() => {
    const notifs = notificationStatusFilter === 'all' ? allNotifications : notifications;
    if (!notifs) return [];

    let filtered = notifs;

    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((notification: any) =>
        notification.title.toLowerCase().includes(searchLower) ||
        notification.content.toLowerCase().includes(searchLower) ||
        notification.type?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter (for 'all' view)
    if (notificationStatusFilter === 'all') {
      // Already handled by the query
    } else if (notificationStatusFilter === 'read') {
      filtered = filtered.filter((n: any) => n.read);
    }

    return filtered;
  }, [notifications, allNotifications, searchQuery, notificationStatusFilter]);

  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, { label: string; variant: 'default' | 'info' | 'warning' | 'danger' }> = {
      low: { label: 'Basse', variant: 'default' },
      normal: { label: 'Normale', variant: 'info' },
      high: { label: 'Haute', variant: 'warning' },
      urgent: { label: 'Urgente', variant: 'danger' },
    };
    const priorityInfo = priorityMap[priority] || priorityMap.normal;
    return <Badge variant={priorityInfo.variant}>{priorityInfo.label}</Badge>;
  };

  const handleSendMessage = () => {
    if (!messageForm.receiverId || !messageForm.content) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }
    sendMessageMutation.mutate({
      receiverId: messageForm.receiverId,
      subject: messageForm.subject,
      content: messageForm.content,
      category: messageForm.category,
      channels: messageForm.channels,
    });
  };

  const handleCreateAnnouncement = () => {
    if (!announcementForm.title || !announcementForm.content) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }
    const { portalCategory, coverImageUrl, imageUrls, ...rest } = announcementForm;
    createAnnouncementMutation.mutate({
      ...rest,
      portalCategory: portalCategory === 'auto' ? '' : portalCategory,
      coverImageUrl: coverImageUrl.trim() || undefined,
      imageUrls: imageUrls.trim()
        ? imageUrls
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    });
  };

  const handleEditAnnouncement = (announcement: any) => {
    setEditingAnnouncement(announcement);
    setAnnouncementForm({
      title: announcement.title,
      content: announcement.content,
      targetRole: announcement.targetRole || '',
      targetClass: announcement.targetClassId || '',
      priority: announcement.priority || 'normal',
      expiresAt: announcement.expiresAt ? format(new Date(announcement.expiresAt), "yyyy-MM-dd'T'HH:mm") : '',
      portalCategory: announcement.portalCategory || 'auto',
      coverImageUrl: announcement.coverImageUrl || '',
      imageUrls: Array.isArray(announcement.imageUrls) ? announcement.imageUrls.join('\n') : '',
    });
    setIsEditAnnouncementModalOpen(true);
  };

  const handleUpdateAnnouncement = () => {
    if (!announcementForm.title || !announcementForm.content) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }
    if (!editingAnnouncement) return;
    const { portalCategory, coverImageUrl, imageUrls, ...rest } = announcementForm;
    updateAnnouncementMutation.mutate({
      id: editingAnnouncement.id,
      data: {
        ...rest,
        portalCategory: portalCategory === 'auto' ? '' : portalCategory,
        coverImageUrl: coverImageUrl.trim() || null,
        imageUrls: imageUrls.trim()
          ? imageUrls
              .split(/[\n,;]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      },
    });
  };

  // Export functions for messages
  const exportMessagesToCSV = () => {
    if (!filteredMessages || filteredMessages.length === 0) {
      toast.error('Aucun message à exporter');
      return;
    }

    try {
      const headers = ['Expéditeur', 'Destinataire', 'Sujet', 'Contenu', 'Date', 'Statut'];
      const csvContent =
        '\ufeff' +
        headers.join(';') +
        '\n' +
        filteredMessages
          .map((message: any) =>
            [
              `"${message.sender.firstName} ${message.sender.lastName}"`,
              `"${message.receiver.firstName} ${message.receiver.lastName}"`,
              `"${(message.subject || '').replace(/"/g, '""')}"`,
              `"${message.content.replace(/"/g, '""')}"`,
              format(new Date(message.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr }),
              message.read ? 'Lu' : 'Non lu',
            ].join(';')
          )
          .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `messages_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Messages exportés en CSV avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const exportMessagesToJSON = () => {
    if (!filteredMessages || filteredMessages.length === 0) {
      toast.error('Aucun message à exporter');
      return;
    }

    try {
      const jsonData = filteredMessages.map((message: any) => ({
        expéditeur: `${message.sender.firstName} ${message.sender.lastName}`,
        destinataire: `${message.receiver.firstName} ${message.receiver.lastName}`,
        sujet: message.subject || 'N/A',
        contenu: message.content,
        date: format(new Date(message.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        statut: message.read ? 'Lu' : 'Non lu',
      }));

      const jsonString = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `messages_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Messages exportés en JSON avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export JSON:', error);
      toast.error('Erreur lors de l\'export JSON');
    }
  };

  const exportMessagesToPDF = () => {
    if (!filteredMessages || filteredMessages.length === 0) {
      toast.error('Aucun message à exporter');
      return;
    }

    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const currentDate = new Date().toLocaleDateString('fr-FR');
      
      doc.setFontSize(20);
      doc.setTextColor(236, 72, 153);
      doc.text('School Manager', 14, 20);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Rapport des Messages', 14, 30);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Généré le ${currentDate}`, 14, 37);

      const tableData = filteredMessages.map((message: any) => [
        `${message.sender.firstName} ${message.sender.lastName}`.substring(0, 20),
        `${message.receiver.firstName} ${message.receiver.lastName}`.substring(0, 20),
        (message.subject || 'N/A').substring(0, 30),
        message.content.substring(0, 40),
        format(new Date(message.createdAt), 'dd/MM/yyyy', { locale: fr }),
        message.read ? 'Lu' : 'Non lu',
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
        head: [['Expéditeur', 'Destinataire', 'Sujet', 'Contenu', 'Date', 'Statut']],
        body: tableData,
        startY: 45,
        theme: 'striped',
        headStyles: { fillColor: [236, 72, 153], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });

      doc.save(`messages_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Messages exportés en PDF avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de l\'export PDF:', error);
      toast.error(`Erreur lors de l'export PDF: ${error.message || 'Erreur inconnue'}`);
    }
  };

  // Export functions for announcements
  const exportAnnouncementsToCSV = () => {
    if (!filteredAnnouncements || filteredAnnouncements.length === 0) {
      toast.error('Aucune annonce à exporter');
      return;
    }

    try {
      const headers = ['Titre', 'Auteur', 'Rôle cible', 'Classe cible', 'Priorité', 'Date', 'Statut'];
      const csvContent =
        '\ufeff' +
        headers.join(';') +
        '\n' +
        filteredAnnouncements
          .map((announcement: any) =>
            [
              `"${announcement.title.replace(/"/g, '""')}"`,
              `"${announcement.author.firstName} ${announcement.author.lastName}"`,
              announcement.targetRole || 'Tous',
              announcement.targetClassRelation?.name || 'Toutes',
              announcement.priority,
              format(new Date(announcement.createdAt), 'dd/MM/yyyy', { locale: fr }),
              announcement.published ? 'Publiée' : 'Brouillon',
            ].join(';')
          )
          .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `annonces_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Annonces exportées en CSV avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const exportAnnouncementsToJSON = () => {
    if (!filteredAnnouncements || filteredAnnouncements.length === 0) {
      toast.error('Aucune annonce à exporter');
      return;
    }

    try {
      const jsonData = filteredAnnouncements.map((announcement: any) => ({
        titre: announcement.title,
        auteur: `${announcement.author.firstName} ${announcement.author.lastName}`,
        rôleCible: announcement.targetRole || 'Tous',
        classeCible: announcement.targetClassRelation?.name || 'Toutes',
        priorité: announcement.priority,
        date: format(new Date(announcement.createdAt), 'dd/MM/yyyy', { locale: fr }),
        statut: announcement.published ? 'Publiée' : 'Brouillon',
      }));

      const jsonString = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `annonces_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Annonces exportées en JSON avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export JSON:', error);
      toast.error('Erreur lors de l\'export JSON');
    }
  };

  const exportAnnouncementsToPDF = () => {
    if (!filteredAnnouncements || filteredAnnouncements.length === 0) {
      toast.error('Aucune annonce à exporter');
      return;
    }

    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const currentDate = new Date().toLocaleDateString('fr-FR');
      
      doc.setFontSize(20);
      doc.setTextColor(236, 72, 153);
      doc.text('School Manager', 14, 20);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Rapport des Annonces', 14, 30);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Généré le ${currentDate}`, 14, 37);

      const tableData = filteredAnnouncements.map((announcement: any) => [
        announcement.title.substring(0, 30),
        `${announcement.author.firstName} ${announcement.author.lastName}`.substring(0, 20),
        announcement.targetRole || 'Tous',
        (announcement.targetClassRelation?.name || 'Toutes').substring(0, 15),
        announcement.priority,
        format(new Date(announcement.createdAt), 'dd/MM/yyyy', { locale: fr }),
        announcement.published ? 'Publiée' : 'Brouillon',
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
        head: [['Titre', 'Auteur', 'Rôle cible', 'Classe cible', 'Priorité', 'Date', 'Statut']],
        body: tableData,
        startY: 45,
        theme: 'striped',
        headStyles: { fillColor: [236, 72, 153], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });

      doc.save(`annonces_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Annonces exportées en PDF avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de l\'export PDF:', error);
      toast.error(`Erreur lors de l'export PDF: ${error.message || 'Erreur inconnue'}`);
    }
  };

  // Export functions for notifications
  const exportNotificationsToCSV = () => {
    if (!filteredNotifications || filteredNotifications.length === 0) {
      toast.error('Aucune notification à exporter');
      return;
    }

    try {
      const headers = ['Type', 'Titre', 'Contenu', 'Date', 'Statut'];
      const csvContent =
        '\ufeff' +
        headers.join(';') +
        '\n' +
        filteredNotifications
          .map((notification: any) =>
            [
              notification.type || 'N/A',
              `"${notification.title.replace(/"/g, '""')}"`,
              `"${notification.content.replace(/"/g, '""')}"`,
              format(new Date(notification.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr }),
              notification.read ? 'Lu' : 'Non lu',
            ].join(';')
          )
          .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `notifications_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Notifications exportées en CSV avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const exportNotificationsToJSON = () => {
    if (!filteredNotifications || filteredNotifications.length === 0) {
      toast.error('Aucune notification à exporter');
      return;
    }

    try {
      const jsonData = filteredNotifications.map((notification: any) => ({
        type: notification.type || 'N/A',
        titre: notification.title,
        contenu: notification.content,
        date: format(new Date(notification.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        statut: notification.read ? 'Lu' : 'Non lu',
      }));

      const jsonString = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `notifications_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Notifications exportées en JSON avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'export JSON:', error);
      toast.error('Erreur lors de l\'export JSON');
    }
  };

  const exportNotificationsToPDF = () => {
    if (!filteredNotifications || filteredNotifications.length === 0) {
      toast.error('Aucune notification à exporter');
      return;
    }

    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const currentDate = new Date().toLocaleDateString('fr-FR');
      
      doc.setFontSize(20);
      doc.setTextColor(236, 72, 153);
      doc.text('School Manager', 14, 20);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Rapport des Notifications', 14, 30);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Généré le ${currentDate}`, 14, 37);

      const tableData = filteredNotifications.map((notification: any) => [
        notification.type || 'N/A',
        notification.title.substring(0, 40),
        notification.content.substring(0, 50),
        format(new Date(notification.createdAt), 'dd/MM/yyyy', { locale: fr }),
        notification.read ? 'Lu' : 'Non lu',
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
        head: [['Type', 'Titre', 'Contenu', 'Date', 'Statut']],
        body: tableData,
        startY: 45,
        theme: 'striped',
        headStyles: { fillColor: [236, 72, 153], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });

      doc.save(`notifications_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Notifications exportées en PDF avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de l\'export PDF:', error);
      toast.error(`Erreur lors de l'export PDF: ${error.message || 'Erreur inconnue'}`);
    }
  };

  const listTitleClass = compact
    ? 'text-base font-bold text-gray-800 mb-3'
    : 'text-xl font-bold text-gray-800 mb-6';

  return (
    <div className={compact ? 'space-y-4 text-sm' : 'space-y-6'}>
      {/* Header */}
      {!embedded && (
      <Card className="bg-gradient-to-r from-pink-600 to-rose-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black mb-2">Communication</h2>
            <p className="text-pink-100 text-lg">
              Restez connecté avec tous les acteurs de l'établissement
            </p>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{messages?.length || 0}</div>
              <div className="text-sm text-pink-100">Messages</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{announcements?.length || 0}</div>
              <div className="text-sm text-pink-100">Annonces</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{(notificationStatusFilter === 'unread' ? notifications?.length : allNotifications?.length) || 0}</div>
              <div className="text-sm text-pink-100">Notifications</div>
            </div>
          </div>
        </div>
      </Card>
      )}

      {/* Tabs */}
      {!embedded && (
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg transform scale-105'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-pink-100 text-pink-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center space-x-2">
            {activeTab === 'messages' && (
              <Button onClick={() => setIsMessageModalOpen(true)}>
                <FiPlus className="w-4 h-4 mr-2" />
                Nouveau message
              </Button>
            )}
            {activeTab === 'announcements' && (
              <Button onClick={() => setIsAnnouncementModalOpen(true)}>
                <FiPlus className="w-4 h-4 mr-2" />
                Nouvelle annonce
              </Button>
            )}
          </div>
        </div>
      </Card>
      )}

      {embedded && (
        <div className="flex flex-wrap justify-end gap-2">
          {activeTab === 'messages' && (
            <Button size={compact ? 'sm' : 'md'} onClick={() => setIsMessageModalOpen(true)}>
              <FiPlus className="w-4 h-4 mr-2" />
              Nouveau message
            </Button>
          )}
          {activeTab === 'announcements' && (
            <Button size={compact ? 'sm' : 'md'} onClick={() => setIsAnnouncementModalOpen(true)}>
              <FiPlus className="w-4 h-4 mr-2" />
              {announcementKind === 'circular' ? 'Nouvelle circulaire' : 'Nouvelle actualité'}
            </Button>
          )}
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className={compact ? 'flex flex-col md:flex-row gap-3' : 'flex flex-col md:flex-row gap-4'}>
          <div className="flex-1">
            <SearchBar
              compact={compact}
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Rechercher..."
            />
          </div>
          {activeTab === 'messages' && (
            <FilterDropdown compact={compact}
              label="Statut"
              selected={messageStatusFilter}
              onChange={setMessageStatusFilter}
              options={[
                { value: 'all', label: 'Tous' },
                { value: 'read', label: 'Lus' },
                { value: 'unread', label: 'Non lus' },
              ]}
            />
          )}
          {activeTab === 'announcements' && (
            <>
              <FilterDropdown compact={compact}
                label="Rôle cible"
                selected={selectedRole}
                onChange={setSelectedRole}
                options={[
                  { value: 'all', label: 'Tous les rôles' },
                  { value: 'ADMIN', label: 'Administrateurs' },
                  { value: 'TEACHER', label: 'Enseignants' },
                  { value: 'STUDENT', label: 'Élèves' },
                  { value: 'PARENT', label: 'Parents' },
                ]}
              />
              <FilterDropdown compact={compact}
                label="Statut"
                selected={announcementStatusFilter}
                onChange={setAnnouncementStatusFilter}
                options={[
                  { value: 'all', label: 'Tous' },
                  { value: 'published', label: 'Publiées' },
                  { value: 'draft', label: 'Brouillons' },
                ]}
              />
              <FilterDropdown compact={compact}
                label="Priorité"
                selected={announcementPriorityFilter}
                onChange={setAnnouncementPriorityFilter}
                options={[
                  { value: 'all', label: 'Toutes' },
                  { value: 'low', label: 'Basse' },
                  { value: 'normal', label: 'Normale' },
                  { value: 'high', label: 'Haute' },
                  { value: 'urgent', label: 'Urgente' },
                ]}
              />
            </>
          )}
          {activeTab === 'notifications' && (
            <FilterDropdown compact={compact}
              label="Statut"
              selected={notificationStatusFilter}
              onChange={setNotificationStatusFilter}
              options={[
                { value: 'unread', label: 'Non lues' },
                { value: 'all', label: 'Toutes' },
                { value: 'read', label: 'Lues' },
              ]}
            />
          )}
          {/* Export buttons */}
          {activeTab === 'messages' && (
            <FilterDropdown compact={compact}
              label="Exporter"
              selected=""
              onChange={(format) => {
                if (format === 'csv') exportMessagesToCSV();
                if (format === 'json') exportMessagesToJSON();
                if (format === 'pdf') exportMessagesToPDF();
              }}
              options={[
                { value: 'csv', label: 'CSV' },
                { value: 'json', label: 'JSON' },
                { value: 'pdf', label: 'PDF' },
              ]}
            />
          )}
          {activeTab === 'announcements' && (
            <FilterDropdown compact={compact}
              label="Exporter"
              selected=""
              onChange={(format) => {
                if (format === 'csv') exportAnnouncementsToCSV();
                if (format === 'json') exportAnnouncementsToJSON();
                if (format === 'pdf') exportAnnouncementsToPDF();
              }}
              options={[
                { value: 'csv', label: 'CSV' },
                { value: 'json', label: 'JSON' },
                { value: 'pdf', label: 'PDF' },
              ]}
            />
          )}
          {activeTab === 'notifications' && (
            <>
            <Button
              variant="secondary"
              size={compact ? 'sm' : 'md'}
              onClick={() => markAllNotificationsReadMutation.mutate()}
              disabled={markAllNotificationsReadMutation.isPending}
            >
              <FiCheckCircle className="w-4 h-4 mr-2" />
              Tout marquer comme lu
            </Button>
              <FilterDropdown compact={compact}
                label="Exporter"
                selected=""
                onChange={(format) => {
                  if (format === 'csv') exportNotificationsToCSV();
                  if (format === 'json') exportNotificationsToJSON();
                  if (format === 'pdf') exportNotificationsToPDF();
                }}
                options={[
                  { value: 'csv', label: 'CSV' },
                  { value: 'json', label: 'JSON' },
                  { value: 'pdf', label: 'PDF' },
                ]}
              />
            </>
          )}
        </div>
      </Card>

      {/* Content */}
      <div className="animate-slide-up">
        {activeTab === 'messages' && (
          <Card>
            <h3 className={listTitleClass}>
              {messagesMode === 'requests'
                ? `Demandes et réclamations (${filteredMessages.length})`
                : `Messages (${filteredMessages.length})`}
            </h3>
            {filteredMessages.length === 0 ? (
              <div className="text-center py-12">
                <FiMail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Aucun message trouvé</p>
              </div>
            ) : (
              <div className={compact ? 'space-y-3' : 'space-y-4'}>
                {filteredMessages.map((message: any) => (
                  <div
                    key={message.id}
                    className={`rounded-lg border-2 transition-all ${
                      compact ? 'p-3' : 'p-4'
                    } ${
                      message.read
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <Avatar
                          src={message.sender.avatar}
                          name={`${message.sender.firstName} ${message.sender.lastName}`}
                          size={compact ? 'sm' : 'md'}
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1 flex-wrap">
                            <span className="font-bold text-gray-800">
                              {message.sender.firstName} {message.sender.lastName}
                            </span>
                            {message.category && (
                              <Badge
                                variant={
                                  message.category === 'URGENT'
                                    ? 'danger'
                                    : message.category === 'ACADEMIC'
                                    ? 'info'
                                    : 'default'
                                }
                                className="text-xs"
                              >
                                {message.category === 'GENERAL'
                                  ? 'Général'
                                  : message.category === 'ACADEMIC'
                                  ? 'Académique'
                                  : message.category === 'ABSENCE'
                                  ? 'Absence'
                                  : message.category === 'PAYMENT'
                                  ? 'Paiement'
                                  : message.category === 'CONDUCT'
                                  ? 'Conduite'
                                  : message.category === 'URGENT'
                                  ? 'Urgent'
                                  : message.category === 'ANNOUNCEMENT'
                                  ? 'Annonce'
                                  : message.category}
                              </Badge>
                            )}
                            {message.channels && message.channels.length > 0 && (
                              <div className="flex items-center space-x-1">
                                {message.channels.includes('PLATFORM') && (
                                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                    📱 Plateforme
                                  </span>
                                )}
                                {message.channels.includes('EMAIL') && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                    ✉️ Email
                                  </span>
                                )}
                                {message.channels.includes('SMS') && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                    📱 SMS
                                  </span>
                                )}
                              </div>
                            )}
                            <Badge variant="info">
                              {message.sender.role}
                            </Badge>
                            {!message.read && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                <FiAlertCircle className="w-3 h-3 mr-1" />
                                Non lu
                              </span>
                            )}
                          </div>
                          {message.subject && (
                            <h4 className="font-semibold text-gray-800 mb-1">{message.subject}</h4>
                          )}
                          <p
                            className={`text-gray-600 mb-2 line-clamp-2 ${compact ? 'text-xs' : 'text-sm'}`}
                          >
                            {message.content}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <div className="flex items-center">
                              <FiUser className="w-3 h-3 mr-1" />
                              À: {message.receiver.firstName} {message.receiver.lastName}
                            </div>
                            <div className="flex items-center">
                              <FiClock className="w-3 h-3 mr-1" />
                              {format(new Date(message.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {!message.read && (
                          <button
                            onClick={() => markMessageReadMutation.mutate(message.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Marquer comme lu"
                          >
                            <FiCheck className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedMessageId(message.id);
                            setIsMessageDetailsModalOpen(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Voir les détails"
                        >
                          <FiEye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
                              deleteMessageMutation.mutate(message.id);
                            }
                          }}
                          disabled={deleteMessageMutation.isPending}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Supprimer"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'announcements' && (
          <Card>
            <h3 className={listTitleClass}>
              {announcementKind === 'circular'
                ? `Circulaires (${filteredAnnouncements.length})`
                : announcementKind === 'news'
                  ? `Actualités (${filteredAnnouncements.length})`
                  : `Annonces (${filteredAnnouncements.length})`}
            </h3>
            {filteredAnnouncements.length === 0 ? (
              <div className="text-center py-12">
                <FiMessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Aucune annonce trouvée</p>
              </div>
            ) : (
              <div className={compact ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
                {filteredAnnouncements.map((announcement: any) => (
                  <Card
                    key={announcement.id}
                    className={`hover:shadow-lg transition-shadow ${
                      !announcement.published ? 'border-2 border-yellow-200 bg-yellow-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-bold text-gray-800">{announcement.title}</h4>
                          {getPriorityBadge(announcement.priority)}
                          {!announcement.published && (
                            <Badge variant="warning">
                              Brouillon
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                          {announcement.content}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500 mb-3">
                          <div className="flex items-center">
                            <FiUser className="w-3 h-3 mr-1" />
                            {announcement.author.firstName} {announcement.author.lastName}
                          </div>
                          {announcement.targetRole && (
                            <Badge variant="info" size="sm">
                              {announcement.targetRole}
                            </Badge>
                          )}
                          {announcement.targetClassRelation && (
                            <Badge variant="info" size="sm">
                              {announcement.targetClassRelation.name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                          <FiClock className="w-3 h-3 mr-1" />
                          {format(new Date(announcement.createdAt), 'dd/MM/yyyy', { locale: fr })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-3 border-t border-gray-200">
                      {!announcement.published && (
                        <Button
                          size="sm"
                          onClick={() => publishAnnouncementMutation.mutate(announcement.id)}
                          className="flex-1"
                        >
                          <FiSend className="w-4 h-4 mr-1" />
                          Publier
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEditAnnouncement(announcement)}
                      >
                        <FiEdit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedAnnouncementId(announcement.id);
                          setIsAnnouncementDetailsModalOpen(true);
                        }}
                      >
                        <FiEye className="w-4 h-4" />
                      </Button>
                      <button
                        onClick={() => {
                          if (window.confirm('Êtes-vous sûr de vouloir supprimer cette annonce ?')) {
                            deleteAnnouncementMutation.mutate(announcement.id);
                          }
                        }}
                        disabled={deleteAnnouncementMutation.isPending}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'notifications' && (
          <Card>
            <h3 className={listTitleClass}>Notifications ({filteredNotifications.length})</h3>
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <FiCheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                <p className="text-gray-600">
                  {notificationStatusFilter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification trouvée'}
                </p>
              </div>
            ) : (
              <div className={compact ? 'space-y-2' : 'space-y-3'}>
                {filteredNotifications.map((notification: any) => (
                  <div
                    key={notification.id}
                    className={`border rounded-lg flex items-start space-x-3 transition-all ${
                      compact ? 'p-3' : 'p-4'
                    } ${
                      notification.read
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <FiBell
                      className={`mt-0.5 ${notification.read ? 'text-gray-400' : 'text-blue-600'} ${
                        compact ? 'w-4 h-4' : 'w-5 h-5'
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className={`font-semibold text-gray-800 ${compact ? 'text-sm' : ''}`}>
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <Badge variant="info" size="sm">
                            Non lu
                          </Badge>
                        )}
                        {notification.type && (
                          <Badge variant="info" size="sm">
                            {notification.type}
                          </Badge>
                        )}
                      </div>
                      <p className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
                        {notification.content}
                      </p>
                      <div className="flex items-center text-xs text-gray-500 mt-2">
                        <FiClock className="w-3 h-3 mr-1" />
                        {format(new Date(notification.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!notification.read && (
                        <button
                          onClick={() => markNotificationReadMutation.mutate(notification.id)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Marquer comme lu"
                        >
                          <FiCheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (window.confirm('Êtes-vous sûr de vouloir supprimer cette notification ?')) {
                            deleteNotificationMutation.mutate(notification.id);
                          }
                        }}
                        disabled={deleteNotificationMutation.isPending}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Message Details Modal */}
      {selectedMessageId && (
        <MessageDetailsModal
          isOpen={isMessageDetailsModalOpen}
          onClose={() => {
            setIsMessageDetailsModalOpen(false);
            setSelectedMessageId(null);
          }}
          messageId={selectedMessageId}
          onReply={(receiverId, subject) => {
            setIsMessageDetailsModalOpen(false);
            setMessageForm({ receiverId, subject, content: '', category: 'GENERAL', channels: ['PLATFORM'] });
            setIsMessageModalOpen(true);
          }}
        />
      )}

      {/* Announcement Details Modal */}
      {selectedAnnouncementId && (
        <AnnouncementDetailsModal
          isOpen={isAnnouncementDetailsModalOpen}
          onClose={() => {
            setIsAnnouncementDetailsModalOpen(false);
            setSelectedAnnouncementId(null);
          }}
          announcementId={selectedAnnouncementId}
        />
      )}

      {/* Message Modal */}
      <Modal
        isOpen={isMessageModalOpen}
        onClose={() => {
          setIsMessageModalOpen(false);
          setMessageForm({ receiverId: '', subject: '', content: '', category: 'GENERAL', channels: ['PLATFORM'] });
        }}
        title="Nouveau message"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Destinataire <span className="text-red-500">*</span>
            </label>
            <MessageRecipientSearch
              inModal
              compact={compact}
              accent="pink"
              users={(Array.isArray(users) ? users : []) as MessageRecipientUser[]}
              value={messageForm.receiverId}
              onChange={(receiverId) => setMessageForm({ ...messageForm, receiverId })}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Sujet</label>
            <Input
              value={messageForm.subject}
              onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
              placeholder="Sujet du message (optionnel)"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={messageForm.content}
              onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
              placeholder="Contenu du message"
              rows={6}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Catégorie <span className="text-red-500">*</span>
            </label>
            <FilterDropdown
              compact={compact}
              label="Catégorie"
              selected={messageForm.category}
              onChange={(value) => setMessageForm({ ...messageForm, category: value })}
              options={[
                { value: 'GENERAL', label: 'Général' },
                { value: 'ACADEMIC', label: 'Académique' },
                { value: 'ABSENCE', label: 'Absence' },
                { value: 'PAYMENT', label: 'Paiement' },
                { value: 'CONDUCT', label: 'Conduite' },
                { value: 'URGENT', label: 'Urgent' },
                { value: 'ANNOUNCEMENT', label: 'Annonce' },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Canaux d'envoi <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={messageForm.channels.includes('PLATFORM')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setMessageForm({
                        ...messageForm,
                        channels: [...messageForm.channels, 'PLATFORM'],
                      });
                    } else {
                      setMessageForm({
                        ...messageForm,
                        channels: messageForm.channels.filter((c) => c !== 'PLATFORM'),
                      });
                    }
                  }}
                  className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                />
                <span className="text-sm text-gray-700">Plateforme (message interne)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={messageForm.channels.includes('EMAIL')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setMessageForm({
                        ...messageForm,
                        channels: [...messageForm.channels, 'EMAIL'],
                      });
                    } else {
                      setMessageForm({
                        ...messageForm,
                        channels: messageForm.channels.filter((c) => c !== 'EMAIL'),
                      });
                    }
                  }}
                  className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                />
                <span className="text-sm text-gray-700">Email</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={messageForm.channels.includes('SMS')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setMessageForm({
                        ...messageForm,
                        channels: [...messageForm.channels, 'SMS'],
                      });
                    } else {
                      setMessageForm({
                        ...messageForm,
                        channels: messageForm.channels.filter((c) => c !== 'SMS'),
                      });
                    }
                  }}
                  className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                />
                <span className="text-sm text-gray-700">SMS</span>
              </label>
            </div>
            {messageForm.channels.length === 0 && (
              <p className="text-sm text-red-500 mt-1">Veuillez sélectionner au moins un canal</p>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsMessageModalOpen(false);
                setMessageForm({ receiverId: '', subject: '', content: '', category: 'GENERAL', channels: ['PLATFORM'] });
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={sendMessageMutation.isPending}
              className="bg-pink-600 hover:bg-pink-700"
            >
              {sendMessageMutation.isPending ? (
                <>
                  <FiClock className="w-4 h-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <FiSend className="w-4 h-4 mr-2" />
                  Envoyer
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Announcement Modal */}
      <Modal
        isOpen={isAnnouncementModalOpen}
        onClose={() => {
          setIsAnnouncementModalOpen(false);
          setAnnouncementForm({
            title: '',
            content: '',
            targetRole: '',
            targetClass: '',
            priority: 'normal',
            expiresAt: '',
            portalCategory: 'auto',
            coverImageUrl: '',
            imageUrls: '',
          });
        }}
        title="Nouvelle annonce"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Titre <span className="text-red-500">*</span>
            </label>
            <Input
              value={announcementForm.title}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
              placeholder="Titre de l'annonce"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Contenu <span className="text-red-500">*</span>
            </label>
            <textarea
              value={announcementForm.content}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
              placeholder="Contenu de l'annonce"
              rows={6}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type portail</label>
              <FilterDropdown
                compact={compact}
                selected={announcementForm.portalCategory}
                onChange={(value) => setAnnouncementForm({ ...announcementForm, portalCategory: value })}
                options={[
                  { value: 'auto', label: 'Auto (détecter circulaire au titre)' },
                  { value: 'circular', label: 'Circulaire officielle' },
                  { value: 'news', label: 'Actualité' },
                  { value: 'gallery', label: 'Galerie (médias)' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Image de couverture (URL)</label>
              <Input
                value={announcementForm.coverImageUrl}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, coverImageUrl: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Images supplémentaires (URL, une par ligne ou virgules)
            </label>
            <textarea
              value={announcementForm.imageUrls}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, imageUrls: e.target.value })}
              placeholder="https://…"
              rows={3}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Rôle cible</label>
              <FilterDropdown compact={compact}
                selected={announcementForm.targetRole}
                onChange={(value) => setAnnouncementForm({ ...announcementForm, targetRole: value })}
                options={[
                  { value: '', label: 'Tous les rôles' },
                  { value: 'ADMIN', label: 'Administrateurs' },
                  { value: 'TEACHER', label: 'Enseignants' },
                  { value: 'STUDENT', label: 'Élèves' },
                  { value: 'PARENT', label: 'Parents' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Classe cible</label>
              <FilterDropdown compact={compact}
                selected={announcementForm.targetClass}
                onChange={(value) => setAnnouncementForm({ ...announcementForm, targetClass: value })}
                options={[
                  { value: '', label: 'Toutes les classes' },
                  ...(classes?.map((c: any) => ({ value: c.id, label: c.name })) || []),
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Priorité</label>
              <FilterDropdown compact={compact}
                selected={announcementForm.priority}
                onChange={(value) => setAnnouncementForm({ ...announcementForm, priority: value })}
                options={[
                  { value: 'low', label: 'Basse' },
                  { value: 'normal', label: 'Normale' },
                  { value: 'high', label: 'Haute' },
                  { value: 'urgent', label: 'Urgente' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date d'expiration</label>
              <Input
                type="datetime-local"
                value={announcementForm.expiresAt}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, expiresAt: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsAnnouncementModalOpen(false);
                setAnnouncementForm({
                  title: '',
                  content: '',
                  targetRole: '',
                  targetClass: '',
                  priority: 'normal',
                  expiresAt: '',
                  portalCategory: 'auto',
                  coverImageUrl: '',
                  imageUrls: '',
                });
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateAnnouncement}
              disabled={createAnnouncementMutation.isPending}
              className="bg-pink-600 hover:bg-pink-700"
            >
              {createAnnouncementMutation.isPending ? (
                <>
                  <FiClock className="w-4 h-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <FiCheck className="w-4 h-4 mr-2" />
                  Créer
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Announcement Modal */}
      <Modal
        isOpen={isEditAnnouncementModalOpen}
        onClose={() => {
          setIsEditAnnouncementModalOpen(false);
          setEditingAnnouncement(null);
          setAnnouncementForm({
            title: '',
            content: '',
            targetRole: '',
            targetClass: '',
            priority: 'normal',
            expiresAt: '',
            portalCategory: 'auto',
            coverImageUrl: '',
            imageUrls: '',
          });
        }}
        title="Modifier l'annonce"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Titre <span className="text-red-500">*</span>
            </label>
            <Input
              value={announcementForm.title}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
              placeholder="Titre de l'annonce"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Contenu <span className="text-red-500">*</span>
            </label>
            <textarea
              value={announcementForm.content}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
              placeholder="Contenu de l'annonce"
              rows={6}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type portail</label>
              <FilterDropdown
                compact={compact}
                selected={announcementForm.portalCategory}
                onChange={(value) => setAnnouncementForm({ ...announcementForm, portalCategory: value })}
                options={[
                  { value: 'auto', label: 'Auto (détecter circulaire au titre)' },
                  { value: 'circular', label: 'Circulaire officielle' },
                  { value: 'news', label: 'Actualité' },
                  { value: 'gallery', label: 'Galerie (médias)' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Image de couverture (URL)</label>
              <Input
                value={announcementForm.coverImageUrl}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, coverImageUrl: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Images supplémentaires (URL, une par ligne ou virgules)
            </label>
            <textarea
              value={announcementForm.imageUrls}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, imageUrls: e.target.value })}
              placeholder="https://…"
              rows={3}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Rôle cible</label>
              <FilterDropdown compact={compact}
                selected={announcementForm.targetRole}
                onChange={(value) => setAnnouncementForm({ ...announcementForm, targetRole: value })}
                options={[
                  { value: '', label: 'Tous les rôles' },
                  { value: 'ADMIN', label: 'Administrateurs' },
                  { value: 'TEACHER', label: 'Enseignants' },
                  { value: 'STUDENT', label: 'Élèves' },
                  { value: 'PARENT', label: 'Parents' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Classe cible</label>
              <FilterDropdown compact={compact}
                selected={announcementForm.targetClass}
                onChange={(value) => setAnnouncementForm({ ...announcementForm, targetClass: value })}
                options={[
                  { value: '', label: 'Toutes les classes' },
                  ...(classes?.map((c: any) => ({ value: c.id, label: c.name })) || []),
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Priorité</label>
              <FilterDropdown compact={compact}
                selected={announcementForm.priority}
                onChange={(value) => setAnnouncementForm({ ...announcementForm, priority: value })}
                options={[
                  { value: 'low', label: 'Basse' },
                  { value: 'normal', label: 'Normale' },
                  { value: 'high', label: 'Haute' },
                  { value: 'urgent', label: 'Urgente' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date d'expiration</label>
              <Input
                type="datetime-local"
                value={announcementForm.expiresAt}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, expiresAt: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditAnnouncementModalOpen(false);
                setEditingAnnouncement(null);
                setAnnouncementForm({
                  title: '',
                  content: '',
                  targetRole: '',
                  targetClass: '',
                  priority: 'normal',
                  expiresAt: '',
                  portalCategory: 'auto',
                  coverImageUrl: '',
                  imageUrls: '',
                });
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdateAnnouncement}
              disabled={updateAnnouncementMutation.isPending}
              className="bg-pink-600 hover:bg-pink-700"
            >
              {updateAnnouncementMutation.isPending ? (
                <>
                  <FiClock className="w-4 h-4 mr-2 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                <>
                  <FiCheck className="w-4 h-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CommunicationManagement;
