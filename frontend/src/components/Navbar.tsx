'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Plus, User as UserIcon, LogOut, Code, BookOpen, Menu, X, Sun, Moon } from 'lucide-react';
import { User } from '@/lib/api';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const loadUser = () => {
      const savedUser = localStorage.getItem('dragyou_user');
      if (savedUser) {
        try { setUser(JSON.parse(savedUser)); } catch (e) {}
      }
    };
    loadUser();
    window.addEventListener('storage', loadUser);

    // Initialize Theme
    const savedTheme = (localStorage.getItem('dragyou_theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }

    return () => window.removeEventListener('storage', loadUser);
  }, []);

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
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              D
            </div>
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
