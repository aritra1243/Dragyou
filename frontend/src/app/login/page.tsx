'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { User as UserIcon, Lock } from 'lucide-react';
import { api } from '@/lib/api';

function LoginContent() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect away — never show login to authenticated users
  useEffect(() => {
    const token = localStorage.getItem('dragyou_token');
    if (token) {
      const redirect = searchParams.get('redirect') || '/';
      window.location.href = redirect;
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.login({ username, password });
      localStorage.setItem('dragyou_token', res.access_token);
      localStorage.setItem('dragyou_user', JSON.stringify(res.user));
      const redirect = searchParams.get('redirect') || '/';
      window.location.href = redirect;
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto font-bold text-xl glow-blue">
          D
        </div>
        <h1 className="text-2xl font-bold text-gray-100">Sign in to Dragyou</h1>
        <p className="text-xs text-gray-400 font-mono">Access your repositories and collaborate</p>
      </div>

      <div className="glass-panel p-8 rounded-2xl border border-gray-800 space-y-6 shadow-2xl">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-gray-300 font-semibold mb-1">Username or Email</label>
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
            <label className="block text-gray-300 font-semibold mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all text-xs font-sans mt-2 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-gray-400 font-mono">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-blue-400 hover:underline font-semibold">
          Register here
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto my-12 text-center text-gray-400 text-sm">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
