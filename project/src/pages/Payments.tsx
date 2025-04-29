import React, { useState, useEffect } from 'react';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import PaymentForm from '../components/payments/PaymentForm';
import PaymentDetails from '../components/payments/PaymentDetails';
import { Payment, Room, Tenant } from '../types';
import { formatCurrency, formatDate, getPaymentStatusColor } from '../utils/formatters';
import { Plus, Search, Filter, Download, Calendar, ArrowDownUp, CreditCard, AlertTriangle, Clock, MessageCircle } from 'lucide-react';
import { useProperty } from '../contexts/PropertyContext';
import { paymentService, tenantService, roomService } from '../services/supabase';

type SortField = 'tenantName' | 'roomNumber' | 'amount' | 'dueDate' | 'date';
type SortOrder = 'asc' | 'desc';

const Payments: React.FC = () => {
  const { selectedProperty } = useProperty();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | undefined>();
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProperty?.id) {
      loadData();
    }
  }, [selectedProperty]);

  const loadData = async () => {
    if (!selectedProperty?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      // Load payments, tenants, and rooms in parallel
      const [paymentsData, tenantsData, roomsData] = await Promise.all([
        paymentService.getByPropertyId(selectedProperty.id),
        tenantService.getByPropertyId(selectedProperty.id),
        roomService.getByPropertyId(selectedProperty.id)
      ]);

      setAllPayments(paymentsData);
      setTenants(tenantsData);
      setRooms(roomsData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const enhancedPayments = allPayments.map(payment => {
    const tenant = tenants.find(t => t.id === payment.tenantId);
    const room = rooms.find(r => r.id === payment.roomId);
    
    return {
      ...payment,
      tenantName: tenant ? tenant.name : 'Tidak Diketahui',
      roomNumber: room ? room.number : 'Tidak Diketahui'
    };
  });

  const dateFilteredPayments = enhancedPayments.filter(payment => {
    if (!dateRange.start || !dateRange.end) return true;
    return payment.dueDate >= dateRange.start && payment.dueDate <= dateRange.end;
  });

  const totalPaid = dateFilteredPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = dateFilteredPayments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalOverdue = dateFilteredPayments
    .filter(p => p.status === 'overdue')
    .reduce((sum, p) => sum + p.amount, 0);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };
  
  const filteredAndSortedPayments = dateFilteredPayments
    .filter(payment => {
      const matchesSearch = 
        payment.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.roomNumber.includes(searchQuery);
      
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'tenantName':
          comparison = a.tenantName.localeCompare(b.tenantName);
          break;
        case 'roomNumber':
          comparison = a.roomNumber.localeCompare(b.roomNumber);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'dueDate':
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        case 'date':
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const generateWhatsAppMessage = (payment: Payment & { tenantName: string; roomNumber: string }) => {
    const tenant = tenants.find(t => t.id === payment.tenantId);
    const dueDate = new Date(payment.dueDate);
    const month = dueDate.toLocaleString('id-ID', { month: 'long' });
    const year = dueDate.getFullYear();
    const propertyName = selectedProperty?.name || "KostManager Property";

    let message = '';

    switch (payment.status) {
      case 'paid':
        message = `Halo ${payment.tenantName},\n\nTerima kasih telah menyelesaikan pembayaran sewa untuk periode ${month} ${year}. Kami sangat menghargai ketepatan Anda dalam melakukan pembayaran.\n\nBerikut adalah kwitansi pembayaran Anda:\n[Link Kwitansi]\n\nJika ada pertanyaan atau membutuhkan bantuan lebih lanjut, jangan ragu untuk menghubungi kami.\n\nSalam hangat,\nManajemen ${propertyName}`;
        break;
      case 'pending':
        message = `Halo ${payment.tenantName},\n\nKami ingin mengingatkan bahwa pembayaran sewa untuk periode ${month} ${year} masih belum diterima. Berikut adalah rincian tagihan Anda:\n\n[Link invoice]\n\nMohon segera menyelesaikan pembayaran paling lambat ${formatDate(payment.dueDate)}. Jika Anda membutuhkan informasi tambahan atau bantuan terkait pembayaran, silakan hubungi kami.\n\nTerima kasih atas perhatiannya.\n\nSalam hangat,\nManajemen ${propertyName}`;
        break;
      case 'overdue':
        message = `Halo ${payment.tenantName},\n\nKami mencatat bahwa pembayaran sewa untuk periode ${month} ${year} belum diterima hingga saat ini. Pembayaran telah melewati batas waktu yang ditentukan pada ${formatDate(payment.dueDate)}.\n\nMohon segera menyelesaikan pembayaran Anda untuk menghindari denda keterlambatan atau tindakan lebih lanjut. Jika Anda mengalami kendala, silakan segera hubungi kami agar kami dapat membantu mencari solusi.\n\nTerima kasih atas perhatian dan kerja sama Anda.\n\nSalam hangat,\nManajemen ${propertyName}`;
        break;
    }

    return encodeURIComponent(message);
  };

  const handleWhatsAppClick = (payment: Payment & { tenantName: string; roomNumber: string }) => {
    const tenant = tenants.find(t => t.id === payment.tenantId);
    if (tenant) {
      const message = generateWhatsAppMessage(payment);
      const phoneNumber = tenant.phone.startsWith('0') ? '62' + tenant.phone.slice(1) : tenant.phone;
      window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
    }
  };

  const handleRecordPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowPaymentForm(true);
    setShowPaymentDetails(false);
  };

  const handleViewDetails = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowPaymentDetails(true);
    setShowPaymentForm(false);
  };

  const handlePaymentSubmit = async (data: Partial<Payment>) => {
    try {
      if (!selectedProperty?.id) {
        throw new Error('No property selected');
      }

      // Ensure UUID fields are not empty strings and handle empty date fields
      const paymentData = {
        ...data,
        property_id: selectedProperty.id,
        tenantId: data.tenantId || null,
        roomId: data.roomId || null,
        date: data.date || null, // Convert empty string to null
        dueDate: data.dueDate || null // Convert empty string to null
      };

      if (selectedPayment) {
        await paymentService.update(selectedPayment.id, { ...paymentData, status: 'paid' });
        const updatedPayments = allPayments.map(p => 
          p.id === selectedPayment.id 
            ? { ...p, ...paymentData, status: 'paid' }
            : p
        );
        setAllPayments(updatedPayments);
      } else {
        const newPayment = await paymentService.create(paymentData as Payment);
        setAllPayments([...allPayments, newPayment]);
      }
      setShowPaymentForm(false);
      setSelectedPayment(undefined);
    } catch (err) {
      console.error('Error saving payment:', err);
      setError('Failed to save payment. Please try again.');
    }
  };

  const handleExport = () => {
    const headers = ['Penyewa', 'Kamar', 'Jumlah', 'Tanggal Jatuh Tempo', 'Tanggal Pembayaran', 'Status', 'Metode Pembayaran', 'Catatan'];
    const rows = filteredAndSortedPayments.map(payment => [
      payment.tenantName,
      `Kamar ${payment.roomNumber}`,
      payment.amount.toString(),
      payment.dueDate,
      payment.date || '',
      payment.status === 'paid' ? 'Lunas' : payment.status === 'pending' ? 'Menunggu' : 'Terlambat',
      payment.paymentMethod || '',
      payment.notes || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pembayaran_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!selectedProperty?.id) {
    return (
      <div className="p-6 text-center text-gray-500">
        Please select a property to view payments
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Pembayaran</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total Pembayaran</p>
                <p className="mt-1 text-2xl font-semibold text-green-900">{formatCurrency(totalPaid)}</p>
                {dateRange.start && dateRange.end && (
                  <p className="text-xs text-green-600 mt-1">
                    {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                  </p>
                )}
              </div>
              <div className="p-3 bg-green-200 rounded-full text-green-600">
                <CreditCard size={24} />
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Menunggu Pembayaran</p>
                <p className="mt-1 text-2xl font-semibold text-yellow-900">{formatCurrency(totalPending)}</p>
                {dateRange.start && dateRange.end && (
                  <p className="text-xs text-yellow-600 mt-1">
                    {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                  </p>
                )}
              </div>
              <div className="p-3 bg-yellow-200 rounded-full text-yellow-600">
                <Clock size={24} />
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Pembayaran Terlambat</p>
                <p className="mt-1 text-2xl font-semibold text-red-900">{formatCurrency(totalOverdue)}</p>
                {dateRange.start && dateRange.end && (
                  <p className="text-xs text-red-600 mt-1">
                    {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                  </p>
                )}
              </div>
              <div className="p-3 bg-red-200 rounded-full text-red-600">
                <AlertTriangle size={24} />
              </div>
            </div>
          </div>
        </Card>
      </div>
      
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-800">Catatan Pembayaran</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari pembayaran..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
            </div>
            <Button icon={<Plus size={16} />} onClick={() => setShowPaymentForm(true)}>
              Catat Pembayaran
            </Button>
          </div>
        </CardHeader>

        <div className="px-6 pb-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <Button 
                variant={statusFilter === 'all' ? 'primary' : 'outline'} 
                size="sm" 
                onClick={() => setStatusFilter('all')}
              >
                Semua
              </Button>
              <Button 
                variant={statusFilter === 'paid' ? 'primary' : 'outline'} 
                size="sm" 
                onClick={() => setStatusFilter('paid')}
              >
                Lunas
              </Button>
              <Button 
                variant={statusFilter === 'pending' ? 'primary' : 'outline'} 
                size="sm" 
                onClick={() => setStatusFilter('pending')}
              >
                Menunggu
              </Button>
              <Button 
                variant={statusFilter === 'overdue' ? 'primary' : 'outline'} 
                size="sm" 
                onClick={() => setStatusFilter('overdue')}
              >
                Terlambat
              </Button>
            </div>
            
            <div className="flex gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-500">sampai</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button variant="outline" size="sm" icon={<Download size={16} />} onClick={handleExport}>
                Ekspor
              </Button>
            </div>
          </div>
        </div>
        
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : error ? (
            <div className="p-6 text-center text-red-500">{error}</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button 
                      className="flex items-center cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('tenantName')}
                    >
                      Penyewa
                      <ArrowDownUp size={14} className="ml-1" />
                    </button>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button 
                      className="flex items-center cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('roomNumber')}
                    >
                      Kamar
                      <ArrowDownUp size={14} className="ml-1" />
                    </button>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button 
                      className="flex items-center cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('amount')}
                    >
                      Jumlah
                      <ArrowDownUp size={14} className="ml-1" />
                    </button>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button 
                      className="flex items-center cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('dueDate')}
                    >
                      Jatuh Tempo
                      <ArrowDownUp size={14} className="ml-1" />
                    </button>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button 
                      className="flex items-center cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('date')}
                    >
                      Tanggal Bayar
                      <ArrowDownUp size={14} className="ml-1" />
                    </button>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedPayments.length > 0 ? (
                  filteredAndSortedPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{payment.tenantName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900">Kamar {payment.roomNumber}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{formatCurrency(payment.amount)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900">{formatDate(payment.dueDate)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900">{payment.date ? formatDate(payment.date) : '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={getPaymentStatusColor(payment.status)}>
                          {payment.status === 'paid' ? 'Lunas' : 
                           payment.status === 'pending' ? 'Menunggu' : 'Terlambat'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          {payment.status === 'pending' || payment.status === 'overdue' ? (
                            <>
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => handleRecordPayment(payment)}
                              >
                                Catat Pembayaran
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                icon={<MessageCircle size={14} />}
                                onClick={() => handleWhatsAppClick(payment)}
                              >
                                WhatsApp
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDetails(payment)}
                              >
                                Lihat Detail
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                icon={<MessageCircle size={14} />}
                                onClick={() => handleWhatsAppClick(payment)}
                              >
                                WhatsApp
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      Tidak ada catatan pembayaran yang sesuai dengan pencarian Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {showPaymentForm && (
        <PaymentForm
          payment={selectedPayment}
          tenants={tenants}
          rooms={rooms}
          onSubmit={handlePaymentSubmit}
          onClose={() => {
            setShowPaymentForm(false);
            setSelectedPayment(undefined);
          }}
        />
      )}

      {showPaymentDetails && selectedPayment && (
        <PaymentDetails
          payment={selectedPayment}
          tenantName={enhancedPayments.find(p => p.id === selectedPayment.id)?.tenantName}
          roomNumber={enhancedPayments.find(p => p.id === selectedPayment.id)?.roomNumber}
          onClose={() => {
            setShowPaymentDetails(false);
            setSelectedPayment(undefined);
          }}
        />
      )}
    </div>
  );
};

export default Payments;