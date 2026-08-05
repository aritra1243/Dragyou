'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { api, Collaborator } from '@/lib/api';
import { Settings, Trash2, Shield, Users, UserPlus, UserX } from 'lucide-react';

interface Props {
  params: { owner: string; repo: string };
}

export default function SettingsPage({ params }: Props) {
  const { owner, repo } = params;
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Collaborators state
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loadingCollabs, setLoadingCollabs] = useState(true);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState('write');
  const [inviting, setInviting] = useState(false);
  const [collabMsg, setCollabMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // User search suggestions state
  const [userSuggestions, setUserSuggestions] = useState<Array<{ id: number; username: string; display_name?: string; avatar_url?: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const loadCollaborators = () => {
    setLoadingCollabs(true);
    api.listCollaborators(owner, repo)
      .then((data) => setCollaborators(data.collaborators || []))
      .catch(() => setCollaborators([]))
      .finally(() => setLoadingCollabs(false));
  };

  useEffect(() => {
    loadCollaborators();
  }, [owner, repo]);

  // Live user search autocomplete effect
  useEffect(() => {
    const q = inviteUsername.trim();
    if (!q) {
      setUserSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(() => {
      api.searchUsers(q)
        .then((data) => {
          setUserSuggestions(data.users || []);
          setShowSuggestions(true);
        })
        .catch(() => setUserSuggestions([]));
    }, 200);

    return () => clearTimeout(timer);
  }, [inviteUsername]);

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;

    setInviting(true);
    setCollabMsg(null);
    setShowSuggestions(false);

    try {
      await api.addCollaborator(owner, repo, inviteUsername.trim(), inviteRole);
      setCollabMsg({ ok: true, text: `✓ Added/Updated ${inviteUsername} with '${inviteRole}' role` });
      setInviteUsername('');
      loadCollaborators();
    } catch (err: any) {
      setCollabMsg({ ok: false, text: err.message || 'Failed to add collaborator' });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveCollaborator = async (username: string) => {
    if (!confirm(`Remove collaborator ${username}?`)) return;

    try {
      await api.removeCollaborator(owner, repo, username);
      loadCollaborators();
    } catch (err: any) {
      alert(err.message || 'Failed to remove collaborator');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete ${owner}/${repo}? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await api.deleteRepo(owner, repo);
      window.location.href = '/repos';
    } catch (err: any) {
      setError(err.message || 'Failed to delete repository');
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-140px)]">
      <Sidebar owner={owner} repo={repo} />

      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Settings className="text-gray-400" size={22} /> Repository Settings
          </h1>
          <span className="text-xs font-mono text-gray-400">{owner}/{repo}</span>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Collaborators & Roles */}
        <div className="border border-gray-800 rounded-2xl overflow-hidden glass-panel">
          <div className="bg-gray-900/80 px-5 py-3 border-b border-gray-800 text-xs font-mono text-gray-300 font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-blue-400" /> Collaborators & Roles
            </div>
            <span className="text-[10px] text-gray-500 font-normal">Manage access for team members</span>
          </div>

          <div className="p-6 space-y-6">
            {/* Add Collaborator Form */}
            <form onSubmit={handleAddCollaborator} className="space-y-3">
              <label className="block text-xs font-mono text-gray-400">
                Add Collaborator or Update Role
              </label>

              {collabMsg && (
                <div className={`p-3 rounded-xl border text-xs font-mono ${
                  collabMsg.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                  {collabMsg.text}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    required
                    placeholder="Search or enter username..."
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    onFocus={() => inviteUsername.trim() && setShowSuggestions(true)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
                  />

                  {/* Autocomplete Suggestions Dropdown */}
                  {showSuggestions && userSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-gray-800/60 max-h-60 overflow-y-auto">
                      {userSuggestions.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setInviteUsername(u.username);
                            setShowSuggestions(false);
                          }}
                          className="p-2.5 flex items-center gap-3 hover:bg-blue-600/20 cursor-pointer transition-colors"
                        >
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.username} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[10px] flex items-center justify-center border border-blue-500/30">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 font-mono text-xs text-gray-200">
                            <span className="font-bold text-gray-100">{u.username}</span>
                            {u.display_name && (
                              <span className="text-gray-400 text-[11px] ml-2 font-sans">({u.display_name})</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="write">Write (Can Push & Upload)</option>
                  <option value="admin">Admin (Manage Repo)</option>
                  <option value="maintainer">Maintainer</option>
                  <option value="read">Read Only</option>
                </select>

                <button
                  type="submit"
                  disabled={inviting}
                  className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                >
                  <UserPlus size={15} />
                  {inviting ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>

            {/* List Collaborators */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono text-gray-400">Current Members ({collaborators.length})</h4>

              {loadingCollabs ? (
                <div className="text-xs font-mono text-gray-500 p-4 border border-gray-800 rounded-xl">
                  Loading collaborators...
                </div>
              ) : collaborators.length === 0 ? (
                <div className="text-xs font-mono text-gray-500 p-4 border border-gray-800 rounded-xl">
                  No additional collaborators added yet. Only the owner ({owner}) has access.
                </div>
              ) : (
                <div className="border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800/60 font-mono text-xs">
                  {collaborators.map((c) => (
                    <div key={c.id} className="p-3.5 flex items-center justify-between hover:bg-gray-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs">
                          {c.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-gray-200">{c.username}</div>
                          {c.email && <div className="text-[10px] text-gray-500">{c.email}</div>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                          {c.role}
                        </span>

                        <button
                          onClick={() => handleRemoveCollaborator(c.username)}
                          className="text-gray-500 hover:text-red-400 transition-colors p-1"
                          title="Remove collaborator"
                        >
                          <UserX size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="border border-red-500/30 rounded-2xl overflow-hidden glass-panel bg-red-950/10">
          <div className="bg-red-500/10 px-5 py-3 border-b border-red-500/20 text-xs font-mono text-red-400 font-bold flex items-center gap-2">
            <Shield size={16} /> Danger Zone
          </div>

          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-gray-100">Delete this repository</h3>
              <p className="text-xs text-gray-400 mt-1">
                Once deleted, all commits, trees, blobs, branches, pull requests, and issues will be permanently removed.
              </p>
            </div>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 flex-shrink-0"
            >
              <Trash2 size={16} />
              {deleting ? 'Deleting...' : 'Delete Repository'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
