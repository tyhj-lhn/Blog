import { useState, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, Save, Key, User, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import type { User as UserType } from '../../types';

const AVATAR_MAX = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png'];

type Feedback = { type: 'success' | 'error'; message: string } | null;

export default function AdminProfile() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Username ---
  const [username, setUsername] = useState(user?.username ?? '');
  const [usernameFeedback, setUsernameFeedback] = useState<Feedback>(null);

  // --- Password ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);

  // --- Avatar ---
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const clearFeedback = useCallback(() => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setUsernameFeedback(null);
      setPasswordFeedback(null);
    }, 4000);
  }, []);

  // --- Username mutation ---
  const usernameMutation = useMutation({
    mutationFn: (newUsername: string) =>
      api.put<UserType>('/auth/me', { username: newUsername }),
    onSuccess: (data) => {
      updateUser(data);
      setUsernameFeedback({ type: 'success', message: '用户名已更新' });
      clearFeedback();
    },
    onError: (err: Error) => {
      setUsernameFeedback({ type: 'error', message: err.message });
      clearFeedback();
    },
  });

  // --- Password mutation ---
  const passwordMutation = useMutation({
    mutationFn: (pw: { currentPassword: string; newPassword: string }) =>
      api.put<{ message: string }>('/auth/me/password', pw),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setPasswordFeedback({ type: 'success', message: '密码已更改（所有设备已登出，请重新登录）' });
      clearFeedback();
    },
    onError: (err: Error) => {
      setPasswordFeedback({ type: 'error', message: err.message });
      clearFeedback();
    },
  });

  // --- Avatar upload ---
  const handleAvatarSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Client-side validation
      if (!ALLOWED_MIME.includes(file.type)) {
        setAvatarError('仅支持 JPG 和 PNG 格式');
        return;
      }
      if (file.size > AVATAR_MAX) {
        setAvatarError('图片不能超过 2 MB');
        return;
      }

      setAvatarError(null);
      setAvatarUploading(true);

      try {
        const formData = new FormData();
        formData.append('file', file);
        const { url } = await api.upload<{ url: string }>('/admin/upload', formData);

        // Update profile with new avatar URL
        const updatedUser = await api.put<UserType>('/auth/me', { avatar: url });
        updateUser(updatedUser);
        setAvatarPreview(url);
      } catch (err) {
        setAvatarError(err instanceof Error ? err.message : '上传失败');
      } finally {
        setAvatarUploading(false);
        // Reset file input so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [updateUser],
  );

  const handleRemoveAvatar = useCallback(async () => {
    try {
      const updatedUser = await api.put<UserType>('/auth/me', { avatar: null });
      updateUser(updatedUser);
      setAvatarPreview(null);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : '移除失败');
    }
  }, [updateUser]);

  const handleSaveUsername = () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameFeedback({ type: 'error', message: '用户名不能为空' });
      return;
    }
    if (trimmed === user?.username) {
      setUsernameFeedback({ type: 'error', message: '用户名未变化' });
      return;
    }
    usernameMutation.mutate(trimmed);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordFeedback({ type: 'error', message: '请输入当前密码' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', message: '新密码至少 6 位' });
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  const avatarUrl = avatarPreview ?? user?.avatar;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="font-heading text-2xl text-zinc-900 mb-8">管理员设置</h1>

      {/* ---- Avatar ---- */}
      <section className="bg-white rounded-xl border border-zinc-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Camera size={16} />
          头像
        </h2>

        <div className="flex items-center gap-5">
          {/* Avatar display */}
          <div className="relative group shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="管理员头像"
                className="w-20 h-20 rounded-full object-cover ring-2 ring-zinc-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-zinc-200 flex items-center justify-center ring-2 ring-zinc-200">
                <User size={32} className="text-zinc-400" />
              </div>
            )}

            {/* Overlay on hover */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute inset-0 rounded-full bg-zinc-950/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
            >
              <Camera size={20} className="text-white" />
            </button>

            {/* Uploading spinner */}
            {avatarUploading && (
              <div className="absolute inset-0 rounded-full bg-zinc-950/60 flex items-center justify-center">
                <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </div>
            )}
          </div>

          <div>
            <p className="text-sm text-zinc-700 mb-1">点击头像更换图片</p>
            <p className="text-xs text-zinc-400">JPG 或 PNG，不超过 2 MB</p>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="text-xs text-red-500 hover:text-red-600 mt-1 cursor-pointer"
              >
                移除头像
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleAvatarSelect}
            className="hidden"
          />
        </div>

        {avatarError && (
          <div className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle size={14} />
            {avatarError}
          </div>
        )}
      </section>

      {/* ---- Username ---- */}
      <section className="bg-white rounded-xl border border-zinc-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <User size={16} />
          账户名
        </h2>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="username" className="block text-xs text-zinc-500 mb-1">
              用户名
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={50}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveUsername}
            disabled={usernameMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-60"
          >
            <Save size={14} />
            {usernameMutation.isPending ? '保存中...' : '保存'}
          </button>
        </div>

        {usernameFeedback && (
          <div
            className={`mt-3 flex items-center gap-1.5 text-sm ${
              usernameFeedback.type === 'success' ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {usernameFeedback.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {usernameFeedback.message}
          </div>
        )}
      </section>

      {/* ---- Password ---- */}
      <section className="bg-white rounded-xl border border-zinc-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Key size={16} />
          更改密码
        </h2>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-xs text-zinc-500 mb-1">
              当前密码
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-xs text-zinc-500 mb-1">
              新密码（至少 6 位）
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              maxLength={128}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={passwordMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-60"
          >
            <Key size={14} />
            {passwordMutation.isPending ? '更改中...' : '更改密码'}
          </button>
        </form>

        {passwordFeedback && (
          <div
            className={`mt-3 flex items-center gap-1.5 text-sm ${
              passwordFeedback.type === 'success' ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {passwordFeedback.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {passwordFeedback.message}
          </div>
        )}
      </section>
    </div>
  );
}
