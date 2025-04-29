import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Building2, 
  CreditCard, 
  ClipboardList, 
  TrendingUp, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import OccupancyChart from '../components/dashboard/OccupancyChart';
import RoomOverview from '../components/dashboard/RoomOverview';
import UpcomingPayments from '../components/dashboard/UpcomingPayments';
import MaintenanceOverview from '../components/dashboard/MaintenanceOverview';
import { formatCurrency } from '../utils/formatters';
import { useProperty } from '../contexts/PropertyContext';
import { supabase } from '../lib/supabase';
import { Room, Tenant, Payment, MaintenanceRequest } from '../types';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { selectedProperty } = useProperty();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);

  useEffect(() => {
    if (selectedProperty?.id) {
      loadDashboardData();
    }
  }, [selectedProperty]);

  const loadDashboardData = async () => {
    if (!selectedProperty?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [roomsData, tenantsData, paymentsData, maintenanceData] = await Promise.all([
        supabase
          .from('rooms')
          .select('*')
          .eq('property_id', selectedProperty.id)
          .order('name'),  // Changed from 'number' to 'name'
        
        supabase
          .from('tenants')
          .select('*')
          .eq('property_id', selectedProperty.id)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('payments')
          .select('*')
          .eq('property_id', selectedProperty.id)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('maintenance_requests')
          .select('*')
          .eq('property_id', selectedProperty.id)
          .order('created_at', { ascending: false })
      ]);

      if (roomsData.error) throw roomsData.error;
      if (tenantsData.error) throw tenantsData.error;
      if (paymentsData.error) throw paymentsData.error;
      if (maintenanceData.error) throw maintenanceData.error;

      setRooms(roomsData.data || []);
      setTenants(tenantsData.data || []);
      setPayments(paymentsData.data || []);
      setMaintenanceRequests(maintenanceData.data || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate financial summary
  const getFinancialSummary = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.date || payment.dueDate);
      return paymentDate.getMonth() === currentMonth && 
             paymentDate.getFullYear() === currentYear;
    });

    const totalRevenue = monthlyPayments.reduce((sum, payment) => {
      return payment.status === 'paid' ? sum + payment.amount : sum;
    }, 0);

    const pendingPayments = monthlyPayments.reduce((sum, payment) => {
      return payment.status === 'pending' ? sum + payment.amount : sum;
    }, 0);

    const overduePayments = monthlyPayments.reduce((sum, payment) => {
      return payment.status === 'overdue' ? sum + payment.amount : sum;
    }, 0);

    return {
      totalRevenue,
      pendingPayments,
      overduePayments,
      monthlyIncome: totalRevenue
    };
  };

  // Calculate occupancy summary
  const getOccupancySummary = () => {
    const total = rooms.length;
    const occupied = rooms.filter(room => room.status === 'occupied').length;
    const vacant = rooms.filter(room => room.status === 'vacant').length;
    const maintenance = rooms.filter(room => room.status === 'maintenance').length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return {
      total,
      occupied,
      vacant,
      maintenance,
      occupancyRate
    };
  };

  const financialSummary = getFinancialSummary();
  const occupancySummary = getOccupancySummary();

  const pendingPayments = payments.filter(
    payment => payment.status === 'pending' || payment.status === 'overdue'
  );

  const activeMaintenanceRequests = maintenanceRequests.filter(
    request => request.status === 'pending' || request.status === 'in-progress'
  );

  if (!selectedProperty?.id) {
    return (
      <div className="p-6 text-center text-gray-500">
        Please select a property to view the dashboard
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="mt-2 text-gray-600">Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Beranda</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <StatCard
          title="Total Penyewa"
          value={tenants.filter(tenant => tenant.status === 'active').length}
          icon={<Users size={24} />}
          change={{ 
            value: "+2", 
            type: "increase" 
          }}
        />
        <StatCard
          title="Total Kamar"
          value={rooms.length}
          icon={<Building2 size={24} />}
          change={{ 
            value: "0", 
            type: "neutral" 
          }}
        />
        <StatCard
          title="Pendapatan Bulanan"
          value={formatCurrency(financialSummary.monthlyIncome)}
          icon={<CreditCard size={24} />}
          change={{ 
            value: "+5%", 
            type: "increase" 
          }}
        />
        <StatCard
          title="Permintaan Pemeliharaan"
          value={activeMaintenanceRequests.length}
          icon={<ClipboardList size={24} />}
          change={{ 
            value: "-1", 
            type: "decrease" 
          }}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OccupancyChart data={occupancySummary} />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <StatCard
            title="Tingkat Hunian"
            value={`${occupancySummary.occupancyRate}%`}
            icon={<TrendingUp size={24} />}
            change={{ 
              value: "+2.5%", 
              type: "increase" 
            }}
            className="h-full"
          />
          <StatCard
            title="Pembayaran Terlambat"
            value={formatCurrency(financialSummary.overduePayments)}
            icon={<AlertTriangle size={24} />}
            change={{ 
              value: formatCurrency(financialSummary.overduePayments), 
              type: "increase" 
            }}
            className="h-full"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingPayments 
          payments={pendingPayments} 
          tenants={tenants}
          onViewAllClick={() => onNavigate('payments')}
        />
        <MaintenanceOverview 
          maintenanceRequests={activeMaintenanceRequests} 
          rooms={rooms}
          onViewAllClick={() => onNavigate('maintenance')}
        />
      </div>
      
      <RoomOverview 
        rooms={rooms} 
        onViewAllClick={() => onNavigate('rooms')}
      />
    </div>
  );
};

export default Dashboard;