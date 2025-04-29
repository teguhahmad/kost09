import React, { useState, useEffect } from 'react';
import Card, { CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Plus, Search, Bell, Users, Building2, CreditCard, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface BackofficeUser {
  user_id: string;
  role: string;
  email?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'user' | 'property' | 'payment';
  target_user_id?: string | null;
  created_at: string;
}

const Notifications = () => {
  const [users, setUsers] = useState<BackofficeUser[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'system' as const,
    target_user_id: '' as string | null
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First, get backoffice users
      const { data: backofficeUsers, error: backofficeError } = await supabase
        .from('backoffice_users')
        .select('user_id, role');

      if (backofficeError) throw backofficeError;

      // Then, get user profiles using the admin API
      const userIds = backofficeUsers?.map(user => user.user_id) || [];
      const userProfiles = new Map();

      // Get user data for each backoffice user
      for (const userId of userIds) {
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
        if (!userError && user) {
          userProfiles.set(user.id, user.email);
        }
      }

      // Merge the data
      const transformedUsers = backofficeUsers?.map(user => ({
        user_id: user.user_id,
        role: user.role,
        email: userProfiles.get(user.user_id)
      })) || [];

      // Get notifications
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;

      setUsers(transformedUsers);
      setNotifications(notificationsData || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please make sure you have the correct permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      setError(null);

      const { error: insertError } = await supabase
        .from('notifications')
        .insert([{
          ...formData,
          target_user_id: formData.target_user_id || null
        }]);

      if (insertError) throw insertError;

      await loadData();
      setShowForm(false);
      setFormData({
        title: '',
        message: '',
        type: 'system',
        target_user_id: null
      });
    } catch (err) {
      console.error('Error creating notification:', err);
      setError('Failed to create notification');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;

    try {
      setIsLoading(true);
      setError(null);

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadData();
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError('Failed to delete notification');
    } finally {
      setIsLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <Users className="text-blue-500" size={20} />;
      case 'property':
        return <Building2 className="text-green-500" size={20} />;
      case 'payment':
        return <CreditCard className="text-purple-500" size={20} />;
      default:
        return <Bell className="text-gray-500" size={20} />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'bg-blue-100 text-blue-800';
      case 'property':
        return 'bg-green-100 text-green-800';
      case 'payment':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredNotifications = notifications.filter(notification =>
    notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    notification.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Notifications Management</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-800">All Notifications</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
            </div>
            <Button 
              icon={<Plus size={16} />}
              onClick={() => setShowForm(true)}
              disabled={isLoading}
            >
              Add Notification
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
              <p className="mt-2 text-gray-500">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length > 0 ? (
            <div className="space-y-4">
              {filteredNotifications.map((notification) => (
                <div 
                  key={notification.id}
                  className="flex items-start gap-4 p-4 bg-white rounded-lg border border-gray-200"
                >
                  <div className="p-2 bg-gray-50 rounded-full">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{notification.title}</h3>
                        <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                      </div>
                      <Badge className={getNotificationColor(notification.type)}>
                        {notification.type}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <div className="text-gray-500">
                        {format(new Date(notification.created_at), 'dd MMM yyyy HH:mm', { locale: id })}
                        {notification.target_user_id && (
                          <span className="ml-2">
                            • Sent to: {users.find(u => u.user_id === notification.target_user_id)?.email}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteNotification(notification.id)}
                        disabled={isLoading}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No notifications found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Notification Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Add New Notification</h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormData({
                    title: '',
                    message: '',
                    type: 'system',
                    target_user_id: null
                  });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    type: e.target.value as 'system' | 'user' | 'property' | 'payment'
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="system">System</option>
                  <option value="user">User</option>
                  <option value="property">Property</option>
                  <option value="payment">Payment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target User (Optional)
                </label>
                <select
                  value={formData.target_user_id || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    target_user_id: e.target.value || null
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Users</option>
                  {users.map(user => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.email} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({
                      title: '',
                      message: '',
                      type: 'system',
                      target_user_id: null
                    });
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? 'Adding...' : 'Add Notification'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;