'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { api, Branch } from '@/lib/api';
import { GitBranch, Plus, X } from 'lucide-react';

interface Props {
  params: { owner: string; repo: string };
}

export default function BranchesPage({ params }: Props) {
  const { owner, repo } = params;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [loading, setLoading] = useState(true);

  // New branch modal state
  const [showModal, setShowModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const loadBranches = () => {
    setLoading(true);
    api.getBranches(owner, repo)
      .then((data) => {
        const list = data.branches || [];
        setBranches(list);
        if (data.default_branch) {
          setDefaultBranch(data.default_branch);
          setTargetBranch(data.default_branch);
        } else if (list.length > 0) {
          setTargetBranch(list[0].name);
        }
      })
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBranches();
  }, [owner, repo]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    setCreating(true);
    setError('');

    try {
      await api.createBranch(owner, repo, newBranchName.trim(), targetBranch);
      setNewBranchName('');
      setShowModal(false);
      loadBranches();
    } catch (err: any) {
      setError(err.message || 'Failed to create branch');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-140px)]">
      <Sidebar owner={owner} repo={repo} />

      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <GitBranch className="text-blue-400" size={22} /> Branches
          </h1>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-400">
              {branches.length} branch(es)
            </span>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-blue-600/20"
            >
              <Plus size={14} /> New Branch
            </button>
          </div>
        </div>

        {/* Create Branch Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                  <GitBranch size={16} className="text-blue-400" /> Create New Branch
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  <X size={16} />
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreateBranch} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. feature/auth, dev, fix-bug"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-1">
                    Source Branch
                  </label>
                  <select
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
                  >
                    {branches.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Branch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-gray-500 font-mono text-xs border border-gray-800 rounded-xl">
            Loading branches...
          </div>
        ) : branches.length === 0 ? (
          <div className="p-8 text-center text-gray-400 font-mono text-xs border border-gray-800 rounded-xl glass-card">
            No branches found in this repository.
          </div>
        ) : (
          <div className="border border-gray-800 rounded-xl overflow-hidden glass-card">
            <div className="bg-gray-900/80 px-4 py-2.5 border-b border-gray-800 text-xs font-mono text-gray-400 flex justify-between">
              <span>Branch Name</span>
              <span>Commit SHA</span>
            </div>

            <div className="divide-y divide-gray-800/60 font-mono text-xs">
              {branches.map((b) => (
                <div key={b.name} className="p-4 flex items-center justify-between hover:bg-gray-800/40 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <GitBranch size={16} className="text-blue-400" />
                    <span className="font-semibold text-gray-200">{b.name}</span>
                    {b.name === defaultBranch && (
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Default
                      </span>
                    )}
                  </div>

                  <span className="bg-gray-900 px-2.5 py-1 rounded-lg border border-gray-800 text-blue-400">
                    {b.hash?.substring(0, 8) || 'head'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
