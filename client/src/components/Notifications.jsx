import { useState } from 'react';
import useStore from '../store.js';

function Notifications() {
  const [open, setOpen] = useState(false);
  const notifications = useStore(state => state.notifications);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getLevelColor = (level) => {
    switch (level) {
      case 'error': return 'bg-red-100 text-red-700 border-red-200';
      case 'warning': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'error': return '🔴';
      case 'warning': return '🟡';
      default: return '🔵';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
          {unreadCount}
        </span>
      )}
    </button>

    {open && (
      <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
        <div className="p-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">通知中心</h3>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              暂无通知
            </div>
          ) : (
            notifications.slice(0, 10).map((notification, index) => (
              <div
                key={index}
                className={`p-3 border-b border-gray-100 last:border-b-0 ${
                  !notification.read ? 'bg-gray-50' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{getLevelIcon(notification.level)}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {notification.title || notification.type}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notification.timestamp).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-2 border-t border-gray-200">
          <button className="w-full text-sm text-primary-600 hover:text-primary-700 font-medium">
            查看全部通知
          </button>
        </div>
      </div>
    )}
    </div>
  );
}

export default Notifications;
