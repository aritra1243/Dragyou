'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Code, GitCommit, GitBranch, GitPullRequest, AlertCircle, Settings, FileText, Share2 } from 'lucide-react';
import { getCloneUrl } from '@/lib/api';

interface SidebarProps {
  owner: string;
  repo: string;
}

export default function Sidebar({ owner, repo }: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/repos/${owner}/${repo}`;

  const navItems = [
    { label: 'Code', href: basePath, icon: Code, exact: true },
    { label: 'Commits', href: `${basePath}/commits`, icon: GitCommit },
    { label: 'Branches', href: `${basePath}/branches`, icon: GitBranch },
    { label: 'Pull Requests', href: `${basePath}/pulls`, icon: GitPullRequest },
    { label: 'Issues', href: `${basePath}/issues`, icon: AlertCircle },
    { label: 'Settings', href: `${basePath}/settings`, icon: Settings },
  ];

  return (
    <div className="w-60 border-r border-gray-800 p-4 space-y-6 flex-shrink-0 hidden md:block">
      <div>
        <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500 font-semibold px-2">
          Repository
        </span>
        <div className="mt-2 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-blue-400' : 'text-gray-500'} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-800/60">
        <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500 font-semibold px-2">
          CLI Quick Commands
        </span>
        <div className="mt-2 space-y-2 text-[11px] font-mono bg-gray-900/90 p-3 rounded-xl border border-gray-800/80">
          <div className="text-gray-400"># Clone repo</div>
          <div className="text-blue-400 select-all overflow-x-auto whitespace-nowrap">
            nova clone {getCloneUrl(owner, repo)}
          </div>
        </div>
      </div>
    </div>
  );
}
