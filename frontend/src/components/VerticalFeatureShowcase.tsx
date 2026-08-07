'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Shield,
  Layers,
  Cpu,
  Workflow,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Terminal,
  CheckCircle2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  HardDrive
} from 'lucide-react';

interface FeatureItem {
  id: number;
  step: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  glowColor: string;
  icon: React.ElementType;
  image: string;
  description: string;
  bullets: string[];
  codeSnippet: string;
  metrics: { label: string; value: string }[];
}

const features: FeatureItem[] = [
  {
    id: 1,
    step: '01',
    title: 'Native SHA-256 Storage',
    subtitle: 'Future-Proof Cryptographic Integrity Engine',
    badge: 'Hardware Accelerated',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    glowColor: 'from-cyan-500/30 via-blue-500/20 to-transparent',
    icon: Shield,
    image: '/features/sha256_crypto_engine.png',
    description: 'Calculates 256-bit cryptographic tree hashes and zlib compressed blob objects at native C++ hardware speed, preventing hash collision vulnerabilities.',
    bullets: [
      'Zero SHA-1 collision risk with 256-bit security guarantees',
      'Hardware-accelerated hash generation in native C++20 engine',
      'Immutable blob store with instant zlib delta compression'
    ],
    codeSnippet: `$ drag add .\n[BLOB 100644] e3b0c44298fc1c149afbf4c8996fb924\n✓ Tree hash computed: a257e467b931 (0.8ms)`,
    metrics: [
      { label: 'Hashrate', value: '1.2 GB/s' },
      { label: 'Security', value: 'SHA-256' },
      { label: 'Compression', value: 'Zlib Dynamic' }
    ]
  },
  {
    id: 2,
    step: '02',
    title: 'Virtual Shallow Clones',
    subtitle: 'Sub-Second Gigabyte Monorepo Materialization',
    badge: 'Monorepo Scale',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    glowColor: 'from-purple-500/30 via-indigo-500/20 to-transparent',
    icon: HardDrive,
    image: '/features/shallow_clone_tree.png',
    description: 'Shallow materialization technology enables sub-second checkout of massive repositories by pulling lightweight tree metadata first and fetching file contents on-demand.',
    bullets: [
      'Instant checkout of multi-gigabyte repositories in under 50ms',
      'Lazy blob fetching on file access with background prefetching',
      'Drastically reduced disk usage and network transfer overhead'
    ],
    codeSnippet: `$ drag clone --depth 1 https://dragyou.io/monorepo\n✓ Materialized 12,400 files in 48ms\n[VIRTUAL TREE] Ready for development`,
    metrics: [
      { label: 'Materialization', value: '<50ms' },
      { label: 'Disk Overhead', value: '-92%' },
      { label: 'Tree Parsing', value: '0.4ms' }
    ]
  },
  {
    id: 3,
    step: '03',
    title: 'DNYPACK Packfile Streaming',
    subtitle: 'High-Throughput Binary Wire Protocol',
    badge: 'Custom HTTP/2 Protocol',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    glowColor: 'from-emerald-500/30 via-teal-500/20 to-transparent',
    icon: Layers,
    image: '/features/dnypack_protocol.png',
    description: 'Custom binary packfile streaming format over HTTP with magic header validation, delta compression, and sub-second multi-object pack negotiation.',
    bullets: [
      'Stream compressed packfiles with minimal TCP roundtrips',
      'Automated magic byte header verification for secure pack streams',
      'Selective pack delta resolution for ultra-fast incremental pushes'
    ],
    codeSnippet: `HEADER: DNYPACK v1.0 [DELTA_OBJECT_STREAM]\nStreaming 4.2 MB packfile (24ms)\n✓ Remote ref updated: fe132af9 → main`,
    metrics: [
      { label: 'Throughput', value: '350 MB/s' },
      { label: 'Wire Overhead', value: '<1.5%' },
      { label: 'Push Latency', value: '18ms' }
    ]
  },
  {
    id: 4,
    step: '04',
    title: 'Myers O(ND) Diff & Merge Engine',
    subtitle: 'Sub-Millisecond 3-Way Line Conflict Resolution',
    badge: 'Native C++20 Core',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    glowColor: 'from-blue-500/30 via-cyan-500/20 to-transparent',
    icon: Cpu,
    image: '/features/diff_merge_engine.png',
    description: 'Line-level 3-way merge resolution using Myers optimal O(ND) diffing algorithm with visual conflict markers and automated clean auto-merging.',
    bullets: [
      'Optimal shortest edit path computation for complex code diffs',
      'Clean 3-way automatic resolution for independent branch edits',
      'Built-in visual conflict markers with single-click manual overrides'
    ],
    codeSnippet: `$ drag diff main...feature/v2\n<<<<<<< HEAD [Your Changes]\n======= \n>>>>>>> feature/v2 [Incoming Changes]\n✓ Myers auto-merge resolved 4 files cleanly`,
    metrics: [
      { label: 'Diff Speed', value: '<2ms/kloc' },
      { label: 'Algorithm', value: 'Myers O(ND)' },
      { label: 'Auto-Merge Rate', value: '98.4%' }
    ]
  }
];

export default function VerticalFeatureShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intercept vertical wheel scrolling over the container to drive smooth horizontal slide transitions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastScrollTime = 0;
    const scrollCooldown = 450; // ms between step slide animations

    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastScrollTime < scrollCooldown) return;

      if (Math.abs(e.deltaY) > 15) {
        if (e.deltaY > 0 && activeIndex < features.length - 1) {
          e.preventDefault();
          setActiveIndex((prev) => prev + 1);
          lastScrollTime = now;
        } else if (e.deltaY < 0 && activeIndex > 0) {
          e.preventDefault();
          setActiveIndex((prev) => prev - 1);
          lastScrollTime = now;
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [activeIndex]);

  return (
    <section
      ref={containerRef}
      className="relative space-y-8 pt-6 pb-4 scroll-mt-20 overflow-hidden"
      id="vertical-feature-tour"
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-800/80 pb-6 select-none">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-medium">
            <Sparkles size={14} className="text-blue-400" /> Interactive Animated Feature Tour
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            High-Performance Platform Capabilities
          </h2>
        </div>

        {/* Navigation Step Pills & Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-900 border border-gray-800">
            {features.map((feat, idx) => (
              <button
                key={feat.id}
                onClick={() => setActiveIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  activeIndex === idx
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-105'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                {feat.step}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
              disabled={activeIndex === 0}
              className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 border border-gray-800 transition-all active:scale-95"
              title="Previous Feature"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setActiveIndex((prev) => Math.min(features.length - 1, prev + 1))}
              disabled={activeIndex === features.length - 1}
              className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 border border-gray-800 transition-all active:scale-95"
              title="Next Feature"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Sliding Track Container */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-800/80 bg-gray-950/60 p-4 sm:p-6 backdrop-blur-sm shadow-2xl">
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="w-full shrink-0 min-w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center px-2 py-2"
              >
                {/* Left Column: Clean Image Display (Without top window header or bottom metrics bar) */}
                <div className="lg:col-span-6 relative group">
                  {/* Subtle Ambient Glow */}
                  <div className={`absolute -inset-2 rounded-3xl bg-gradient-to-r ${item.glowColor} blur-2xl opacity-60 transition-all duration-700`} />

                  {/* Borderless Clean Image Frame */}
                  <div className="relative aspect-[16/10] w-full rounded-2xl border border-gray-800/90 bg-gray-950 overflow-hidden shadow-2xl transition-all duration-500 group-hover:border-blue-500/40">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      priority
                    />
                    {/* Subtle Overlay Vignette */}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950/40 via-transparent to-transparent pointer-events-none" />
                  </div>
                </div>

                {/* Right Column: Feature Details & CLI Log */}
                <div className="lg:col-span-6 space-y-5">
                  {/* Feature Title & Subtitle */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black font-mono text-blue-500">
                          {item.step}
                        </span>
                        <div className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-blue-400 shadow-inner">
                          <Icon size={18} />
                        </div>
                        <span className="text-xs font-mono text-gray-400">
                          {item.subtitle}
                        </span>
                      </div>

                      <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold border ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    </div>

                    <h3 className="text-2xl font-bold text-gray-100 tracking-tight pt-1">
                      {item.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Bullet Highlights */}
                  <div className="space-y-2 pt-1">
                    {item.bullets.map((bullet, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-300">
                        <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>

                  {/* Compact Metrics Chips Row */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {item.metrics.map((m, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-1 rounded-lg bg-gray-900/90 border border-gray-800/80 text-[11px] font-mono flex items-center gap-1.5"
                      >
                        <span className="text-gray-400">{m.label}:</span>
                        <span className="font-bold text-blue-400">{m.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* CLI Execution Log */}
                  <div className="rounded-xl bg-gray-950 border border-gray-800/80 p-3.5 font-mono text-xs text-gray-300 space-y-1.5 shadow-inner">
                    <div className="flex items-center justify-between border-b border-gray-850 pb-1.5">
                      <div className="flex items-center gap-2">
                        <Terminal size={13} className="text-blue-400" />
                        <span className="text-[10px] font-bold text-gray-400">CLI Execution Log</span>
                      </div>
                      <span className="text-[9px] text-gray-500 font-mono">Subprocess Execution</span>
                    </div>
                    <pre className="text-blue-300/90 whitespace-pre-wrap text-[11px] leading-relaxed pt-1">
                      {item.codeSnippet}
                    </pre>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress Line & Step Indicators below track */}
      <div className="flex items-center justify-between pt-2 px-1 select-none">
        <div className="flex items-center gap-3">
          <div className="w-36 h-1.5 rounded-full bg-gray-900 border border-gray-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${((activeIndex + 1) / features.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-gray-400">
            Feature {activeIndex + 1} of {features.length}
          </span>
        </div>

        <button
          onClick={() => {
            setActiveIndex((prev) => (prev + 1) % features.length);
          }}
          className="text-xs font-mono font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
        >
          <span>{activeIndex === features.length - 1 ? 'Replay Tour' : 'Next Capability'}</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}
