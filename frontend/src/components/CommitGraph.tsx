'use client';

import React from 'react';
import { GitCommit, User, Calendar, Tag } from 'lucide-react';
import { Commit } from '@/lib/api';

interface CommitGraphProps {
  commits: Commit[];
}

export default function CommitGraph({ commits }: CommitGraphProps) {
  if (!commits || commits.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 font-mono text-xs border border-gray-800 rounded-xl bg-gray-900/40">
        No commits found in this repository yet.
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Just now';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <div className="border border-gray-800 rounded-xl overflow-hidden glass-card">
        <div className="bg-gray-900/80 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between text-xs text-gray-400 font-mono">
          <span>Commit History ({commits.length})</span>
          <span>SHA-256</span>
        </div>

        <div className="divide-y divide-gray-800/60">
          {commits.map((commit, index) => (
            <div key={commit.hash || index} className="p-4 hover:bg-gray-800/40 transition-colors">
              <div className="flex items-start justify-between gap-4">
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mt-0.5 flex-shrink-0">
                    <GitCommit size={16} />
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-100 font-mono hover:text-blue-400 transition-colors">
                      {commit.message}
                    </h4>

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1 font-medium text-gray-300">
                        <User size={13} className="text-gray-500" />
                        {commit.author}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono text-[11px] text-gray-400">
                        <Calendar size={13} className="text-gray-500" />
                        {formatDate(commit.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs bg-gray-900 px-2.5 py-1 rounded-lg border border-gray-800 text-blue-400 font-medium">
                    {commit.hash?.substring(0, 8) || 'head'}
                  </span>
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
