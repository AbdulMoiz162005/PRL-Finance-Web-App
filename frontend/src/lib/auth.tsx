import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { User } from './format';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('rf_user') || 'null');
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(!!localStorage.getItem('rf_token'));

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      const u = res.data.user;
      setUser(u);
      localStorage.setItem('rf_user', JSON.stringify(u));
    } catch {
      /* handled by interceptor */
    }
  };

  useEffect(() => {
    if (localStorage.getItem('rf_token')) {
      refreshUser().finally(() => setLoading(false));
    }
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('rf_token', res.data.token);
    setUser(res.data.user);
    localStorage.setItem('rf_user', JSON.stringify(res.data.user));
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('rf_token');
    localStorage.removeItem('rf_user');
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, logout, refreshUser }), [user, loading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useAuth = () => useContext(Ctx);
