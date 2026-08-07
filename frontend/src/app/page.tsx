'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Code, GitBranch, Terminal, Shield, Cpu, Layers, ArrowRight, Star,
  Plus, Check, Copy, Activity, Server, Zap, RefreshCw, FolderGit2,
  Clock, Hash, FileCode, User, Play, ChevronRight, ChevronLeft, Lock, Globe,
  CheckCircle2, Sparkles, Workflow, HardDrive, BarChart3
} from 'lucide-react';
import { api, Repository, User as UserType } from '@/lib/api';
import VerticalFeatureShowcase from '@/components/VerticalFeatureShowcase';

// Interactive Terminal Demo Component for Landing Page
function TerminalDemo() {
  const [activeTab, setActiveTab] = useState<'init' | 'commit' | 'push'>('push');
  const [copied, setCopied] = useState(false);

  const tabs = {
    init: {
      title: '1. Initialize & Authenticate',
      cmd: 'drag init\ndrag login http://localhost:8080',
      output: `Initialized empty Dragyou repository in .drag/
Logging in to http://localhost:8080...
✓ Logged in as developer on http://localhost:8080`,
    },
    commit: {
      title: '2. Stage & Create SHA-256 Commit',
      cmd: 'drag add .\ndrag commit -m "initial commit"',
      output: `staged: README.md (blob 100644)
staged: main.py (blob 100644)
[main fe132af9] initial commit
 2 file(s) committed (tree a257e467)`,
    },
    push: {
      title: '3. Push Pack over DNYPACK Protocol',
      cmd: 'drag remote add origin http://localhost:8080/api/v1/repos/workspace/my-repo\ndrag push origin main',
      output: `Negotiating with http://localhost:8080/api/v1/repos/workspace/my-repo...
Objects to upload: 4
Uploading pack (0 KB)...
✓ Pushed main → origin
  fe132af9 main → origin/main`,
    },
  };

  const current = tabs[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(current.cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="terminal-window rounded-2xl border border-gray-800 bg-gray-950 overflow-hidden shadow-2xl">
      {/* Terminal window header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 select-none">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="text-[11px] font-mono text-gray-400 ml-2">drag shell v0.1.0</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800/80 bg-gray-900/50 overflow-x-auto">
        {(Object.keys(tabs) as Array<keyof typeof tabs>).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-xs font-mono transition-colors whitespace-nowrap ${
              activeTab === key
                ? 'bg-gray-950 text-blue-400 border-b-2 border-blue-500 font-semibold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tabs[key].title}
          </button>
        ))}
      </div>

      {/* Output screen */}
      <div className="p-5 font-mono text-xs space-y-3">
        <div className="text-blue-400 flex items-start gap-2">
          <span className="text-gray-600">$</span>
          <pre className="whitespace-pre-wrap">{current.cmd}</pre>
        </div>
        <div className="text-gray-400 border-t border-gray-800/60 pt-3 leading-relaxed">
          <pre className="whitespace-pre-wrap text-emerald-400/90">{current.output}</pre>
        </div>
      </div>
    </div>
  );
}



export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('dragyou_user');
    if (savedUser) {
      try { setCurrentUser(JSON.parse(savedUser)); } catch (e) {}
    }

    if (savedUser) {
      api.listRepos()
        .then((res) => setRepos(res.items || []))
        .catch(() => setRepos([]))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  // ── LANDING PAGE (WHEN SIGNED OUT) ──────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="space-y-16 py-6 animate-fadeIn max-w-6xl mx-auto">
        
        {/* Landing Hero */}
        <section className="text-center space-y-6 max-w-4xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-medium">
            <Sparkles size={14} className="text-blue-400" /> Next-Gen Version Control Engine
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            High-Performance Version Control <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Engineered for Modern Codebases
            </span>
          </h1>

          <p className="text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Dragyou delivers sub-millisecond object resolution, SHA-256 cryptographic hashing, zero-overhead virtual cloning, and binary packfile streaming over HTTP.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/register"
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 active:scale-95"
            >
              Get Started Free <ArrowRight size={16} />
            </Link>

            <Link
              href="/docs"
              className="px-6 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-200 font-semibold text-sm border border-gray-800 transition-all flex items-center gap-2"
            >
              <Terminal size={16} className="text-blue-400" /> Read Technical Manual
            </Link>
          </div>
        </section>

        {/* Interactive Terminal Demo */}
        <section className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-blue-400" />
              <span className="text-xs font-bold font-mono text-gray-200">Drag CLI Execution Simulator</span>
            </div>
            <span className="text-[11px] font-mono text-gray-500">C++20 Engine v0.1.0</span>
          </div>
          <TerminalDemo />
        </section>

        {/* Software Architecture Showcase Grid */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-gray-100 tracking-tight">Built for Hardware-Accelerated Performance</h2>
            <p className="text-xs text-gray-400 font-mono">Core technology breakdown of the Dragyou VCS platform</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="glass-card p-6 rounded-2xl border border-gray-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Shield size={20} />
              </div>
              <h3 className="text-base font-bold text-gray-100">SHA-256 Cryptographic Core</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Future-proof 256-bit cryptographic hashing for all blobs, directory trees, commit chains, and tags—eliminating collision vulnerabilities.
              </p>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-gray-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Cpu size={20} />
              </div>
              <h3 className="text-base font-bold text-gray-100">Myers O(ND) Diff Engine</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Native C++20 diffing algorithm and 3-way merge resolver executing directly at native speed with minimal memory footprint.
              </p>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-gray-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Layers size={20} />
              </div>
              <h3 className="text-base font-bold text-gray-100">DNYPACK Wire Protocol</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Binary packfile streaming over HTTP with custom magic header validation, delta compression, and sub-second object negotiation.
              </p>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-gray-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <HardDrive size={20} />
              </div>
              <h3 className="text-base font-bold text-gray-100">Virtual Shallow Clones</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Shallow cloning capability allows instant repository materialization by downloading tree metadata first and fetching file blobs on demand.
              </p>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-gray-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Server size={20} />
              </div>
              <h3 className="text-base font-bold text-gray-100">Go Backend Platform</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Enterprise Chi REST API server, PostgreSQL persistence layer, JWT token authorization, and automated CORS security middleware.
              </p>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-gray-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Workflow size={20} />
              </div>
              <h3 className="text-base font-bold text-gray-100">C++ Engine Subprocess Bridge</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                High-performance Go-to-C++ IPC bridge with zlib-compressed object store parsing and direct disk object tree resolution.
              </p>
            </div>
          </div>
        </section>

        {/* Platform Metrics Bar */}
        <section className="glass-panel p-8 rounded-2xl border border-gray-800/80 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <div className="text-3xl font-extrabold font-mono text-blue-400">SHA-256</div>
            <div className="text-xs font-mono text-gray-400">Cryptographic Integrity</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-extrabold font-mono text-emerald-400">&lt;5ms</div>
            <div className="text-xs font-mono text-gray-400 font-sans">Tree Object Resolution</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-extrabold font-mono text-indigo-400">C++20</div>
            <div className="text-xs font-mono text-gray-400">Native Engine Core</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-extrabold font-mono text-purple-400">DNYPACK</div>
            <div className="text-xs font-mono text-gray-400">Binary Wire Protocol</div>
          </div>
        </section>

        {/* ── INTERACTIVE VERTICAL SCROLL SHOWCASE SECTION ───────────────────────── */}
        <VerticalFeatureShowcase />

        {/* ── NORMAL VERTICAL SCROLL SECTION AT BOTTOM ─────────────────────────────── */}
        <section className="glass-panel p-8 rounded-2xl border border-gray-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Terminal size={18} className="text-blue-400" /> CLI Quickstart Guide
              </h3>
              <p className="text-xs text-gray-400 font-mono">Run drag CLI in 3 easy steps on your local machine</p>
            </div>
            <a
              href="/downloads/drag.exe"
              download="drag.exe"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs font-mono shadow-md transition-all shrink-0 active:scale-95"
            >
              <Terminal size={14} /> Download drag.exe (404 KB)
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 font-mono text-xs">
            <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-2">
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">1</span>
                Initialize Repo
              </div>
              <div className="p-2.5 rounded-lg bg-gray-950 text-gray-300 border border-gray-850">
                drag init
              </div>
              <p className="text-[11px] text-gray-400 font-sans">Creates local <code>.drag/</code> tree storage.</p>
            </div>

            <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">2</span>
                Stage & Commit
              </div>
              <div className="p-2.5 rounded-lg bg-gray-950 text-gray-300 border border-gray-850">
                drag add .<br />
                drag commit -m &quot;feat&quot;
              </div>
              <p className="text-[11px] text-gray-400 font-sans">Computes SHA-256 tree & blob hashes.</p>
            </div>

            <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-2">
              <div className="flex items-center gap-2 text-purple-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px]">3</span>
                Push Remote
              </div>
              <div className="p-2.5 rounded-lg bg-gray-950 text-gray-300 border border-gray-850">
                drag login<br />
                drag push origin main
              </div>
              <p className="text-[11px] text-gray-400 font-sans">Streams DNYPACK binary packfiles to server.</p>
            </div>
          </div>
        </section>

        {/* Final Call-to-Action Section */}
        <section className="rounded-3xl border border-blue-500/20 bg-gradient-to-r from-blue-950/40 via-gray-900 to-indigo-950/40 p-8 sm:p-10 text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Ready to experience high-speed version control?
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto leading-relaxed">
            Create your account to start initializing repositories, creating commits, and streaming packfiles over the drag CLI.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/register"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95"
            >
              Create Free Account
            </Link>
            <Link
              href="/login"
              className="px-6 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-xs border border-gray-700 transition-all"
            >
              Sign In
            </Link>
          </div>
        </section>

      </div>
    );
  }

  // ── DEVELOPER WORKSPACE DASHBOARD (WHEN SIGNED IN) ─────────────────────
  const myRepos = repos.filter(
    (r) => r.full_name.startsWith(`${currentUser.username}/`) || r.owner?.username === currentUser.username
  );
  const exploreRepos = repos.filter(
    (r) => !r.full_name.startsWith(`${currentUser.username}/`) && r.owner?.username !== currentUser.username
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Top Workspace Header */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Welcome back, <span className="text-blue-400">{currentUser.display_name || currentUser.username}</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Authenticated
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Manage your personal repositories, branches, and code pushes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/docs"
            className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 text-xs font-medium border border-gray-800 transition-colors flex items-center gap-2"
          >
            <Terminal size={14} className="text-blue-400" /> CLI Manual
          </Link>

          <Link
            href="/repos?new=true"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus size={15} /> New Repository
          </Link>
        </div>
      </section>

      {/* Metrics Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-gray-800/80 space-y-1">
          <div className="text-[11px] font-mono uppercase text-gray-500 font-semibold">Your Repositories</div>
          <div className="text-2xl font-bold text-gray-100 font-mono">{loading ? '…' : myRepos.length}</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-gray-800/80 space-y-1">
          <div className="text-[11px] font-mono uppercase text-gray-500 font-semibold">Engine Hashing</div>
          <div className="text-sm font-bold text-emerald-400 font-mono flex items-center gap-1 mt-1">
            <Shield size={14} /> SHA-256 Native
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-gray-800/80 space-y-1">
          <div className="text-[11px] font-mono uppercase text-gray-500 font-semibold">Diff Engine</div>
          <div className="text-sm font-bold text-blue-400 font-mono flex items-center gap-1 mt-1">
            <Cpu size={14} /> Myers O(ND)
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-gray-800/80 space-y-1">
          <div className="text-[11px] font-mono uppercase text-gray-500 font-semibold">Wire Protocol</div>
          <div className="text-sm font-bold text-indigo-400 font-mono flex items-center gap-1 mt-1">
            <Layers size={14} /> DNYPACK v1
          </div>
        </div>
      </section>

      {/* Your Repositories Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="text-blue-400" size={18} />
            <h2 className="text-base font-bold text-gray-100">Your Repositories</h2>
          </div>

          <Link href="/repos" className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
            View All ({myRepos.length}) <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500 font-mono text-xs border border-gray-800/80 rounded-2xl glass-panel">
            <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-blue-400" />
            Loading your repositories...
          </div>
        ) : myRepos.length === 0 ? (
          <div className="p-10 text-center glass-panel rounded-2xl space-y-3 border border-gray-800/80">
            <FolderGit2 size={32} className="mx-auto text-gray-600" />
            <p className="text-gray-300 text-sm font-semibold">No personal repositories created yet</p>
            <p className="text-gray-500 text-xs font-mono max-w-md mx-auto">
              Create your first repository using the button below or push via drag CLI.
            </p>
            <Link
              href="/repos?new=true"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              <Plus size={14} /> Create Repository
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myRepos.map((repo) => {
              const cloneCmd = `drag clone http://localhost:8080/api/v1/repos/${repo.full_name}`;
              return (
                <div
                  key={repo.id}
                  className="glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4 border border-gray-800/80 hover:border-blue-500/40 transition-all group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/repos/${repo.full_name}`}
                        className="font-bold font-mono text-sm text-gray-100 group-hover:text-blue-400 transition-colors flex items-center gap-2"
                      >
                        {repo.visibility === 'private' ? (
                          <Lock size={13} className="text-amber-400" />
                        ) : (
                          <Globe size={13} className="text-emerald-400" />
                        )}
                        <span>{repo.full_name}</span>
                      </Link>

                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${
                        repo.visibility === 'public'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-gray-800 text-gray-400 border-gray-700'
                      }`}>
                        {repo.visibility}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 line-clamp-2">
                      {repo.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-800/60 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-3 text-gray-400">
                      <span className="flex items-center gap-1 text-gray-300">
                        <GitBranch size={13} className="text-blue-400" /> {repo.default_branch || 'main'}
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <Star size={12} className="text-yellow-500" /> {repo.star_count || 0}
                      </span>
                    </div>

                    <button
                      onClick={() => copyToClipboard(cloneCmd, `clone-${repo.id}`)}
                      className="flex items-center gap-1 text-[11px] font-mono text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-800 transition-colors"
                    >
                      <Terminal size={11} className="text-blue-400" />
                      <span>{copiedCmd === `clone-${repo.id}` ? 'Copied' : 'Clone'}</span>
                      {copiedCmd === `clone-${repo.id}` ? (
                        <Check size={11} className="text-emerald-400" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Explore Community Repositories Section */}
      {exploreRepos.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-gray-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="text-emerald-400" size={18} />
              <h2 className="text-base font-bold text-gray-100">Explore Public Repositories</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exploreRepos.map((repo) => {
              const cloneCmd = `drag clone http://localhost:8080/api/v1/repos/${repo.full_name}`;
              const ownerName = repo.full_name.split('/')[0] || 'unknown';
              return (
                <div
                  key={repo.id}
                  className="glass-card p-5 rounded-2xl flex flex-col justify-between space-y-4 border border-gray-800/80 hover:border-emerald-500/40 transition-all group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/repos/${repo.full_name}`}
                        className="font-bold font-mono text-sm text-gray-100 group-hover:text-emerald-400 transition-colors flex items-center gap-2"
                      >
                        <Globe size={13} className="text-emerald-400" />
                        <span>{repo.full_name}</span>
                      </Link>

                      <Link
                        href={`/users/${encodeURIComponent(ownerName)}`}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                      >
                        @{ownerName}
                      </Link>
                    </div>

                    <p className="text-xs text-gray-400 line-clamp-2">
                      {repo.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-800/60 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-3 text-gray-400">
                      <span className="flex items-center gap-1 text-gray-300">
                        <GitBranch size={13} className="text-blue-400" /> {repo.default_branch || 'main'}
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <Star size={12} className="text-yellow-500" /> {repo.star_count || 0}
                      </span>
                    </div>

                    <button
                      onClick={() => copyToClipboard(cloneCmd, `clone-${repo.id}`)}
                      className="flex items-center gap-1 text-[11px] font-mono text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-800 transition-colors"
                    >
                      <Terminal size={11} className="text-blue-400" />
                      <span>{copiedCmd === `clone-${repo.id}` ? 'Copied' : 'Clone'}</span>
                      {copiedCmd === `clone-${repo.id}` ? (
                        <Check size={11} className="text-emerald-400" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Developer CLI Cheat Sheet */}
      <section className="glass-panel p-6 rounded-2xl border border-gray-800/80 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="text-blue-400" size={18} />
            <h2 className="text-sm font-bold text-gray-100 font-mono">Drag CLI Quick Reference</h2>
          </div>
          <span className="text-[11px] font-mono text-gray-500">C++20 Wire Protocol v1</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
          <div className="bg-gray-950/80 p-3.5 rounded-xl border border-gray-800/80 space-y-1.5">
            <div className="text-blue-400 font-semibold">$ drag init</div>
            <div className="text-gray-400 text-[11px]">Initialize .drag/ skeleton in directory</div>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-xl border border-gray-800/80 space-y-1.5">
            <div className="text-blue-400 font-semibold">$ drag add .</div>
            <div className="text-gray-400 text-[11px]">Stage modified files into binary index</div>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-xl border border-gray-800/80 space-y-1.5">
            <div className="text-blue-400 font-semibold">$ drag commit -m "msg"</div>
            <div className="text-gray-400 text-[11px]">Construct SHA-256 commit & tree objects</div>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-xl border border-gray-800/80 space-y-1.5">
            <div className="text-blue-400 font-semibold">$ drag login http://localhost:8080</div>
            <div className="text-gray-400 text-[11px]">Authenticate & save JWT credential token</div>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-xl border border-gray-800/80 space-y-1.5">
            <div className="text-blue-400 font-semibold">$ drag push origin main</div>
            <div className="text-gray-400 text-[11px]">Negotiate missing objects & stream DNYPACK</div>
          </div>

          <div className="bg-gray-950/80 p-3.5 rounded-xl border border-gray-800/80 space-y-1.5">
            <div className="text-blue-400 font-semibold">$ drag clone &lt;url&gt;</div>
            <div className="text-gray-400 text-[11px]">Clone repository metadata and tree</div>
          </div>
        </div>
      </section>

    </div>
  );
}
