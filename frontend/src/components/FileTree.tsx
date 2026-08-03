'use client';

import React from 'react';
import Link from 'next/link';
import { Folder, FileText, ChevronRight } from 'lucide-react';
import { TreeItem } from '@/lib/api';

interface FileTreeProps {
  items: TreeItem[];
  owner: string;
  repo: string;
  refName: string;
  currentPath: string;
}

export default function FileTree({ items, owner, repo, refName, currentPath }: FileTreeProps) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 font-mono text-xs border border-gray-800 rounded-xl bg-gray-900/40">
        Directory is empty or no files committed yet.
      </div>
    );
  }

  // Sort directories first, then files alphabetically
  const sorted = [...items].sort((a, b) => {
    if (a.type === 'tree' && b.type !== 'tree') return -1;
    if (a.type !== 'tree' && b.type === 'tree') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden glass-card">
      <div className="bg-gray-900/80 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between text-xs text-gray-400 font-mono">
        <span>Name</span>
        <span>Mode / Size</span>
      </div>

      <div className="divide-y divide-gray-800/60">
        {sorted.map((item) => {
          const isDir = item.type === 'tree';
          const itemRelative = currentPath ? `${currentPath}/${item.name}` : item.name;
          const href = isDir
            ? `/repos/${owner}/${repo}?path=${encodeURIComponent(itemRelative)}`
            : `/repos/${owner}/${repo}?path=${encodeURIComponent(itemRelative)}&view=file`;

          return (
            <Link
              key={item.name}
              href={href}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/50 transition-colors group text-xs font-mono"
            >
              <div className="flex items-center gap-2.5">
                {isDir ? (
                  <Folder size={16} className="text-blue-400 group-hover:scale-110 transition-transform" />
                ) : (
                  <FileText size={16} className="text-gray-400" />
                )}
                <span className={isDir ? 'font-semibold text-gray-200 group-hover:text-blue-400' : 'text-gray-300 group-hover:text-white'}>
                  {item.name}
                </span>
              </div>

              <div className="flex items-center gap-4 text-gray-500 text-[11px]">
                <span>{item.mode}</span>
                {item.size !== undefined && !isDir && (
                  <span className="w-16 text-right">{item.size} B</span>
                )}
                <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-300" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
