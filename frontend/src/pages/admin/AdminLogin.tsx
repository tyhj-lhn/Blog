import { useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function AdminLogin() {
  const { login, isAuth, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading_, setLoading_] = useState(false);

  // Redirect to dashboard if already authenticated
  if (!loading && isAuth) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('请输入邮箱和密码');
      return;
    }

    setLoading_(true);
    try {
      await login(email.trim(), password);
      const returnUrl = searchParams.get('returnUrl');
      navigate(returnUrl || '/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading_(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-4xl text-zinc-900 mb-2 text-center">MemoryStory</h1>
        <p className="text-sm text-zinc-500 text-center mb-8">管理员登录</p>
        <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
          <div>
            <label htmlFor="email" className="block text-sm text-zinc-600 mb-1">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@memorystory.dev"
              maxLength={255}
              required
              autoFocus
              className="w-full min-h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm text-zinc-600 mb-1">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              maxLength={128}
              required
              className="w-full min-h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading_}
            className="w-full min-h-11 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
          >
            {loading_ ? '登录中...' : '登录'}
          </button>
        </form>
        <p className="mt-6 text-center">
          <a href="/" className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors duration-150">
            ← 返回博客
          </a>
        </p>
      </div>
    </div>
  );
}
