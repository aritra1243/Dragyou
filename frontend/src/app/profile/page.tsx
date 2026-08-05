'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  User as UserIcon, Mail, Sparkles, Lock, Check, Shield, Save,
  Camera, Upload, Image as ImageIcon, Trash2, RefreshCw, AlertCircle, Key
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

  // Section 1: Public Profile Fields
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Section 2: Account Email Fields
  const [email, setEmail] = useState('');
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Section 3: Password Security Fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncUser = (u: User) => {
    setCurrentUser(u);
    setDisplayName(u.display_name || '');
    setEmail(u.email || '');
    setBio(u.bio || '');
    setAvatarUrl(u.avatar_url || '');
    localStorage.setItem('dragyou_user', JSON.stringify(u));
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('dragyou_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        syncUser(u);
      } catch (e) {}
    }

    // Fetch fresh user profile from API
    api.getMe()
      .then((u) => syncUser(u))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Handle Photo File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileMsg({ type: 'error', text: 'Image file size must be less than 5MB.' });
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
            setProfileMsg({ type: 'success', text: 'Photo uploaded! Click "Update Public Profile" below to save.' });
          } else {
            setAvatarUrl(reader.result as string);
          }
        };
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit Section 1: Public Profile
  const handleUpdatePublicProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setSubmittingProfile(true);

    try {
      const res = await api.updateProfile({
        display_name: displayName,
        bio,
        avatar_url: avatarUrl,
      });

      const updatedUser = { ...currentUser, ...res.user, avatar_url: avatarUrl };
      syncUser(updatedUser);
      setProfileMsg({ type: 'success', text: '✓ Public profile updated successfully!' });

      setTimeout(() => window.dispatchEvent(new Event('storage')), 100);
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSubmittingProfile(false);
    }
  };

  // Submit Section 2: Email Address
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setEmailMsg({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setSubmittingEmail(true);

    try {
      const res = await api.updateProfile({ email: cleanEmail });
      const updatedUser = { ...currentUser, ...res.user, email: cleanEmail };
      syncUser(updatedUser);
      setEmailMsg({ type: 'success', text: '✓ Email address updated successfully!' });
    } catch (err: any) {
      setEmailMsg({ type: 'error', text: err.message || 'Failed to update email address.' });
    } finally {
      setSubmittingEmail(false);
    }
  };

  // Submit Section 3: Password Update
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setSubmittingPassword(true);

    try {
      await api.updateProfile({ new_password: newPassword });
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({ type: 'success', text: '✓ Password changed successfully!' });
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setSubmittingPassword(false);
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
            <UserIcon className="text-blue-400" size={24} /> Account & Profile Settings
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            Manage your public developer profile, email address, and security credentials (GitHub Style)
          </p>
        </div>

        <span className="text-xs font-mono px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
          @{currentUser.username}
        </span>
      </div>

      {/* Profile Photo Header Card */}
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
                <Trash2 size={13} /> Remove Photo
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

      {/* SECTION 1: Public Profile Form */}
      <form onSubmit={handleUpdatePublicProfile} className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-5" autoComplete="off">
        <div className="border-b border-gray-800/80 pb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-blue-400" />
          <h3 className="text-sm font-bold text-gray-100 font-mono">Public Profile</h3>
        </div>

        {profileMsg && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-mono flex items-center gap-2.5 ${
              profileMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {profileMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{profileMsg.text}</span>
          </div>
        )}

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

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={submittingProfile}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs font-mono disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20 active:scale-95"
          >
            <Save size={15} />
            <span>{submittingProfile ? 'Saving...' : 'Update Public Profile'}</span>
          </button>
        </div>
      </form>

      {/* SECTION 2: Account Email Form */}
      <form onSubmit={handleUpdateEmail} className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-5" autoComplete="off">
        <div className="border-b border-gray-800/80 pb-3 flex items-center gap-2">
          <Mail size={16} className="text-blue-400" />
          <h3 className="text-sm font-bold text-gray-100 font-mono">Account Email</h3>
        </div>

        {emailMsg && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-mono flex items-center gap-2.5 ${
              emailMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {emailMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{emailMsg.text}</span>
          </div>
        )}

        <div className="text-xs font-mono space-y-2">
          <label className="block text-gray-300 font-medium">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3 h-4 w-4 text-gray-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. dhabalaritra67@gmail.com"
              className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <p className="text-[11px] text-gray-500">Your email address is used for commit signatures and account recovery notifications.</p>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={submittingEmail}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs font-mono disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20 active:scale-95"
          >
            <Save size={15} />
            <span>{submittingEmail ? 'Updating Email...' : 'Update Email'}</span>
          </button>
        </div>
      </form>

      {/* SECTION 3: Change Password Form */}
      <form onSubmit={handleUpdatePassword} className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-5" autoComplete="off">
        <div className="border-b border-gray-800/80 pb-3 flex items-center gap-2">
          <Shield size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-gray-100 font-mono">Change Password</h3>
        </div>

        {passwordMsg && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-mono flex items-center gap-2.5 ${
              passwordMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {passwordMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{passwordMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs font-mono">
          <div>
            <label className="block text-gray-300 font-medium mb-1.5">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-gray-500" />
              <input
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 chars)"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 font-medium mb-1.5">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-gray-500" />
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-3.5 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={submittingPassword}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs font-mono disabled:opacity-50 transition-colors shadow-lg shadow-amber-600/20 active:scale-95"
          >
            <Key size={15} />
            <span>{submittingPassword ? 'Changing Password...' : 'Change Password'}</span>
          </button>
        </div>
      </form>

    </div>
  );
}
