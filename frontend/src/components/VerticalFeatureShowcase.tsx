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
  Zap,
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
    glowColor: 'from-cyan-500/20 via-blue-500/10 to-transparent',
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
      { label: 'Hash Hashrate', value: '1.2 GB/s' },
      { label: 'Security Standard', value: 'SHA-256' },
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
    glowColor: 'from-purple-500/20 via-indigo-500/10 to-transparent',
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
    glowColor: 'from-emerald-500/20 via-teal-500/10 to-transparent',
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
    glowColor: 'from-blue-500/20 via-cyan-500/10 to-transparent',
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
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Wheel listener to intercept vertical scrolling over the component
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastScrollTime = 0;
    const scrollCooldown = 400; // ms between step changes

    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastScrollTime < scrollCooldown) return;

      if (Math.abs(e.deltaY) > 20) {
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

  const activeFeature = features[activeIndex];
  const IconComponent = activeFeature.icon;

  return (
    <section
      ref={containerRef}
      className="relative space-y-8 pt-6 pb-4 scroll-mt-20"
      id="vertical-feature-tour"
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-800/80 pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-medium">
            <Sparkles size={14} className="text-blue-400" /> Interactive Vertical Showcase
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            High-Performance Platform Capabilities
          </h2>
          <p className="text-xs text-gray-400 font-mono">
            Scroll vertically with your mouse wheel or use step controls to explore core architecture features.
          </p>
        </div>

        {/* Step Navigation Pills & Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-900 border border-gray-800">
            {features.map((feat, idx) => (
              <button
                key={feat.id}
                onClick={() => setActiveIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  activeIndex === idx
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
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
              className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 border border-gray-800 transition-all active:scale-95"
              title="Previous Step"
            >
              <ChevronUp size={18} />
            </button>
            <button
              onClick={() => setActiveIndex((prev) => Math.min(features.length - 1, prev + 1))}
              disabled={activeIndex === features.length - 1}
              className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 border border-gray-800 transition-all active:scale-95"
              title="Next Step"
            >
              <ChevronDown size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Showcase Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Visual Asset Display */}
        <div className="lg:col-span-6 relative group">
          <div className={`absolute -inset-1 rounded-3xl bg-gradient-to-r ${activeFeature.glowColor} blur-xl opacity-70 transition-all duration-700`} />

          <div className="relative rounded-2xl border border-gray-800/90 bg-gray-950/90 overflow-hidden shadow-2xl backdrop-blur-md">
            {/* Header bar of visual card */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800 select-none">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="text-[11px] font-mono text-gray-400 ml-2">
                  capability_visual_0{activeFeature.id}.png
                </span>
              </div>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold border ${activeFeature.badgeColor}`}>
                {activeFeature.badge}
              </span>
            </div>

            {/* Generated Feature Visual Image */}
            <div className="relative aspect-[16/10] w-full bg-gray-950 overflow-hidden">
              <Image
                src={activeFeature.image}
                alt={activeFeature.title}
                fill
                className="object-cover transition-all duration-700 scale-100 group-hover:scale-105"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-60" />
            </div>

            {/* Live Metrics Row below image */}
            <div className="grid grid-cols-3 divide-x divide-gray-800/80 border-t border-gray-800 bg-gray-900/60 p-3 text-center">
              {activeFeature.metrics.map((m, idx) => (
                <div key={idx} className="space-y-0.5 px-2">
                  <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{m.label}</div>
                  <div className="text-xs font-mono font-bold text-blue-400">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Feature Content & Technical Overview */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black font-mono text-blue-500/60">
                {activeFeature.step}
              </span>
              <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-blue-400 shadow-inner">
                <IconComponent size={20} />
              </div>
              <span className="text-xs font-mono text-gray-400">
                {activeFeature.subtitle}
              </span>
            </div>

            <h3 className="text-2xl font-bold text-gray-100 tracking-tight">
              {activeFeature.title}
            </h3>

            <p className="text-sm text-gray-300 leading-relaxed">
              {activeFeature.description}
            </p>
          </div>

          {/* Bullet Highlights */}
          <div className="space-y-2.5 pt-1">
            {activeFeature.bullets.map((bullet, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-gray-300">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>

          {/* Code Snippet Box */}
          <div className="rounded-xl bg-gray-950 border border-gray-800/80 p-4 font-mono text-xs text-gray-300 space-y-2 shadow-inner">
            <div className="flex items-center justify-between border-b border-gray-850 pb-2">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-blue-400" />
                <span className="text-[11px] font-bold text-gray-400">CLI Execution Log</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">Subprocess Execution</span>
            </div>
            <pre className="text-blue-300/90 whitespace-pre-wrap leading-relaxed pt-1">
              {activeFeature.codeSnippet}
            </pre>
          </div>

          {/* Progress Bar & Jump Link */}
          <div className="pt-2 flex items-center justify-between border-t border-gray-800/60">
            <div className="flex items-center gap-2">
              <div className="w-32 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${((activeIndex + 1) / features.length) * 100}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-gray-400">
                {activeIndex + 1} of {features.length}
              </span>
            </div>

            <button
              onClick={() => {
                setActiveIndex((prev) => (prev + 1) % features.length);
              }}
              className="text-xs font-mono font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              <span>Next Feature</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
