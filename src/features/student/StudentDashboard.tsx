/**
 * Student dashboard: home (courses, live classes, deadlines, progress),
 * lesson player with resume + notes, assignments, grades & feedback,
 * gamified progress, certificates, and messaging with own teachers.
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  analyticsApi, assessmentApi, attendanceApi, classApi, courseApi, gradebookApi,
  liveApi, messageApi, notificationApi, questionApi,
} from '../../services/api';
import {
  Badge, Button, Card, EmptyState, Input, Modal, ProgressBar, SectionTitle, StatCard, Textarea, Avatar,
} from '../../components/ui';
import { BarChart, MasteryBar, Ring, TrendChart } from '../../components/charts';
import { ChemText } from '../../features/chem/KaTeXText';
import { Messaging, contactsFor } from '../../features/Messaging';
import { QuizRunner } from '../../features/QuizRunner';
import type { Lesson, Quiz, User } from '../../types';

export function StudentDashboard({ student, view, setView }: {
  student: User; view: string; setView: (v: string) => void;
}) {
  const { t } = useApp();
  const myClasses = useMemo(() => classApi.list().filter((c) => student.studentClassIds?.includes(c.id)), [student]);
  const courses = useMemo(() => myClasses.map((c) => courseApi.forClass(c.id)).filter(Boolean), [myClasses]);

  switch (view) {
    case 'home':
      return <StudentHome student={student} courses={courses} myClasses={myClasses} setView={setView} />;
    case 'courses':
      return <CoursesView student={student} courses={courses} setView={setView} />;
    case 'live':
      return <StudentLive student={student} myClasses={myClasses} />;
    case 'assignments':
      return <AssignmentsView student={student} courses={courses} setView={setView} />;
    case 'grades':
      return <GradesView student={student} />;
    case 'progress':
      return <ProgressView student={student} courses={courses} />;
    case 'certificates':
      return <Certificates student={student} courses={courses} />;
    case 'messages':
      return <Messaging me={student} allowedPartners={contactsFor(student)} title={`${t('messaging')} — ${t('readOnly')} own teachers`} />;
    default:
      return <StudentHome student={student} courses={courses} myClasses={myClasses} setView={setView} />;
  }
}

/* ---------------------------------- home ---------------------------------- */
function StudentHome({ student, courses, myClasses, setView }: {
  student: User; courses: ReturnType<typeof courseApi.forClass>[]; myClasses: ReturnType<typeof classApi.list>; setView: (v: string) => void;
}) {
  const { t } = useApp();
  const live = liveApi.list().filter((s) => myClasses.some((c) => c.id === s.classId) && new Date(s.start).getTime() >= Date.now() - 3600_000).slice(0, 3);
  const upcoming = useMemo(() => {
    const items: { kind: string; title: string; deadline: string }[] = [];
    for (const c of courses) {
      if (!c) continue;
      for (const q of assessmentApi.quizzesForCourse(c.id)) items.push({ kind: 'quiz', title: q.title, deadline: q.deadline });
      for (const a of assessmentApi.assignmentsForCourse(c.id)) items.push({ kind: 'assignment', title: a.title, deadline: a.deadline });
    }
    return items.sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 5);
  }, [courses]);
  const notifs = notificationApi.forUser(student.id).slice(0, 4);
  const avg = gradebookApi.studentAverage(student.id);
  const att = attendanceApi.studentStats(student.id);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('average')} value={`${avg}%`} sub="Across all assessments" icon="📈" tone="blue" />
        <StatCard label={t('attendanceRate')} value={`${att.rate}%`} sub={`${att.present} present · ${att.late} late`} icon="✅" tone="green" />
        <StatCard label={t('liveClasses')} value={live.length} sub="Upcoming sessions" icon="📡" tone="violet" />
        <StatCard label={t('streak')} value={`${5 + (student.id.length % 3)} 📅`} sub="Days in a row" icon="🔥" tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('courses')} action={<Button variant="ghost" onClick={() => setView('courses')} className="text-sm">{t('all')} →</Button>}>
          <div className="space-y-3">
            {courses.filter(Boolean).map((c) => {
              const lessons = courseApi.lessons(c!.id);
              const done = lessons.filter((l) => courseApi.progress(student.id, l.id) >= 100).length;
              const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
              return (
                <button key={c!.id} onClick={() => setView('courses')}
                  className="w-full rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-600">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c!.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{done}/{lessons.length} lessons complete</p>
                  <div className="mt-2"><ProgressBar value={pct} /></div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title={t('today')} subtitle={t('upcoming')}>
          {upcoming.length === 0 && <EmptyState>{t('noData')}</EmptyState>}
          <div className="space-y-2">
            {upcoming.map((u) => {
              const overdue = new Date(u.deadline).getTime() < Date.now();
              return (
                <div key={u.title} className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{u.title}</p>
                    <p className="text-xs text-slate-400">{new Date(u.deadline).toLocaleDateString()}</p>
                  </div>
                  <Badge tone={overdue ? 'red' : 'amber'}>{u.kind}{overdue ? ` · ${t('overdue')}` : ''}</Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title={t('notifications')} action={<Button variant="ghost" onClick={() => setView('messages')} className="text-xs">{t('messaging')} →</Button>}>
          <div className="space-y-2">
            {notifs.map((n) => (
              <div key={n.id} className={`rounded-lg border p-2.5 text-sm ${n.read ? 'border-slate-100 dark:border-slate-700/50' : 'border-brand-200 bg-brand-50/50 dark:border-brand-800 dark:bg-brand-900/20'}`}>
                <p className="font-medium text-slate-700 dark:text-slate-200">{n.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{n.body}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {live.length > 0 && (
        <Card title={t('liveNow')} action={<Button variant="ghost" onClick={() => setView('live')} className="text-sm">{t('all')} →</Button>}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.title}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(s.start).toLocaleString()}</p>
                <Button className="mt-2 w-full" onClick={() => setView('live')}>{t('join')}</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* --------------------------------- courses -------------------------------- */
function CoursesView({ student, courses, setView }: {
  student: User; courses: ReturnType<typeof courseApi.forClass>[]; setView: (v: string) => void;
}) {
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [notes, setNotes] = useState('');

  return (
    <div className="space-y-4">
      {courses.filter(Boolean).map((c) => {
        const lessons = courseApi.lessons(c!.id);
        return (
          <Card key={c!.id} title={c!.title} subtitle={c!.description}>
            <div className="grid gap-3 sm:grid-cols-2">
              {lessons.map((l) => {
                const pct = courseApi.progress(student.id, l.id);
                return (
                  <div key={l.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{l.title}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{l.summary}</p>
                      </div>
                      <Badge tone={pct >= 100 ? 'green' : pct >= 50 ? 'amber' : 'slate'}>{pct}%</Badge>
                    </div>
                    <div className="mt-2"><ProgressBar value={pct} tone={pct >= 100 ? 'green' : 'brand'} /></div>
                    <Button className="mt-3 w-full" onClick={() => { setActiveLesson(l); setNotes(''); }}>
                      {pct >= 100 ? 'Review lesson' : 'Continue lesson'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <Modal open={!!activeLesson} onClose={() => setActiveLesson(null)} title={activeLesson?.title ?? ''} wide>
        {activeLesson && (
          <LessonPlayer
            lesson={activeLesson} student={student} notes={notes} setNotes={setNotes}
            onComplete={() => setView('progress')}
          />
        )}
      </Modal>
    </div>
  );
}

/** Lesson player: recorded content, resources, resume progress, notes, bookmark. */
function LessonPlayer({ lesson, student, notes, setNotes, onComplete }: {
  lesson: Lesson; student: User; notes: string; setNotes: (s: string) => void; onComplete: () => void;
}) {
  const { t, toast } = useApp();
  const pct = courseApi.progress(student.id, lesson.id);

  const watch = (newPct: number) => {
    courseApi.setProgress(student.id, lesson.id, newPct);
    if (newPct === 100) toast('Lesson complete — well done! 🎉', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-900 p-4 text-white">
        <p className="text-xs uppercase tracking-wide text-slate-400">Recorded lesson · {lesson.recordedMinutes} min</p>
        {/* faux video player */}
        <div className="mt-3 flex aspect-video items-center justify-center rounded-lg bg-slate-800">
          <button onClick={() => watch(Math.min(100, pct + 25))}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-2xl hover:bg-brand-500" aria-label="Play lesson">▶</button>
        </div>
        <div className="mt-2"><ProgressBar value={pct} tone="green" /></div>
        <p className="mt-1 text-xs text-slate-400">Watched {pct}% — the player remembers your progress</p>
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Lesson content</p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300"><ChemText>{lesson.content}</ChemText></p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Resources</p>
        <div className="space-y-1.5">
          {lesson.resources.map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-300">
                <Badge tone={r.type === 'video' ? 'blue' : r.type === 'pdf' ? 'red' : 'violet'}>{r.type}</Badge>
                {' '}{r.title}
              </span>
              <span className="text-xs text-slate-400">{r.url}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">My notes</p>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Take notes while watching…" />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => watch(Math.min(100, pct + 10))}>+10% watched</Button>
        <Button onClick={() => watch(100)}>{t('markComplete')}</Button>
        {pct >= 100 && <Button variant="outline" onClick={onComplete}>{t('progress2')} →</Button>}
      </div>
    </div>
  );
}

/* ------------------------------- assignments ------------------------------ */
function AssignmentsView({ student, courses, setView }: {
  student: User; courses: ReturnType<typeof courseApi.forClass>[]; setView: (v: string) => void;
}) {
  const { t, toast } = useApp();

  const rows = courses.filter(Boolean).flatMap((c) => [
    ...assessmentApi.quizzesForCourse(c!.id).map((q) => ({ id: q.id, title: q.title, deadline: q.deadline, kind: 'quiz' as const, max: '—' })),
    ...assessmentApi.assignmentsForCourse(c!.id).map((a) => ({ id: a.id, title: a.title, deadline: a.deadline, kind: 'assignment' as const, max: String(a.maxScore) })),
  ]).sort((a, b) => a.deadline.localeCompare(b.deadline));

  return (
    <Card title={t('assignments')} subtitle="Take quizzes and submit assignments">
      <div className="space-y-2">
        {rows.map((r) => {
          const sub = db_submission(student.id, r.id);
          const overdue = !sub && new Date(r.deadline).getTime() < Date.now();
          return (
            <div key={r.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.title}</p>
                  <p className="text-xs text-slate-400">{new Date(r.deadline).toLocaleDateString()} · max {r.max}</p>
                </div>
                <div className="flex gap-2">
                  {sub ? (
                    <Badge tone={sub.status === 'graded' ? 'green' : 'amber'}>
                      {sub.status === 'graded' ? `${sub.score}/${sub.maxScore}` : t('submitted')}
                    </Badge>
                  ) : overdue ? <Badge tone="red">{t('overdue')}</Badge> : null}
                </div>
              </div>
              {r.kind === 'assignment' && !sub && (
                <div className="mt-2">
                  <AssignmentSubmit student={student} assignmentId={r.id} onDone={() => toast(t('submitted'), 'success')} />
                </div>
              )}
              {r.kind === 'quiz' && !sub && !overdue && (
                <div className="mt-2"><QuizInline quizId={r.id} student={student} /></div>
              )}
              {sub?.feedback && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{sub.feedback}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// local helper: find a submission for a student+assessment
function db_submission(studentId: string, assessmentId: string) {
  return assessmentApi.submissionsForAssessment(assessmentId).find((s) => s.studentId === studentId);
}

const ASSIGNMENT_MAX_MB = 50; // Storage supports large files; fallback caps smaller

/**
 * AssignmentSubmit — students submit an assignment with an optional note and
 * an uploaded file. The file is stored in Supabase Storage (large files
 * supported); it falls back to a base64 data URL if Storage is unavailable.
 * The teacher can download it from the grade table.
 */
function AssignmentSubmit({ student, assignmentId, onDone }: { student: User; assignmentId: string; onDone: () => void }) {
  const { toast } = useApp();
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (file && file.size > ASSIGNMENT_MAX_MB * 1024 * 1024) {
      return toast(`File exceeds the ${ASSIGNMENT_MAX_MB} MB cap`, 'error');
    }
    setBusy(true);
    let filePayload: import('../../types').AssignmentFile | undefined;
    if (file) {
      try {
        filePayload = await assessmentApi.saveAssignmentFile(file);
      } catch (e) {
        setBusy(false);
        return toast(e instanceof Error ? e.message : 'File upload failed', 'error');
      }
    }
    assessmentApi.submitAssignment(student.id, assignmentId, note || (file ? file.name : ''), filePayload);
    setBusy(false);
    setNote('');
    setFile(null);
    onDone();
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input placeholder="Submission note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="h-9" />
      <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
        {file ? <span className="text-brand-600">{file.name}</span> : 'attach file'}
      </label>
      <Button className="h-9" onClick={submit} disabled={busy}>{busy ? '…' : 'Submit'}</Button>
    </div>
  );
}

/** Embedded quiz launcher (used from the assignments list). */
function QuizInline({ quizId, student }: { quizId: string; student: User }) {
  const quiz = assessmentApi.quizById(quizId);
  const [open, setOpen] = useState(false);
  if (!quiz) return null;
  if (!open) {
    return <Button className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>Start quiz</Button>;
  }
  return <QuizRunner quiz={quiz} student={student} onClose={() => setOpen(false)} />;
}

/* ---------------------------------- grades -------------------------------- */
function GradesView({ student }: { student: User }) {
  const { t } = useApp();
  const rows = gradebookApi.forStudent(student.id);
  const avg = gradebookApi.studentAverage(student.id);
  const trend = analyticsApi.studentTrend(student.id);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('average')} value={`${avg}%`} icon="📈" tone="blue" />
        <StatCard label={t('graded') + ' items'} value={rows.filter((r) => r.score != null).length} icon="✅" tone="green" />
        <StatCard label={t('trend')} value="↗" sub="Last 8 assessments" icon="📉" tone="violet" />
      </div>
      <Card title="Grade trend" subtitle="Percentage across recent assessments">
        <TrendChart values={trend} />
      </Card>
      <Card title={t('grades')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/80">
              <tr><th className="px-4 py-2">Item</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Score</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700/60">
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">{r.title}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 capitalize">{r.type}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">
                    {r.score == null
                      ? <Badge tone="red">{t('missing')}</Badge>
                      : <Badge tone={r.score / r.maxScore >= 0.8 ? 'green' : r.score / r.maxScore >= 0.6 ? 'amber' : 'red'}>{r.score}/{r.maxScore}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Teacher feedback</p>
          <div className="space-y-2">
            {assessmentApi.submissionsForAssessment('').length === 0 && <p className="text-sm text-slate-400">Feedback appears here when graded.</p>}
            {submissionsForStudent(student.id).map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                <p className="font-medium text-slate-700 dark:text-slate-200">{s.assessmentId} — {s.score ?? 'pending'}/{s.maxScore}</p>
                <p className="mt-1 text-slate-500 dark:text-slate-400">{s.feedback || 'No feedback yet.'}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function submissionsForStudent(studentId: string) {
  return assessmentApi.submissionsForStudent(studentId);
}

/* --------------------------------- progress ------------------------------ */
function ProgressView({ student, courses }: { student: User; courses: ReturnType<typeof courseApi.forClass>[] }) {
  const { t } = useApp();
  const los = analyticsApi.studentOutcomeMastery(student.id);
  const weak = los.filter((l) => l.mastery < 65).slice(0, 5);
  const lessons = courses.filter(Boolean).flatMap((c) => courseApi.lessons(c!.id));
  const done = lessons.filter((l) => courseApi.progress(student.id, l.id) >= 100).length;
  const totalPct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;

  const points = 240 + student.id.length * 17;
  const streak = 5 + student.id.length % 3;
  const badges = [
    { name: 'Periodic Pro', icon: '🧪', won: totalPct >= 75 },
    { name: 'Lab Safety Certified', icon: '🛡️', won: true },
    { name: 'Stoichometry Star', icon: '⚖️', won: los.some((l) => l.mastery >= 80) },
    { name: '5-Day Streak', icon: '🔥', won: streak >= 5 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><div className="flex items-center gap-4">
          <Ring value={totalPct} label={`${totalPct}%`} />
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('completion')}</p>
            <p className="text-xs text-slate-400">{done}/{lessons.length} lessons complete</p>
            <Button className="mt-2 h-8 px-3 text-xs" onClick={() => window.print()}>{t('print')}</Button>
          </div>
        </div></Card>
        <StatCard label={t('points')} value={points} icon="⭐" tone="amber" />
        <StatCard label={t('streak')} value={`${streak} days`} icon="🔥" tone="red" />
      </div>

      <Card title={t('badges')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {badges.map((b) => (
            <div key={b.name} className={`rounded-xl border p-4 text-center transition-colors ${
              b.won ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' : 'border-slate-200 opacity-40 dark:border-slate-700'}`}>
              <p className="text-3xl">{b.won ? b.icon : '🔒'}</p>
              <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{b.name}</p>
              <p className="text-[10px] text-slate-400">{b.won ? t('active') : 'Locked'}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('learningOutcomes')} subtitle="Mastery by learning outcome">
          {los.length === 0 ? <EmptyState>{t('noData')}</EmptyState> : (
            <div className="space-y-2">
              {los.map((l) => <MasteryBar key={l.lo!.id} value={l.mastery} label={`${l.lo!.code} · ${l.lo!.text.slice(0, 42)}…`} />)}
            </div>
          )}
        </Card>
        <Card title={t('weakTopics')} subtitle={t('readOnly')}>
          {weak.length === 0 ? <p className="text-sm text-slate-400">No weak areas — keep it up! 🌟</p> : (
            <ul className="space-y-2 text-sm">
              {weak.map((w) => (
                <li key={w.lo!.id} className="rounded-lg border border-rose-100 bg-rose-50/60 p-3 dark:border-rose-900/50 dark:bg-rose-900/15">
                  <p className="font-medium text-slate-700 dark:text-slate-200">{w.lo!.code} — {w.lo!.text.slice(0, 60)}…</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mastery {w.mastery}% · Suggested: re-watch the related lesson and retry the quiz.</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------- certificates ----------------------------- */
function Certificates({ student, courses }: { student: User; courses: ReturnType<typeof courseApi.forClass>[] }) {
  const { t } = useApp();
  const earned = courses.filter(Boolean).map((c) => {
    const lessons = courseApi.lessons(c!.id);
    const pcts = lessons.map((l) => courseApi.progress(student.id, l.id));
    const pct = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
    return { course: c!, pct, earned: pct >= 80 };
  });

  return (
    <Card title={t('certificates')} subtitle="Course completion certificates (printable)">
      <div className="grid gap-4 md:grid-cols-2">
        {earned.map((e) => (
          <div key={e.course.id} className="print-page rounded-2xl border-4 border-double border-slate-300 p-6 text-center shadow-sm dark:border-slate-600">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Certificate of Completion</p>
            <p className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100">{e.course.title}</p>
            {e.earned ? (
              <>
                <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">This certifies that</p>
                <p className="my-1 text-xl font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">{student.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">has successfully completed the course with {e.pct}% progress.</p>
                <p className="mt-8 text-xs text-slate-400">Sahara International School · {t('academicYears')}</p>
                <Button className="mt-4" onClick={() => window.print()}>{t('print')} / {t('exportPdf')}</Button>
              </>
            ) : (
              <p className="mt-8 text-sm text-slate-400">{e.pct}% complete — reach 80% to earn this certificate.</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* --------------------------------- live classes --------------------------- */
function StudentLive({ student, myClasses }: { student: User; myClasses: ReturnType<typeof classApi.list> }) {
  const { t, toast } = useApp();
  const sessions = liveApi.list().filter((s) => myClasses.some((c) => c.id === s.classId));
  const joined = (id: string) => { liveApi.join(id, student.id); toast('Attendance marked present ✅', 'success'); };

  return (
    <Card title={t('liveClasses')}>
      <div className="space-y-3">
        {sessions.map((s) => {
          const cls = classApi.byId(s.classId);
          const now = new Date(s.start);
          const liveNow = Math.abs(Date.now() - now.getTime()) < s.durationMin * 60_000;
          return (
            <div key={s.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.title}</p>
                  <p className="text-xs text-slate-400">{cls?.name} · {now.toLocaleString()} · {s.platform}</p>
                </div>
                <div className="flex items-center gap-2">
                  {s.joinedStudentIds.includes(student.id) && <Badge tone="green">Joined</Badge>}
                  <Button className="h-8 px-3 text-xs" onClick={() => joined(s.id)} disabled={s.joinedStudentIds.includes(student.id)}>
                    {liveNow ? t('join') : 'Mark join'}
                  </Button>
                </div>
              </div>
              <p className="mt-1 font-mono text-[11px] text-brand-600 dark:text-brand-300">{s.link}</p>
            </div>
          );
        })}
        {sessions.length === 0 && <EmptyState>{t('noData')}</EmptyState>}
      </div>
    </Card>
  );
}
