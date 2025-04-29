import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Building2, 
  CreditCard, 
  TrendingUp,
  AlertTriangle,
  Loader2,
  Building,
  UserPlus,
  DollarSign,
  Activity,
  CheckCircle,
  XCircle,
  Calendar,
  Clock
} from 'lucide-react';
import Card, { CardHeader, CardContent } from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import { formatCurrency } from '../../utils/formatters';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface DashboardStats {
  total_users: number;
  total_properties: number;
  total_revenue: number;
  active_tenants: number;
  monthly_revenue: any[];
  user_growth: any[];
  property_distribution: { city: string; count: number }[];
  recent_activities: {
    id: string;
    type: string;
    description: string;
    created_at: string;
  }[];
  subscription_stats: {
    total: number;
    active: number;
    cancelled: number;
    revenue: number;
    growth_rate: number;
  };
  system_health: {
    active_properties: number;
    total_rooms: number;
    maintenance_requests: number;
    overdue_payments: number;
  };
}

const BackofficeDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    total_users: 0,
    total_properties: 0,
    total_revenue: 0,
    active_tenants: 0,
    monthly_revenue: [],
    user_growth: [],
    property_distribution: [],
    recent_activities: [],
    subscription_stats: {
      total: 0,
      active: 0,
      cancelled: 0,
      revenue: 0,
      growth_rate: 0
    },
    system_health: {
      active_properties: 0,
      total_rooms: 0,
      maintenance_requests: 0,
      overdue_payments: 0
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadStats();
  }, [dateRange]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get total users
      const { count: usersCount } = await supabase
        .from('backoffice_users')
        .select('*', { count: 'exact', head: true });

      // Get total properties
      const { count: propertiesCount } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true });

      // Get total revenue
      const { data: revenueData } = await supabase
        .from('payments')
        .select('amount, created_at')
        .eq('status', 'paid')
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);

      const totalRevenue = revenueData?.reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;

      // Get monthly revenue data
      const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.toLocaleString('default', { month: 'short' });
        const revenue = revenueData?.filter(payment => {
          const paymentDate = new Date(payment.created_at);
          return paymentDate.getMonth() === date.getMonth() && 
                 paymentDate.getFullYear() === date.getFullYear();
        }).reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;
        return { month, revenue };
      }).reverse();

      // Get active tenants count
      const { count: tenantsCount } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get property distribution
      const { data: properties } = await supabase
        .from('properties')
        .select('city');

      const cityCount = properties?.reduce((acc, property) => {
        if (property.city) {
          acc[property.city] = (acc[property.city] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const distribution = Object.entries(cityCount || {}).map(([city, count]) => ({
        city,
        count
      }));

      // Get recent activities from audit logs
      const { data: activities } = await supabase
        .from('backoffice_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      // Get user growth data - using backoffice_users instead of auth.users
      const userGrowthData = await Promise.all(
        Array.from({ length: 6 }, async (_, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
          const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

          const { count } = await supabase
            .from('backoffice_users')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfMonth.toISOString())
            .lte('created_at', endOfMonth.toISOString());

          return {
            month: date.toLocaleString('default', { month: 'short' }),
            users: count || 0
          };
        })
      );

      // Get subscription stats
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('*, subscription_plans(price)')
        .order('created_at', { ascending: false });

      const currentMonth = new Date().getMonth();
      const lastMonth = new Date().setMonth(currentMonth - 1);
      
      const currentMonthSubs = subscriptions?.filter(s => 
        new Date(s.created_at).getMonth() === currentMonth
      ).length || 0;
      
      const lastMonthSubs = subscriptions?.filter(s => 
        new Date(s.created_at).getMonth() === new Date(lastMonth).getMonth()
      ).length || 0;

      const growthRate = lastMonthSubs > 0 
        ? ((currentMonthSubs - lastMonthSubs) / lastMonthSubs) * 100 
        : 0;

      const subscriptionStats = {
        total: subscriptions?.length || 0,
        active: subscriptions?.filter(s => s.status === 'active').length || 0,
        cancelled: subscriptions?.filter(s => s.status === 'cancelled').length || 0,
        revenue: subscriptions?.reduce((sum, s) => sum + (s.subscription_plans?.price || 0), 0) || 0,
        growth_rate: Math.round(growthRate)
      };

      // Get system health stats
      const [
        { count: activePropertiesCount },
        { count: totalRoomsCount },
        { count: maintenanceCount },
        { count: overduePaymentsCount }
      ] = await Promise.all([
        // Active properties
        supabase
          .from('properties')
          .select('*', { count: 'exact', head: true }),
        
        // Total rooms
        supabase
          .from('rooms')
          .select('*', { count: 'exact', head: true }),
        
        // Pending maintenance requests
        supabase
          .from('maintenance_requests')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'in-progress']),
        
        // Overdue payments
        supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'overdue')
      ]);

      const systemHealth = {
        active_properties: activePropertiesCount || 0,
        total_rooms: totalRoomsCount || 0,
        maintenance_requests: maintenanceCount || 0,
        overdue_payments: overduePaymentsCount || 0
      };

      setStats({
        total_users: usersCount || 0,
        total_properties: propertiesCount || 0,
        total_revenue: totalRevenue,
        active_tenants: tenantsCount || 0,
        monthly_revenue: monthlyRevenue,
        user_growth: userGrowthData.reverse(),
        property_distribution: distribution,
        recent_activities: activities || [],
        subscription_stats: subscriptionStats,
        system_health: systemHealth
      });
    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={stats.total_users.toString()}
          icon={<Users size={24} />}
          change={{ 
            value: "+5%", 
            type: "increase" 
          }}
        />
        <StatCard
          title="Total Properties"
          value={stats.total_properties.toString()}
          icon={<Building2 size={24} />}
          change={{ 
            value: "+2%", 
            type: "increase" 
          }}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.total_revenue)}
          icon={<CreditCard size={24} />}
          change={{ 
            value: "+12%", 
            type: "increase" 
          }}
        />
        <StatCard
          title="Active Tenants"
          value={stats.active_tenants.toString()}
          icon={<TrendingUp size={24} />}
          change={{ 
            value: "+8%", 
            type: "increase" 
          }}
        />
      </div>

      {/* Subscription Overview */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-800">Subscription Overview</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Active Subscriptions</p>
                  <p className="text-2xl font-bold text-green-900">{stats.subscription_stats.active}</p>
                </div>
                <CheckCircle className="text-green-500" size={24} />
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">Cancelled</p>
                  <p className="text-2xl font-bold text-red-900">{stats.subscription_stats.cancelled}</p>
                </div>
                <XCircle className="text-red-500" size={24} />
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-blue-900">{formatCurrency(stats.subscription_stats.revenue)}</p>
                </div>
                <DollarSign className="text-blue-500" size={24} />
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600">Monthly Growth</p>
                  <p className="text-2xl font-bold text-purple-900">{stats.subscription_stats.growth_rate}%</p>
                </div>
                <TrendingUp className="text-purple-500" size={24} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-800">Monthly Revenue</h2>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthly_revenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => formatCurrency(value as number)}
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '0.375rem'
                    }}
                  />
                  <Bar dataKey="revenue" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User Growth Chart */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-800">User Growth</h2>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.user_growth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '0.375rem'
                    }}
                  />
                  <Line type="monotone" dataKey="users" stroke="#3B82F6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-800">System Overview</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600">Active Properties</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.system_health.active_properties}</p>
                  </div>
                  <Building className="text-blue-500" size={24} />
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600">Total Rooms</p>
                    <p className="text-2xl font-bold text-green-900">{stats.system_health.total_rooms}</p>
                  </div>
                  <Building2 className="text-green-500" size={24} />
                </div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-600">Pending Maintenance</p>
                    <p className="text-2xl font-bold text-yellow-900">{stats.system_health.maintenance_requests}</p>
                  </div>
                  <Clock className="text-yellow-500" size={24} />
                </div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600">Overdue Payments</p>
                    <p className="text-2xl font-bold text-red-900">{stats.system_health.overdue_payments}</p>
                  </div>
                  <AlertTriangle className="text-red-500" size={24} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-800">Recent Activities</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recent_activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-blue-100 rounded-full">
                    {activity.type === 'user' ? (
                      <UserPlus className="h-5 w-5 text-blue-600" />
                    ) : activity.type === 'property' ? (
                      <Building className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Activity className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900">{activity.description}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BackofficeDashboard;