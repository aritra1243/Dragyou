'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { api, Branch } from '@/lib/api';
import { GitBranch, Star, Check } from 'lucide-react';

interface Props {
  params: { owner: string; repo: string };
}

export default function BranchesPage({ params }: Props) {
  const { owner, repo } = params;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBranches(owner, repo)
      .then((data) => {
        setBranches(data.branches || []);
        if (data.default_branch) setDefaultBranch(data.default_branch);
      })
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  return (
    <div className="flex gap-6 min-h-[calc(100vh-140px)]">
      <Sidebar owner={owner} repo={repo} />

      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <GitBranch className="text-blue-400" size={22} /> Branches
          </h1>
          <span className="text-xs font-mono text-gray-400">
            {branches.length} branch(es)
          </span>
        </div>

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
