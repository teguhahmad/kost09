import React, { useState, useEffect, useRef } from 'react';
import { Menu, Bell } from 'lucide-react';
import Button from '../ui/Button';
import PropertySelector from './PropertySelector';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  onNavigate?: (page: string) => void;
}

const Header: React.FC<HeaderProps> = ({ title, onMenuClick, onNavigate }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead } = useNotifications();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleViewAllNotifications = () => {
    setShowNotifications(false);
    if (onNavigate) {
      onNavigate('notifications');
    }
  };

  const handleNotificationClick = async (id: string) => {
    await markAsRead(id);
  };

  // Get only the 5 most recent notifications
  const recentNotifications = notifications.slice(0, 5);

  return (
    <header className="bg-white shadow-sm h-16 flex items-center fixed top-0 right-0 left-64 z-20 px-6">
      <div className="flex-1 flex items-center">
        <button onClick={onMenuClick} className="lg:hidden mr-4 text-gray-500 focus:outline-none">
          <Menu size={24} />
        </button>
        
        <PropertySelector />
        
        <div className="mx-4 h-6 w-px bg-gray-200" />
        
        <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="relative" ref={notificationsRef}>
          <button 
            className="relative text-gray-500 hover:text-gray-700 focus:outline-none"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Notifikasi</h3>
              </div>
              {recentNotifications.length > 0 ? (
                recentNotifications.map(notification => (
                  <div 
                    key={notification.id} 
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                      notification.status === 'unread' ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification.id)}
                  >
                    <p className="text-sm text-gray-800">{notification.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { 
                        addSuffix: true,
                        locale: id 
                      })}
                    </p>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-gray-500">
                  Tidak ada notifikasi
                </div>
              )}
              <div className="px-4 py-2 border-t border-gray-100">
                <button 
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={handleViewAllNotifications}
                >
                  Lihat semua notifikasi
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
            A
          </div>
          <span className="text-sm font-medium text-gray-700 hidden md:inline-block">Admin</span>
        </div>
      </div>
    </header>
  );
};

export default Header;