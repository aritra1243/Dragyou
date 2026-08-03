'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { api, PullRequest } from '@/lib/api';
import { GitPullRequest, Plus, User, CheckCircle2, Clock } from 'lucide-react';

interface Props {
  params: { owner: string; repo: string };
}

export default function PullsPage({ params }: Props) {
  const { owner, repo } = params;
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listPullRequests(owner, repo)
      .then((data) => setPrs(data.pull_requests || []))
      .catch(() => setPrs([]))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  return (
    <div className="flex gap-6 min-h-[calc(100vh-140px)]">
      <Sidebar owner={owner} repo={repo} />

      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <GitPullRequest className="text-purple-400" size={22} /> Pull Requests
          </h1>

          <button className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-purple-600/20">
            <Plus size={14} /> New Pull Request
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 font-mono text-xs border border-gray-800 rounded-xl">
            Loading pull requests...
          </div>
        ) : prs.length === 0 ? (
          <div className="p-10 text-center glass-panel rounded-2xl border border-gray-800 space-y-2">
            <GitPullRequest className="mx-auto text-gray-600" size={32} />
            <p className="text-gray-300 font-semibold text-sm">No pull requests found</p>
            <p className="text-gray-500 text-xs font-mono">Create a pull request to merge changes from one branch into another.</p>
          </div>
        ) : (
          <div className="border border-gray-800 rounded-xl overflow-hidden glass-card">
            <div className="divide-y divide-gray-800/60">
              {prs.map((pr) => (
                <div key={pr.id} className="p-4 hover:bg-gray-800/40 transition-colors flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-100 hover:text-purple-400 cursor-pointer">
                        {pr.title}
                      </span>
                      <span className="text-xs font-mono text-gray-500">#{pr.id}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
                      <span>{pr.source_branch} → {pr.target_branch}</span>
                      <span>•</span>
                      <span>opened by {pr.author?.username || 'user'}</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                    {pr.state}
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
