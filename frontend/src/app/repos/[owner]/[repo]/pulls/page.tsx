'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { api, PullRequest, Branch } from '@/lib/api';
import { GitPullRequest, Plus, CheckCircle2, XCircle, Clock, X, GitMerge } from 'lucide-react';

interface Props {
  params: { owner: string; repo: string };
}

export default function PullsPage({ params }: Props) {
  const { owner, repo } = params;
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState<'open' | 'merged' | 'closed'>('open');

  // New PR Modal state
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sourceBranch, setSourceBranch] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Action state
  const [actionId, setActionId] = useState<number | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.listPullRequests(owner, repo, stateFilter),
      api.getBranches(owner, repo),
    ])
      .then(([prData, branchData]) => {
        setPrs(prData.pull_requests || []);
        const bList = branchData.branches || [];
        setBranches(bList);
        if (bList.length > 0 && !sourceBranch) {
          setSourceBranch(bList[0].name);
        }
        if (branchData.default_branch) {
          setTargetBranch(branchData.default_branch);
        }
      })
      .catch(() => setPrs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [owner, repo, stateFilter]);

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !sourceBranch || !targetBranch) return;

    setCreating(true);
    setError('');

    try {
      await api.createPullRequest(owner, repo, {
        title: title.trim(),
        body: body.trim(),
        source_branch: sourceBranch,
        target_branch: targetBranch,
      });
      setTitle('');
      setBody('');
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create Pull Request');
    } finally {
      setCreating(false);
    }
  };

  const handleMergePR = async (id: number) => {
    if (!confirm(`Merge Pull Request #${id}? This will update ${targetBranch} branch.`)) return;

    setActionId(id);
    try {
      await api.mergePullRequest(owner, repo, id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to merge Pull Request');
    } finally {
      setActionId(null);
    }
  };

  const handleClosePR = async (id: number) => {
    if (!confirm(`Close Pull Request #${id}?`)) return;

    setActionId(id);
    try {
      await api.closePullRequest(owner, repo, id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to close Pull Request');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-140px)]">
      <Sidebar owner={owner} repo={repo} />

      <div className="flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <GitPullRequest className="text-purple-400" size={22} /> Pull Requests
          </h1>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-purple-600/20"
          >
            <Plus size={14} /> New Pull Request
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          {(['open', 'merged', 'closed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStateFilter(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono capitalize transition-all border ${
                stateFilter === tab
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 font-bold'
                  : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Create PR Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                  <GitPullRequest size={16} className="text-purple-400" /> New Pull Request
                </h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-200">
                  <X size={16} />
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreatePR} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-1">PR Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Add user authentication & profile search"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-gray-400 mb-1">Source Branch (Compare)</label>
                    <select
                      value={sourceBranch}
                      onChange={(e) => setSourceBranch(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-purple-500"
                    >
                      {branches.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-gray-400 mb-1">Target Branch (Base)</label>
                    <select
                      value={targetBranch}
                      onChange={(e) => setTargetBranch(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-purple-500"
                    >
                      {branches.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-1">Description (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Describe what changes are included in this PR..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-purple-500"
                  />
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
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Pull Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PR List */}
        {loading ? (
          <div className="p-8 text-center text-gray-500 font-mono text-xs border border-gray-800 rounded-xl">
            Loading pull requests...
          </div>
        ) : prs.length === 0 ? (
          <div className="p-10 text-center glass-panel rounded-2xl border border-gray-800 space-y-2">
            <GitPullRequest className="mx-auto text-gray-600" size={32} />
            <p className="text-gray-300 font-semibold text-sm">No {stateFilter} pull requests found</p>
            <p className="text-gray-500 text-xs font-mono">Create a pull request to review and merge branch contributions.</p>
          </div>
        ) : (
          <div className="border border-gray-800 rounded-xl overflow-hidden glass-card">
            <div className="divide-y divide-gray-800/60">
              {prs.map((pr) => (
                <div key={pr.id} className="p-5 hover:bg-gray-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-100 hover:text-purple-400 cursor-pointer">
                        {pr.title}
                      </span>
                      <span className="text-xs font-mono text-gray-500">#{pr.id}</span>
                    </div>

                    {pr.body && (
                      <p className="text-xs text-gray-400 font-sans line-clamp-1">{pr.body}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-mono">
                      <span className="bg-gray-900 px-2 py-0.5 rounded border border-gray-800 text-purple-400">
                        {pr.source_branch} → {pr.target_branch}
                      </span>
                      <span>•</span>
                      <span>opened by @{pr.author?.username || 'user'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* PR State Badge */}
                    <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full font-semibold border ${
                      pr.state === 'open'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : pr.state === 'merged'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {pr.state}
                    </span>

                    {/* Merge / Close actions for Open PRs */}
                    {pr.state === 'open' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMergePR(pr.id)}
                          disabled={actionId === pr.id}
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 shadow-md shadow-emerald-600/20"
                        >
                          <GitMerge size={13} />
                          {actionId === pr.id ? 'Merging...' : 'Merge PR'}
                        </button>

                        <button
                          onClick={() => handleClosePR(pr.id)}
                          disabled={actionId === pr.id}
                          className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-red-400 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50"
                          title="Close PR without merging"
                        >
                          <XCircle size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
