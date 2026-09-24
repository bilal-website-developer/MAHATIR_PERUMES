import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  Check,
  CheckCheck,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api';

export interface NotificationItem {
  id: string;
  branch_id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  data?: Record<string, any>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');
  const popoverRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // 1. Fetch unread count & notifications
  const { data: notificationsData, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiClient<NotificationItem[]>('/api/v1/notifications');
      return {
        items: res.data || [],
        unread_count: (res.meta as any)?.unread_count ?? (res.data?.filter((n) => !n.is_read).length || 0),
      };
    },
    refetchInterval: 30000, // background refresh every 30s
  });

  const notifications = notificationsData?.items || [];
  const unreadCount = notificationsData?.unread_count || 0;

  // 2. Mark single as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient(`/api/v1/notifications/${id}/read`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // 3. Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient('/api/v1/notifications/read-all', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // 4. Trigger scan mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      await apiClient('/api/v1/notifications/scan', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      refetch();
    },
  });

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'critical') return n.severity === 'critical';
    return true;
  });

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-gold-300 hover:bg-slate-800/50 rounded-lg transition-colors"
        title="In-App Notification Center"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg ring-2 ring-[#0f121a] animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-[#141824] border border-slate-700/80 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#11141e]">
            <div className="flex items-center space-x-2">
              <span className="font-serif text-sm font-semibold text-slate-100">
                Operational Alerts
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gold-500/20 text-gold-300 border border-gold-500/30">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending}
                className="p-1 text-slate-400 hover:text-gold-300 rounded transition-colors disabled:opacity-50"
                title="Scan Inventory Thresholds"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center space-x-1 transition-colors"
                  title="Mark All Read"
                >
                  <CheckCheck className="h-3.5 w-3.5 text-gold-400" />
                  <span>Mark all</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-4 py-2 bg-[#0d1017] border-b border-slate-800 flex items-center space-x-2 text-[11px]">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-slate-700 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'unread'
                  ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('critical')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'critical'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Critical
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {filteredNotifications.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
                <ShieldCheck className="h-8 w-8 text-emerald-500/40" />
                <span>All systems healthy. No active alerts.</span>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3.5 text-xs transition-colors hover:bg-slate-800/40 flex items-start justify-between space-x-3 ${
                    !notif.is_read ? 'bg-gold-500/[0.04]' : 'opacity-70'
                  }`}
                >
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="mt-0.5">
                      {notif.severity === 'critical' ? (
                        <AlertOctagon className="h-4 w-4 text-rose-400 flex-shrink-0" />
                      ) : notif.severity === 'warning' ? (
                        <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                      ) : (
                        <Info className="h-4 w-4 text-sky-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4
                          className={`font-semibold truncate ${
                            !notif.is_read ? 'text-slate-200' : 'text-slate-400'
                          }`}
                        >
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap ml-2">
                          {new Date(notif.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>

                  {!notif.is_read && (
                    <button
                      onClick={() => markReadMutation.mutate(notif.id)}
                      className="p-1 text-slate-500 hover:text-gold-400 rounded transition-colors"
                      title="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer Shortcuts */}
          <div className="p-3 border-t border-slate-800 bg-[#11141e] flex items-center justify-between text-xs">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/suggestions');
              }}
              className="text-gold-400 hover:text-gold-300 font-medium flex items-center space-x-1 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Smart Production</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/alerts');
              }}
              className="text-slate-400 hover:text-slate-200 font-medium flex items-center space-x-1 transition-colors"
            >
              <span>Manage Alerts</span>
              <ExternalLink className="h-3 w-3 ml-0.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
