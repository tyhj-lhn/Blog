import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../lib/api';
import { setTokens, clearTokens, isAuthenticated } from '../lib/auth';
import type { LoginResponse, User } from '../types';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate user state on mount if token exists
  useEffect(() => {
    if (isAuthenticated()) {
      api.get<User>('/auth/me')
        .then((u) => { setUser(u); })
        .catch(() => {
          clearTokens();
        })
        .finally(() => { setLoading(false); });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<LoginResponse>('/auth/login', { email, password });
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const updateUser = useCallback((u: User) => {
    setUser(u);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuth: isAuthenticated() && user !== null, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
