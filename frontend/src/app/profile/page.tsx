'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  User as UserIcon, Mail, Sparkles, Lock, Check, Shield, Save,
  Camera, Terminal, Key, UserCheck, AlertCircle, RefreshCw, Upload, Image as ImageIcon, Trash2
} from 'lucide-react';
import { api, User } from '@/lib/api';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
];

export default function ProfilePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status State
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('dragyou_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setCurrentUser(u);
        setDisplayName(u.display_name || '');
        setEmail(u.email || '');
        setBio(u.bio || '');
        setAvatarUrl(u.avatar_url || '');
      } catch (e) {}
    }

    // Fetch fresh user profile from API
    api.getMe()
      .then((u) => {
        setCurrentUser(u);
        setDisplayName(u.display_name || '');
        setEmail(u.email || '');
        setBio(u.bio || '');
        setAvatarUrl(u.avatar_url || '');
        localStorage.setItem('dragyou_user', JSON.stringify(u));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image file size must be less than 5MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 300;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setAvatarUrl(resizedDataUrl);
            setMessage({ type: 'success', text: 'Photo ready! Click "Save Profile Changes" below to save.' });
          } else {
            setAvatarUrl(reader.result as string);
          }
        };
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setSubmitting(true);

    try {
      const payload: any = {
        display_name: displayName,
        email,
        bio,
        avatar_url: avatarUrl,
      };

      if (newPassword) {
        payload.new_password = newPassword;
      }

      const res = await api.updateProfile(payload);
      
      // Update local storage user profile
      const updatedUser = { ...currentUser, ...res.user, avatar_url: avatarUrl, email };
      setCurrentUser(updatedUser);
      localStorage.setItem('dragyou_user', JSON.stringify(updatedUser));

      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Profile & avatar updated successfully!' });

      // Refresh page state smoothly so Navbar updates avatar immediately
      setTimeout(() => {
        window.dispatchEvent(new Event('storage'));
      }, 100);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 font-mono text-xs border border-gray-800 rounded-2xl glass-panel my-8 max-w-xl mx-auto">
        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-400" />
        Loading user profile...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto my-16 space-y-6 text-center animate-fadeIn">
        <div className="glass-panel p-8 rounded-2xl border border-gray-800 space-y-4">
          <Lock size={32} className="mx-auto text-amber-400" />
          <h1 className="text-xl font-bold text-gray-100">Sign in Required</h1>
          <p className="text-xs text-gray-400 font-mono">You must be signed in to view and edit your profile.</p>
          <Link
            href="/login"
            className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs font-mono"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4 animate-fadeIn">
      
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5 tracking-tight">
            <UserIcon className="text-blue-400" size={24} /> Account Settings & Profile
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Manage your avatar photo, display profile details, email, and security credentials
          </p>
        </div>

        <span className="text-xs font-mono px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
          @{currentUser.username}
        </span>
      </div>

      {/* Profile Photo Upload Header Card */}
      <div className="glass-panel p-6 rounded-2xl border border-gray-800/80 flex flex-col sm:flex-row items-center gap-6">
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={currentUser.username}
              className="w-24 h-24 rounded-2xl object-cover border border-gray-700 shadow-2xl transition-all group-hover:opacity-75"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-3xl shadow-2xl transition-all group-hover:opacity-75">
              {currentUser.username[0].toUpperCase()}
            </div>
          )}

          {/* Hover Overlay Camera Badge */}
          <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[11px] font-mono transition-opacity">
            <Camera size={20} className="mb-1 text-blue-400" />
            <span>Upload Photo</span>
          </div>
        </div>

        <div className="space-y-3 text-center sm:text-left flex-1">
          <div>
            <h2 className="text-lg font-bold text-gray-100 font-mono">
              {displayName || currentUser.username}
            </h2>
            <p className="text-xs text-gray-400 font-mono">@{currentUser.username}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 font-mono text-xs">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
            >
              <Upload size={13} /> Upload New Photo
            </button>

            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl('')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-red-400 border border-gray-800 transition-colors"
              >
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preset Avatars Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-gray-800/80 space-y-2">
        <div className="text-xs font-mono text-gray-400 flex items-center gap-1.5">
          <ImageIcon size={14} className="text-blue-400" /> Quick Preset Developer Avatars:
        </div>
        <div className="flex items-center gap-3 overflow-x-auto py-1">
          {AVATAR_PRESETS.map((url, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setAvatarUrl(url)}
              className={`relative rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                avatarUrl === url ? 'border-blue-500 scale-105 shadow-md shadow-blue-500/20' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <img src={url} alt={`Preset ${idx + 1}`} className="w-10 h-10 object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Alert Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono flex items-center gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-6">
        <div className="border-b border-gray-800/80 pb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-blue-400" />
          <h3 className="text-sm font-bold text-gray-100 font-mono">Personal Information</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs font-mono">
          <div>
            <label className="block text-gray-300 font-medium mb-1.5">Username (Immutable)</label>
            <input
              type="text"
              disabled
              value={currentUser.username}
              className="w-full bg-gray-950/60 border border-gray-800/80 rounded-xl px-3.5 py-2.5 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-medium mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Aritra Dahabala"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-gray-300 font-medium mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-gray-300 font-medium mb-1.5">Bio / Description</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell developers about your work and tech stack..."
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors leading-relaxed"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-gray-300 font-medium mb-1.5">Avatar Photo URL</label>
            <div className="relative">
              <Camera className="absolute left-3.5 top-3 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Upload photo above or paste image URL..."
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Security / Change Password */}
        <div className="border-t border-gray-800/80 pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-amber-400" />
            <h3 className="text-sm font-bold text-gray-100 font-mono">Security & Password Update</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs font-mono">
            <div>
              <label className="block text-gray-300 font-medium mb-1.5">New Password (optional)</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-gray-500" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-300 font-medium mb-1.5">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-gray-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <div className="border-t border-gray-800/80 pt-5 flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs font-mono disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20 active:scale-95"
          >
            <Save size={15} />
            <span>{submitting ? 'Saving Changes...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>

    </div>
  );
}
