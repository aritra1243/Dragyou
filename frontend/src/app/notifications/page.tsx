'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bell, Star, GitFork, UserPlus, GitPullRequest, AlertCircle, CheckCircle2,
  CheckCheck, Trash2, Filter, Inbox, ArrowLeft, ExternalLink
} from 'lucide-react';
import { api, Notification, User } from '@/lib/api';

function relativeTime(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

export default function NotificationsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const loadData = () => {
    setLoading(true);
    api.listNotifications()
      .then((data) => {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      })
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('dragyou_user');
    if (savedUser) {
      try { setCurrentUser(JSON.parse(savedUser)); } catch (e) {}
    }
    loadData();
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      loadData();
    } catch (err) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      loadData();
    } catch (err) {}
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteNotification(id);
      loadData();
    } catch (err) {}
  };

  const filtered = notifications.filter((n) => {
    const matchesRead = filter === 'all' || !n.is_read;
    const matchesType = typeFilter === 'all' || n.type === typeFilter;
    return matchesRead && matchesType;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
            <Bell className="text-blue-400" size={24} /> Notifications Inbox
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Stay updated with activity on your repositories, stars, forks, and collaborator requests
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 font-semibold text-xs font-mono transition-all self-start sm:self-auto"
          >
            <CheckCheck size={16} /> Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      {/* Toolbar Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-950/80 p-2 border border-gray-800 rounded-2xl">
        <div className="flex items-center gap-1 text-xs font-mono">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            All ({notifications.length})
          </button>

          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 ${
              filter === 'unread'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-400/20 text-blue-300 text-[10px]">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Type Filter Dropdown */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <Filter size={14} className="text-gray-500" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-gray-300 rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Event Types</option>
            <option value="star">Stars ⭐</option>
            <option value="fork">Forks 🍴</option>
            <option value="collaborator">Collaborator Invites 👥</option>
            <option value="pull_request">Pull Requests 🔀</option>
            <option value="issue">Issues ⚠️</option>
          </select>
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 font-mono text-xs border border-gray-800/80 rounded-2xl glass-panel">
          Loading notifications...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center glass-panel rounded-2xl space-y-3 border border-gray-800/80">
          <Inbox size={40} className="mx-auto text-gray-600" />
          <h3 className="text-base font-bold text-gray-200">Inbox is empty</h3>
          <p className="text-gray-400 text-xs font-mono max-w-sm mx-auto">
            {filter === 'unread'
              ? 'You have no unread notifications.'
              : 'You do not have any notifications right now.'}
          </p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden divide-y divide-gray-800/60">
          {filtered.map((n) => {
            let notifIcon = <CheckCircle2 size={18} className="text-blue-400 shrink-0" />;
            if (n.type === 'star') notifIcon = <Star size={18} className="text-amber-400 shrink-0" />;
            if (n.type === 'fork') notifIcon = <GitFork size={18} className="text-blue-400 shrink-0" />;
            if (n.type === 'collaborator') notifIcon = <UserPlus size={18} className="text-emerald-400 shrink-0" />;
            if (n.type === 'pull_request') notifIcon = <GitPullRequest size={18} className="text-purple-400 shrink-0" />;
            if (n.type === 'issue') notifIcon = <AlertCircle size={18} className="text-red-400 shrink-0" />;

            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.is_read) handleMarkRead(n.id);
                  if (n.link) window.location.href = n.link;
                }}
                className={`p-4 flex items-start gap-4 hover:bg-gray-900/60 cursor-pointer transition-all ${
                  !n.is_read ? 'bg-blue-950/20 font-medium' : 'opacity-85'
                }`}
              >
                <div className="mt-1 p-2 rounded-xl bg-gray-900 border border-gray-800">
                  {notifIcon}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-gray-100 flex items-center gap-2">
                      {n.title}
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      )}
                    </span>
                    <span className="text-[11px] font-mono text-gray-500 shrink-0">
                      {relativeTime(n.created_at)}
                    </span>
                  </div>

                  {n.message && (
                    <p className="text-xs text-gray-400 leading-relaxed font-sans">
                      {n.message}
                    </p>
                  )}

                  {n.repository && (
                    <div className="pt-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-900 text-blue-400 border border-gray-800">
                        {n.repository.full_name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-center">
                  {!n.is_read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(n.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition-colors"
                      title="Mark as read"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  )}

                  <button
                    onClick={(e) => handleDelete(n.id, e)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                    title="Delete notification"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
