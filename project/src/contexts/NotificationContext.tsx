import React, { createContext, useContext, useState, useEffect } from 'react';
import { Notification } from '../types';
import { notificationService } from '../services/supabase';
import { supabase } from '../lib/supabase';
import { useProperty } from './PropertyContext';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  createNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'status'>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
  createNotification: async () => {}
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { selectedProperty } = useProperty();

  useEffect(() => {
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        loadNotifications();
      } else if (event === 'SIGNED_OUT') {
        setNotifications([]);
      }
    });

    // Only set up notifications subscription if we have a session
    const setupNotificationsSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const notificationsSubscription = supabase
          .channel('notifications_changes')
          .on(
            'postgres_changes',
            { 
              event: '*', 
              schema: 'public', 
              table: 'notifications',
              filter: selectedProperty ? `target_property_id=eq.${selectedProperty.id}` : undefined
            },
            () => {
              loadNotifications();
            }
          )
          .subscribe();

        return () => {
          notificationsSubscription.unsubscribe();
        };
      }
    };

    const unsubscribe = setupNotificationsSubscription();

    return () => {
      authSubscription.unsubscribe();
      unsubscribe?.then(cleanup => cleanup?.());
    };
  }, [selectedProperty]);

  const loadNotifications = async () => {
    try {
      // Check if user is authenticated before loading notifications
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('User not authenticated, skipping notification load');
        return;
      }

      const data = await notificationService.getAll();
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await notificationService.markAsRead(id);
      setNotifications(notifications.map(notification =>
        notification.id === id ? { ...notification, status: 'read' } : notification
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await notificationService.markAllAsRead();
      setNotifications(notifications.map(notification => ({ ...notification, status: 'read' })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await notificationService.delete(id);
      setNotifications(notifications.filter(notification => notification.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const createNotification = async (notification: Omit<Notification, 'id' | 'created_at' | 'status'>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const newNotification = await notificationService.create(notification);
      setNotifications([newNotification, ...notifications]);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      createNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};