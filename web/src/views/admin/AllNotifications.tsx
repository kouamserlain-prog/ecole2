import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { staffApi } from '../../services/api/staff.api';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import SearchBar from '../../components/ui/SearchBar';
import FilterDropdown from '../../components/ui/FilterDropdown';
import {
  FiBell,
  FiAlertCircle,
  FiCheckCircle,
  FiInfo,
  FiX,
  FiArrowLeft,
  FiFilter,
  FiDownload,
  FiRefreshCw,
  FiClock,
  FiCheck,
  FiTrash2,
  FiMail,
} from 'react-icons/fi';
import { formatDistanceToNow, format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import toast from 'react-hot-toast';

type NotificationType = 'all' | 'message' | 'announcement' | 'grade' | 'absence' | 'assignment' | 'system';
type NotificationStatus = 'all' | 'read' | 'unread';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  link?: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

type AllNotificationsProps = {
  /** `staff` : notifications du compte personnel (API `/staff/notifications`). */
  audience?: 'admin' | 'staff';
};

const AllNotifications = ({ audience = 'admin' }: AllNotificationsProps) => {
  const isStaff = audience === 'staff';
  const queryClient = useQueryClient();
  const notificationsQueryKey = ['all-notifications', audience] as const;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<NotificationType>('all');
  const [selectedStatus, setSelectedStatus] = useState<NotificationStatus>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Fetch all notifications
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: async () => {
      try {
        if (isStaff) {
          return await staffApi.getNotifications();
        }
        return await adminApi.getNotifications();
      } catch (error) {
        if (isStaff) {
          toast.error('Impossible de charger vos notifications.');
          return [];
        }
        // Fallback to mock data if API fails (admin uniquement)
        const mockNotifications: Notification[] = [
          {
            id: '1',
            type: 'absence',
            title: 'Absences non justifiées',
            content: '5 élèves ont des absences non justifiées cette semaine',
            read: false,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          },
          {
            id: '2',
            type: 'assignment',
            title: 'Nouveau devoir',
            content: 'Un nouveau devoir a été créé pour la classe 6ème A',
            read: false,
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
          },
          {
            id: '3',
            type: 'grade',
            title: 'Bulletins générés',
            content: 'Les bulletins du trimestre 1 ont été générés avec succès',
            read: true,
            readAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          {
            id: '4',
            type: 'system',
            title: 'Erreur de synchronisation',
            content: 'Problème de connexion avec le serveur de sauvegarde',
            read: false,
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          },
          {
            id: '5',
            type: 'announcement',
            title: 'Nouvelle annonce',
            content: 'Une nouvelle annonce a été publiée pour toutes les classes',
            read: true,
            readAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          },
          {
            id: '6',
            type: 'message',
            title: 'Nouveau message',
            content: 'Vous avez reçu un nouveau message de Marie Martin',
            read: false,
            createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          },
          {
            id: '7',
            type: 'grade',
            title: 'Note ajoutée',
            content: 'Une nouvelle note a été ajoutée pour le cours de Mathématiques',
            read: false,
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          },
          {
            id: '8',
            type: 'system',
            title: 'Mise à jour disponible',
            content: 'Une nouvelle version de School Manager est disponible',
            read: true,
            readAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
            createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          },
        ];
        return mockNotifications;
      }
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      try {
        if (isStaff) {
          return await staffApi.markNotificationAsRead(notificationId);
        }
        return await adminApi.markNotificationAsRead(notificationId);
      } catch (error: any) {
        // Si l'API échoue (notifications mockées ou erreur serveur), on continue quand même
        // L'erreur sera gérée dans onSuccess pour mettre à jour localement
        throw error;
      }
    },
    onSuccess: (data, notificationId) => {
      // Mettre à jour le cache localement
      queryClient.setQueryData(notificationsQueryKey, (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((notification: Notification) =>
          notification.id === notificationId
            ? { ...notification, read: true, readAt: new Date() }
            : notification
        );
      });
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      toast.success('Notification marquée comme lue');
    },
    onError: (error: any, notificationId: string) => {
      // Si l'API échoue (notifications mockées ou erreur serveur), on met à jour localement quand même
      const status = error.response?.status;
      const is404 = status === 404;
      const is500 = status === 500;
      
      if (is404 || is500) {
        // Mettre à jour localement pour les notifications mockées ou en cas d'erreur serveur
        console.warn('API error (status:', status, '), updating locally:', error);
        if (!isStaff) {
          queryClient.setQueryData(notificationsQueryKey, (oldData: any) => {
            if (!oldData) return oldData;
            return oldData.map((notification: Notification) =>
              notification.id === notificationId
                ? { ...notification, read: true, readAt: new Date() }
                : notification
            );
          });
          toast.success('Notification marquée comme lue (localement)');
        } else {
          toast.error('Erreur lors du marquage de la notification');
        }
      } else {
        // Autre type d'erreur
        console.error('Error marking notification as read:', error);
        toast.error('Erreur lors du marquage de la notification');
      }
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      try {
        if (isStaff) {
          return await staffApi.deleteNotification(notificationId);
        }
        return await adminApi.deleteNotification(notificationId);
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: (data, notificationId) => {
      // Supprimer de la liste localement
      queryClient.setQueryData(notificationsQueryKey, (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.filter((notification: Notification) => notification.id !== notificationId);
      });
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      toast.success('Notification supprimée avec succès');
    },
    onError: (error: any, notificationId: string) => {
      const status = error.response?.status;
      const is404 = status === 404;
      const is500 = status === 500;
      
      if (!isStaff && (is404 || is500)) {
        // Supprimer localement pour les notifications mockées ou en cas d'erreur serveur
        console.warn('API error (status:', status, '), deleting locally:', error);
        queryClient.setQueryData(notificationsQueryKey, (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.filter((notification: Notification) => notification.id !== notificationId);
        });
        toast.success('Notification supprimée (localement)');
      } else {
        console.error('Error deleting notification:', error);
        toast.error(error.response?.data?.error || 'Erreur lors de la suppression de la notification');
      }
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
      case 'absence':
        return <FiAlertCircle className="w-5 h-5 text-orange-500" />;
      case 'success':
      case 'grade':
        return <FiCheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
      case 'system':
        return <FiAlertCircle className="w-5 h-5 text-red-500" />;
      case 'message':
        return <FiMail className="w-5 h-5 text-blue-500" />;
      case 'announcement':
        return <FiBell className="w-5 h-5 text-purple-500" />;
      case 'assignment':
        return <FiInfo className="w-5 h-5 text-indigo-500" />;
      default:
        return <FiInfo className="w-5 h-5 text-blue-500" />;
    }
  };

  const getNotificationColor = (type: string, read: boolean) => {
    const opacity = read ? 'opacity-60' : '';
    switch (type) {
      case 'warning':
      case 'absence':
        return `bg-orange-50 border-orange-200 ${opacity}`;
      case 'success':
      case 'grade':
        return `bg-green-50 border-green-200 ${opacity}`;
      case 'error':
      case 'system':
        return `bg-red-50 border-red-200 ${opacity}`;
      case 'message':
        return `bg-blue-50 border-blue-200 ${opacity}`;
      case 'announcement':
        return `bg-purple-50 border-purple-200 ${opacity}`;
      case 'assignment':
        return `bg-indigo-50 border-indigo-200 ${opacity}`;
      default:
        return `bg-gray-50 border-gray-200 ${opacity}`;
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      all: 'Toutes',
      message: 'Message',
      announcement: 'Annonce',
      grade: 'Note',
      absence: 'Absence',
      assignment: 'Devoir',
      system: 'Système',
    };
    return labels[type] || type;
  };

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter((notification) => notification.type === selectedType);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter((notification) =>
        selectedStatus === 'read' ? notification.read : !notification.read
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (notification) =>
          notification.title.toLowerCase().includes(query) ||
          notification.content.toLowerCase().includes(query)
      );
    }

    // Filter by date range
    if (selectedDateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (selectedDateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter((notification) => notification.createdAt >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter((notification) => notification.createdAt >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter((notification) => notification.createdAt >= filterDate);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          filtered = filtered.filter((notification) => notification.createdAt >= filterDate);
          break;
      }
    }

    // Sort by createdAt (newest first)
    return filtered.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
  }, [notifications, selectedType, selectedStatus, searchQuery, selectedDateRange]);

  // Pagination
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const notificationTypeOptions = [
    { value: 'all', label: 'Tous les types' },
    { value: 'message', label: 'Message' },
    { value: 'announcement', label: 'Annonce' },
    { value: 'grade', label: 'Note' },
    { value: 'absence', label: 'Absence' },
    { value: 'assignment', label: 'Devoir' },
    { value: 'system', label: 'Système' },
  ];

  const statusOptions = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'unread', label: 'Non lues' },
    { value: 'read', label: 'Lues' },
  ];

  const dateRangeOptions = [
    { value: 'all', label: 'Toutes les dates' },
    { value: 'today', label: "Aujourd'hui" },
    { value: 'week', label: '7 derniers jours' },
    { value: 'month', label: '30 derniers jours' },
    { value: 'year', label: 'Cette année' },
  ];

  const unreadCount = filteredNotifications.filter((n) => !n.read).length;
  const readCount = filteredNotifications.filter((n) => n.read).length;

  const handleMarkAsRead = (id: string) => {
    markAsReadMutation.mutate(id);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette notification ?')) {
      deleteNotificationMutation.mutate(id);
    }
  };

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      try {
        if (isStaff) {
          return await staffApi.markAllNotificationsAsRead();
        }
        return await adminApi.markAllNotificationsAsRead();
      } catch (error: any) {
        throw error;
      }
    },
    onSuccess: (data) => {
      const count = isStaff ? undefined : data?.count || 0;
      // Mettre à jour toutes les notifications non lues dans le cache
      queryClient.setQueryData(notificationsQueryKey, (oldData: any) => {
        if (!oldData) return oldData;
        const now = new Date();
        return oldData.map((notification: Notification) =>
          !notification.read
            ? { ...notification, read: true, readAt: now }
            : notification
        );
      });
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      if (!isStaff) {
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      }
      if (isStaff) {
        toast.success('Toutes les notifications sont marquées comme lues.');
      } else {
        toast.success(`${count} notification(s) marquée(s) comme lue(s)`);
      }
    },
    onError: (error: any) => {
      const status = error.response?.status;
      const is404 = status === 404;
      const is500 = status === 500;
      
      if (!isStaff && (is404 || is500)) {
        // Mettre à jour localement pour les notifications mockées ou en cas d'erreur serveur
        console.warn('API error (status:', status, '), updating locally:', error);
        const unreadCount = filteredNotifications.filter((n) => !n.read).length;
        queryClient.setQueryData(notificationsQueryKey, (oldData: any) => {
          if (!oldData) return oldData;
          const now = new Date();
          return oldData.map((notification: Notification) =>
            !notification.read
              ? { ...notification, read: true, readAt: now }
              : notification
          );
        });
        toast.success(`${unreadCount} notification(s) marquée(s) comme lue(s) (localement)`);
      } else {
        console.error('Error marking all notifications as read:', error);
        toast.error(error.response?.data?.error || 'Erreur lors du marquage des notifications');
      }
    },
  });

  const handleMarkAllAsRead = () => {
    const unreadCount = filteredNotifications.filter((n) => !n.read).length;
    if (unreadCount === 0) {
      toast('Aucune notification non lue à marquer', { icon: 'ℹ️' });
      return;
    }
    markAllAsReadMutation.mutate();
  };

  const handleExport = () => {
    const csvContent = [
      ['Type', 'Titre', 'Contenu', 'Statut', 'Date'].join(','),
      ...filteredNotifications.map((notification) =>
        [
          getNotificationTypeLabel(notification.type),
          `"${notification.title}"`,
          `"${notification.content}"`,
          notification.read ? 'Lue' : 'Non lue',
          format(
            notification.createdAt instanceof Date
              ? notification.createdAt
              : new Date(notification.createdAt),
            'dd/MM/yyyy HH:mm',
            { locale: fr }
          ),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `notifications_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('Notifications exportées avec succès');
  };

  const todayCount = useMemo(
    () =>
      filteredNotifications.filter((n) => {
        const d = n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt);
        return format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
      }).length,
    [filteredNotifications]
  );

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {isStaff
              ? 'Alertes et messages liés à vos modules (pré-inscriptions, stock, etc.)'
              : "Consultez et gérez les notifications de l'établissement"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
            >
              {markAllAsReadMutation.isPending ? (
                <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FiCheck className="w-4 h-4 mr-2" />
              )}
              Tout marquer lu ({unreadCount})
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <FiRefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <FiDownload className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Recherche</label>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Titre, contenu..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <FilterDropdown
              options={notificationTypeOptions}
              selected={selectedType}
              onChange={(value) => {
                setSelectedType(value as NotificationType);
                setCurrentPage(1);
              }}
              label="Type"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
            <FilterDropdown
              options={statusOptions}
              selected={selectedStatus}
              onChange={(value) => {
                setSelectedStatus(value as NotificationStatus);
                setCurrentPage(1);
              }}
              label="Statut"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Période</label>
            <FilterDropdown
              options={dateRangeOptions}
              selected={selectedDateRange}
              onChange={(value) => {
                setSelectedDateRange(value);
                setCurrentPage(1);
              }}
              label="Période"
            />
          </div>
        </div>
        {(selectedType !== 'all' || selectedStatus !== 'all' || selectedDateRange !== 'all' || searchQuery) && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
            {selectedType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium">
                {getNotificationTypeLabel(selectedType)}
                <button type="button" onClick={() => setSelectedType('all')} className="hover:text-indigo-900" aria-label="Retirer le filtre type" title="Retirer le filtre type">
                  <FiX className="w-3 h-3" aria-hidden />
                </button>
              </span>
            )}
            {selectedStatus !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                {selectedStatus === 'read' ? 'Lues' : 'Non lues'}
                <button type="button" onClick={() => setSelectedStatus('all')} className="hover:text-gray-900" aria-label="Retirer le filtre statut" title="Retirer le filtre statut">
                  <FiX className="w-3 h-3" aria-hidden />
                </button>
              </span>
            )}
            {selectedDateRange !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                {dateRangeOptions.find((o) => o.value === selectedDateRange)?.label}
                <button type="button" onClick={() => setSelectedDateRange('all')} className="hover:text-gray-900" aria-label="Retirer le filtre période" title="Retirer le filtre période">
                  <FiX className="w-3 h-3" aria-hidden />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                « {searchQuery} »
                <button type="button" onClick={() => setSearchQuery('')} className="hover:text-gray-900" aria-label="Effacer la recherche" title="Effacer la recherche">
                  <FiX className="w-3 h-3" aria-hidden />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedType('all');
                setSelectedStatus('all');
                setSelectedDateRange('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Tout effacer
            </button>
          </div>
        )}
      </Card>

      {/* Indicateurs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Total</p>
              <p className="text-xl font-bold text-gray-900">{filteredNotifications.length}</p>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50">
              <FiBell className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Non lues</p>
              <p className="text-xl font-bold text-gray-900">{unreadCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50">
              <FiAlertCircle className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Lues</p>
              <p className="text-xl font-bold text-gray-900">{readCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50">
              <FiCheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Aujourd'hui</p>
              <p className="text-xl font-bold text-gray-900">{todayCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-violet-50">
              <FiClock className="w-5 h-5 text-violet-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Notifications List */}
      <Card>
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Chargement des notifications...</p>
          </div>
        ) : paginatedNotifications.length === 0 ? (
          <div className="text-center py-12">
            <FiBell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Aucune notification trouvée
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery ||
              selectedType !== 'all' ||
              selectedStatus !== 'all' ||
              selectedDateRange !== 'all'
                ? 'Essayez de modifier vos filtres de recherche'
                : "Aucune notification n'a été enregistrée pour le moment"}
            </p>
            {(searchQuery ||
              selectedType !== 'all' ||
              selectedStatus !== 'all' ||
              selectedDateRange !== 'all') && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedType('all');
                  setSelectedStatus('all');
                  setSelectedDateRange('all');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
              >
                Réinitialiser les filtres
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedNotifications.map((notification) => {
                const createdAt =
                  notification.createdAt instanceof Date
                    ? notification.createdAt
                    : new Date(notification.createdAt);
                return (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border-2 transition-all ${getNotificationColor(
                      notification.type,
                      notification.read
                    )} hover:shadow-md`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="font-semibold text-gray-900">{notification.title}</p>
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            )}
                            <Badge
                              className={`${
                                notification.read
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-blue-100 text-blue-800'
                              } text-xs`}
                            >
                              {getNotificationTypeLabel(notification.type)}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{notification.content}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span className="flex items-center space-x-1">
                              <FiClock className="w-3 h-3" />
                              <span>
                                {formatDistanceToNow(createdAt, {
                                  addSuffix: true,
                                  locale: fr,
                                })}
                              </span>
                            </span>
                            <span className="text-gray-300">•</span>
                            <span>
                              {format(createdAt, 'dd MMMM yyyy à HH:mm', { locale: fr })}
                            </span>
                            {notification.read && notification.readAt && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span className="text-green-600">
                                  Lue le{' '}
                                  {format(
                                    notification.readAt instanceof Date
                                      ? notification.readAt
                                      : new Date(notification.readAt),
                                    'dd/MM/yyyy à HH:mm',
                                    { locale: fr }
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                          {notification.link && (
                            <a
                              href={notification.link}
                              className="text-sm text-blue-600 hover:text-blue-700 hover:underline mt-2 inline-block"
                            >
                              Voir les détails →
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {!notification.read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="p-2 text-gray-400 hover:text-green-600 transition-colors rounded-lg hover:bg-green-50"
                            title="Marquer comme lu"
                          >
                            <FiCheckCircle className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          disabled={deleteNotificationMutation.isPending}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Supprimer"
                        >
                          <FiTrash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Affichage de {(currentPage - 1) * itemsPerPage + 1} à{' '}
                  {Math.min(currentPage * itemsPerPage, filteredNotifications.length)} sur{' '}
                  {filteredNotifications.length} notification(s)
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    size="sm"
                  >
                    Précédent
                  </Button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (page) =>
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                      )
                      .map((page, index, array) => (
                        <div key={page} className="flex items-center">
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="px-2 text-gray-400">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                              currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {page}
                          </button>
                        </div>
                      ))}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    size="sm"
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default AllNotifications;

