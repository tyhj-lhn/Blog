import { useState, useCallback, type ReactNode } from 'react';
import { api } from '../lib/api';
import { setTokens, clearTokens, isAuthenticated } from '../lib/auth';
import type { LoginResponse, User } from '../types';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<LoginResponse>('/auth/login', { email, password });
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuth: isAuthenticated(), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
