import React, { useState, useCallback, useEffect } from 'react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { formatCurrency } from '../utils/formatters';
import { Download, Calendar, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useProperty } from '../contexts/PropertyContext';
import { supabase } from '../lib/supabase';

interface MonthlyData {
  month: string;
  revenue: number;
  pending: number;
  overdue: number;
  occupancyRate: number;
}

const Reports: React.FC = () => {
  const { selectedProperty } = useProperty();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [dateRange, setDateRange] = useState({
    start: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const loadData = async () => {
    if (!selectedProperty?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      // Get all payments for the property within the date range
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('property_id', selectedProperty.id)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
        .order('created_at', { ascending: true });

      if (paymentsError) throw paymentsError;

      // Get all rooms for occupancy calculation
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .eq('property_id', selectedProperty.id);

      if (roomsError) throw roomsError;

      // Calculate monthly data based on the date range
      const startDate = parseISO(dateRange.start);
      const endDate = parseISO(dateRange.end);
      const monthDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                       (endDate.getMonth() - startDate.getMonth()) + 1;

      const monthlyStats = Array.from({ length: monthDiff }, (_, i) => {
        const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        
        const monthPayments = payments?.filter(payment => {
          const paymentDate = payment.date ? parseISO(payment.date) : null;
          return paymentDate && paymentDate >= start && paymentDate <= end;
        }) || [];

        const revenue = monthPayments.reduce((sum, payment) => {
          return payment.status === 'paid' ? sum + payment.amount : sum;
        }, 0);

        const pending = monthPayments.reduce((sum, payment) => {
          return payment.status === 'pending' ? sum + payment.amount : sum;
        }, 0);

        const overdue = monthPayments.reduce((sum, payment) => {
          return payment.status === 'overdue' ? sum + payment.amount : sum;
        }, 0);

        const occupiedRooms = rooms?.filter(r => r.status === 'occupied').length || 0;
        const occupancyRate = rooms?.length ? Math.round((occupiedRooms / rooms.length) * 100) : 0;

        return {
          month: format(date, 'MMM yyyy'),
          revenue,
          pending,
          overdue,
          occupancyRate
        };
      });

      setMonthlyData(monthlyStats);
    } catch (err) {
      console.error('Error loading report data:', err);
      setError('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProperty, dateRange]);

  const totalRevenue = monthlyData.reduce((sum, month) => sum + month.revenue, 0);
  const averageRevenue = monthlyData.length > 0 ? totalRevenue / monthlyData.length : 0;
  const totalPending = monthlyData.reduce((sum, month) => sum + month.pending, 0);
  const totalOverdue = monthlyData.reduce((sum, month) => sum + month.overdue, 0);

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Laporan Keuangan', 15, 15);
    doc.setFontSize(12);
    doc.text(`Periode: ${format(parseISO(dateRange.start), 'dd MMM yyyy')} - ${format(parseISO(dateRange.end), 'dd MMM yyyy')}`, 15, 25);

    // Add summary
    doc.text('Ringkasan:', 15, 35);
    doc.text(`Total Pendapatan: ${formatCurrency(totalRevenue)}`, 20, 45);
    doc.text(`Rata-rata Pendapatan Bulanan: ${formatCurrency(averageRevenue)}`, 20, 55);
    doc.text(`Pembayaran Tertunda: ${formatCurrency(totalPending)}`, 20, 65);
    doc.text(`Pembayaran Terlambat: ${formatCurrency(totalOverdue)}`, 20, 75);

    // Add monthly data table
    const tableData = monthlyData.map(data => [
      data.month,
      formatCurrency(data.revenue),
      formatCurrency(data.pending),
      formatCurrency(data.overdue),
      `${data.occupancyRate}%`
    ]);

    (doc as any).autoTable({
      startY: 85,
      head: [['Bulan', 'Pendapatan', 'Tertunda', 'Terlambat', 'Tingkat Hunian']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }
    });

    // Save the PDF
    doc.save(`laporan_keuangan_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handleExportCSV = () => {
    const headers = ['Bulan', 'Pendapatan', 'Tertunda', 'Terlambat', 'Tingkat Hunian'];
    const rows = monthlyData.map(data => [
      data.month,
      data.revenue,
      data.pending,
      data.overdue,
      `${data.occupancyRate}%`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `laporan_keuangan_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!selectedProperty?.id) {
    return (
      <div className="p-6 text-center text-gray-500">
        Please select a property to view reports
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="mt-2 text-gray-600">Loading report data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Laporan Keuangan</h1>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <input
              type="date"
              name="start"
              value={dateRange.start}
              onChange={handleDateRangeChange}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500">sampai</span>
            <input
              type="date"
              name="end"
              value={dateRange.end}
              onChange={handleDateRangeChange}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" icon={<Download size={16} />} onClick={handleExportPDF}>
              Ekspor PDF
            </Button>
            <Button variant="outline" size="sm" icon={<Download size={16} />} onClick={handleExportCSV}>
              Ekspor CSV
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="p-6">
            <h3 className="text-sm font-medium text-blue-600">Total Pendapatan</h3>
            <p className="mt-2 text-3xl font-bold text-blue-900">{formatCurrency(totalRevenue)}</p>
            <p className="mt-1 text-sm text-blue-600">Periode yang dipilih</p>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <div className="p-6">
            <h3 className="text-sm font-medium text-green-600">Rata-rata Pendapatan Bulanan</h3>
            <p className="mt-2 text-3xl font-bold text-green-900">{formatCurrency(averageRevenue)}</p>
            <p className="mt-1 text-sm text-green-600">Per bulan</p>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
          <div className="p-6">
            <h3 className="text-sm font-medium text-yellow-600">Pembayaran Tertunda</h3>
            <p className="mt-2 text-3xl font-bold text-yellow-900">{formatCurrency(totalPending)}</p>
            <p className="mt-1 text-sm text-yellow-600">Periode yang dipilih</p>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100">
          <div className="p-6">
            <h3 className="text-sm font-medium text-red-600">Pembayaran Terlambat</h3>
            <p className="mt-2 text-3xl font-bold text-red-900">{formatCurrency(totalOverdue)}</p>
            <p className="mt-1 text-sm text-red-600">Periode yang dipilih</p>
          </div>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-800">Pendapatan Bulanan</h2>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => formatCurrency(value as number)}
                  labelStyle={{ color: '#111827' }}
                  contentStyle={{ 
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '0.375rem'
                  }}
                />
                <Bar dataKey="revenue" fill="#3B82F6" name="Pendapatan" />
                <Bar dataKey="pending" fill="#EAB308" name="Tertunda" />
                <Bar dataKey="overdue" fill="#EF4444" name="Terlambat" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Occupancy Rate Trend */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-800">Tren Tingkat Hunian</h2>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => `${value}%`}
                  labelStyle={{ color: '#111827' }}
                  contentStyle={{ 
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '0.375rem'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="occupancyRate" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="Tingkat Hunian"
                  dot={{ fill: '#3B82F6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;