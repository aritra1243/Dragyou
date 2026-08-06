'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { UserPlus, User as UserIcon, Mail, Lock, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.register({
        username,
        email,
        password,
        display_name: displayName,
      });
      localStorage.setItem('dragyou_token', res.access_token);
      localStorage.setItem('dragyou_user', JSON.stringify(res.user));
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Registration failed. Try a different username or email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-10 space-y-6">
      <div className="text-center space-y-2">
        <img
          src="/logo.png"
          alt="Dragyou Logo"
          className="w-12 h-12 rounded-2xl object-cover border border-indigo-500/30 mx-auto shadow-lg shadow-indigo-500/20 glow-purple"
        />
        <h1 className="text-2xl font-bold text-gray-100">Create Dragyou Account</h1>
        <p className="text-xs text-gray-400 font-mono">Join the enterprise version control platform</p>
      </div>

      <div className="glass-panel p-8 rounded-2xl border border-gray-800 space-y-6 shadow-2xl">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-gray-300 font-semibold mb-1">Username *</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="alice"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Email Address *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alice@example.com"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Display Name (optional)</label>
            <div className="relative">
              <Sparkles className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alice Smith"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 font-semibold mb-1">Password *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all text-xs font-sans mt-2 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Complete Registration'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-gray-400 font-mono">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-400 hover:underline font-semibold">
          Sign in here
        </Link>
      </p>
    </div>
  );
}
