'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import CommitGraph from '@/components/CommitGraph';
import { api, Commit } from '@/lib/api';
import { GitCommit } from 'lucide-react';

interface Props {
  params: { owner: string; repo: string };
}

export default function CommitsPage({ params }: Props) {
  const { owner, repo } = params;
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCommits(owner, repo, 50)
      .then((data) => setCommits(data.commits || []))
      .catch(() => setCommits([]))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-140px)]">
      <Sidebar owner={owner} repo={repo} />

      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <GitCommit className="text-blue-400" size={22} /> Commit History
          </h1>
          <span className="text-xs font-mono text-gray-400">
            {owner}/{repo}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 font-mono text-xs border border-gray-800 rounded-xl">
            Loading commits...
          </div>
        ) : (
          <CommitGraph commits={commits} />
        )}
      </div>
    </div>
  );
}
