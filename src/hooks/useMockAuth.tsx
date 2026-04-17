import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { HAS_API, api, setToken, getToken, ApiError } from '@/lib/api';

export type MockRole = 'admin' | 'user';

export interface MockUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: MockRole;
  createdAt: string;
  bio?: string | null;
  theme?: string;
  language?: string;
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
  updateProfile: (updates: Partial<Pick<MockUser, 'displayName' | 'avatarUrl' | 'bio' | 'theme' | 'language'>>) => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error?: string }>;
}

const USERS_KEY = 'mock_auth_users';
const SESSION_KEY = 'mock_auth_session';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------- localStorage helpers (mock mode) ----------
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

  // ---------- Bootstrap session ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (HAS_API) {
        const token = getToken();
        if (!token) { if (!cancelled) setLoading(false); return; }
        try {
          const { user: u } = await api<{ user: MockUser }>('/auth/me');
          if (!cancelled) setUser(u);
        } catch {
          setToken(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }
      // Mock fallback
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const session = JSON.parse(raw) as { userId: string };
          const stored = readUsers().find((u) => u.id === session.userId);
          if (stored) setUser(stripPassword(stored));
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (HAS_API) {
      try {
        const { token, user: u } = await api<{ token: string; user: MockUser }>('/auth/login', {
          method: 'POST', body: { email, password }, auth: false,
        });
        setToken(token);
        setUser(u);
        return {};
      } catch (e) {
        return { error: e instanceof ApiError ? e.message : 'Inloggen mislukt' };
      }
    }
    const users = readUsers();
    const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!found) return { error: 'Geen account gevonden met dit e-mailadres.' };
    if (found.password !== password) return { error: 'Onjuist wachtwoord.' };
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: found.id }));
    setUser(stripPassword(found));
    return {};
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName: string) => {
    if (HAS_API) {
      try {
        const { token, user: u } = await api<{ token: string; user: MockUser }>('/auth/signup', {
          method: 'POST', body: { email, password, displayName }, auth: false,
        });
        setToken(token);
        setUser(u);
        return {};
      } catch (e) {
        return { error: e instanceof ApiError ? e.message : 'Registratie mislukt' };
      }
    }
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
    if (HAS_API) {
      setToken(null);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    (updates: Partial<Pick<MockUser, 'displayName' | 'avatarUrl' | 'bio' | 'theme' | 'language'>>) => {
      if (HAS_API) {
        setUser((prev) => (prev ? { ...prev, ...updates } : prev));
        api('/auth/me', { method: 'PATCH', body: updates }).catch((e) => {
          console.error('updateProfile failed', e);
        });
        return;
      }
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

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (HAS_API) {
      try {
        await api('/auth/change-password', {
          method: 'POST',
          body: { currentPassword, newPassword },
        });
        return {};
      } catch (e) {
        return { error: e instanceof ApiError ? e.message : 'Wachtwoord wijzigen mislukt' };
      }
    }
    // Mock fallback (localStorage)
    const users = readUsers();
    const idx = user ? users.findIndex((u) => u.id === user.id) : -1;
    if (idx === -1) return { error: 'Niet ingelogd.' };
    if (users[idx].password !== currentPassword) return { error: 'Huidig wachtwoord is onjuist.' };
    if (currentPassword === newPassword) return { error: 'Nieuw wachtwoord moet verschillen van het huidige wachtwoord.' };
    users[idx] = { ...users[idx], password: newPassword };
    writeUsers(users);
    return {};
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useMockAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useMockAuth must be used inside MockAuthProvider');
  return ctx;
}
