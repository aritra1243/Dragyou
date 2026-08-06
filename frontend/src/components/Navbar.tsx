'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Search, Plus, User as UserIcon, LogOut, Code, BookOpen, Menu, X, Sun, Moon,
  Bell, Star, GitFork, UserPlus, GitPullRequest, AlertCircle, CheckCircle2, CheckCheck, ExternalLink
} from 'lucide-react';
import { api, User, Notification } from '@/lib/api';

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifTab, setNotifTab] = useState<'all' | 'unread'>('unread');
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadNotifications = () => {
    if (!localStorage.getItem('dragyou_token')) return;
    api.listNotifications()
      .then((data) => {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    const loadUser = () => {
      const savedUser = localStorage.getItem('dragyou_user');
      if (savedUser) {
        try { setUser(JSON.parse(savedUser)); } catch (e) {}
      } else {
        setUser(null);
      }
    };
    loadUser();
    loadNotifications();

    window.addEventListener('storage', loadUser);

    // Poll notifications every 20 seconds when user is logged in
    const timer = setInterval(() => {
      if (localStorage.getItem('dragyou_token')) {
        loadNotifications();
      }
    }, 20000);

    // Click outside to close notifications dropdown
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);

    // Initialize Theme
    const savedTheme = (localStorage.getItem('dragyou_theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }

    return () => {
      window.removeEventListener('storage', loadUser);
      clearInterval(timer);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handleMarkRead = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      loadNotifications();
    } catch (err) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      loadNotifications();
    } catch (err) {}
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('dragyou_theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dragyou_token');
    localStorage.removeItem('dragyou_user');
    setUser(null);
    window.location.href = '/';
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setMobileMenuOpen(false);
    if (q.includes('/')) {
      const parts = q.split('/');
      window.location.href = `/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`;
    } else if (q.startsWith('@')) {
      window.location.href = `/users/${encodeURIComponent(q.slice(1))}`;
    } else {
      window.location.href = `/users/${encodeURIComponent(q)}`;
    }
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-4 lg:gap-6">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <img
              src="/logo.png"
              alt="Dragyou Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform border border-blue-500/30"
            />
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg text-gray-100 tracking-tight flex items-center gap-1.5">
                Dragyou
                <span className="text-[9px] sm:text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">VCS</span>
              </span>
              <span className="text-[9px] text-gray-400 -mt-1 font-mono hidden sm:block">C++20 Engine</span>
            </div>
          </Link>

          {/* Desktop Nav links */}
          <nav className="hidden md:flex items-center gap-1 font-medium text-sm text-gray-300">
            <Link href="/" className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-gray-800/60 transition-colors">
              Dashboard
            </Link>
            <Link href={user ? "/repos" : "/login"} className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-gray-800/60 transition-colors flex items-center gap-1.5">
              <Code size={16} /> Repositories
            </Link>
            <Link href="/docs" className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-gray-800/60 transition-colors flex items-center gap-1.5">
              <BookOpen size={16} /> Documentation
            </Link>
          </nav>
        </div>

        {/* Global Search Bar (Desktop) */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user (@username) or repo (owner/repo)..."
              className="w-full bg-gray-900/80 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
            />
            <kbd className="absolute right-3 top-2.5 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-800 rounded border border-gray-700">
              Enter ↵
            </kbd>
          </form>
        </div>

        {/* Desktop Controls */}
        <div className="hidden sm:flex items-center gap-3">
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-gray-800 bg-gray-900/80 hover:bg-gray-800 text-gray-300 hover:text-amber-400 transition-all cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun size={17} className="text-amber-400 animate-fadeIn" />
            ) : (
              <Moon size={17} className="text-indigo-600 animate-fadeIn" />
            )}
          </button>

          <Link
            href="/repos?new=true"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95 shrink-0"
          >
            <Plus size={14} /> New Repo
          </Link>

          {/* Notification Bell & Dropdown */}
          {user && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative p-2 rounded-xl border border-gray-800 bg-gray-900/80 hover:bg-gray-800 text-gray-300 hover:text-white transition-all cursor-pointer"
                title="Notifications"
                aria-label="View Notifications"
              >
                <Bell size={17} className={unreadCount > 0 ? "text-blue-400" : "text-gray-400"} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white font-mono text-[9px] font-bold flex items-center justify-center border border-gray-950 shadow-sm animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Center Dropdown */}
              {showNotifs && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 glass-panel bg-gray-950/95 border border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden text-xs animate-fadeIn">
                  {/* Header */}
                  <div className="p-3.5 border-b border-gray-800 flex items-center justify-between bg-gray-900/80 font-mono">
                    <div className="flex items-center gap-2 font-bold text-gray-100">
                      <Bell size={15} className="text-blue-400" />
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px]">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>

                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <CheckCheck size={13} /> Mark all read
                      </button>
                    )}
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex border-b border-gray-800/80 bg-gray-900/40 text-xs font-mono">
                    <button
                      onClick={() => setNotifTab('unread')}
                      className={`flex-1 py-2 text-center transition-colors ${
                        notifTab === 'unread'
                          ? 'text-blue-400 border-b-2 border-blue-500 font-bold bg-gray-900/60'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      Unread ({unreadCount})
                    </button>
                    <button
                      onClick={() => setNotifTab('all')}
                      className={`flex-1 py-2 text-center transition-colors ${
                        notifTab === 'all'
                          ? 'text-blue-400 border-b-2 border-blue-500 font-bold bg-gray-900/60'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      All ({notifications.length})
                    </button>
                  </div>

                  {/* Notification List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-800/60">
                    {(() => {
                      const displayList = notifTab === 'unread' ? notifications.filter(n => !n.is_read) : notifications;
                      if (displayList.length === 0) {
                        return (
                          <div className="p-8 text-center text-gray-500 font-mono space-y-1">
                            <CheckCircle2 size={24} className="mx-auto text-gray-600 mb-2" />
                            <p className="text-gray-300 font-semibold">No notifications</p>
                            <p className="text-[11px]">You're all caught up!</p>
                          </div>
                        );
                      }
                      return displayList.map((n) => {
                        const isRead = n.is_read;
                        let notifIcon = <CheckCircle2 size={15} className="text-blue-400 shrink-0" />;
                        if (n.type === 'star') notifIcon = <Star size={15} className="text-amber-400 shrink-0" />;
                        if (n.type === 'fork') notifIcon = <GitFork size={15} className="text-blue-400 shrink-0" />;
                        if (n.type === 'collaborator') notifIcon = <UserPlus size={15} className="text-emerald-400 shrink-0" />;
                        if (n.type === 'pull_request') notifIcon = <GitPullRequest size={15} className="text-purple-400 shrink-0" />;
                        if (n.type === 'issue') notifIcon = <AlertCircle size={15} className="text-red-400 shrink-0" />;

                        return (
                          <div
                            key={n.id}
                            onClick={(e) => {
                              if (!n.is_read) handleMarkRead(n.id, e);
                              setShowNotifs(false);
                              if (n.link) window.location.href = n.link;
                            }}
                            className={`p-3 flex items-start gap-3 hover:bg-gray-900/80 cursor-pointer transition-colors ${
                              !isRead ? 'bg-blue-950/20' : 'opacity-80'
                            }`}
                          >
                            <div className="mt-0.5">{notifIcon}</div>
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="text-gray-200 font-medium text-xs leading-snug break-words">
                                {n.title}
                              </div>
                              {n.message && (
                                <p className="text-[11px] text-gray-400 line-clamp-2 leading-tight">
                                  {n.message}
                                </p>
                              )}
                              <div className="text-[10px] font-mono text-gray-500 pt-0.5">
                                {timeAgo(n.created_at)}
                              </div>
                            </div>
                            {!isRead && (
                              <button
                                onClick={(e) => handleMarkRead(n.id, e)}
                                title="Mark as read"
                                className="w-2 h-2 rounded-full bg-blue-500 hover:scale-125 transition-transform mt-1.5 shrink-0"
                              />
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Footer */}
                  <div className="p-2.5 bg-gray-900/80 border-t border-gray-800 text-center font-mono text-[11px]">
                    <Link
                      href="/notifications"
                      onClick={() => setShowNotifs(false)}
                      className="text-blue-400 hover:text-blue-300 hover:underline flex items-center justify-center gap-1 font-semibold"
                    >
                      View all notifications <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
              <Link
                href="/profile"
                className="flex items-center gap-2 hover:bg-gray-800/60 px-2 py-1 rounded-xl transition-colors"
                title="View & Edit Profile"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-7 h-7 rounded-full object-cover border border-indigo-500/40 shadow-sm"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs">
                    {user.username[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-gray-200 hidden lg:block">{user.username}</span>
              </Link>

              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="text-xs font-medium text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-800">
                Sign in
              </Link>
              <Link href="/register" className="text-xs font-medium text-white bg-gray-800 hover:bg-gray-700 px-3.5 py-2 rounded-xl border border-gray-700">
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Controls */}
        <div className="flex items-center gap-2 sm:hidden">
          {/* Mobile Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-gray-800 bg-gray-900 text-gray-300"
            title="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun size={16} className="text-amber-400" />
            ) : (
              <Moon size={16} className="text-indigo-600" />
            )}
          </button>

          <Link
            href="/repos?new=true"
            className="p-2 rounded-xl bg-blue-600 text-white text-xs"
            title="New Repo"
          >
            <Plus size={16} />
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-gray-300 hover:text-white bg-gray-900 border border-gray-800 rounded-xl"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-menu-drawer md:hidden border-t border-gray-800 bg-gray-950/95 backdrop-blur-md px-4 py-4 space-y-4 animate-fadeIn">
          {/* Mobile Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search (@user or owner/repo)..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </form>

          {/* Nav Links */}
          <div className="space-y-1 font-mono text-xs text-gray-300">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl hover:bg-gray-800/60"
            >
              Dashboard
            </Link>
            <Link
              href={user ? "/repos" : "/login"}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-800/60"
            >
              <Code size={15} /> Repositories
            </Link>
            <Link
              href="/docs"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-800/60"
            >
              <BookOpen size={15} /> Documentation
            </Link>
          </div>

          {/* User Account Section */}
          <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between font-mono text-xs">
            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 text-gray-200 hover:text-blue-400"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                  <span>@{user.username}</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-red-400 hover:text-red-300 px-2 py-1 bg-red-500/10 rounded-lg border border-red-500/20"
                >
                  <LogOut size={13} /> Logout
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 w-full">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2 rounded-xl bg-gray-900 text-gray-300 border border-gray-800"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center py-2 rounded-xl bg-blue-600 text-white font-semibold"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
