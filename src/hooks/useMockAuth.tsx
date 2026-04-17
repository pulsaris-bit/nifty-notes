import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

export type MockRole = 'admin' | 'user';

export interface MockUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: MockRole;
  createdAt: string;
}

interface StoredUser extends MockUser {
  password: string; // mock only — never do this in real apps
}

interface AuthContextValue {
  user: MockUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string, displayName: string) => Promise<{ error?: string }>;
  logout: () => void;
  updateProfile: (updates: Partial<Pick<MockUser, 'displayName' | 'avatarUrl'>>) => void;
}

const USERS_KEY = 'mock_auth_users';
const SESSION_KEY = 'mock_auth_session';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function stripPassword(u: StoredUser): MockUser {
  const { password, ...rest } = u;
  return rest;
}

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw) as { userId: string };
        const stored = readUsers().find((u) => u.id === session.userId);
        if (stored) setUser(stripPassword(stored));
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const users = readUsers();
    const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!found) return { error: 'Geen account gevonden met dit e-mailadres.' };
    if (found.password !== password) return { error: 'Onjuist wachtwoord.' };
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: found.id }));
    setUser(stripPassword(found));
    return {};
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName: string) => {
    const users = readUsers();
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { error: 'Er bestaat al een account met dit e-mailadres.' };
    }
    const isFirst = users.length === 0;
    const newUser: StoredUser = {
      id: `u-${Date.now()}`,
      email,
      password,
      displayName,
      avatarUrl: null,
      role: isFirst ? 'admin' : 'user',
      createdAt: new Date().toISOString(),
    };
    const next = [...users, newUser];
    writeUsers(next);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: newUser.id }));
    setUser(stripPassword(newUser));
    return {};
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    (updates: Partial<Pick<MockUser, 'displayName' | 'avatarUrl'>>) => {
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...updates };
        const users = readUsers().map((u) => (u.id === prev.id ? { ...u, ...updates } : u));
        writeUsers(users);
        return next;
      });
    },
    [],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useMockAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useMockAuth must be used inside MockAuthProvider');
  return ctx;
}
