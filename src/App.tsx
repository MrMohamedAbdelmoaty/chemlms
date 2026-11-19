/**
 * ChemLMS root component: auth gate → role-based shell → dashboard.
 * Chemistry Lab is exposed to teachers and students; navigation is defined
 * per role so every role only sees what its permissions allow.
 */
import { useState } from 'react';
import { useApp } from './context/AppContext';
import { AppShell, type NavItem } from './components/AppShell';
import { cn } from './components/ui';
import { Login } from './features/auth/Login';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { TeacherDashboard } from './features/teacher/TeacherDashboard';
import { StudentDashboard } from './features/student/StudentDashboard';
import { ParentDashboard } from './features/parent/ParentDashboard';
import { ChemTools } from './features/chem/ChemTools';
import type { Role } from './types';

const NAV: Record<Role, NavItem[]> = {
  admin: [
    { key: 'dashboard', labelKey: 'overview', icon: '📊' },
    { key: 'curricula', labelKey: 'curricula', icon: '📚' },
    { key: 'courses', labelKey: 'courses', icon: '📖' },
    { key: 'questions', labelKey: 'questionBank', icon: '❓' },
    { key: 'quizzes', labelKey: 'quizzes', icon: '📝' },
    { key: 'gradebook', labelKey: 'gradebook', icon: '📒' },
    { key: 'attendance', labelKey: 'attendance', icon: '✅' },
    { key: 'chemistry', labelKey: 'chemistryLab', icon: '⚗️' },
    { key: 'videos', labelKey: 'videos', icon: '🎬' },
    { key: 'users', labelKey: 'users', icon: '👥' },
    { key: 'classes', labelKey: 'classes', icon: '🏫' },
    { key: 'messaging', labelKey: 'messaging', icon: '💬' },
    { key: 'notifications', labelKey: 'notifications', icon: '🔔' },
    { key: 'announcements', labelKey: 'announcements', icon: '📢' },
    { key: 'reports', labelKey: 'reports', icon: '📈' },
    { key: 'audit', labelKey: 'auditLog', icon: '📋' },
    { key: 'settings', labelKey: 'settings', icon: '⚙️' },
  ],
  teacher: [
    { key: 'dashboard', labelKey: 'overview', icon: '📊' },
    { key: 'courses', labelKey: 'courses', icon: '📖' },
    { key: 'questionBank', labelKey: 'questionBank', icon: '❓' },
    { key: 'quizzes', labelKey: 'quizzes', icon: '📝' },
    { key: 'gradebook', labelKey: 'gradebook', icon: '📒' },
    { key: 'attendance', labelKey: 'attendance', icon: '✅' },
    { key: 'live', labelKey: 'liveClasses', icon: '📡' },
    { key: 'analytics', labelKey: 'analytics', icon: '🔬' },
    { key: 'worksheets', labelKey: 'worksheets', icon: '🖨️' },
    { key: 'messages', labelKey: 'messaging', icon: '💬' },
    { key: 'chem', labelKey: 'chemistryLab', icon: '⚗️' },
  ],
  student: [
    { key: 'home', labelKey: 'overview', icon: '🏠' },
    { key: 'courses', labelKey: 'courses', icon: '📖' },
    { key: 'assignments', labelKey: 'assignments', icon: '📝' },
    { key: 'live', labelKey: 'liveClasses', icon: '📡' },
    { key: 'grades', labelKey: 'grades', icon: '📒' },
    { key: 'progress', labelKey: 'progress', icon: '🎯' },
    { key: 'certificates', labelKey: 'certificates', icon: '🏆' },
    { key: 'messages', labelKey: 'messaging', icon: '💬' },
    { key: 'chem', labelKey: 'chemistryLab', icon: '⚗️' },
  ],
  parent: [
    { key: 'dashboard', labelKey: 'overview', icon: '🏠' },
    { key: 'grades', labelKey: 'grades', icon: '📒' },
    { key: 'assignments', labelKey: 'assignments', icon: '📝' },
    { key: 'attendance', labelKey: 'attendance', icon: '✅' },
    { key: 'live', labelKey: 'liveClasses', icon: '📡' },
    { key: 'progress', labelKey: 'progress', icon: '🎯' },
    { key: 'reports', labelKey: 'reportCard', icon: '📄' },
    { key: 'messages', labelKey: 'messaging', icon: '💬' },
  ],
};

function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-[60] flex flex-col gap-2">
      {toasts.map((tst) => (
        <div key={tst.id}
          className={cn('pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg',
            tst.tone === 'success' ? 'bg-emerald-600' : tst.tone === 'error' ? 'bg-rose-600' : 'bg-slate-700 dark:bg-slate-600')}>
          {tst.text}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const { user } = useApp();
  const [view, setView] = useState('dashboard');

  if (!user) {
    return (
      <>
        <Login />
        <Toasts />
      </>
    );
  }

  const nav = NAV[user.role];
  const effectiveView = nav.some((n) => n.key === view) ? view : nav[0].key;

  return (
    <>
      <AppShell nav={nav} view={effectiveView} onNavigate={setView}>
        {user.role === 'admin' && <AdminDashboard admin={user} view={effectiveView} />}
        {user.role === 'teacher' && <TeacherDashboard teacher={user} view={effectiveView} setView={setView} />}
        {user.role === 'student' && <StudentDashboard student={user} view={effectiveView} setView={setView} />}
        {user.role === 'parent' && <ParentDashboard parent={user} view={effectiveView} setView={setView} />}
        {(user.role === 'teacher' || user.role === 'student') && effectiveView === 'chem' && <ChemTools />}
      </AppShell>
      <Toasts />
    </>
  );
}
