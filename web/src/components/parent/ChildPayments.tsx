import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parentApi } from '../../services/api';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { 
  FiDollarSign, 
  FiCalendar, 
  FiCheckCircle, 
  FiXCircle, 
  FiClock,
  FiCreditCard,
  FiSmartphone,
  FiFileText,
  FiDownload,
  FiInfo,
  FiAlertCircle,
  FiSearch,
  FiFilter,
  FiTrendingUp
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import toast from 'react-hot-toast';
import { formatFCFA } from '../../utils/currency';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { chartBlueRed, CHART_BLUE, CHART_ANIMATION_MS } from '../charts';
import jsPDF from 'jspdf';

interface ChildPaymentsProps {
  studentId: string;
}

const ChildPayments = ({ studentId }: ChildPaymentsProps) => {
  const [selectedFee, setSelectedFee] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'CASH'>('CARD');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDetails, setPaymentDetails] = useState<{ phoneNumber?: string; operator?: string; transactionCode?: string; accountNumber?: string; reference?: string }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [filterMethod, setFilterMethod] = useState<'all' | 'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'CASH'>('all');
  const queryClient = useQueryClient();

  const { data: tuitionFees, isLoading } = useQuery({
    queryKey: ['parent-child-tuition-fees', studentId],
    queryFn: () => parentApi.getChildTuitionFees(studentId),
  });

  const { data: payments } = useQuery({
    queryKey: ['parent-child-payments', studentId],
    queryFn: () => parentApi.getChildPayments(studentId),
  });

  const createPaymentMutation = useMutation({
    mutationFn: ({ tuitionFeeId, paymentMethod, amount, phoneNumber, operator, transactionCode }: { tuitionFeeId: string; paymentMethod: string; amount: number; phoneNumber?: string; operator?: string; transactionCode?: string }) =>
      parentApi.createPayment(studentId, tuitionFeeId, paymentMethod, amount, phoneNumber, operator, transactionCode),
    onSuccess: (data: { payment?: { paymentMethod?: string; id?: string } }) => {
      const isCash = data.payment?.paymentMethod === 'CASH';
      setShowPaymentModal(false);
      if (isCash) {
        toast.success(
          "Déclaration enregistrée. Elle sera prise en compte après validation par l'économe.",
        );
        queryClient.invalidateQueries({ queryKey: ['parent-child-tuition-fees'] });
        queryClient.invalidateQueries({ queryKey: ['parent-child-payments'] });
        return;
      }
      toast.success(
        'Paiement enregistré. Il restera en attente jusqu’à validation sécurisée.',
      );
      queryClient.invalidateQueries({ queryKey: ['parent-child-tuition-fees'] });
      queryClient.invalidateQueries({ queryKey: ['parent-child-payments'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'initiation du paiement');
    },
  });

  const getStatusBadge = (fee: any) => {
    if (fee.isPaid) {
      return <Badge variant="success" size="md">Payé</Badge>;
    }
    const isOverdue = new Date(fee.dueDate) < new Date();
    if (isOverdue) {
      return <Badge variant="danger" size="md">En retard</Badge>;
    }
    return <Badge variant="warning" size="md">En attente</Badge>;
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'CARD':
        return <FiCreditCard className="w-5 h-5" />;
      case 'MOBILE_MONEY':
        return <FiSmartphone className="w-5 h-5" />;
      case 'BANK_TRANSFER':
        return <FiFileText className="w-5 h-5" />;
      case 'CASH':
        return <FiDollarSign className="w-5 h-5" />;
      default:
        return <FiDollarSign className="w-5 h-5" />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'CARD':
        return 'Carte bancaire';
      case 'MOBILE_MONEY':
        return 'Mobile Money';
      case 'BANK_TRANSFER':
        return 'Virement bancaire';
      case 'CASH':
        return 'Espèces';
      default:
        return method;
    }
  };

  const getPaymentMethodDescription = (method: string) => {
    switch (method) {
      case 'CARD':
        return 'Paiement sécurisé par carte bancaire';
      case 'MOBILE_MONEY':
        return 'Paiement via Mobile Money (Orange Money, MTN Mobile Money, etc.)';
      case 'BANK_TRANSFER':
        return 'Virement bancaire direct';
      case 'CASH':
        return 'Déclaration espèces — validation par l\'économe après dépôt';
      default:
        return '';
    }
  };

  // Filtrage des frais
  const filteredFees = useMemo(() => {
    if (!tuitionFees) return [];
    
    return tuitionFees.filter((fee: any) => {
      if (filterStatus === 'paid' && !fee.isPaid) return false;
      if (filterStatus === 'pending' && fee.isPaid) return false;
      if (filterStatus === 'overdue' && (fee.isPaid || new Date(fee.dueDate) >= new Date())) return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const period = fee.period?.toLowerCase() || '';
        const academicYear = fee.academicYear?.toLowerCase() || '';
        if (!period.includes(query) && !academicYear.includes(query)) return false;
      }
      
      return true;
    });
  }, [tuitionFees, filterStatus, searchQuery]);

  // Filtrage des paiements
  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    
    return payments.filter((payment: any) => {
      if (filterMethod !== 'all' && payment.paymentMethod !== filterMethod) return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const reference = payment.paymentReference?.toLowerCase() || '';
        const method = getPaymentMethodLabel(payment.paymentMethod)?.toLowerCase() || '';
        if (!reference.includes(query) && !method.includes(query)) return false;
      }
      
      return true;
    });
  }, [payments, filterMethod, searchQuery]);

  // Données pour les graphiques
  const paymentChartData = useMemo(() => {
    if (!payments) return [];
    
    const monthlyData: Record<string, { month: string; amount: number; count: number }> = {};
    
    payments
      .filter((p: any) => p.status === 'COMPLETED')
      .forEach((payment: any) => {
        const date = new Date(payment.createdAt);
        const monthKey = format(date, 'MMM yyyy', { locale: fr });
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { month: monthKey, amount: 0, count: 0 };
        }
        
        monthlyData[monthKey].amount += payment.amount;
        monthlyData[monthKey].count += 1;
      });
    
    return Object.values(monthlyData).sort((a, b) => {
      const dateA = new Date(a.month);
      const dateB = new Date(b.month);
      return dateA.getTime() - dateB.getTime();
    });
  }, [payments]);

  const paymentMethodData = useMemo(() => {
    if (!payments) return [];
    
    const methodCount: Record<string, number> = {};
    
    payments
      .filter((p: any) => p.status === 'COMPLETED')
      .forEach((payment: any) => {
        const method = payment.paymentMethod;
        methodCount[method] = (methodCount[method] || 0) + 1;
      });
    
    return Object.entries(methodCount).map(([method, count]) => ({
      name: getPaymentMethodLabel(method),
      value: count,
    }));
  }, [payments]);

  const generateReceipt = (payment: any) => {
    try {
      const doc = new jsPDF();
      const currentDate = new Date().toLocaleDateString('fr-FR');
      
      // Header
      doc.setFillColor(139, 92, 246);
      doc.roundedRect(14, 10, 40, 12, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SM', 34, 18, { align: 'center' });
      
      doc.setTextColor(139, 92, 246);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('School Manager', 60, 18);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text('Reçu de Paiement', 60, 25);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Généré le ${currentDate}`, 60, 30);
      
      // Informations de l'élève
      let yPos = 45;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      
      doc.text('Informations de l\'Élève', 14, yPos);
      yPos += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      // Récupérer les informations de l'élève depuis le paiement ou le frais
      let studentName = 'Non disponible';
      let studentPhone = 'Non disponible';
      
      if (payment.tuitionFee?.student?.user) {
        const student = payment.tuitionFee.student.user;
        studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Non disponible';
        studentPhone = student.phone || 'Non disponible';
      } else if (payment.student?.user) {
        const student = payment.student.user;
        studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Non disponible';
        studentPhone = student.phone || 'Non disponible';
      }
      
      doc.text(`Nom complet: ${studentName}`, 14, yPos);
      yPos += 6;
      
      // Afficher le numéro de téléphone du profil ou celui utilisé pour le paiement
      let displayPhone = studentPhone;
      if (payment.notes) {
        // Essayer d'extraire le numéro de téléphone des notes (format: "phoneNumber: +237 6XX XXX XXX")
        const phoneMatch = payment.notes.match(/phoneNumber:\s*([+\d\s]+)/i);
        if (phoneMatch && phoneMatch[1]) {
          displayPhone = phoneMatch[1].trim();
        }
      }
      doc.text(`Numéro de téléphone: ${displayPhone}`, 14, yPos);
      
      yPos += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Informations du Paiement', 14, yPos);
      yPos += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Référence: ${payment.paymentReference}`, 14, yPos);
      yPos += 6;
      doc.text(`Date: ${format(new Date(payment.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}`, 14, yPos);
      yPos += 6;
      doc.text(`Méthode: ${getPaymentMethodLabel(payment.paymentMethod)}`, 14, yPos);
      yPos += 6;
      doc.text(`Montant: ${formatFCFA(payment.amount)}`, 14, yPos);
      yPos += 6;
      doc.text(`Statut: ${payment.status === 'COMPLETED' ? 'Complété' : payment.status === 'PENDING' ? 'En attente' : 'Échoué'}`, 14, yPos);
      
      if (payment.transactionId) {
        yPos += 6;
        doc.text(`Transaction ID: ${payment.transactionId}`, 14, yPos);
      }
      
      yPos += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Informations du Frais', 14, yPos);
      yPos += 8;
      
      doc.setFont('helvetica', 'normal');
      if (payment.tuitionFee) {
        doc.text(`Période: ${payment.tuitionFee.period}`, 14, yPos);
        yPos += 6;
        doc.text(`Année scolaire: ${payment.tuitionFee.academicYear}`, 14, yPos);
        yPos += 6;
        if (payment.tuitionFee.description) {
          doc.text(`Description: ${payment.tuitionFee.description}`, 14, yPos);
          yPos += 6;
        }
      }
      
      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(9);
      doc.setTextColor(128, 128, 128);
      doc.text('Ce document est un reçu de paiement électronique.', 14, pageHeight - 20, { align: 'center' });
      doc.text('Pour toute question, contactez l\'administration.', 14, pageHeight - 15, { align: 'center' });
      
      doc.save(`recu-paiement-${payment.paymentReference}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Reçu téléchargé avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de la génération du reçu:', error);
      toast.error('Erreur lors de la génération du reçu');
    }
  };

  const handlePay = (fee: any) => {
    setSelectedFee(fee);
    // Initialiser le montant avec le montant restant ou le montant total
    const remainingAmount = fee.remainingAmount !== undefined ? fee.remainingAmount : (fee.amount - (fee.totalPaid || 0));
    setPaymentAmount(remainingAmount > 0 ? remainingAmount.toString() : fee.amount.toString());
    setPaymentMethod('CARD');
    setPaymentDetails({});
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = () => {
    if (!selectedFee) return;
    
    // Validation pour Mobile Money
    if (paymentMethod === 'MOBILE_MONEY') {
      if (!paymentDetails.phoneNumber) {
        toast.error('Veuillez saisir votre numéro de téléphone pour Mobile Money');
        return;
      }
      // Valider le format du numéro
      const phoneRegex = /^(\+237\s?)?[67]\d{8}$/;
      const cleanPhone = paymentDetails.phoneNumber.replace(/\s/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        toast.error('Format de numéro invalide. Utilisez: +237 6XX XXX XXX ou 6XX XXX XXX');
        return;
      }
      if (!paymentDetails.operator) {
        toast.error('Veuillez sélectionner un opérateur Mobile Money');
        return;
      }
    }
    
    // Validation pour Virement bancaire
    if (paymentMethod === 'BANK_TRANSFER' && !paymentDetails.accountNumber) {
      toast.error('Veuillez saisir le numéro de compte bancaire pour le virement');
      return;
    }
    
    // Valider le montant
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Veuillez saisir un montant valide');
      return;
    }
    
    const remainingAmount = selectedFee.remainingAmount !== undefined 
      ? selectedFee.remainingAmount 
      : (selectedFee.amount - (selectedFee.totalPaid || 0));
    
    if (amount > remainingAmount) {
      toast.error(`Le montant ne peut pas dépasser le montant restant (${formatFCFA(remainingAmount)})`);
      return;
    }
    
    createPaymentMutation.mutate({
      tuitionFeeId: selectedFee.id,
      paymentMethod,
      amount: amount,
      phoneNumber: paymentDetails.phoneNumber,
      operator: paymentDetails.operator,
      transactionCode: paymentDetails.transactionCode,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">Chargement des frais de scolarité...</p>
        </div>
      </Card>
    );
  }

  const totalAmount = tuitionFees?.reduce((sum: number, fee: any) => sum + fee.amount, 0) || 0;
  const paidAmount = tuitionFees?.filter((f: any) => f.isPaid).reduce((sum: number, fee: any) => sum + fee.amount, 0) || 0;
  const pendingAmount = totalAmount - paidAmount;
  const overdueFees = tuitionFees?.filter((f: any) => !f.isPaid && new Date(f.dueDate) < new Date()).length || 0;
  const completedPayments = payments?.filter((p: any) => p.status === 'COMPLETED').length || 0;

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total des frais</p>
              <p className="text-2xl font-bold text-gray-900">{formatFCFA(totalAmount)}</p>
              <p className="text-xs text-gray-500 mt-1">{tuitionFees?.length || 0} frais</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white">
              <FiDollarSign className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Payé</p>
              <p className="text-2xl font-bold text-gray-900">{formatFCFA(paidAmount)}</p>
              <p className="text-xs text-gray-500 mt-1">{completedPayments} paiements</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center text-white">
              <FiCheckCircle className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">En attente</p>
              <p className="text-2xl font-bold text-gray-900">{formatFCFA(pendingAmount)}</p>
              <p className="text-xs text-gray-500 mt-1">{tuitionFees?.filter((f: any) => !f.isPaid).length || 0} frais</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-white">
              <FiClock className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">En retard</p>
              <p className="text-2xl font-bold text-gray-900">{overdueFees}</p>
              <p className="text-xs text-gray-500 mt-1">Frais en retard</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center text-white">
              <FiXCircle className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Graphiques */}
      {(paymentChartData.length > 0 || paymentMethodData.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {paymentChartData.length > 0 && (
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <FiTrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                Évolution des paiements
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={paymentChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: any) => formatFCFA(value)} />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke={CHART_BLUE}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    isAnimationActive
                    animationDuration={CHART_ANIMATION_MS}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {paymentMethodData.length > 0 && (
            <Card>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <FiCreditCard className="w-5 h-5 mr-2 text-purple-600" />
                Méthodes de paiement
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentMethodData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={chartBlueRed(index)} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* Filtres et recherche */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher par période, année scolaire..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              aria-label="Filtrer les frais par statut"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="paid">Payé</option>
              <option value="pending">En attente</option>
              <option value="overdue">En retard</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Liste des frais */}
      {filteredFees && filteredFees.length > 0 ? (
        <div className="space-y-4">
          {filteredFees.map((fee: any) => (
            <Card 
              key={fee.id}
              className={`relative overflow-hidden ${fee.isPaid ? 'border-l-4 border-green-500' : 'border-l-4 border-orange-500'}`}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{fee.period}</h3>
                    {getStatusBadge(fee)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Année scolaire:</span> {fee.academicYear}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Échéance:</span>{' '}
                      {format(new Date(fee.dueDate), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                    {!fee.isPaid && new Date(fee.dueDate) < new Date() && (
                      <p className="text-sm text-red-600 font-semibold">
                        ⚠️ Ce paiement est en retard de {Math.ceil((new Date().getTime() - new Date(fee.dueDate).getTime()) / (1000 * 60 * 60 * 24))} jour(s)
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <p className="text-2xl font-bold text-gray-900">{formatFCFA(fee.amount)}</p>
                  {!fee.isPaid ? (
                    <Button
                      variant="primary"
                      onClick={() => handlePay(fee)}
                      size="md"
                      className="min-w-[160px]"
                    >
                      <FiCreditCard className="w-4 h-4 mr-2" />
                      Payer maintenant
                    </Button>
                  ) : fee.paidAt ? (
                    <div className="text-right">
                      <Badge variant="success" size="md" className="mb-2">
                        Payé
                      </Badge>
                      <p className="text-xs text-gray-500">
                        Payé le {format(new Date(fee.paidAt), 'dd MMMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <FiDollarSign className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-lg mb-2">Aucun frais de scolarité trouvé</p>
            <p className="text-sm">Aucun frais ne correspond à vos critères de recherche</p>
          </div>
        </Card>
      )}

      {/* Historique des paiements */}
      {payments && payments.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Historique des paiements</h3>
            <div className="flex gap-2">
              <select
                aria-label="Filtrer l'historique par méthode de paiement"
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">Toutes les méthodes</option>
                <option value="CARD">Carte bancaire</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK_TRANSFER">Virement bancaire</option>
                <option value="CASH">Espèces</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Référence</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Méthode</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Montant</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment: any) => (
                  <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      {format(new Date(payment.createdAt), 'dd MMM yyyy', { locale: fr })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600 font-mono">
                        {payment.paymentReference}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        {getPaymentMethodIcon(payment.paymentMethod)}
                        <span className="text-gray-600">{getPaymentMethodLabel(payment.paymentMethod)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      {formatFCFA(payment.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          payment.status === 'COMPLETED' ? 'success' :
                          payment.status === 'PENDING' ? 'warning' :
                          payment.status === 'FAILED' ? 'danger' : 'secondary'
                        }
                        size="sm"
                      >
                        {payment.status === 'COMPLETED' ? 'Complété' :
                         payment.status === 'PENDING' ? 'En attente' :
                         payment.status === 'FAILED' ? 'Échoué' :
                         payment.status === 'CANCELLED' ? 'Annulé' : payment.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      {payment.status === 'COMPLETED' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => generateReceipt(payment)}
                        >
                          <FiDownload className="w-4 h-4 mr-2" />
                          Reçu
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal de paiement */}
      {showPaymentModal && selectedFee && (
        <Modal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedFee(null);
          }}
          title="Paiement des frais de scolarité"
        >
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Période</p>
                  <p className="font-semibold text-gray-900 text-lg">{selectedFee.period}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 mb-1">Année scolaire</p>
                  <p className="font-semibold text-gray-900">{selectedFee.academicYear}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-blue-200 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">Montant total</p>
                  <p className="font-semibold text-gray-900">{formatFCFA(selectedFee.amount)}</p>
                </div>
                {selectedFee.totalPaid !== undefined && selectedFee.totalPaid > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-600">Montant payé</p>
                      <p className="font-semibold text-green-600">{formatFCFA(selectedFee.totalPaid)}</p>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                      <p className="text-sm font-semibold text-gray-700">Montant restant</p>
                      <p className="text-xl font-bold text-purple-600">{formatFCFA(selectedFee.remainingAmount || (selectedFee.amount - selectedFee.totalPaid))}</p>
                    </div>
                    {selectedFee.paymentProgress !== undefined && (
                      <div className="mt-2">
                        <progress
                          aria-label="Progression du paiement"
                          className="w-full h-2 accent-purple-600"
                          value={Math.min(100, selectedFee.paymentProgress)}
                          max={100}
                        />
                        <p className="text-xs text-gray-500 mt-1 text-right">
                          {selectedFee.paymentProgress.toFixed(1)}% payé
                        </p>
                      </div>
                    )}
                  </>
                )}
                {new Date(selectedFee.dueDate) < new Date() && !selectedFee.isPaid && (
                  <p className="text-sm text-red-600 mt-2 font-semibold flex items-center">
                    <FiAlertCircle className="w-4 h-4 mr-1" />
                    Échéance dépassée
                  </p>
                )}
              </div>
            </div>

            {/* Champ pour saisir le montant du paiement */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Montant à payer <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                      setPaymentAmount(value);
                    }
                  }}
                  min="0"
                  step="1000"
                  max={selectedFee.remainingAmount !== undefined ? selectedFee.remainingAmount : selectedFee.amount}
                  placeholder="0"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg font-semibold"
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                  FCFA
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const remaining = selectedFee.remainingAmount !== undefined 
                      ? selectedFee.remainingAmount 
                      : (selectedFee.amount - (selectedFee.totalPaid || 0));
                    setPaymentAmount(remaining > 0 ? remaining.toString() : '0');
                  }}
                  className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                >
                  Montant restant
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentAmount(selectedFee.amount.toString())}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Montant total
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Vous pouvez payer en plusieurs fois. Le montant maximum est le montant restant à payer.
              </p>
            </div>

            <div className="w-full">
              <p className="text-sm font-medium text-gray-700 mb-3">Méthode de paiement</p>
              <div className="grid grid-cols-2 gap-3 mb-4 w-full">
                {['CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CASH'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(method as any);
                      setPaymentDetails({});
                    }}
                    className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all duration-200 min-h-[100px] w-full ${
                      paymentMethod === method
                        ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`mb-2 ${paymentMethod === method ? 'text-orange-600' : 'text-gray-400'}`}>
                      {getPaymentMethodIcon(method)}
                    </div>
                    <span className={`text-xs font-semibold text-center ${paymentMethod === method ? 'text-orange-700' : 'text-gray-700'}`}>
                      {getPaymentMethodLabel(method)}
                    </span>
                  </button>
                ))}
              </div>
              
              {/* Description de la méthode sélectionnée */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-2">
                <FiInfo className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">{getPaymentMethodDescription(paymentMethod)}</p>
              </div>

              {/* Champs supplémentaires selon la méthode */}
              {paymentMethod === 'MOBILE_MONEY' && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Opérateur Mobile Money <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'ORANGE_MONEY', label: 'Orange Money', icon: '🟠', borderClass: 'border-orange-500', bgClass: 'bg-orange-50', textClass: 'text-orange-700' },
                        { value: 'MTN_MOBILE_MONEY', label: 'MTN Mobile Money', icon: '🟡', borderClass: 'border-yellow-500', bgClass: 'bg-yellow-50', textClass: 'text-yellow-700' },
                        { value: 'MOOV_MONEY', label: 'Moov Money', icon: '🔵', borderClass: 'border-blue-500', bgClass: 'bg-blue-50', textClass: 'text-blue-700' },
                        { value: 'WAVE', label: 'Wave', icon: '🌊', borderClass: 'border-sky-500', bgClass: 'bg-sky-50', textClass: 'text-sky-700' },
                      ].map((op) => (
                        <button
                          key={op.value}
                          type="button"
                          onClick={() => setPaymentDetails({ ...paymentDetails, operator: op.value })}
                          className={`p-3 border-2 rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                            paymentDetails.operator === op.value
                              ? `${op.borderClass} ${op.bgClass} shadow-md`
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-xl">{op.icon}</span>
                          <span className={`text-sm font-semibold ${
                            paymentDetails.operator === op.value ? op.textClass : 'text-gray-700'
                          }`}>
                            {op.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Numéro de téléphone Mobile Money <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={paymentDetails.phoneNumber || ''}
                      onChange={(e) => {
                        let value = e.target.value;
                        // Formatage automatique
                        value = value.replace(/\D/g, ''); // Garder seulement les chiffres
                        if (value.startsWith('237')) {
                          value = '+' + value;
                        } else if (value.length > 0 && !value.startsWith('+')) {
                          if (value.length <= 9) {
                            value = '+237 ' + value;
                          }
                        }
                        setPaymentDetails({ ...paymentDetails, phoneNumber: value });
                      }}
                      placeholder="+237 6XX XXX XXX"
                      maxLength={17}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Format: +237 6XX XXX XXX ou 6XX XXX XXX
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code de transaction (optionnel)
                    </label>
                    <input
                      type="text"
                      value={paymentDetails.transactionCode || ''}
                      onChange={(e) => setPaymentDetails({ ...paymentDetails, transactionCode: e.target.value })}
                      placeholder="Code reçu après le paiement"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Saisissez le code de confirmation reçu par SMS après avoir effectué le paiement
                    </p>
                  </div>

                  {/* Instructions selon l'opérateur */}
                  {paymentDetails.operator && (
                    <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Instructions de paiement :</p>
                      {paymentDetails.operator === 'ORANGE_MONEY' && (
                        <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                          <li>Composez *144# sur votre téléphone Orange</li>
                          <li>Sélectionnez "Payer une facture" ou "Payer un service"</li>
                          <li>Entrez le numéro de compte: <strong>237 6XX XXX XXX</strong></li>
                          <li>Entrez le montant: <strong>{formatFCFA(parseFloat(paymentAmount) || 0)}</strong></li>
                          <li>Confirmez avec votre code PIN</li>
                          <li>Entrez le code de transaction reçu ci-dessus</li>
                        </ol>
                      )}
                      {paymentDetails.operator === 'MTN_MOBILE_MONEY' && (
                        <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                          <li>Composez *126# sur votre téléphone MTN</li>
                          <li>Sélectionnez "Paiement de facture"</li>
                          <li>Entrez le numéro de compte: <strong>237 6XX XXX XXX</strong></li>
                          <li>Entrez le montant: <strong>{formatFCFA(parseFloat(paymentAmount) || 0)}</strong></li>
                          <li>Confirmez avec votre code PIN</li>
                          <li>Entrez le code de transaction reçu ci-dessus</li>
                        </ol>
                      )}
                      {paymentDetails.operator === 'MOOV_MONEY' && (
                        <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                          <li>Composez *155# sur votre téléphone Moov</li>
                          <li>Sélectionnez "Paiement"</li>
                          <li>Entrez le numéro de compte: <strong>237 6XX XXX XXX</strong></li>
                          <li>Entrez le montant: <strong>{formatFCFA(parseFloat(paymentAmount) || 0)}</strong></li>
                          <li>Confirmez avec votre code PIN</li>
                          <li>Entrez le code de transaction reçu ci-dessus</li>
                        </ol>
                      )}
                      {paymentDetails.operator === 'WAVE' && (
                        <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                          <li>Ouvrez l&apos;application Wave sur votre téléphone</li>
                          <li>Sélectionnez &quot;Payer&quot; ou &quot;Envoyer&quot;</li>
                          <li>Entrez le numéro de compte de l&apos;école</li>
                          <li>Entrez le montant: <strong>{formatFCFA(parseFloat(paymentAmount) || 0)}</strong></li>
                          <li>Confirmez avec votre code PIN</li>
                          <li>Entrez le code de transaction reçu ci-dessus</li>
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'BANK_TRANSFER' && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Numéro de compte
                    </label>
                    <input
                      type="text"
                      value={paymentDetails.accountNumber || ''}
                      onChange={(e) => setPaymentDetails({ ...paymentDetails, accountNumber: e.target.value })}
                      placeholder="Numéro de compte bancaire"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Référence de virement
                    </label>
                    <input
                      type="text"
                      value={paymentDetails.reference || ''}
                      onChange={(e) => setPaymentDetails({ ...paymentDetails, reference: e.target.value })}
                      placeholder="Référence du virement"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'CASH' && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Espèces :</strong> présentez-vous à l&apos;administration avec le montant exact.
                    Votre déclaration restera <strong>en attente</strong> jusqu&apos;à validation par
                    l&apos;économe après encaissement.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedFee(null);
                }}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmPayment}
                disabled={createPaymentMutation.isPending}
              >
                {createPaymentMutation.isPending
                  ? 'Traitement...'
                  : paymentMethod === 'CASH'
                    ? 'Soumettre la déclaration'
                    : 'Confirmer le paiement'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ChildPayments;
