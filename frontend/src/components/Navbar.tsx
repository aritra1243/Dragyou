'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Plus, Terminal, Github, User as UserIcon, LogOut, Code, GitBranch, BookOpen } from 'lucide-react';
import { User } from '@/lib/api';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const loadUser = () => {
      const savedUser = localStorage.getItem('dragyou_user');
      if (savedUser) {
        try { setUser(JSON.parse(savedUser)); } catch (e) {}
      }
    };
    loadUser();
    window.addEventListener('storage', loadUser);
    return () => window.removeEventListener('storage', loadUser);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('dragyou_token');
    localStorage.removeItem('dragyou_user');
    setUser(null);
    window.location.href = '/';
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              D
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-gray-100 tracking-tight flex items-center gap-1.5">
                Dragyou
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">VCS</span>
              </span>
              <span className="text-[10px] text-gray-400 -mt-1 font-mono">C++20 Engine</span>
            </div>
          </Link>

          {/* Nav links */}
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

        {/* Global Search Bar */}
        <div className="flex-1 max-w-md mx-6 hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search code, repositories, commits... (nova search)"
              className="w-full bg-gray-900/80 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            <kbd className="absolute right-3 top-2.5 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-800 rounded border border-gray-700">
              Ctrl K
            </kbd>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Link
            href="/repos?new=true"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-95"
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
                <span className="text-xs font-medium text-gray-200 hidden md:block">{user.username}</span>
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

      </div>
    </header>
  );
}
