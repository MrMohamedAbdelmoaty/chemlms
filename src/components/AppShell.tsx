/**
 * Application shell: role-scoped sidebar navigation, topbar with theme /
 * language toggles, a notifications bell, and the active dashboard content.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { notificationApi, usersApi } from '../services/api';
import { Avatar, Badge, Button, cn, Field, Input, Modal } from './ui';
import type { Role } from '../types';

export interface NavItem { key: string; labelKey: string; icon: string }

export function AppShell({
  nav, view, onNavigate, children,
}: {
  nav: NavItem[];
  view: string;
  onNavigate: (key: string) => void;
  children: ReactNode;
}) {
  const { t, user, logout, theme, toggleTheme, lang, toggleLang, changePassword } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState(() => (user ? notificationApi.forUser(user.id) : []));
  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) setNotifs(notificationApi.forUser(user.id));
  }, [user, notifOpen]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = notifs.filter((n) => !n.read).length;
  const current = nav.find((n) => n.key === view);

  const submitPw = async () => {
    setPwError('');
    if (!curPw || !newPw) { setPwError('Fill in both fields.'); return; }
    if (newPw.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    setPwBusy(true);
    const res = await changePassword(curPw, newPw);
    setPwBusy(false);
    if (res.ok) { setPwOpen(false); setCurPw(''); setNewPw(''); }
    else setPwError(res.error ?? 'Failed to change password.');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Sidebar (desktop) */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">⚗</div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('appName')}</p>
            <p className="text-[11px] text-slate-400">Chemistry LMS</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
          {nav.map((item) => (
            <button key={item.key} type="button" onClick={() => onNavigate(item.key)}
              aria-current={view === item.key ? 'page' : undefined}
              className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                view === item.key
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
              <span className="text-base">{item.icon}</span>
              <span className="text-start">{t(item.labelKey)}</span>
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <Avatar name={user?.name ?? ''} color={user?.avatarColor ?? 'bg-slate-500'} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.name}</p>
              <p className="text-[11px] capitalize text-slate-400">{user ? t(`role_${user.role}`) : ''}</p>
            </div>
            <button onClick={() => setPwOpen(true)} title="Change password"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">🔑</button>
            <button onClick={logout} title={t('logout')}
              className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">⏻</button>
          </div>
        </div>
      </aside>

      {/* change password modal */}
      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Change password">
        <div className="space-y-3">
          <Field label="Current password">
            <Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="New password">
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" placeholder="Min. 6 characters" />
          </Field>
          {pwError && <p className="text-sm text-rose-600">⚠ {pwError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={submitPw} disabled={pwBusy}>{pwBusy ? '…' : 'Change password'}</Button>
          </div>
        </div>
      </Modal>

      {/* Mobile top nav */}
      <div className="no-print sticky top-0 z-30 flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 dark:border-slate-800 dark:bg-slate-900 md:hidden">
        {nav.map((item) => (
          <button key={item.key} type="button" onClick={() => onNavigate(item.key)}
            aria-current={view === item.key ? 'page' : undefined}
            className={cn('shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium',
              view === item.key ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                : 'text-slate-500 dark:text-slate-400')}>
            <span className="mr-1">{item.icon}</span>{t(item.labelKey)}
          </button>
        ))}
      </div>

      {/* Main */}
      <div className="md:pl-60">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-5 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 md:top-0">
          <h1 className="truncate text-lg font-semibold text-slate-800 dark:text-slate-100">
            {current ? t(current.labelKey) : t('dashboard')}
          </h1>
          <div className="flex items-center gap-1.5">
            <button onClick={toggleTheme} title={t('theme')} aria-label={t('theme')}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={toggleLang} title={t('language')} aria-label={t('language')}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              {lang === 'ar' ? '🇬🇧' : '🇸🇦'}
            </button>
            <div className="relative" ref={popRef}>
              <button onClick={() => setNotifOpen((o) => !o)} aria-label={t('notifications')}
                className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                🔔
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute end-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center justify-between px-2 py-1">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('notifications')}</p>
                    {unread > 0 && (
                      <button onClick={() => { notifs.forEach((n) => notificationApi.markRead(n.id)); }}
                        className="text-xs text-brand-600 hover:underline">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifs.length === 0 && <p className="px-2 py-4 text-center text-sm text-slate-400">{t('noData')}</p>}
                    {notifs.map((n) => (
                      <button key={n.id} onClick={() => notificationApi.markRead(n.id)}
                        className={cn('mb-1 block w-full rounded-lg p-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50',
                          !n.read && 'bg-brand-50/60 dark:bg-brand-900/20')}>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{n.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{n.body}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400">{new Date(n.at).toLocaleString()}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <Avatar name={user?.name ?? ''} color={user?.avatarColor ?? 'bg-slate-500'} size={32} />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}

/** Small helper to resolve a user's full name from an id. */
export function userName(id: string): string {
  return usersApi.byId(id)?.name ?? id;
}

export function roleBadge(role: Role) {
  const tones: Record<Role, 'blue' | 'violet' | 'green' | 'amber'> = {
    admin: 'blue', teacher: 'violet', student: 'green', parent: 'amber',
  };
  return <Badge tone={tones[role]}>{role}</Badge>;
}
