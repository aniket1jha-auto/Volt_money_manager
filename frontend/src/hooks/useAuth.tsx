import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@/types';
import { getCurrentUser } from '@/lib/api';

const STORAGE_KEY = 'volt.session';

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function writeSession(user: User | null) {
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const user = readSession();
    setState({ user, loading: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: async (email, password) => {
        // Mock auth — any non-empty creds succeed and load the seed user.
        if (!email.trim() || !password.trim()) {
          throw new Error('Email and password are required');
        }
        const seed = await getCurrentUser('user_001');
        if (!seed) throw new Error('User not found');
        const user: User = { ...seed, email };
        writeSession(user);
        setState({ user, loading: false });
        return user;
      },
      logout: () => {
        writeSession(null);
        setState({ user: null, loading: false });
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
