'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { api, Issue } from '@/lib/api';
import { AlertCircle, Plus, User } from 'lucide-react';

interface Props {
  params: { owner: string; repo: string };
}

export default function IssuesPage({ params }: Props) {
  const { owner, repo } = params;
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listIssues(owner, repo)
      .then((data) => setIssues(data.issues || []))
      .catch(() => setIssues([]))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  return (
    <div className="flex gap-6 min-h-[calc(100vh-140px)]">
      <Sidebar owner={owner} repo={repo} />

      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <AlertCircle className="text-green-400" size={22} /> Issues
          </h1>

          <button className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-md shadow-green-600/20">
            <Plus size={14} /> New Issue
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 font-mono text-xs border border-gray-800 rounded-xl">
            Loading issues...
          </div>
        ) : issues.length === 0 ? (
          <div className="p-10 text-center glass-panel rounded-2xl border border-gray-800 space-y-2">
            <AlertCircle className="mx-auto text-gray-600" size={32} />
            <p className="text-gray-300 font-semibold text-sm">No issues found</p>
            <p className="text-gray-500 text-xs font-mono">Create an issue to track bugs, enhancements, and tasks.</p>
          </div>
        ) : (
          <div className="border border-gray-800 rounded-xl overflow-hidden glass-card">
            <div className="divide-y divide-gray-800/60">
              {issues.map((issue) => (
                <div key={issue.id} className="p-4 hover:bg-gray-800/40 transition-colors flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-100 hover:text-green-400 cursor-pointer">
                        {issue.title}
                      </span>
                      <span className="text-xs font-mono text-gray-500">#{issue.number}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
                      <span>opened by {issue.author?.username || 'user'}</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-semibold">
                    {issue.state}
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
