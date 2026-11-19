/**
 * Parent dashboard: child switcher at the top, then read-only views of each
 * child's grades, assignment status, exams, attendance, live-class schedule,
 * teacher feedback, progress trends and certificates. Parents cannot edit
 * grades, submit work or take quizzes — every view is display-only.
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  analyticsApi, announcementApi, assessmentApi, attendanceApi, classApi, courseApi,
  gradebookApi, liveApi, messageApi, notificationApi, usersApi,
} from '../../services/api';
import {
  Avatar, Badge, Button, Card, EmptyState, Modal, ProgressBar, Select, StatCard, Table, THead, TRow, TD, Textarea,
} from '../../components/ui';
import { BarChart, MasteryBar, Ring, TrendChart } from '../../components/charts';
import { Messaging, contactsFor } from '../../features/Messaging';
import type { User } from '../../types';

export function ParentDashboard({ parent, view, setView }: {
  parent: User; view: string; setView: (v: string) => void;
}) {
  const { t, toast } = useApp();
  const children = useMemo(
    () => (parent.children ?? []).map((id) => usersApi.byId(id)).filter(Boolean) as User[],
    [parent],
  );
  const [childId, setChildId] = useState(children[0]?.id ?? '');
  const child = usersApi.byId(childId);

  const classes = useMemo(
    () => classApi.list().filter((c) => child && c.studentIds.includes(child.id)),
    [child],
  );

  if (view === 'messages') {
    return <Messaging me={parent} allowedPartners={contactsFor(parent)} title={t('messaging') + ' — ' + t('guardians')} />;
  }

  if (!child) {
    return <Card title={t('readOnly')}><EmptyState>{t('noData')}</EmptyState></Card>;
  }

  return (
    <div className="space-y-4">
      {/* Child switcher */}
      <Card title={t('childSwitcher')}>
        <div className="flex flex-wrap gap-3">
          {children.map((c) => (
            <button key={c.id} onClick={() => setChildId(c.id)}
              className={`flex items-center gap-2 rounded-xl border-2 p-2.5 transition-colors ${
                childId === c.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}>
              <Avatar name={c.name} color={c.avatarColor} size={36} />
              <div className="text-start">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.name}</p>
                <p className="text-xs text-slate-400">{classes.find((cl) => cl.studentIds.includes(c.id))?.name ?? ''}</p>
              </div>
              {childId === c.id && <Badge tone="blue">✓</Badge>}
            </button>
          ))}
        </div>
      </Card>

      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {child.name} · {t('readOnly')} view
        </p>
        <Badge tone="amber">🔒 {t('readOnly')}</Badge>
      </div>

      {view === 'dashboard' && <ParentOverview parent={parent} child={child} classes={classes} />}
      {view === 'grades' && <ParentGrades child={child} classes={classes} />}
      {view === 'assignments' && <ParentAssignments child={child} classes={classes} />}
      {view === 'attendance' && <ParentAttendance child={child} classes={classes} />}
      {view === 'live' && <ParentLive child={child} classes={classes} />}
      {view === 'progress' && <ParentProgress child={child} classes={classes} />}
      {view === 'reports' && <ParentReports child={child} classes={classes} />}
    </div>
  );
}

/* --------------------------------- overview ------------------------------- */
function ParentOverview({ parent, child, classes }: { parent: User; child: User; classes: ReturnType<typeof classApi.list> }) {
  const { t } = useApp();
  const avg = gradebookApi.studentAverage(child.id);
  const att = attendanceApi.studentStats(child.id);
  const trend = analyticsApi.studentTrend(child.id);
  const notifs = notificationApi.forUser(parent.id).slice(0, 5);

  const upcomingExams = classes.flatMap((c) => gradebookApi.forClass(c.id).filter((r) => r.type === 'exam'));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('average')} value={`${avg}%`} sub={t('readOnly')} icon="📈" tone="blue" />
        <StatCard label={t('attendanceRate')} value={`${att.rate}%`} sub={`${att.present} present · ${att.late} late`} icon="✅" tone="green" />
        <StatCard label={t('exams')} value={upcomingExams.length} sub="Upcoming / past exams" icon="📝" tone="violet" />
        <StatCard label={t('trend')} value="↗" sub="Grade trend" icon="📉" tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`${child.name} — ${t('trend')}`}>
          <TrendChart values={trend} />
          <p className="mt-1 text-xs text-slate-400">Average across graded assessments</p>
        </Card>

        <Card title={t('notifications')} subtitle="Automatic alerts">
          <div className="space-y-2">
            {notifs.map((n) => (
              <div key={n.id} className={`rounded-lg border p-2.5 text-sm ${n.read ? 'border-slate-100 dark:border-slate-700/50' : 'border-brand-200 bg-brand-50/50 dark:border-brand-800 dark:bg-brand-900/20'}`}>
                <p className="font-medium text-slate-700 dark:text-slate-200">{n.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{n.body}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('teacherFeedback')}>
          <div className="space-y-2">
            {messageApi.all().filter((m) => (m.fromId === child.id || m.toId === child.id) && m.fromId !== parent.id)
              .slice(0, 3).map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-100 p-2.5 text-sm dark:border-slate-700/50">
                  <p className="text-xs text-slate-400">{usersApi.byId(m.fromId === child.id ? m.toId : m.fromId)?.name}</p>
                  <p className="text-slate-600 dark:text-slate-300">{m.content}</p>
                </div>
              ))}
            <p className="text-xs text-slate-400">Message teachers from the Messaging tab.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------- grades -------------------------------- */
function ParentGrades({ child, classes }: { child: User; classes: ReturnType<typeof classApi.list> }) {
  const { t } = useApp();
  const rows = classes.flatMap((c) => gradebookApi.forClass(c.id).filter((r) => r.studentId === child.id));
  const avg = gradebookApi.studentAverage(child.id);

  return (
    <Card title={`${child.name} — ${t('grades')}`} subtitle={`${t('readOnly')} · ${t('reportCard')}`}
      action={<Button className="h-9 px-3 text-xs" onClick={() => window.print()}>{t('exportPdf')}</Button>}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label={t('average')} value={`${avg}%`} icon="📈" tone="blue" />
        <StatCard label={t('graded')} value={rows.filter((r) => r.score != null).length} icon="✅" tone="green" />
        <StatCard label={t('missing')} value={rows.filter((r) => r.score == null).length} icon="⚠️" tone="red" />
      </div>
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">Item</th><th className="px-4 py-2 text-left">Class</th><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Score</th></tr></THead>
        <tbody>
          {rows.map((r) => (
            <TRow key={r.id}>
              <TD className="font-medium text-slate-800 dark:text-slate-100">{r.title}</TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{classes.find((c) => c.id === r.classId)?.name}</TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{new Date(r.date).toLocaleDateString()}</TD>
              <TD>{r.score == null ? <Badge tone="red">{t('missing')}</Badge> : <Badge tone={r.score / r.maxScore >= 0.8 ? 'green' : r.score / r.maxScore >= 0.6 ? 'amber' : 'red'}>{r.score}/{r.maxScore}</Badge>}</TD>
            </TRow>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

/* -------------------------------- assignments ----------------------------- */
function ParentAssignments({ child, classes }: { child: User; classes: ReturnType<typeof classApi.list> }) {
  const { t } = useApp();
  const items = classes.flatMap((c) => {
    const course = courseApi.forClass(c.id);
    if (!course) return [];
    return [
      ...assessmentApi.quizzesForCourse(course.id).map((q) => ({ id: q.id, title: q.title, deadline: q.deadline, kind: 'quiz' as const })),
      ...assessmentApi.assignmentsForCourse(course.id).map((a) => ({ id: a.id, title: a.title, deadline: a.deadline, kind: 'assignment' as const })),
    ];
  }).sort((a, b) => a.deadline.localeCompare(b.deadline));

  return (
    <Card title={`${child.name} — ${t('assignments')}`} subtitle={`${t('exams')} & deadlines · ${t('readOnly')}`}>
      <div className="space-y-2">
        {items.map((it) => {
          const sub = assessmentApi.submissionsForAssessment(it.id).find((s) => s.studentId === child.id);
          const overdue = !sub && new Date(it.deadline).getTime() < Date.now();
          return (
            <div key={it.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{it.title}</p>
                <p className="text-xs text-slate-400">Due {new Date(it.deadline).toLocaleDateString()} · {it.kind}</p>
                {sub?.feedback && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Feedback: {sub.feedback}</p>}
              </div>
              <div>
                {sub ? <Badge tone={sub.status === 'graded' ? 'green' : 'amber'}>{sub.status}</Badge>
                  : overdue ? <Badge tone="red">{t('overdue')}</Badge> : <Badge tone="slate">{t('upcoming')}</Badge>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* -------------------------------- attendance ------------------------------ */
function ParentAttendance({ child, classes }: { child: User; classes: ReturnType<typeof classApi.list> }) {
  const { t } = useApp();
  const records = classes.flatMap((c) => attendanceApi.forStudent(child.id).filter((a) => a.classId === c.id));
  const stats = attendanceApi.studentStats(child.id);
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date)).slice(-12).reverse();

  return (
    <Card title={`${child.name} — ${t('attendance')}`} subtitle={t('readOnly')}>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard label={t('attendanceRate')} value={`${stats.rate}%`} icon="✅" tone="green" />
        <StatCard label={t('present')} value={stats.present} icon="🟢" tone="green" />
        <StatCard label={t('late')} value={stats.late} icon="🟡" tone="amber" />
        <StatCard label={t('absent')} value={stats.absent} icon="🔴" tone="red" />
      </div>
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Class</th><th className="px-4 py-2 text-left">Status</th></tr></THead>
        <tbody>
          {sorted.map((r) => (
            <TRow key={r.id}>
              <TD>{new Date(r.date).toLocaleDateString()}</TD>
              <TD>{classes.find((c) => c.id === r.classId)?.name}</TD>
              <TD><Badge tone={r.status === 'present' ? 'green' : r.status === 'late' ? 'amber' : 'red'}>{t(r.status === 'present' ? 'present' : r.status)}</Badge></TD>
            </TRow>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

/* -------------------------------- live classes ---------------------------- */
function ParentLive({ child, classes }: { child: User; classes: ReturnType<typeof classApi.list> }) {
  const { t } = useApp();
  const sessions = liveApi.list().filter((s) => classes.some((c) => c.id === s.classId));
  return (
    <Card title={`${child.name} — ${t('liveClasses')}`} subtitle={t('readOnly')}>
      <div className="space-y-3">
        {sessions.map((s) => {
          const cls = classApi.byId(s.classId);
          const joined = s.joinedStudentIds.includes(child.id);
          return (
            <div key={s.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.title}</p>
                  <p className="text-xs text-slate-400">{cls?.name} · {new Date(s.start).toLocaleString()} · {s.platform}</p>
                </div>
                <Badge tone={joined ? 'green' : 'slate'}>{joined ? 'Joined' : 'Scheduled'}</Badge>
              </div>
            </div>
          );
        })}
        {sessions.length === 0 && <EmptyState>{t('noData')}</EmptyState>}
      </div>
    </Card>
  );
}

/* -------------------------------- progress -------------------------------- */
function ParentProgress({ child, classes }: { child: User; classes: ReturnType<typeof classApi.list> }) {
  const { t } = useApp();
  const los = analyticsApi.studentOutcomeMastery(child.id);
  const avg = gradebookApi.studentAverage(child.id);
  const lessons = classes.flatMap((c) => courseApi.forClass(c.id ? c.id : '') ? courseApi.lessons(courseApi.forClass(c.id)!.id) : []);
  const pcts = lessons.map((l) => courseApi.progress(child.id, l.id));
  const coursePct = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={`${child.name} — ${t('progress2')}`} subtitle={t('readOnly')}>
        <div className="flex items-center gap-5">
          <Ring value={coursePct} />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('completion')}: {coursePct}%</p>
            <MasteryBar value={avg} label={`${t('average')} grade`} />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {los.map((l) => <MasteryBar key={l.lo!.id} value={l.mastery} label={`${l.lo!.code} · ${l.lo!.text.slice(0, 50)}…`} />)}
        </div>
      </Card>
      <Card title={t('weakTopics')} subtitle={`${t('readOnly')} · ${t('learningOutcomes')}`}>
        {los.filter((l) => l.mastery < 65).length === 0
          ? <p className="text-sm text-slate-400">No weak areas currently — great progress! 🌟</p>
          : <ul className="space-y-2 text-sm">
            {los.filter((l) => l.mastery < 65).map((w) => (
              <li key={w.lo!.id} className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-900/15">
                <p className="font-medium text-slate-700 dark:text-slate-200">{w.lo!.code} — {w.lo!.text.slice(0, 58)}…</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mastery {w.mastery}%</p>
              </li>
            ))}
          </ul>}
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Average by class</p>
          <BarChart data={classes.map((c) => ({ label: c.name.split(' ').slice(-2).join(' '), value: gradebookApi.forClass(c.id).filter((r) => r.studentId === child.id && r.score != null).reduce((a, b) => a + (b.score! / b.maxScore) * 100, 0) / Math.max(1, gradebookApi.forClass(c.id).filter((r) => r.studentId === child.id && r.score != null).length) }))} color="#10b981" />
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------- reports -------------------------------- */
function ParentReports({ child, classes }: { child: User; classes: ReturnType<typeof classApi.list> }) {
  const { t } = useApp();
  const announcements = announcementApi.visibleFor(child).slice(0, 3);

  return (
    <div className="space-y-4">
      <Card title={`${child.name} — ${t('reportCard')}`} subtitle={`${t('readOnly')} · ${t('download')}`}
        action={<Button className="h-9 px-3 text-xs" onClick={() => window.print()}>{t('exportPdf')}</Button>}>
        <div className="print-page space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
            <div>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Sahara International School</p>
              <p className="text-xs text-slate-400">{t('academicYears')} · {t('term')}</p>
            </div>
            <div className="text-end">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{child.name}</p>
              <p className="text-xs text-slate-400">{classes.map((c) => c.name).join(', ')}</p>
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Summary</p>
          <Table>
            <THead><tr><th className="px-4 py-2 text-left">Metric</th><th className="px-4 py-2 text-left">Value</th></tr></THead>
            <tbody>
              <TRow><TD>{t('average')} grade</TD><TD><b>{gradebookApi.studentAverage(child.id)}%</b></TD></TRow>
              <TRow><TD>{t('attendanceRate')}</TD><TD><b>{attendanceApi.studentStats(child.id).rate}%</b></TD></TRow>
              <TRow><TD>{t('graded')} items</TD><TD><b>{classes.flatMap((c) => gradebookApi.forClass(c.id)).filter((r) => r.studentId === child.id && r.score != null).length}</b></TD></TRow>
            </tbody>
          </Table>
          <p className="pt-2 text-xs text-slate-400">Generated {new Date().toLocaleDateString()} — for official use, contact the school office.</p>
        </div>
      </Card>

      <Card title={t('announcements')}>
        <div className="space-y-2">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.title}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{a.body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- meeting request --------------------------- */
export function ParentMeetingRequest({ parent }: { parent: User }) {
  const { t, toast } = useApp();
  const [open, setOpen] = useState(false);
  const children = (parent.children ?? []).map((id) => usersApi.byId(id)).filter(Boolean) as User[];
  const [childId, setChildId] = useState(children[0]?.id ?? '');
  const [text, setText] = useState('');

  const teachers = useMemo(() => {
    const child = usersApi.byId(childId);
    if (!child) return [];
    const classes = classApi.list().filter((c) => c.studentIds.includes(child.id));
    return [...new Set(classes.map((c) => c.teacherId))].map((id) => usersApi.byId(id)!).filter(Boolean);
  }, [childId]);

  const send = () => {
    if (!text.trim() || !childId) return toast('Select a child and write a message', 'error');
    for (const tch of teachers) {
      messageApi.send(parent.id, tch.id, `[Meeting request] ${text}`);
    }
    toast(t('meetingRequested'), 'success');
    setOpen(false);
    setText('');
  };

  return (
    <>
      <Button className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>+ {t('requestMeeting')}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('requestMeeting')}>
        <div className="space-y-3">
          <Select value={childId} onChange={(e) => setChildId(e.target.value)}>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Textarea rows={3} placeholder={t('messagePlaceholder')} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="text-xs text-slate-400">This sends a message to the teachers of the selected child.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button onClick={send}>{t('sendMessage')}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

