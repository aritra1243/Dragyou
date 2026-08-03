'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { api } from '@/lib/api';
import { Settings, Trash2, Shield, Key } from 'lucide-react';

interface Props {
  params: { owner: string; repo: string };
}

export default function SettingsPage({ params }: Props) {
  const { owner, repo } = params;
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete ${owner}/${repo}? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await api.deleteRepo(owner, repo);
      window.location.href = '/repos';
    } catch (err: any) {
      setError(err.message || 'Failed to delete repository');
      setDeleting(false);
    }
  };

  return (
    <div className="flex gap-6 min-h-[calc(100vh-140px)]">
      <Sidebar owner={owner} repo={repo} />

      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Settings className="text-gray-400" size={22} /> Repository Settings
          </h1>
          <span className="text-xs font-mono text-gray-400">{owner}/{repo}</span>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Danger Zone */}
        <div className="border border-red-500/30 rounded-2xl overflow-hidden glass-panel bg-red-950/10">
          <div className="bg-red-500/10 px-5 py-3 border-b border-red-500/20 text-xs font-mono text-red-400 font-bold flex items-center gap-2">
            <Shield size={16} /> Danger Zone
          </div>

          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-gray-100">Delete this repository</h3>
              <p className="text-xs text-gray-400 mt-1">
                Once deleted, all commits, trees, blobs, branches, pull requests, and issues will be permanently removed.
              </p>
            </div>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 flex-shrink-0"
            >
              <Trash2 size={16} />
              {deleting ? 'Deleting...' : 'Delete Repository'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
