'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen, Terminal, Cpu, Shield, Layers, Code, Copy, Check,
  Zap, ArrowRight, Play, Server, Database, GitBranch, Key,
  Lock, RefreshCw, ChevronRight, Search, FileCode, CheckCircle2
} from 'lucide-react';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-gray-800 bg-gray-950">
      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-900/90 border-b border-gray-800 text-[11px] font-mono text-gray-400 select-none">
        <span className="text-gray-500">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-gray-200 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function DocumentationPage() {
  const [activeSection, setActiveSection] = useState<'quickstart' | 'cli' | 'architecture' | 'api'>('quickstart');
  const [searchQuery, setSearchQuery] = useState('');

  const sections = [
    { id: 'quickstart', label: 'Quick Start Guide', icon: Play },
    { id: 'cli', label: 'Nova CLI Reference', icon: Terminal },
    { id: 'architecture', label: 'System Architecture', icon: Cpu },
    { id: 'api', label: 'REST API & Auth', icon: Server },
  ] as const;

  return (
    <div className="space-y-8 min-h-screen">
      {/* Header Banner */}
      <section className="rounded-2xl border border-gray-800/80 bg-gray-900/40 p-6 sm:p-8 space-y-3">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-medium">
          <BookOpen size={13} /> Official System Documentation
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Dragyou VCS Documentation & Developer Manual
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <p className="text-gray-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Comprehensive guides and reference manual for nova CLI commands, C++ engine storage model, binary packfile protocol, and Go REST API endpoints.
          </p>
          <a
            href="/downloads/nova.exe"
            download="nova.exe"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs font-mono shadow-lg shadow-blue-500/20 transition-all shrink-0 active:scale-95"
          >
            <Terminal size={15} /> Download Nova CLI (nova.exe)
          </a>
        </div>
      </section>

      {/* Main Grid: Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Navigation Sidebar */}
        <aside className="lg:col-span-1 space-y-4">
          <div className="glass-panel p-4 rounded-2xl border border-gray-800 space-y-2 sticky top-20">
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-semibold px-2">
              Documentation Index
            </p>
            <nav className="space-y-1">
              {sections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    activeSection === id
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                  }`}
                >
                  <Icon size={16} className={activeSection === id ? 'text-blue-400' : 'text-gray-500'} />
                  <span className="flex-1 text-left">{label}</span>
                  {activeSection === id && <ChevronRight size={14} className="text-blue-400" />}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content Body */}
        <main className="lg:col-span-3 space-y-8">
          
          {/* SECTION 1: QUICKSTART */}
          {activeSection === 'quickstart' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="border-b border-gray-800 pb-4">
                <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                  <Play className="text-blue-400" size={24} /> Quick Start Guide
                </h2>
                <p className="text-gray-400 text-xs mt-1">Get up and running with Dragyou VCS in under 3 minutes.</p>
              </div>

              {/* Step 1 */}
              <div className="glass-card p-6 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-200 font-mono">
                  <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs">1</span>
                  Add nova CLI to your PATH
                </div>
                <p className="text-xs text-gray-400">
                  First, ensure the compiled <code className="text-blue-400 font-mono">nova.exe</code> binary is in your terminal environment PATH:
                </p>
                <CodeBlock code={`$env:PATH += ";D:\\Dragyou\\backend\\build\\bin\\Release"`} />
                <p className="text-xs text-gray-500">Verify by running <code className="text-gray-300 font-mono">nova --version</code> in your shell.</p>
              </div>

              {/* Step 2 */}
              <div className="glass-card p-6 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-200 font-mono">
                  <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs">2</span>
                  Create a Repository via Web UI or API
                </div>
                <p className="text-xs text-gray-400">
                  Click the <strong>"+ New Repo"</strong> button in the top navbar or call the API:
                </p>
                <CodeBlock code={`# 1. Login to get your access token
$token = (Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" \`
  -Method POST -Body '{"username":"developer","password":"Password@123"}' -ContentType "application/json").access_token

# 2. Create the repository
$repoBody = '{"name":"my-project","description":"My first Dragyou repo","visibility":"public"}'
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/repos" \`
  -Method POST -Body $repoBody -ContentType "application/json" \`
  -Headers @{ Authorization = "Bearer $token" }`} language="powershell" />
              </div>

              {/* Step 3 */}
              <div className="glass-card p-6 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-200 font-mono">
                  <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs">3</span>
                  Initialize Local Repo & Authenticate CLI
                </div>
                <p className="text-xs text-gray-400">
                  Navigate to your local code directory and initialize <code className="text-blue-400 font-mono">.nova/</code>:
                </p>
                <CodeBlock code={`mkdir D:\\my-project
cd D:\\my-project

nova init
nova login http://localhost:8080
# Enter your Username and Password when prompted`} />
              </div>

              {/* Step 4 */}
              <div className="glass-card p-6 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-200 font-mono">
                  <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs">4</span>
                  Stage, Commit, and Push
                </div>
                <p className="text-xs text-gray-400">
                  Create code files, stage them into the binary index, commit, and push to remote:
                </p>
                <CodeBlock code={`# Create a test file
"print('Hello, Dragyou!')" | Out-File main.py -Encoding utf8

# Stage files
nova add .

# Create commit
nova commit -m "initial commit"

# Set remote server URL
nova remote add origin http://localhost:8080/api/v1/repos/developer/my-project

# Push commits & objects
nova push origin main`} />
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono pt-2">
                  <CheckCircle2 size={14} /> View your pushed files on the web dashboard at http://localhost:3000/repos/developer/my-project
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: CLI REFERENCE */}
          {activeSection === 'cli' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="border-b border-gray-800 pb-4">
                <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                  <Terminal className="text-blue-400" size={24} /> Nova CLI Command Reference
                </h2>
                <p className="text-gray-400 text-xs mt-1">Complete command-line interface specification for local and remote operations.</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-blue-400 font-mono uppercase tracking-wider">Local Workspace Commands</h3>

                <div className="glass-card p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-bold text-white font-mono">nova init [path]</code>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Local</span>
                  </div>
                  <p className="text-xs text-gray-400">Initializes an empty <code className="text-gray-300 font-mono">.nova/</code> directory skeleton with object store, refs, and default configuration.</p>
                </div>

                <div className="glass-card p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-bold text-white font-mono">nova add &lt;file...&gt;</code>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Local</span>
                  </div>
                  <p className="text-xs text-gray-400">Stages target files into the binary staging index. Use <code className="text-gray-300 font-mono">nova add .</code> to stage all modified and untracked files recursively.</p>
                </div>

                <div className="glass-card p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-bold text-white font-mono">nova commit -m "&lt;message&gt;"</code>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Local</span>
                  </div>
                  <p className="text-xs text-gray-400">Creates a SHA-256 tree object from the staging index and constructs a new commit pointing to parent commits.</p>
                </div>

                <div className="glass-card p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-bold text-white font-mono">nova status</code>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Local</span>
                  </div>
                  <p className="text-xs text-gray-400">Displays working directory status, comparing staged files against the HEAD commit and listing untracked files.</p>
                </div>

                <div className="glass-card p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-bold text-white font-mono">nova log [--max &lt;n&gt;]</code>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Local</span>
                  </div>
                  <p className="text-xs text-gray-400">Prints the commit log starting from current HEAD back to the root commit with full SHA-256 hashes and author signatures.</p>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-sm font-bold text-indigo-400 font-mono uppercase tracking-wider">Remote & Collaboration Commands</h3>

                <div className="glass-card p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-bold text-white font-mono">nova login [server-url]</code>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Remote</span>
                  </div>
                  <p className="text-xs text-gray-400">Authenticates with a Dragyou server via JWT, saving credentials to <code className="text-gray-300 font-mono">~/.nova/credentials</code>.</p>
                </div>

                <div className="glass-card p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-bold text-white font-mono">nova remote add &lt;name&gt; &lt;url&gt;</code>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Remote</span>
                  </div>
                  <p className="text-xs text-gray-400">Links a remote repository URL under an alias (e.g. <code className="text-gray-300 font-mono">origin</code>) inside <code className="text-gray-300 font-mono">.nova/config</code>.</p>
                </div>

                <div className="glass-card p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-bold text-white font-mono">nova push [&lt;remote&gt;] [&lt;branch&gt;]</code>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Remote</span>
                  </div>
                  <p className="text-xs text-gray-400">Negotiates missing objects with the server, serializes a binary <code className="text-gray-300 font-mono">DNYPACK</code> packfile, streams it, and updates the branch ref tip.</p>
                </div>

                <div className="glass-card p-5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-bold text-white font-mono">nova clone [--depth n] &lt;url&gt;</code>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Remote</span>
                  </div>
                  <p className="text-xs text-gray-400">Clones a remote repository. Supports shallow/virtual clones by downloading metadata first and materializing file blobs on demand.</p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: ARCHITECTURE */}
          {activeSection === 'architecture' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="border-b border-gray-800 pb-4">
                <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                  <Cpu className="text-blue-400" size={24} /> System Architecture & Engine Design
                </h2>
                <p className="text-gray-400 text-xs mt-1">Deep dive into Dragyou's native storage, hashing, and wire format.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-6 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-100">
                    <Shield className="text-blue-400" size={18} /> SHA-256 Cryptographic Integrity
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Unlike legacy version control systems using SHA-1 (which suffers from collision attacks), Dragyou uses full 256-bit SHA-256 hashes for all content addressing (blobs, trees, commits, and tags).
                  </p>
                </div>

                <div className="glass-card p-6 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-100">
                    <Zap className="text-amber-400" size={18} /> Native C++20 Core Engine
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    The core object store, Myers O(ND) diff engine, zlib compression, and 3-way merge algorithms execute natively in compiled C++20 for maximum throughput on monorepos.
                  </p>
                </div>

                <div className="glass-card p-6 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-100">
                    <Layers className="text-indigo-400" size={18} /> DNYPACK Wire Protocol
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Client and server communicate over HTTP using a custom binary wire format containing magic header <code className="font-mono text-blue-400">DNYPACK\0</code>, versioning, object counts, type markers, and payload streams.
                  </p>
                </div>

                <div className="glass-card p-6 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-100">
                    <Server className="text-teal-400" size={18} /> Go Platform Backend
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    The collaboration layer is written in Go, exposing Chi REST endpoints, JWT authentication middleware, GORM PostgreSQL persistence, and an engine bridge to local repository stores.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: REST API & AUTH */}
          {activeSection === 'api' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="border-b border-gray-800 pb-4">
                <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                  <Server className="text-blue-400" size={24} /> REST API & Authentication
                </h2>
                <p className="text-gray-400 text-xs mt-1">Integrate third-party tools directly with the Dragyou backend API.</p>
              </div>

              <div className="space-y-4">
                <div className="glass-card p-5 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">POST</span>
                    <span className="text-gray-200">/api/v1/auth/login</span>
                  </div>
                  <p className="text-xs text-gray-400">Authenticates credentials and returns a JWT <code className="text-blue-400 font-mono">access_token</code>.</p>
                </div>

                <div className="glass-card p-5 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">GET</span>
                    <span className="text-gray-200">/api/v1/repos/{'{owner}'}/{'{repo}'}/tree/{'{ref}'}</span>
                  </div>
                  <p className="text-xs text-gray-400">Fetches the directory tree (files, folders, sizes, modes) at the specified ref or branch.</p>
                </div>

                <div className="glass-card p-5 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">GET</span>
                    <span className="text-gray-200">/api/v1/repos/{'{owner}'}/{'{repo}'}/commits</span>
                  </div>
                  <p className="text-xs text-gray-400">Returns commit history log array including commit message, author, timestamp, and SHA-256 hash.</p>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
