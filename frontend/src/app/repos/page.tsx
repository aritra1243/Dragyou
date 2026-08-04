'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Code, Plus, Star, GitBranch, Search, Lock, Globe, X, FolderGit2, Terminal, Check, Copy, LogIn, UserPlus } from 'lucide-react';
import { api, Repository, User } from '@/lib/api';

function ReposContent() {
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false); // true once localStorage has been read
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Read auth state from localStorage ONCE on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('dragyou_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setCurrentUser(u);
      } catch (e) {}
    } else {
      setLoading(false);
    }
    setAuthChecked(true); // mark that we've finished reading localStorage
  }, []);

  useEffect(() => {
    if (currentUser) {
      setLoading(true);
      api.listRepos()
        .then((res) => setRepos(res.items || []))
        .catch(() => setRepos([]))
        .finally(() => setLoading(false));
    }
  }, [currentUser]);

  // Only handle ?new=true AFTER we've confirmed whether user is logged in
  useEffect(() => {
    if (!authChecked) return; // wait for localStorage read to complete
    if (searchParams.get('new') === 'true') {
      if (currentUser) {
        setShowModal(true);
      } else {
        window.location.href = '/login?redirect=/repos?new=true';
      }
    }
  }, [searchParams, currentUser, authChecked]);

  const loadRepos = () => {
    if (currentUser) {
      setLoading(true);
      api.listRepos()
        .then((res) => setRepos(res.items || []))
        .catch(() => setRepos([]))
        .finally(() => setLoading(false));
    }
  };

  const handleCreateClick = () => {
    if (!currentUser) {
      window.location.href = '/login';
    } else {
      setShowModal(true);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const newRepo = await api.createRepo({ name, description, visibility });
      setShowModal(false);
      setName('');
      setDescription('');
      loadRepos();
      window.location.href = `/repos/${newRepo.full_name}`;
    } catch (err: any) {
      setError(err.message || 'Failed to create repository. Please ensure you are signed in.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyClone = (repoFullName: string, id: number) => {
    navigator.clipboard.writeText(`nova clone http://localhost:8080/api/v1/repos/${repoFullName}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = repos.filter((r) => {
    const matchesSearch =
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase()));
    const matchesVis =
      filterVisibility === 'all' || r.visibility === filterVisibility;
    return matchesSearch && matchesVis;
  });

  // ── SIGNED OUT PROMPT CARD ────────────────────────────────────────────────
  if (!currentUser && !loading) {
    return (
      <div className="max-w-md mx-auto my-16 space-y-6 animate-fadeIn">
        <div className="glass-panel p-8 rounded-2xl border border-gray-800 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto">
            <Lock size={28} />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-gray-100">Sign in Required</h1>
            <p className="text-xs text-gray-400 font-mono leading-relaxed">
              Please sign in to your Dragyou account to access your repositories, branch histories, and source code.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-2 font-mono text-xs">
            <Link
              href="/login"
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
            >
              <LogIn size={15} /> Sign In
            </Link>

            <Link
              href="/register"
              className="w-full py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-200 font-medium flex items-center justify-center gap-2 border border-gray-800 transition-colors"
            >
              <UserPlus size={15} /> Register Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── SIGNED IN REPOSITORY DIRECTORY ───────────────────────────────────────
  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-800/80">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2 tracking-tight">
            <FolderGit2 className="text-blue-400" size={24} /> Repository Registry
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Manage repositories for <span className="text-blue-400">{currentUser?.username}</span>
          </p>
        </div>

        <button
          onClick={handleCreateClick}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
        >
          <Plus size={15} /> Create Repository
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories..."
            className="w-full bg-gray-950/80 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-gray-950/80 border border-gray-800 p-1 rounded-xl w-fit text-xs font-mono">
          {(['all', 'public', 'private'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterVisibility(tab)}
              className={`px-3 py-1 rounded-lg capitalize transition-colors ${
                filterVisibility === tab
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Repositories Directory */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 font-mono text-xs border border-gray-800/80 rounded-2xl glass-panel">
          Loading repositories for {currentUser?.username}...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-2xl space-y-3 border border-gray-800/80">
          <FolderGit2 className="mx-auto text-gray-600" size={32} />
          <p className="text-gray-300 text-sm font-semibold">No repositories found</p>
          <p className="text-gray-500 text-xs font-mono">Create your first repository using the button above or push via nova CLI.</p>
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors mt-2"
          >
            <Plus size={14} /> Create Repository
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((repo) => (
            <div
              key={repo.id}
              className="glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4 border border-gray-800/80 hover:border-blue-500/40 transition-all group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/repos/${repo.full_name}`}
                    className="font-bold text-sm text-gray-100 group-hover:text-blue-400 transition-colors font-mono flex items-center gap-2"
                  >
                    {repo.visibility === 'private' ? (
                      <Lock size={13} className="text-amber-400" />
                    ) : (
                      <Globe size={13} className="text-emerald-400" />
                    )}
                    <span>{repo.full_name}</span>
                  </Link>

                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${
                    repo.visibility === 'public'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-gray-800 text-gray-400 border-gray-700'
                  }`}>
                    {repo.visibility}
                  </span>
                </div>

                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                  {repo.description || 'No description provided.'}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-gray-500 pt-3 border-t border-gray-800/60">
                <span className="flex items-center gap-1.5 text-gray-300">
                  <GitBranch size={13} className="text-blue-400" /> {repo.default_branch || 'main'}
                </span>

                <button
                  onClick={() => copyClone(repo.full_name, repo.id)}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-800 transition-colors"
                >
                  <Terminal size={11} className="text-blue-400" />
                  <span>{copiedId === repo.id ? 'Copied' : 'Clone'}</span>
                  {copiedId === repo.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Repository Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-gray-800 p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-gray-100 font-mono flex items-center gap-2">
                <Plus className="text-blue-400" size={16} /> Create Repository
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-200 p-1 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-gray-300 font-medium mb-1">Repository Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. backend-service"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1.5">Visibility</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVisibility('private')}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 text-left transition-all ${
                      visibility === 'private'
                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                        : 'border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <Lock size={15} />
                    <div>
                      <div className="font-bold text-gray-200">Private</div>
                      <div className="text-[10px] text-gray-500">Restricted access</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisibility('public')}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 text-left transition-all ${
                      visibility === 'public'
                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                        : 'border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <Globe size={15} />
                    <div>
                      <div className="font-bold text-gray-200">Public</div>
                      <div className="text-[10px] text-gray-500">Public read access</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 rounded-xl text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Creating...' : 'Create Repository'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReposPage() {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs text-gray-500">Loading directory...</div>}>
      <ReposContent />
    </Suspense>
  );
}
