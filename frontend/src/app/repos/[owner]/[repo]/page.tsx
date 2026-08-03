'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Code, GitCommit, GitBranch, GitPullRequest, AlertCircle, Settings,
  Folder, FileText, ChevronRight, Copy, Check, Terminal, Hash,
  Clock, User, Layers, RefreshCw, ArrowLeft, Eye, Download, Star,
  GitFork, Shield, Cpu, Package, FileCode
} from 'lucide-react';
import { api, Repository, TreeItem, Branch, Commit } from '@/lib/api';

interface Props {
  params: { owner: string; repo: string };
}

// ── File type icon/color helper ───────────────────────────────────────────
function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, { icon: React.ReactNode; color: string }> = {
    py:   { icon: <FileCode size={15} />, color: 'text-yellow-400' },
    cpp:  { icon: <Cpu size={15} />,      color: 'text-blue-400' },
    c:    { icon: <Cpu size={15} />,      color: 'text-blue-300' },
    h:    { icon: <FileCode size={15} />, color: 'text-cyan-400' },
    go:   { icon: <Package size={15} />,  color: 'text-teal-400' },
    ts:   { icon: <FileCode size={15} />, color: 'text-blue-500' },
    tsx:  { icon: <FileCode size={15} />, color: 'text-indigo-400' },
    js:   { icon: <FileCode size={15} />, color: 'text-yellow-300' },
    md:   { icon: <FileText size={15} />, color: 'text-gray-300' },
    json: { icon: <Layers size={15} />,   color: 'text-orange-400' },
    rs:   { icon: <Shield size={15} />,   color: 'text-orange-600' },
  };
  return map[ext || ''] || { icon: <FileText size={15} />, color: 'text-gray-400' };
}

function shortHash(h: string) { return h?.slice(0, 8) || ''; }

function relativeTime(ts: number) {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Sidebar ───────────────────────────────────────────────────────────────
function Sidebar({ owner, repo }: { owner: string; repo: string }) {
  const basePath = `/repos/${owner}/${repo}`;
  const navItems = [
    { label: 'Code',          href: basePath,            icon: Code,           exact: true },
    { label: 'Commits',       href: `${basePath}/commits`, icon: GitCommit },
    { label: 'Branches',      href: `${basePath}/branches`, icon: GitBranch },
    { label: 'Pull Requests', href: `${basePath}/pulls`,  icon: GitPullRequest },
    { label: 'Issues',        href: `${basePath}/issues`, icon: AlertCircle },
    { label: 'Settings',      href: `${basePath}/settings`, icon: Settings },
  ];
  // Simple active detection on client
  const [path, setPath] = useState('');
  useEffect(() => { setPath(window.location.pathname); }, []);

  return (
    <aside className="w-56 flex-shrink-0 hidden md:flex flex-col gap-6">
      {/* Nav */}
      <nav className="space-y-0.5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 px-2 pb-2">Repository</p>
        {navItems.map(({ label, href, icon: Icon, exact }) => {
          const active = exact ? path === href : path.startsWith(href);
          return (
            <Link key={label} href={href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                active
                  ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/10 text-blue-400 border border-blue-500/20 shadow-sm shadow-blue-500/10'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
              }`}>
              <Icon size={15} className={active ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Clone box */}
      <div className="rounded-xl border border-gray-800/80 bg-gray-950/60 p-3 space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Clone</p>
        <code className="block text-[10px] font-mono text-blue-400 break-all leading-relaxed select-all">
          nova clone http://localhost:8080/api/v1/repos/{owner}/{repo}
        </code>
      </div>
    </aside>
  );
}

// ── Main Content ──────────────────────────────────────────────────────────
function RepoDetailContent({ owner, repo }: { owner: string; repo: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentPath = searchParams.get('path') || '';
  const viewMode   = searchParams.get('view') || 'tree';

  const [repository, setRepository]   = useState<Repository | null>(null);
  const [treeItems, setTreeItems]     = useState<TreeItem[]>([]);
  const [blobContent, setBlobContent] = useState<string>('');
  const [branches, setBranches]       = useState<Branch[]>([]);
  const [commits, setCommits]         = useState<Commit[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [loading, setLoading]         = useState(true);
  const [blobLoading, setBlobLoading] = useState(false);
  const [copied, setCopied]           = useState(false);
  const [activeTab, setActiveTab]     = useState<'files'|'commits'>('files');
  const [error, setError]             = useState('');

  // Load repo metadata + branches + commits
  useEffect(() => {
    Promise.all([
      api.getRepo(owner, repo),
      api.getBranches(owner, repo),
      api.getCommits(owner, repo, 20),
    ]).then(([repoData, branchData, commitData]) => {
      setRepository(repoData);
      setSelectedBranch(repoData.default_branch || 'main');
      setBranches(branchData.branches || []);
      setCommits(commitData.commits || []);
    }).catch(() => setError('Failed to load repository'));
  }, [owner, repo]);

  // Load tree
  const loadTree = useCallback(() => {
    setLoading(true);
    setError('');
    api.getTree(owner, repo, selectedBranch, currentPath)
      .then(data => setTreeItems(data.items || []))
      .catch(() => { setTreeItems([]); setError('Could not load file tree'); })
      .finally(() => setLoading(false));
  }, [owner, repo, selectedBranch, currentPath]);

  useEffect(() => {
    if (viewMode === 'file' && currentPath) {
      setBlobLoading(true);
      api.getBlob(owner, repo, selectedBranch, currentPath)
        .then(setBlobContent)
        .catch(() => setBlobContent('// Error loading file'))
        .finally(() => setBlobLoading(false));
    } else {
      loadTree();
    }
  }, [owner, repo, selectedBranch, currentPath, viewMode, loadTree]);

  const copyClone = () => {
    navigator.clipboard.writeText(`nova clone http://localhost:8080/api/v1/repos/${owner}/${repo}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pathParts = currentPath.split('/').filter(Boolean);
  const latestCommit = commits[0];

  // Sort: dirs first then alpha
  const sortedTree = [...treeItems].sort((a, b) => {
    if (a.type === 'tree' && b.type !== 'tree') return -1;
    if (a.type !== 'tree' && b.type === 'tree') return  1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)]">
      <Sidebar owner={owner} repo={repo} />

      <div className="flex-1 min-w-0 space-y-4">

        {/* ── Hero header ─────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 via-gray-900 to-blue-950/20 p-5">
          {/* Glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-400 font-mono text-sm">{owner}</span>
                <span className="text-gray-600">/</span>
                <span className="text-white font-bold font-mono text-lg">{repo}</span>
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                  repository?.visibility === 'public'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-gray-700/40 text-gray-400 border-gray-700'
                }`}>
                  {repository?.visibility || '…'}
                </span>
              </div>
              {repository?.description && (
                <p className="text-gray-400 text-xs">{repository.description}</p>
              )}
              <div className="flex items-center gap-4 pt-1 text-xs text-gray-500 font-mono">
                <span className="flex items-center gap-1"><Star size={11} className="text-yellow-500" /> {repository?.star_count ?? 0} stars</span>
                <span className="flex items-center gap-1"><GitFork size={11} className="text-blue-400" /> {repository?.fork_count ?? 0} forks</span>
                <span className="flex items-center gap-1"><GitCommit size={11} className="text-purple-400" /> {commits.length} commits</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Branch selector */}
              <div className="relative">
                <GitBranch size={12} className="absolute left-2.5 top-2.5 text-blue-400 pointer-events-none z-10" />
                <select
                  value={selectedBranch}
                  onChange={e => setSelectedBranch(e.target.value)}
                  className="bg-gray-900 border border-gray-700 text-gray-200 rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                >
                  {branches.length > 0 ? branches.map(b => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  )) : <option value="main">main</option>}
                </select>
              </div>

              {/* Clone button */}
              <button onClick={copyClone}
                className="flex items-center gap-1.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-mono px-3 py-1.5 rounded-lg transition-all active:scale-95">
                <Terminal size={13} />
                nova clone
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} className="text-gray-400" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 font-mono">
            ⚠ {error}
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────── */}
        {viewMode !== 'file' && (
          <div className="flex gap-1 bg-gray-900/60 border border-gray-800 rounded-xl p-1 w-fit">
            {(['files', 'commits'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-gray-400 hover:text-gray-200'
                }`}>
                {tab === 'files' ? `Files${treeItems.length ? ` (${treeItems.length})` : ''}` : `Commits${commits.length ? ` (${commits.length})` : ''}`}
              </button>
            ))}
          </div>
        )}

        {/* ── FILE VIEW ───────────────────────────────────────── */}
        {viewMode === 'file' ? (
          <div className="space-y-3">
            {/* Back bar */}
            <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
              <button onClick={() => router.back()} className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
                <ArrowLeft size={13} /> Back
              </button>
              <span className="text-gray-700">/</span>
              {pathParts.map((p, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-gray-700">/</span>}
                  <span className={i === pathParts.length - 1 ? 'text-gray-100' : 'text-gray-400'}>{p}</span>
                </React.Fragment>
              ))}
            </div>

            {/* Code viewer */}
            <div className="rounded-2xl border border-gray-800 overflow-hidden">
              {/* toolbar */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/90 border-b border-gray-800">
                <div className="flex items-center gap-2 text-xs font-mono">
                  {(() => { const fi = fileIcon(pathParts.at(-1) || ''); return <span className={fi.color}>{fi.icon}</span>; })()}
                  <span className="text-gray-100 font-semibold">{pathParts.at(-1)}</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400">{blobContent.split('\n').length} lines</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400">{new Blob([blobContent]).size} B</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => navigator.clipboard.writeText(blobContent)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors">
                    <Copy size={12} /> Copy
                  </button>
                </div>
              </div>

              {blobLoading ? (
                <div className="h-48 flex items-center justify-center text-gray-500 text-xs font-mono bg-gray-950 animate-pulse">
                  Loading file…
                </div>
              ) : (
                <div className="overflow-x-auto bg-gray-950 max-h-[70vh] overflow-y-auto">
                  <table className="w-full border-collapse text-xs font-mono">
                    <tbody>
                      {blobContent.split('\n').map((line, i) => (
                        <tr key={i} className="hover:bg-blue-500/5 group">
                          <td className="w-12 select-none text-right px-4 py-0.5 text-gray-600 text-[11px] group-hover:text-gray-400 border-r border-gray-800/50">
                            {i + 1}
                          </td>
                          <td className="pl-4 pr-6 py-0.5 whitespace-pre text-gray-300 leading-6">
                            {line || '\u00a0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        /* ── FILES TAB ────────────────────────────────────────── */
        ) : activeTab === 'files' ? (
          <div className="space-y-3">
            {/* Latest commit bar */}
            {latestCommit && (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-800 bg-gray-900/60 text-xs font-mono">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-[10px] flex-shrink-0">
                    {(latestCommit.author?.[0] || 'A').toUpperCase()}
                  </div>
                  <span className="text-gray-300 truncate">{latestCommit.message}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 pl-4 text-gray-500">
                  <span className="hidden sm:flex items-center gap-1 text-gray-400">
                    <User size={11} /> {latestCommit.author}
                  </span>
                  <span className="flex items-center gap-1 bg-gray-800 px-2 py-0.5 rounded-md border border-gray-700 text-blue-400">
                    <Hash size={10} /> {shortHash(latestCommit.hash)}
                  </span>
                  <span className="flex items-center gap-1 text-gray-500">
                    <Clock size={11} /> {relativeTime(latestCommit.timestamp)}
                  </span>
                </div>
              </div>
            )}

            {/* Breadcrumb */}
            {pathParts.length > 0 && (
              <div className="flex items-center gap-1 text-xs font-mono text-gray-400 px-1">
                <Link href={`/repos/${owner}/${repo}`} className="hover:text-blue-400 flex items-center gap-1">
                  <Folder size={12} /> root
                </Link>
                {pathParts.map((part, idx) => {
                  const sub = pathParts.slice(0, idx + 1).join('/');
                  return (
                    <React.Fragment key={sub}>
                      <ChevronRight size={12} className="text-gray-600" />
                      <Link href={`/repos/${owner}/${repo}?path=${encodeURIComponent(sub)}`} className="hover:text-blue-400">
                        {part}
                      </Link>
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* File tree */}
            <div className="rounded-2xl border border-gray-800 overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-gray-900/80 border-b border-gray-800 text-[10px] font-mono uppercase tracking-wider text-gray-500">
                <span>Name</span>
                <span>Size</span>
                <span className="hidden sm:block">Mode</span>
              </div>

              {loading ? (
                <div className="p-12 text-center text-gray-500 text-xs font-mono animate-pulse bg-gray-950/40">
                  <RefreshCw size={20} className="mx-auto mb-3 animate-spin text-blue-500" />
                  Loading file tree…
                </div>
              ) : sortedTree.length === 0 ? (
                <div className="p-12 text-center bg-gray-950/40">
                  <Folder size={32} className="mx-auto mb-3 text-gray-700" />
                  <p className="text-gray-400 text-sm font-semibold">Directory is empty</p>
                  <p className="text-gray-600 text-xs mt-1 font-mono">Push files using: <span className="text-blue-400">nova push origin main</span></p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800/60 bg-gray-950/20">
                  {/* Up-dir entry */}
                  {pathParts.length > 0 && (
                    <Link href={`/repos/${owner}/${repo}${pathParts.length > 1 ? `?path=${encodeURIComponent(pathParts.slice(0, -1).join('/'))}` : ''}`}
                      className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 items-center hover:bg-blue-500/5 transition-colors text-xs font-mono text-gray-500 hover:text-gray-300 group">
                      <span className="flex items-center gap-2.5">
                        <Folder size={15} className="text-gray-600" /> ..
                      </span>
                      <span />
                      <span className="hidden sm:block" />
                    </Link>
                  )}

                  {sortedTree.map(item => {
                    const isDir = item.type === 'tree';
                    const rel   = currentPath ? `${currentPath}/${item.name}` : item.name;
                    const href  = isDir
                      ? `/repos/${owner}/${repo}?path=${encodeURIComponent(rel)}`
                      : `/repos/${owner}/${repo}?path=${encodeURIComponent(rel)}&view=file`;
                    const fi    = fileIcon(item.name);

                    return (
                      <Link key={item.name} href={href}
                        className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 items-center hover:bg-blue-500/5 transition-colors group">
                        {/* Name */}
                        <div className="flex items-center gap-2.5 min-w-0 text-xs font-mono">
                          {isDir
                            ? <Folder size={15} className="text-blue-400 group-hover:text-blue-300 flex-shrink-0" />
                            : <span className={`${fi.color} flex-shrink-0`}>{fi.icon}</span>
                          }
                          <span className={`truncate ${isDir ? 'font-semibold text-gray-200 group-hover:text-blue-400' : 'text-gray-300 group-hover:text-white'} transition-colors`}>
                            {item.name}
                          </span>
                          {isDir && (
                            <span className="text-[9px] text-gray-600 font-mono bg-gray-800/60 px-1.5 rounded hidden sm:inline">dir</span>
                          )}
                        </div>

                        {/* Size */}
                        <span className="text-[11px] font-mono text-gray-500 whitespace-nowrap">
                          {!isDir && item.size !== undefined ? (
                            item.size < 1024
                              ? `${item.size} B`
                              : `${(item.size / 1024).toFixed(1)} KB`
                          ) : '—'}
                        </span>

                        {/* Mode */}
                        <span className="hidden sm:block text-[10px] font-mono text-gray-600">{item.mode}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        /* ── COMMITS TAB ──────────────────────────────────────── */
        ) : (
          <div className="space-y-2">
            {commits.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-gray-800 bg-gray-950/40">
                <GitCommit size={32} className="mx-auto mb-3 text-gray-700" />
                <p className="text-gray-400 text-sm font-semibold">No commits yet</p>
                <p className="text-gray-600 text-xs mt-1 font-mono">nova commit -m "your message"</p>
              </div>
            ) : commits.map((commit, idx) => (
              <div key={commit.hash}
                className="flex items-start gap-4 p-4 rounded-xl border border-gray-800 bg-gray-900/40 hover:bg-gray-900/70 hover:border-gray-700 transition-all group">

                {/* Timeline dot */}
                <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                  <div className={`w-2.5 h-2.5 rounded-full ring-2 ring-offset-2 ring-offset-[#0b0f19] ${
                    idx === 0 ? 'bg-blue-400 ring-blue-500/40' : 'bg-gray-600 ring-gray-700/40'
                  }`} />
                  {idx < commits.length - 1 && <div className="w-px flex-1 bg-gray-800 mt-1 min-h-[24px]" />}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm text-gray-100 font-medium leading-snug group-hover:text-white transition-colors truncate">
                    {commit.message}
                  </p>
                  <div className="flex items-center gap-3 text-xs font-mono text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1 text-gray-400">
                      <User size={11} /> {commit.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {relativeTime(commit.timestamp)}
                    </span>
                    {commit.parents?.length === 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">root</span>
                    )}
                    {commit.parents?.length > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">merge</span>
                    )}
                  </div>
                </div>

                {/* Hash badge */}
                <div className="flex-shrink-0 flex items-center gap-1.5 bg-gray-800/80 border border-gray-700 rounded-lg px-2.5 py-1 font-mono text-[11px] text-blue-400 hover:text-blue-300 hover:border-blue-500/40 transition-colors cursor-pointer"
                  onClick={() => navigator.clipboard.writeText(commit.hash)}>
                  <Hash size={10} />
                  {shortHash(commit.hash)}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

export default function RepoDetailPage({ params }: Props) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64 text-gray-500 text-xs font-mono">
        <RefreshCw size={16} className="animate-spin mr-2 text-blue-500" /> Loading repository…
      </div>
    }>
      <RepoDetailContent owner={params.owner} repo={params.repo} />
    </Suspense>
  );
}
