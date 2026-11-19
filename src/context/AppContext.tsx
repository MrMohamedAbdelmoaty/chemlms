/**
 * Global app context: authentication, theme (light/dark), language (en/ar,
 * RTL), i18n lookup, and lightweight toasts.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dictionaries, type Lang } from '../i18n';
import {
  login as apiLogin,
  register as apiRegister,
  changePassword as apiChangePassword,
  confirmAccount as apiConfirmAccount,
} from '../services/api';
import type { AuthResult, User, Role } from '../types';
import { db } from '../services/db';

export interface Toast { id: number; text: string; tone: 'info' | 'success' | 'error' }

interface AppCtx {
  user: User | null;
  /** Sign in by email **or** phone + password. */
  login: (identifier: string, password: string) => Promise<AuthResult>;
  loginAs: (identifier: string, password: string) => Promise<AuthResult>;
  /** Register by email **or** phone. */
  register: (input: { name: string; identifier?: string; email?: string; phone?: string; password: string; role?: Role }) => Promise<AuthResult & { confirmationToken?: string; confirmationTarget?: string }>;
  /** Change the signed-in user's password. */
  changePassword: (current: string, next: string) => Promise<AuthResult>;
  /** Confirm an account with a registration token. */
  confirm: (token: string) => AuthResult;
  logout: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  lang: Lang;
  toggleLang: () => void;
  t: (key: string) => string;
  toasts: Toast[];
  toast: (text: string, tone?: Toast['tone']) => void;
}

const Ctx = createContext<AppCtx | null>(null);

const BRAND_PALETTES: Record<string, [string, string, string, string, string, string, string, string, string, string]> = {
  indigo: ['#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81'],
  teal: ['#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a'],
  amber: ['#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'],
  rose: ['#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337'],
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(db.settings.theme);
  const [lang, setLang] = useState<Lang>(db.settings.defaultLanguage);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Apply theme, direction and brand palette to <html>.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    root.setAttribute('lang', lang);
    const palette = BRAND_PALETTES[db.settings.primaryColor] ?? BRAND_PALETTES.indigo;
    palette.forEach((c, i) => root.style.setProperty(`--brand-${i * 100}`, c));
  }, [theme, lang, db.settings.primaryColor]);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await apiLogin(identifier, password);
    if (res.ok && res.user) {
      setUser(res.user);
      toast(`${res.user.name} — ${res.user.role}`, 'success');
    }
    return res;
  }, [toast]);

  const register = useCallback(async (input: { name: string; identifier?: string; email?: string; phone?: string; password: string; role?: Role }) => {
    const res = await apiRegister({
      name: input.name,
      email: input.email,
      phone: input.phone,
      password: input.password,
      role: input.role,
      identifier: input.identifier,
    });
    if (res.ok && res.user) {
      setUser(res.user);
      toast(`${res.user.name} — ${res.user.role}`, 'success');
    }
    return res;
  }, [toast]);

  const changePassword = useCallback(async (current: string, next: string) => {
    if (!user) return { ok: false, error: 'Not signed in.' };
    const res = await apiChangePassword(user.id, current, next);
    if (res.ok) toast('Password changed successfully', 'success');
    return res;
  }, [user, toast]);

  const confirm = useCallback((token: string) => {
    if (!user) return { ok: false, error: 'Not signed in.' };
    const res = apiConfirmAccount(user.id, token);
    if (res.ok && res.user) setUser(res.user);
    return res;
  }, [user]);

  const logout = useCallback(() => setUser(null), []);

  const value = useMemo<AppCtx>(() => ({
    user, login, loginAs: login, register, changePassword, confirm, logout,
    theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    lang, toggleLang: () => setLang((l) => (l === 'en' ? 'ar' : 'en')),
    t: (key: string) => dictionaries[lang][key] ?? dictionaries.en[key] ?? key,
    toasts, toast,
  }), [user, login, register, changePassword, confirm, logout, theme, lang, toasts, toast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
