'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, User, Repository } from '@/lib/api';
import { User as UserIcon, BookOpen, Calendar, Lock, Globe, Star, GitFork, ArrowLeft } from 'lucide-react';

interface Props {
  params: { username: string };
}

export default function UserProfilePage({ params }: Props) {
  const { username } = params;
  const decodedUsername = decodeURIComponent(username);

  const [profile, setProfile] = useState<User | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    Promise.all([
      api.getUser(decodedUsername),
      api.getUserRepos(decodedUsername),
    ])
      .then(([userData, repoData]) => {
        setProfile(userData);
        setRepos(repoData.repositories || []);
      })
      .catch((err: any) => {
        setError(err.message || `User '${decodedUsername}' not found`);
      })
      .finally(() => setLoading(false));
  }, [decodedUsername]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center text-gray-400 font-mono text-sm">
        Loading user profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
          <UserIcon size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-100">User Not Found</h2>
        <p className="text-gray-400 text-sm font-mono">{error || `No user registered with username '@${decodedUsername}'`}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold transition-all mt-4"
        >
          <ArrowLeft size={14} /> Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Profile Header Card */}
      <div className="glass-panel border border-gray-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        {/* Avatar */}
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.username}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-blue-500/40 shadow-xl shadow-blue-500/10"
          />
        ) : (
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-4xl font-extrabold shadow-xl shadow-blue-500/20">
            {profile.username.charAt(0).toUpperCase()}
          </div>
        )}

        {/* User Info */}
        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-100">
              {profile.display_name || profile.username}
            </h1>
            <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold self-center sm:self-auto">
              @{profile.username}
            </span>
          </div>

          {profile.bio && (
            <p className="text-sm text-gray-300 max-w-2xl leading-relaxed">
              {profile.bio}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-mono text-gray-400 pt-2">
            <span className="flex items-center gap-1.5">
              <BookOpen size={14} className="text-blue-400" />
              {repos.length} Public Repositories
            </span>
            {profile.created_at && (
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-500" />
                Joined {new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Public Repositories Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
          <BookOpen className="text-blue-400" size={20} /> Public Repositories ({repos.length})
        </h2>

        {repos.length === 0 ? (
          <div className="p-10 text-center glass-panel rounded-2xl border border-gray-800 space-y-2">
            <BookOpen className="mx-auto text-gray-600" size={32} />
            <p className="text-gray-300 font-semibold text-sm">No public repositories yet</p>
            <p className="text-gray-500 text-xs font-mono">@{profile.username} hasn't created any public repositories.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {repos.map((repo) => (
              <Link
                key={repo.id}
                href={`/repos/${encodeURIComponent(repo.full_name.split('/')[0])}/${encodeURIComponent(repo.name)}`}
                className="p-5 glass-card rounded-2xl border border-gray-800/80 hover:border-blue-500/40 hover:bg-gray-800/40 transition-all group space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-sm text-blue-400 group-hover:text-blue-300 font-mono tracking-tight transition-colors">
                    {repo.full_name}
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <Globe size={10} /> {repo.visibility}
                  </span>
                </div>

                {repo.description ? (
                  <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                    {repo.description}
                  </p>
                ) : (
                  <p className="text-xs text-gray-600 italic">No description provided</p>
                )}

                <div className="flex items-center gap-4 text-xs font-mono text-gray-500 pt-2 border-t border-gray-800/60">
                  <span className="flex items-center gap-1">
                    <Star size={13} className="text-amber-400" /> {repo.star_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitFork size={13} className="text-blue-400" /> {repo.fork_count || 0}
                  </span>
                  <span className="ml-auto text-[11px]">
                    {repo.default_branch || 'main'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
