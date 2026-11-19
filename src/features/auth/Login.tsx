/**
 * Login + registration screen.
 *
 * Real authentication: sign in with email + password (verified against a
 * PBKDF2 hash), or register a brand-new account with a chosen email,
 * password and role. No demo quick-fill — every account is a real account.
 */
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { isValidEmail, isStrongPassword } from '../../services/password';
import { Button, Field, Input } from '../../components/ui';
import type { Role } from '../../types';

const ROLE_META: Record<Role, { icon: string; blurb: string }> = {
  admin: { icon: '🛡️', blurb: 'School management, users, curricula, reports' },
  teacher: { icon: '🧑‍🏫', blurb: 'Courses, quizzes, gradebook, live classes' },
  student: { icon: '🎓', blurb: 'Lessons, quizzes, grades, chemistry lab' },
  parent: { icon: '👨‍👩‍👧', blurb: 'Child progress, reports, notifications' },
};

export function Login() {
  const { t, login, register, theme, toggleTheme, lang, toggleLang, toast } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // register fields
  const [rName, setRName] = useState('');
  const [rEmail, setREmail] = useState('');
  const [rPassword, setRPassword] = useState('');
  const [rRole, setRRole] = useState<Role>('student');
  const [rError, setRError] = useState('');
  const [rBusy, setRBusy] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError(t('invalidCredentials')); return; }
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (!res.ok) setError(res.error ?? t('invalidCredentials'));
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setRError('');
    if (!rName.trim() || !rEmail.trim() || !rPassword) { setRError('All fields are required.'); return; }
    if (!isValidEmail(rEmail)) { setRError('Please enter a valid email address.'); return; }
    if (!isStrongPassword(rPassword)) { setRError('Password must be at least 6 characters.'); return; }
    setRBusy(true);
    const res = await register({ name: rName, email: rEmail, password: rPassword, role: rRole });
    setRBusy(false);
    if (!res.ok) { setRError(res.error ?? 'Registration failed.'); return; }
    toast('Account created — welcome!', 'success');
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

        {/* Right: auth card */}
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800">
            {/* tabs */}
            <div className="mb-5 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-700/60">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                  mode === 'login' ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t('login')}
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setRError(''); }}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                  mode === 'register' ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t('register')}
              </button>
            </div>

            {mode === 'login' ? (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('loginSubtitle')}</p>
                <form onSubmit={signIn} className="mt-5 space-y-4">
                  <Field label={t('email')}>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="name@school.edu" />
                  </Field>
                  <Field label={t('password')}>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
                  </Field>
                  {error && <p className="text-sm text-rose-600">⚠ {error}</p>}
                  <Button type="submit" disabled={busy} className="w-full justify-center">
                    {busy ? '…' : t('signIn')}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400">Create a new account. Passwords are stored securely as a hash.</p>
                <form onSubmit={signUp} className="mt-5 space-y-4">
                  <Field label={t('name')}>
                    <Input value={rName} onChange={(e) => setRName(e.target.value)} placeholder={t('name')} />
                  </Field>
                  <Field label={t('email')}>
                    <Input type="email" value={rEmail} onChange={(e) => setREmail(e.target.value)} autoComplete="username" placeholder="name@school.edu" />
                  </Field>
                  <Field label={t('password')}>
                    <Input type="password" value={rPassword} onChange={(e) => setRPassword(e.target.value)} autoComplete="new-password" placeholder="Min. 6 characters" />
                  </Field>
                  <Field label={t('role')}>
                    <div className="grid grid-cols-2 gap-2">
                      {(['student', 'parent', 'teacher'] as Role[]).map((r) => (
                        <button
                          key={r} type="button"
                          onClick={() => setRRole(r)}
                          className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition-colors ${
                            rRole === r ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span className="text-lg">{ROLE_META[r].icon}</span>
                          <span className="text-sm capitalize text-slate-700 dark:text-slate-200">{t(`role_${r}`)}</span>
                        </button>
                      ))}
                    </div>
                  </Field>
                  {rError && <p className="text-sm text-rose-600">⚠ {rError}</p>}
                  <Button type="submit" disabled={rBusy} className="w-full justify-center">
                    {rBusy ? '…' : t('createAccount')}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
