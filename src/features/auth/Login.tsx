/**
 * Role-based login with demo accounts for Admin, Teacher, Student and
 * Parent. Selecting a role fills the credentials so the reviewer can sign
 * in instantly.
 */
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { demoAccounts } from '../../services/api';
import { Button, Field, Input } from '../../components/ui';
import type { Role } from '../../types';

const ROLE_META: Record<Role, { icon: string; blurb: string }> = {
  admin: { icon: '🛡️', blurb: 'School management, users, curricula, reports' },
  teacher: { icon: '🧑‍🏫', blurb: 'Courses, quizzes, gradebook, live classes' },
  student: { icon: '🎓', blurb: 'Lessons, quizzes, grades, chemistry lab' },
  parent: { icon: '👨‍👩‍👧', blurb: 'Child progress, reports, notifications' },
};

export function Login() {
  const { t, login, theme, toggleTheme, lang, toggleLang } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const accounts = demoAccounts();

  const signIn = (e: React.FormEvent) => {
    e.preventDefault();
    const res = login(email, password);
    if (!res.ok) setError(res.error ?? t('invalidCredentials'));
  };

  const quickFill = (acc: { email: string; password: string }) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError('');
    login(acc.email, acc.password);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-100 via-brand-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="no-print mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:flex-row md:items-center md:justify-center md:py-16">
        {/* Left: brand */}
        <div className="mx-auto w-full max-w-sm md:mx-0">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white shadow-lg">
              ⚗
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('appName')}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('tagline')}</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            A multi-curriculum e-learning platform with interactive chemistry tools: periodic table, notation
            rendering, equation balancer, virtual lab and chemistry-aware auto-grading.
          </p>
          <div className="mt-6 flex gap-2">
            <Button variant="secondary" onClick={toggleTheme} className="w-full justify-center">
              {theme === 'dark' ? '☀️ ' + t('light') : '🌙 ' + t('dark')}
            </Button>
            <Button variant="secondary" onClick={toggleLang} className="w-full justify-center">
              {lang === 'ar' ? '🇬🇧 English' : '🇸🇦 العربية'}
            </Button>
          </div>
        </div>

        {/* Right: sign-in */}
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t('login')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('loginSubtitle')}</p>

            <form onSubmit={signIn} className="mt-5 space-y-4">
              <Field label={t('email')}>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="name@chemlms.edu" />
              </Field>
              <Field label={t('password')}>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
              </Field>
              {error && <p className="text-sm text-rose-600">⚠ {error}</p>}
              <Button type="submit" className="w-full justify-center">{t('signIn')}</Button>
            </form>

            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{t('demoAccount')}</p>
              <div className="grid grid-cols-2 gap-3">
                {accounts.map((acc) => (
                  <button key={acc.role} type="button" onClick={() => quickFill(acc)}
                    className="rounded-xl border border-slate-200 p-3 text-left transition-all hover:border-brand-400 hover:shadow-md dark:border-slate-700 dark:hover:border-brand-500">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{ROLE_META[acc.role].icon}</span>
                      <span className="text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">{t(`role_${acc.role}`)}</span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">{acc.email}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
