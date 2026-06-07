import { useAppStore } from '@/store';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface NotificationProps {
  message?: string;
  type?: 'success' | 'error' | 'info';
  onClose?: () => void;
}

export const Notification = ({ message, type, onClose }: NotificationProps = {}) => {
  const store = useAppStore();
  const notificationMsg = message || store.notification?.message;
  const notificationType = type || store.notification?.type;
  const handleClose = onClose || store.clearNotification;

  if (!notificationMsg || !notificationType) return null;

  const bgColors = {
    success: 'bg-green-50 border-green-500 text-green-800',
    error: 'bg-red-50 border-red-500 text-red-800',
    info: 'bg-blue-50 border-blue-500 text-blue-800',
  };

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
  };

  const Icon = icons[notificationType];

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 shadow-lg ${bgColors[notificationType]}`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="font-medium">{notificationMsg}</span>
        <button
          onClick={handleClose}
          className="ml-2 p-1 hover:bg-black/10 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Notification;
