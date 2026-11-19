/**
 * Admin console — full interactive control over the platform.
 *
 * Every section here is a real CRUD surface (add / edit / delete / track),
 * not a read-only view: curricula (grades, topics, learning outcomes),
 * courses & lessons, the question bank (all 8 question types), quizzes &
 * assignments, the gradebook, attendance, messaging, notifications,
 * chemistry reference data, users (roles, classes, verification),
 * announcements, reports, the audit log and school settings.
 *
 * All mutations flow through the service layer (api.ts) which persists to
 * Supabase, so changes are durable and survive reloads.
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  adminResetPassword, announcementApi, assessmentApi, attendanceApi, chemApi,
  classApi, courseApi, curriculumApi, exportCsv, gradebookApi, messageApi,
  notificationApi, questionApi, settingsApi, usersApi,
} from '../../services/api';
import { db } from '../../services/db';
import {
  Avatar, Badge, Button, Card, EmptyState, Input, Modal, ProgressBar, Select,
  StatCard, Table, THead, TRow, TD, Textarea, Toggle,
} from '../../components/ui';
import { BarChart } from '../../components/charts';
import type { BalanceAnswer, BloomLevel, MatchingAnswer, Question, Role, User } from '../../types';

const BLOOM: BloomLevel[] = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];

export function AdminDashboard({ admin, view }: { admin: User; view: string }) {
  const { t } = useApp();
  const stats = useMemo(() => {
    const students = usersApi.list('student');
    const teachers = usersApi.list('teacher');
    const parents = usersApi.list('parent');
    const allAtt = Object.values(classApi.list().reduce<Record<string, number>>((acc, c) => {
      acc[c.id] = attendanceApi.classRate(c.id);
      return acc;
    }, {}));
    const grades = gradebookApi.forClass(classApi.list()[0]?.id ?? '');
    const avg = grades.filter((g) => g.score != null).length
      ? Math.round(grades.filter((g) => g.score != null).reduce((a, b) => a + (b.score! / b.maxScore) * 100, 0) / grades.filter((g) => g.score != null).length)
      : 0;
    return {
      students: students.length, teachers: teachers.length, parents: parents.length,
      classes: classApi.list().length,
      lessons: courseApi.list().reduce((a, c) => a + courseApi.lessons(c.id).length, 0),
      questions: questionApi.list().length,
      attendance: allAtt.length ? Math.round(allAtt.reduce((a, b) => a + b, 0) / allAtt.length) : 0,
      avg,
    };
  }, []);

  switch (view) {
    case 'curricula':
      return <CurriculaView />;
    case 'courses':
      return <CoursesView />;
    case 'questions':
      return <QuestionsView />;
    case 'quizzes':
      return <QuizzesView />;
    case 'gradebook':
      return <GradebookView />;
    case 'attendance':
      return <AttendanceView />;
    case 'messaging':
      return <MessagingView admin={admin} />;
    case 'notifications':
      return <NotificationsView />;
    case 'chemistry':
      return <ChemistryView />;
    case 'users':
      return <UsersView admin={admin} />;
    case 'classes':
      return <ClassesView />;
    case 'announcements':
      return <AnnouncementsView admin={admin} />;
    case 'reports':
      return <ReportsView />;
    case 'audit':
      return <AuditView />;
    case 'settings':
      return <SettingsView />;
    default:
      return (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label={t('students')} value={stats.students} icon="🎓" tone="blue" />
            <StatCard label={t('teachers')} value={stats.teachers} icon="🧑‍🏫" tone="violet" />
            <StatCard label={t('parents')} value={stats.parents} icon="👨‍👩‍👧" tone="amber" />
            <StatCard label={t('classesCount')} value={stats.classes} icon="📚" tone="green" />
            <StatCard label={t('lessons')} value={stats.lessons} icon="📖" tone="blue" />
            <StatCard label={t('questionBank')} value={stats.questions} icon="❓" tone="violet" />
            <StatCard label={t('attendanceRate')} value={`${stats.attendance}%`} icon="✅" tone="green" />
            <StatCard label={t('avgGrades')} value={`${stats.avg}%`} icon="📈" tone="blue" />
            <StatCard label={t('announcements')} value={db_announcementsCount()} icon="📢" tone="amber" />
          </div>
          <Card title={t('academicYears')} subtitle={`${t('term')} · 2025–2026`}>
            <div className="grid gap-4 lg:grid-cols-3">
              {curriculumApi.list().map((c) => {
                const cls = classApi.list().filter((x) => x.curriculumId === c.id);
                return (
                  <div key={c.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.name}</p>
                      <Badge tone="blue">{c.code}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{c.examStyle}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{c.gradeIds.length} grades · {cls.length} classes · {cls.reduce((a, b) => a + b.studentIds.length, 0)} students</p>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title={t('timetable')} subtitle={t('exams') + ' & schedules'}>
            <div className="space-y-2 text-sm">
              {classApi.list().map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{c.name}</span>
                  <span className="text-xs text-slate-400">
                    {usersApi.byId(c.teacherId)?.name} · {c.studentIds.length} students · midterm {new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      );
  }
}

/** Count announcements (module-level helper for the overview stat). */
function db_announcementsCount(): number {
  return db.announcements.length;
}

/* -------------------------------- curricula ------------------------------- */
function CurriculaView() {
  const { t, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ id: '', name: '', code: '', description: '', examStyle: '' });

  const save = () => {
    if (!d.name || !d.code) return toast('Name and code required', 'error');
    curriculumApi.save({ ...d, color: 'violet' });
    toast('Curriculum saved', 'success');
    setOpen(false);
    setD({ id: '', name: '', code: '', description: '', examStyle: '' });
  };

  return (
    <Card title={t('curricula')} subtitle="Full curriculum management — grades, topics and learning outcomes"
      action={<Button className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>+ {t('addCurriculum')}</Button>}>
      <div className="space-y-3">
        {curriculumApi.list().map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.name} <Badge tone="blue">{c.code}</Badge></p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.description}</p>
                <p className="mt-1 text-xs text-slate-400">Exam style: {c.examStyle} · {c.gradeIds.length} grades · {curriculumApi.topics(c.id).length} topics · {curriculumApi.outcomes(c.id).length} LOs</p>
              </div>
              <div className="flex gap-1.5">
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setD({ id: c.id, name: c.name, code: c.code, description: c.description, examStyle: c.examStyle })}>{t('edit')}</Button>
                <Button variant="ghost" className="h-8 px-2 text-xs text-rose-600" onClick={() => { if (confirm(`Delete curriculum "${c.name}"?`)) { curriculumApi.remove(c.id); toast('Curriculum deleted', 'success'); } }}>{t('delete')}</Button>
              </div>
            </div>

            {/* grades */}
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-slate-500">{t('grades')}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {curriculumApi.grades(c.id).map((g) => (
                  <span key={g.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs dark:border-slate-700">
                    {g.name}
                    <button onClick={() => { curriculumApi.removeGrade(g.id); toast('Grade deleted', 'success'); }} className="text-slate-400 hover:text-rose-600">✕</button>
                  </span>
                ))}
                <button onClick={() => {
                  const name = prompt(`New grade name for ${c.name}:`, '');
                  if (name?.trim()) { curriculumApi.saveGrade({ curriculumId: c.id, name: name.trim() }); toast('Grade added', 'success'); }
                }} className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-brand-600 hover:bg-brand-50 dark:border-slate-600">+ {t('addGrade')}</button>
              </div>
            </div>

            {/* topics + outcomes */}
            <details className="mt-3">
              <summary className="text-xs font-medium text-brand-600 dark:text-brand-300 cursor-pointer">{t('topic')}s & {t('learningOutcomes')}</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {curriculumApi.topics(c.id).map((tp) => {
                  const los = curriculumApi.outcomes(c.id).filter((lo) => lo.topicId === tp.id);
                  return (
                    <div key={tp.id} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/40">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{tp.unit} · {tp.name}</p>
                        <button onClick={() => { curriculumApi.removeTopic(tp.id); toast('Topic deleted', 'success'); }} className="text-slate-400 hover:text-rose-600">✕</button>
                      </div>
                      {los.map((lo) => (
                        <div key={lo.id} className="flex items-start justify-between gap-1 mt-1">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{lo.code}: {lo.text.slice(0, 60)}{lo.text.length > 60 ? '…' : ''}</p>
                          <button onClick={() => { curriculumApi.removeOutcome(lo.id); }} className="text-slate-400 hover:text-rose-600 shrink-0">✕</button>
                        </div>
                      ))}
                      <button onClick={() => {
                        const code = prompt('Outcome code (e.g. LO-STOC-03):');
                        if (code?.trim()) {
                          const text = prompt('Outcome text:');
                          if (text?.trim()) { curriculumApi.saveOutcome({ curriculumId: c.id, topicId: tp.id, code: code.trim(), text: text.trim() }); toast('Outcome added', 'success'); }
                        }
                      }} className="mt-1 text-[11px] text-brand-600 hover:underline">+ {t('learningOutcomes')}</button>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => {
                const unit = prompt('Unit (e.g. Matter):');
                if (unit?.trim()) {
                  const name = prompt('Topic name:');
                  if (name?.trim()) { curriculumApi.saveTopic({ curriculumId: c.id, unit: unit.trim(), name: name.trim() }); toast('Topic added', 'success'); }
                }
              }} className="mt-2 text-xs text-brand-600 hover:underline">+ {t('addTopic')}</button>
            </details>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={d.id ? t('edit') : t('addCurriculum')}>
        <div className="space-y-3">
          <Input placeholder={t('curricula')} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <Input placeholder="Code (e.g. STEM)" value={d.code} onChange={(e) => setD({ ...d, code: e.target.value })} />
          <Input placeholder="Exam style" value={d.examStyle} onChange={(e) => setD({ ...d, examStyle: e.target.value })} />
          <Textarea placeholder="Description" rows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button onClick={save}>{t('save')}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

/* --------------------------------- courses -------------------------------- */
function CoursesView() {
  const { t, toast } = useApp();
  const classes = classApi.list();
  const [open, setOpen] = useState(false);
  const [lessonOpen, setLessonOpen] = useState<string | null>(null);
  const [d, setD] = useState({ id: '', classId: '', title: '', subject: 'Chemistry', description: '' });

  const save = () => {
    if (!d.classId || !d.title) return toast('Class and title required', 'error');
    courseApi.save(d);
    toast('Course saved', 'success');
    setOpen(false);
    setD({ id: '', classId: '', title: '', subject: 'Chemistry', description: '' });
  };

  return (
    <Card title={t('courses')} subtitle="Courses & lessons — add, edit and delete content"
      action={<Button className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>+ {t('add')} {t('courses')}</Button>}>
      <div className="space-y-4">
        {courseApi.list().map((c) => {
          const cls = classApi.byId(c.classId);
          return (
            <div key={c.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.title} <Badge tone="slate">{c.subject}</Badge></p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{cls?.name} · {c.lessonIds.length} {t('lessons')}</p>
                  {c.description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.description}</p>}
                </div>
                <div className="flex gap-1.5">
                  <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setD({ id: c.id, classId: c.classId, title: c.title, subject: c.subject, description: c.description })}>{t('edit')}</Button>
                  <Button variant="ghost" className="h-8 px-2 text-xs text-rose-600" onClick={() => { if (confirm(`Delete "${c.title}" and its lessons?`)) { courseApi.remove(c.id); toast('Course deleted', 'success'); } }}>{t('delete')}</Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {courseApi.lessons(c.id).map((l) => (
                  <span key={l.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs dark:border-slate-700">
                    {l.title}
                    <button onClick={() => { courseApi.removeLesson(l.id); toast('Lesson deleted', 'success'); }} className="text-slate-400 hover:text-rose-600">✕</button>
                  </span>
                ))}
                <button onClick={() => setLessonOpen(c.id)} className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-brand-600 hover:bg-brand-50 dark:border-slate-600">+ {t('lessons')}</button>
              </div>
            </div>
          );
        })}
        {courseApi.list().length === 0 && <EmptyState>{t('noData')}</EmptyState>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={d.id ? t('edit') : `+ ${t('courses')}`}>
        <div className="space-y-3">
          <Select value={d.classId} onChange={(e) => setD({ ...d, classId: e.target.value })}>
            <option value="">{t('classes')}…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input placeholder={t('courses') + ' title'} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          <Input placeholder="Subject" value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value })} />
          <Textarea rows={2} placeholder="Description" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button onClick={save}>{t('save')}</Button>
          </div>
        </div>
      </Modal>

      {lessonOpen && (
        <Modal open onClose={() => setLessonOpen(null)} title={`${t('lessons')} — ${courseApi.byId(lessonOpen)?.title ?? ''}`} wide>
          <LessonManager courseId={lessonOpen} onClose={() => setLessonOpen(null)} />
        </Modal>
      )}
    </Card>
  );
}

/** Lesson CRUD modal — add / edit / delete lessons within a course. */
function LessonManager({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const { t, toast } = useApp();
  const course = courseApi.byId(courseId);
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ id: '', title: '', summary: '', content: '', topicId: '' });

  const topics = course ? curriculumApi.topics(course.curriculumId) : [];
  const los = course ? curriculumApi.outcomes(course.curriculumId) : [];

  const save = () => {
    if (!d.title) return toast('Title required', 'error');
    courseApi.saveLesson({ ...d, courseId, topicId: d.topicId || topics[0]?.id || '', loIds: [] });
    toast('Lesson saved', 'success');
    setOpen(false);
    setD({ id: '', title: '', summary: '', content: '', topicId: '' });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {courseApi.lessons(courseId).map((l) => (
          <div key={l.id} className="flex-1 min-w-40 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{l.title}</p>
              <button onClick={() => { courseApi.removeLesson(l.id); toast('Lesson deleted', 'success'); }} className="text-slate-400 hover:text-rose-600">✕</button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{l.summary}</p>
            <p className="mt-1 text-[10px] text-slate-400">{l.content.length} chars · {l.recordedMinutes} min</p>
          </div>
        ))}
      </div>
      <Button className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>+ {t('lessons')}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={d.id ? t('edit') : `+ ${t('lessons')}`}>
        <div className="space-y-3">
          <Input placeholder="Lesson title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          <Input placeholder="Summary (one line)" value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} />
          <Textarea rows={4} placeholder="Lesson content (markdown-ish text)" value={d.content} onChange={(e) => setD({ ...d, content: e.target.value })} />
          <Select value={d.topicId} onChange={(e) => setD({ ...d, topicId: e.target.value })}>
            <option value="">{t('topic')}…</option>
            {topics.map((tp) => <option key={tp.id} value={tp.id}>{tp.unit} · {tp.name}</option>)}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button onClick={save}>{t('save')}</Button>
          </div>
        </div>
      </Modal>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>{t('close')}</Button>
      </div>
    </div>
  );
}

/* -------------------------------- questions ------------------------------- */
const QUESTION_TYPES: { value: Question['type']; label: string }[] = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'truefalse', label: 'True / False' },
  { value: 'fill', label: 'Fill in the blank' },
  { value: 'matching', label: 'Matching' },
  { value: 'balance', label: 'Balance equation' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'graph', label: 'Graph' },
  { value: 'essay', label: 'Essay' },
];

function QuestionsView() {
  const { t } = useApp();
  const [filter, setFilter] = useState({ curriculumId: '', type: '', search: '' });
  const [edit, setEdit] = useState<Question | null>(null);
  const [qOpen, setQOpen] = useState(false);

  const questions = questionApi.list({
    curriculumId: filter.curriculumId || undefined,
    type: filter.type || undefined,
    search: filter.search || undefined,
  });

  const openAdd = () => { setEdit(null); setQOpen(true); };
  const openEdit = (q: Question) => { setEdit(q); setQOpen(true); };
  const close = () => { setQOpen(false); setEdit(null); };

  return (
    <Card title={t('questionBank')} subtitle={`${questions.length} questions — add, edit, delete`}
      action={<Button className="h-9 px-3 text-xs" onClick={openAdd}>+ {t('add')} {t('questionBank')}</Button>}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={filter.curriculumId} onChange={(e) => setFilter({ ...filter, curriculumId: e.target.value })} className="w-48">
          <option value="">{t('curricula')}…</option>
          {curriculumApi.list().map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })} className="w-40">
          <option value="">{t('all')} types</option>
          {QUESTION_TYPES.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
        </Select>
        <Input placeholder={t('search')} value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} className="w-52" />
      </div>
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">{t('questionBank')}</th><th className="px-4 py-2 text-left">{t('topic')}</th><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">{t('difficulty')}</th><th className="px-4 py-2 text-left">{t('score')}</th><th className="px-4 py-2"></th></tr></THead>
        <tbody>
          {questions.map((q) => (
            <TRow key={q.id}>
              <TD className="max-w-md"><p className="text-sm text-slate-800 dark:text-slate-100 line-clamp-2">{q.stem}</p></TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{curriculumApi.topics(q.curriculumId).find((tp) => tp.id === q.topicId)?.name ?? '—'}</TD>
              <TD><Badge tone="violet">{QUESTION_TYPES.find((x) => x.value === q.type)?.label ?? q.type}</Badge></TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{q.difficulty}</TD>
              <TD>{q.points}</TD>
              <TD className="text-end">
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => openEdit(q)}>{t('edit')}</Button>
                <Button variant="ghost" className="h-8 px-2 text-xs text-rose-600" onClick={() => { if (confirm('Delete this question?')) { questionApi.remove(q.id); } }}>{t('delete')}</Button>
              </TD>
            </TRow>
          ))}
        </tbody>
      </Table>
      {questions.length === 0 && <EmptyState>{t('noData')}</EmptyState>}

      <Modal open={qOpen} onClose={close} title={edit ? t('edit') : `+ ${t('questionBank')}`} wide>
        <QuestionEditor question={edit} onClose={close} />
      </Modal>
    </Card>
  );
}

/**
 * Question editor — full CRUD for all 8 question types with a type-specific
 * answer builder. The answer is stored in the format the auto-grader expects.
 */
function QuestionEditor({ question, onClose }: { question: Question | null; onClose: () => void }) {
  const { t, toast } = useApp();
  const curricula = curriculumApi.list();
  const [d, setD] = useState<Question>(
    question ?? {
      id: '', curriculumId: curricula[0]?.id ?? '', topicId: '', loIds: [], difficulty: 'Remember',
      type: 'mcq', stem: '', options: [], answer: '', explanation: '', points: 2,
    },
  );
  const topics = curriculumApi.topics(d.curriculumId);
  const [answerText, setAnswerText] = useState(
    question ? typeof question.answer === 'string' ? question.answer : JSON.stringify(question.answer) : '',
  );

  const update = (patch: Partial<Question>) => {
    setD((prev) => ({ ...prev, ...patch }));
  };

  const buildAnswer = (): Question['answer'] => {
    switch (d.type) {
      case 'mcq':
      case 'graph': {
        const idx = parseInt(answerText, 10);
        return Number.isNaN(idx) ? answerText : String(idx);
      }
      case 'truefalse':
        return answerText === 'true' ? 'true' : 'false';
      case 'fill':
        return answerText.split('|').map((s) => s.trim()).filter(Boolean);
      case 'matching': {
        const pairs = answerText.split('|').map((p) => p.split(':')).filter((p) => p.length === 2);
        return { pairs: pairs.map(([left, right]) => ({ left: left.trim(), right: right.trim() })) } as MatchingAnswer;
      }
      case 'balance': {
        const [equation, coefs] = answerText.split('::');
        const coefficients = coefs ? coefs.split(',').map((n) => parseInt(n, 10)) : [];
        return { equation: equation ?? '', coefficients } as BalanceAnswer;
      }
      case 'numeric': {
        const [value, unit, sigfigs, tolerance, ...rest] = answerText.split('|');
        return {
          value: parseFloat(value) || 0, unit: unit ?? '', sigfigs: parseInt(sigfigs) || 1,
          tolerance: parseFloat(tolerance) || 0.02, accepts: rest.filter(Boolean),
        };
      }
      case 'essay':
        return '';
      default:
        return answerText;
    }
  };

  const save = () => {
    if (!d.stem) return toast('Question text required', 'error');
    const final = { ...d, answer: buildAnswer() };
    if (d.id) {
      questionApi.save(final);
      toast('Question updated', 'success');
    } else {
      questionApi.save(final);
      toast('Question added', 'success');
    }
    onClose();
  };

  const answerHint: Record<Question['type'], string> = {
    mcq: 'Option index (0,1,2…) or exact option text',
    truefalse: 'true or false',
    fill: 'Accepted variants separated by | e.g. two|2|two hydrogen',
    matching: 'left:right pairs separated by | e.g. A:1|B:2',
    balance: 'equation::coefficients e.g. Fe+O2->Fe2O3::4,3,2',
    numeric: 'value|unit|sigfigs|tolerance|accepts e.g. 4|mol|1|0.02|4,4 mol',
    graph: 'Option index or exact option text',
    essay: 'No answer needed (manual grading)',
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t('curricula')}</label>
          <Select value={d.curriculumId} onChange={(e) => update({ curriculumId: e.target.value, topicId: '' })}>
            {curricula.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t('topic')}</label>
          <Select value={d.topicId} onChange={(e) => update({ topicId: e.target.value })}>
            <option value="">{t('topic')}…</option>
            {topics.map((tp) => <option key={tp.id} value={tp.id}>{tp.unit} · {tp.name}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t('difficulty')}</label>
          <Select value={d.difficulty} onChange={(e) => update({ difficulty: e.target.value as BloomLevel })}>
            {BLOOM.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
          <Select value={d.type} onChange={(e) => update({ type: e.target.value as Question['type'] })}>
            {QUESTION_TYPES.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{t('score')}</label>
          <Input type="number" value={d.points} onChange={(e) => update({ points: parseInt(e.target.value) || 0 })} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">{t('questionBank')} text</label>
        <Textarea rows={3} value={d.stem} onChange={(e) => update({ stem: e.target.value })} />
      </div>
      {(d.type === 'mcq' || d.type === 'graph') && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Options (one per line)</label>
          <Textarea
            rows={4}
            value={(d.options ?? []).join('\n')}
            onChange={(e) => update({ options: e.target.value.split('\n').filter(Boolean) })}
          />
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Answer</label>
        {d.type === 'essay' ? (
          <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-900/40">{answerHint.essay}</p>
        ) : (
          <>
            <Input value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder={answerHint[d.type]} />
            <p className="mt-1 text-[11px] text-slate-400">{answerHint[d.type]}</p>
          </>
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">{t('feedback')} / explanation</label>
        <Textarea rows={2} value={d.explanation} onChange={(e) => update({ explanation: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={save}>{t('save')}</Button>
      </div>
    </div>
  );
}

/* --------------------------------- quizzes -------------------------------- */
function QuizzesView() {
  const { t, toast } = useApp();
  const classes = classApi.list();
  const courses = courseApi.list();
  const [tab, setTab] = useState<'quiz' | 'assignment'>('quiz');
  const [edit, setEdit] = useState<{ id: string; courseId: string } | null>(null);

  const quizzes = courses.flatMap((c) => courseApi.lessons(c.id).length ? [] : []) ;
  const allQuizzes = courses.flatMap((c) => ({ ...c, quizzes: [] }));

  return (
    <Card title={t('quizzes')} subtitle="Quizzes & assignments — build, publish, edit and delete"
      action={<Button className="h-9 px-3 text-xs" onClick={() => setEdit(null)}>+ {t('add')}</Button>}>
      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab('quiz')} className={`rounded-full px-3 py-1 text-xs ${tab === 'quiz' ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>{t('quizzes')}</button>
        <button onClick={() => setTab('assignment')} className={`rounded-full px-3 py-1 text-xs ${tab === 'assignment' ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>{t('assignments')}</button>
      </div>
      {tab === 'quiz' ? (
        <div className="space-y-3">
          {courses.map((c) => {
            const quizzes = db_quizzesForCourse(c.id);
            if (!quizzes.length) return null;
            return (
              <div key={c.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="mb-2 text-xs font-semibold text-slate-500">{c.title}</p>
                <div className="space-y-2">
                  {quizzes.map((q) => (
                    <div key={q.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-slate-900/40">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{q.title}</p>
                        <p className="text-[11px] text-slate-500">{q.questionIds.length} questions · {q.timeLimitMin} min · {q.attempts} attempts · {q.deadline}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={q.published ? 'green' : 'amber'}>{q.published ? 'Published' : 'Draft'}</Badge>
                        <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEdit({ id: q.id, courseId: c.id })}>{t('edit')}</Button>
                        <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => { assessmentApi.setQuizPublished(q.id, !q.published, 'u-admin'); toast(q.published ? 'Unpublished' : 'Published', 'success'); }}>{q.published ? 'Unpublish' : 'Publish'}</Button>
                        <Button variant="ghost" className="h-8 px-2 text-xs text-rose-600" onClick={() => { if (confirm(`Delete "${q.title}"?`)) { assessmentApi.removeQuiz(q.id); toast('Quiz deleted', 'success'); } }}>{t('delete')}</Button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setEdit({ id: '', courseId: c.id })} className="text-xs text-brand-600 hover:underline">+ {t('quizzes')}</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {courses.map((c) => (
            <div key={c.id}>
              <p className="mb-1 text-xs font-semibold text-slate-500">{c.title}</p>
              {db_assignmentsForCourse(c.id).map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.title}</p>
                    <p className="text-[11px] text-slate-500">max {a.maxScore} · {a.deadline} · {a.type}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEdit({ id: a.id, courseId: c.id })}>{t('edit')}</Button>
                    <Button variant="ghost" className="h-8 px-2 text-xs text-rose-600" onClick={() => { if (confirm(`Delete "${a.title}"?`)) { assessmentApi.removeAssignment(a.id); toast('Assignment deleted', 'success'); } }}>{t('delete')}</Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.id ? t('edit') : `+ ${tab === 'quiz' ? t('quizzes') : t('assignments')}`} wide>
          <AssessmentEditor id={edit.id} courseId={edit.courseId} kind={tab} onClose={() => setEdit(null)} />
        </Modal>
      )}
    </Card>
  );
}

/** Helper to read quizzes for a course. */
function db_quizzesForCourse(courseId: string) {
  return assessmentApi.quizzesForCourse(courseId);
}
function db_assignmentsForCourse(courseId: string) {
  return assessmentApi.assignmentsForCourse(courseId);
}

/**
 * Assessment editor — create / edit a quiz (with question picker, time limit,
 * attempts, randomize) or an assignment (deadline, max score, type).
 */
function AssessmentEditor({ id, courseId, kind, onClose }: { id: string; courseId: string; kind: 'quiz' | 'assignment'; onClose: () => void }) {
  const { t, toast } = useApp();
  const existing = id ? (kind === 'quiz' ? assessmentApi.quizById(id) : assessmentApi.assignmentById(id)) : null;
  const [d, setD] = useState({
    id, courseId,
    title: existing?.title ?? '', description: (existing as { description?: string })?.description ?? '',
    deadline: existing?.deadline ?? new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
    maxScore: 20, timeLimitMin: 20, attempts: 2, randomize: true, published: true,
    questionIds: (existing as { questionIds?: string[] })?.questionIds ?? [],
  });

  const allQuestions = questionApi.list();

  const toggleQ = (qid: string) => {
    setD((prev) => ({
      ...prev,
      questionIds: prev.questionIds.includes(qid) ? prev.questionIds.filter((x) => x !== qid) : [...prev.questionIds, qid],
    }));
  };

  const save = () => {
    if (!d.title) return toast('Title required', 'error');
    if (kind === 'quiz') {
      assessmentApi.saveQuiz(d);
      toast('Quiz saved', 'success');
    } else {
      assessmentApi.saveAssignment({ ...d, maxScore: d.maxScore });
      toast('Assignment saved', 'success');
    }
    onClose();
  };

  return (
    <div className="space-y-3">
      <Input placeholder="Title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
      <Textarea rows={2} placeholder="Description" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">{t('deadline')}</span>
          <Input type="date" value={d.deadline} onChange={(e) => setD({ ...d, deadline: e.target.value })} />
        </label>
        {kind === 'quiz' ? (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">{t('timeLimit')}</span>
              <Input type="number" value={d.timeLimitMin} onChange={(e) => setD({ ...d, timeLimitMin: parseInt(e.target.value) || 20 })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">{t('attempts')}</span>
              <Input type="number" value={d.attempts} onChange={(e) => setD({ ...d, attempts: parseInt(e.target.value) || 1 })} />
            </label>
          </>
        ) : (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Max {t('score')}</span>
            <Input type="number" value={d.maxScore} onChange={(e) => setD({ ...d, maxScore: parseInt(e.target.value) || 20 })} />
          </label>
        )}
      </div>
      {kind === 'quiz' && (
        <>
          <div className="flex items-center gap-4">
            <Toggle checked={d.randomize} onChange={(v) => setD({ ...d, randomize: v })} label={t('randomize')} />
            <Toggle checked={d.published} onChange={(v) => setD({ ...d, published: v })} label="Published" />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">{t('questionBank')} — select questions ({d.questionIds.length} selected)</p>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              {allQuestions.map((q) => (
                <label key={q.id} className="flex items-start gap-2 rounded px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="checkbox" checked={d.questionIds.includes(q.id)} onChange={() => toggleQ(q.id)} className="mt-0.5" />
                  <span className="text-xs text-slate-700 dark:text-slate-200 line-clamp-2">{q.stem}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={save}>{t('save')}</Button>
      </div>
    </div>
  );
}

/* --------------------------------- gradebook ------------------------------ */
function GradebookView() {
  const { t, toast } = useApp();
  const [classId, setClassId] = useState(classApi.list()[0]?.id ?? '');
  const cls = classApi.byId(classId);
  const entries = classId ? gradebookApi.forClass(classId) : [];
  const [edit, setEdit] = useState<{ id: string; score: string } | null>(null);

  const setScore = (id: string, score: string) => {
    const num = score === '' ? null : parseFloat(score);
    gradebookApi.setScore(id, num, 'u-admin');
    setEdit(null);
    toast('Score saved', 'success');
  };

  return (
    <Card title={t('gradebook')} subtitle="Editable grades — set or clear any score"
      action={
        <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-52">
          {classApi.list().map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      }>
      {cls && (
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{cls.name} · {entries.length} gradebook entries</p>
      )}
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">Student</th><th className="px-4 py-2 text-left">Assessment</th><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">{t('score')}</th><th className="px-4 py-2 text-left">%</th><th className="px-4 py-2"></th></tr></THead>
        <tbody>
          {entries.map((g) => {
            const student = usersApi.byId(g.studentId);
            const pct = g.score != null ? Math.round((g.score / g.maxScore) * 100) : 0;
            return (
              <TRow key={g.id}>
                <TD><div className="flex items-center gap-2"><Avatar name={student?.name ?? ''} color={student?.avatarColor ?? 'bg-slate-500'} size={26} /><span className="text-sm text-slate-800 dark:text-slate-100">{student?.name ?? g.studentId}</span></div></TD>
                <TD className="text-xs text-slate-600 dark:text-slate-300">{g.title}</TD>
                <TD><Badge tone="slate">{g.type}</Badge></TD>
                <TD>{g.score == null ? <span className="text-xs text-slate-400">—</span> : <span className="font-mono text-sm">{g.score}/{g.maxScore}</span>}</TD>
                <TD>{g.score != null ? <span className={`text-sm font-semibold ${pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{pct}%</span> : '—'}</TD>
                <TD className="text-end"><Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEdit({ id: g.id, score: g.score != null ? String(g.score) : '' })}>{t('edit')}</Button></TD>
              </TRow>
            );
          })}
        </tbody>
      </Table>
      {entries.length === 0 && <EmptyState>{t('noData')}</EmptyState>}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`${t('score')} — ${edit ? entries.find((e) => e.id === edit.id)?.title ?? '' : ''}`}>
        <div className="space-y-3">
          <Input type="number" placeholder="Score (leave empty to clear)" value={edit?.score ?? ''} onChange={(e) => setEdit({ id: edit!.id, score: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEdit(null)}>{t('cancel')}</Button>
            <Button onClick={() => edit && setScore(edit.id, edit.score)}>{t('save')}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

/* ---------------------------------- attendance ----------------------------- */
function AttendanceView() {
  const { t, toast } = useApp();
  const classes = classApi.list();
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const cls = classApi.byId(classId);
  const students = cls ? classApi.students(classId) : [];
  const records = classId ? attendanceApi.forClass(classId, date) : [];

  const record = (studentId: string, status: 'present' | 'absent' | 'late') => {
    attendanceApi.setStatus(classId, studentId, date, status, 'u-admin');
    toast('Attendance updated', 'success');
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card title={t('attendance')} subtitle="Mark, edit or delete attendance — real tracking"
      action={
        <div className="flex gap-2">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-44">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        </div>
      }>
      {cls && (
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{cls.name} · {date} · {attendanceApi.classRate(classId)}% attendance rate</p>
      )}
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">Student</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-left">{t('actions')}</th></tr></THead>
        <tbody>
          {students.map((s) => {
            const rec = records.find((r) => r.studentId === s.id);
            return (
              <TRow key={s.id}>
                <TD><div className="flex items-center gap-2"><Avatar name={s.name} color={s.avatarColor} size={26} /><span className="text-sm text-slate-800 dark:text-slate-100">{s.name}</span></div></TD>
                <TD>
                  {rec ? (
                    <Badge tone={rec.status === 'present' ? 'green' : rec.status === 'late' ? 'amber' : 'red'}>{t(rec.status)}</Badge>
                  ) : <span className="text-xs text-slate-400">—</span>}
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => record(s.id, 'present')} className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300">P</button>
                    <button onClick={() => record(s.id, 'late')} className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300">L</button>
                    <button onClick={() => record(s.id, 'absent')} className="rounded bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-300">A</button>
                    {rec && <button onClick={() => { attendanceApi.remove(classId, s.id, date); toast('Record deleted', 'success'); }} className="rounded px-2 py-0.5 text-[11px] text-slate-400 hover:text-rose-600">✕</button>}
                  </div>
                </TD>
              </TRow>
            );
          })}
        </tbody>
      </Table>
      {students.length === 0 && <EmptyState>{t('noData')}</EmptyState>}
      <p className="mt-3 text-[11px] text-slate-400">P = {t('present')} · L = {t('late')} · A = {t('absent')} — marks persist permanently.</p>
    </Card>
  );
}

/* ---------------------------------- messaging ------------------------------ */
function MessagingView({ admin }: { admin: User }) {
  const { t, toast } = useApp();
  const [recipient, setRecipient] = useState('');
  const [broadcast, setBroadcast] = useState('');
  const [content, setContent] = useState('');
  const msgs = messageApi.all();

  const send = () => {
    if (!recipient || !content) return toast('Recipient and message required', 'error');
    messageApi.send(admin.id, recipient, content);
    toast('Message sent', 'success');
    setContent('');
  };
  const broadcastSend = () => {
    if (!broadcast || !content) return toast('Choose recipients and write a message', 'error');
    const targets = broadcast.split(',').map((s) => s.trim()).filter(Boolean);
    const n = messageApi.broadcast(admin.id, targets, content);
    toast(`Broadcast to ${n} recipients`, 'success');
    setContent('');
  };

  return (
    <div className="space-y-4">
      <Card title={t('messaging')} subtitle="Send messages — direct or broadcast — and moderate the platform">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Direct message</p>
            <Select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              <option value="">{t('users')}…</option>
              {usersApi.list().filter((u) => u.id !== admin.id).map((u) => <option key={u.id} value={u.id}>{u.name} ({t(`role_${u.role}`)})</option>)}
            </Select>
            <Textarea rows={3} placeholder={t('messagePlaceholder')} value={content} onChange={(e) => setContent(e.target.value)} />
            <Button onClick={send}>{t('send')}</Button>
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Broadcast</p>
            <Input placeholder="User IDs separated by commas (e.g. u-s1, u-s2)" value={broadcast} onChange={(e) => setBroadcast(e.target.value)} />
            <Textarea rows={3} placeholder={t('messagePlaceholder')} value={content} onChange={(e) => setContent(e.target.value)} />
            <Button onClick={broadcastSend}>{t('send')} (broadcast)</Button>
          </div>
        </div>
      </Card>

      <Card title={t('moderation')} subtitle="All messages — delete any message from the platform">
        <Table>
          <THead><tr><th className="px-4 py-2 text-left">When</th><th className="px-4 py-2 text-left">From</th><th className="px-4 py-2 text-left">To</th><th className="px-4 py-2 text-left">Message</th><th className="px-4 py-2"></th></tr></THead>
          <tbody>
            {msgs.slice(0, 50).map((m) => (
              <TRow key={m.id}>
                <TD className="text-xs text-slate-500 dark:text-slate-400">{new Date(m.at).toLocaleString()}</TD>
                <TD className="text-xs text-slate-600 dark:text-slate-300">{usersApi.byId(m.fromId)?.name}</TD>
                <TD className="text-xs text-slate-600 dark:text-slate-300">{usersApi.byId(m.toId)?.name}</TD>
                <TD className="max-w-xs text-xs text-slate-500 dark:text-slate-400">{m.content}</TD>
                <TD className="text-end"><Button variant="ghost" className="h-8 px-2 text-xs text-rose-600" onClick={() => { messageApi.remove(m.id, admin.id); toast('Message deleted', 'success'); }}>{t('delete')}</Button></TD>
              </TRow>
            ))}
          </tbody>
        </Table>
        {msgs.length === 0 && <EmptyState>{t('noData')}</EmptyState>}
      </Card>
    </div>
  );
}

/* -------------------------------- notifications ----------------------------- */
function NotificationsView() {
  const { t, toast } = useApp();
  // Admin view: gather notifications across all users.
  const all = (() => {
    const out: { id: string; userId: string; type: string; title: string; body: string; at: string; read: boolean }[] = [];
    for (const u of usersApi.list()) {
      for (const n of notificationApi.forUser(u.id)) out.push(n);
    }
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
  })();

  return (
    <Card title={t('notifications')} subtitle="System notifications across all users — delete or clear">
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">User</th><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Title</th><th className="px-4 py-2 text-left">When</th><th className="px-4 py-2"></th></tr></THead>
        <tbody>
          {all.map((n) => {
            const u = usersApi.byId(n.userId);
            return (
              <TRow key={n.id}>
                <TD className="text-xs text-slate-600 dark:text-slate-300">{u?.name ?? n.userId}</TD>
                <TD><Badge tone="slate">{n.type}</Badge></TD>
                <TD className="max-w-xs text-xs text-slate-500 dark:text-slate-400">{n.title} — {n.body}</TD>
                <TD className="text-xs text-slate-500 dark:text-slate-400">{new Date(n.at).toLocaleString()}</TD>
                <TD className="text-end">
                  <Button variant="ghost" className="h-8 px-2 text-xs text-rose-600" onClick={() => { notificationApi.remove(n.id); }}>{t('delete')}</Button>
                </TD>
              </TRow>
            );
          })}
        </tbody>
      </Table>
      {all.length === 0 && <EmptyState>{t('noData')}</EmptyState>}
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => { if (confirm('Clear ALL notifications for all users?')) { usersApi.list().forEach((u) => notificationApi.clearForUser(u.id)); toast('Notifications cleared', 'success'); } }}>Clear all notifications</Button>
      </div>
    </Card>
  );
}

/* ---------------------------------- chemistry ------------------------------ */
function ChemistryView() {
  const { t, toast } = useApp();
  const [tab, setTab] = useState<'element' | 'equation' | 'constant'>('element');

  return (
    <Card title={t('chemistryLab')} subtitle="Editable chemistry data — elements, equations and constants that drive the tools"
      action={<Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => { if (confirm('Reset chemistry data to defaults?')) { chemApi.resetChemData(); toast('Chemistry data reset', 'success'); } }}>Reset to defaults</Button>}>
      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab('element')} className={`rounded-full px-3 py-1 text-xs ${tab === 'element' ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>{t('element')}s ({chemApi.elements().length})</button>
        <button onClick={() => setTab('equation')} className={`rounded-full px-3 py-1 text-xs ${tab === 'equation' ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>{t('equation')}s ({chemApi.equations().length})</button>
        <button onClick={() => setTab('constant')} className={`rounded-full px-3 py-1 text-xs ${tab === 'constant' ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>Constants ({chemApi.constants().length})</button>
      </div>
      {tab === 'element' && <ElementsManager />}
      {tab === 'equation' && <EquationsManager />}
      {tab === 'constant' && <ConstantsManager />}
    </Card>
  );
}

function ElementsManager() {
  const { t, toast } = useApp();
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [add, setAdd] = useState({ symbol: '', name: '', mass: '', category: 'nonmetal', block: 'p', phase: 'solid' });

  const save = (z: number) => {
    const e = chemApi.elements().find((x) => x.z === z)!;
    chemApi.saveElement({
      z, symbol: edit.symbol ?? e.symbol, name: edit.name ?? e.name,
      mass: parseFloat(edit.mass) || e.mass, category: edit.category ?? e.category,
      block: (edit.block as never) ?? e.block, phase: (edit.phase as never) ?? e.phase,
      electronegativity: parseFloat(edit.en) || e.electronegativity, radiusPm: parseFloat(edit.radius) || e.radiusPm,
    });
    setEdit({});
    toast('Element saved', 'success');
  };

  const addElement = () => {
    if (!add.symbol || !add.name) return toast('Symbol and name required', 'error');
    chemApi.saveElement({ symbol: add.symbol, name: add.name, mass: parseFloat(add.mass) || 0, category: add.category, block: add.block as never, phase: add.phase as never });
    toast('Element added', 'success');
    setAdd({ symbol: '', name: '', mass: '', category: 'nonmetal', block: 'p', phase: 'solid' });
  };

  const elements = [...chemApi.elements()].sort((a, b) => a.z - b.z);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {elements.slice(0, 60).map((e) => (
          <button key={e.z} onClick={() => setEdit((prev) => ({ ...prev, z: String(e.z), symbol: e.symbol, name: e.name, mass: String(e.mass), category: e.category, block: e.block, phase: e.phase, en: String(e.electronegativity), radius: String(e.radiusPm) }))}
            className="flex h-12 w-12 flex-col items-center justify-center rounded-lg border border-slate-200 text-xs dark:border-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30">
            <span className="text-[9px] text-slate-400">{e.z}</span>
            <span className="font-bold text-slate-700 dark:text-slate-100">{e.symbol}</span>
            <span className="text-[9px] text-slate-400">{e.mass}</span>
          </button>
        ))}
      </div>
      {Object.keys(edit).length > 0 && (
        <div className="rounded-xl border border-brand-300 p-3 dark:border-brand-700">
          <p className="mb-2 text-sm font-semibold text-brand-700 dark:text-brand-200">Edit element (Z={edit.z})</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Symbol" value={edit.symbol ?? ''} onChange={(e) => setEdit({ ...edit, symbol: e.target.value })} />
            <Input placeholder="Name" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Input placeholder="Mass" value={edit.mass ?? ''} onChange={(e) => setEdit({ ...edit, mass: e.target.value })} />
            <Select value={edit.category ?? 'nonmetal'} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
              <option value="nonmetal">Nonmetal</option>
              <option value="metalloid">Metalloid</option>
              <option value="alkali-metal">Alkali metal</option>
              <option value="alkaline-earth">Alkaline earth</option>
              <option value="transition-metal">Transition metal</option>
              <option value="post-transition">Post-transition</option>
              <option value="halogen">Halogen</option>
              <option value="noble-gas">Noble gas</option>
              <option value="lanthanide">Lanthanide</option>
              <option value="actinide">Actinide</option>
            </Select>
            <Select value={edit.block ?? 'p'} onChange={(e) => setEdit({ ...edit, block: e.target.value })}>
              <option value="s">s</option><option value="p">p</option><option value="d">d</option><option value="f">f</option>
            </Select>
            <Select value={edit.phase ?? 'solid'} onChange={(e) => setEdit({ ...edit, phase: e.target.value })}>
              <option value="solid">Solid</option><option value="liquid">Liquid</option><option value="gas">Gas</option>
            </Select>
            <Input placeholder="Electronegativity" value={edit.en ?? ''} onChange={(e) => setEdit({ ...edit, en: e.target.value })} />
            <Input placeholder="Radius (pm)" value={edit.radius ?? ''} onChange={(e) => setEdit({ ...edit, radius: e.target.value })} />
          </div>
          <div className="mt-2 flex gap-2">
            <Button className="h-8 px-3 text-xs" onClick={() => save(Number(edit.z))}>{t('save')}</Button>
            <Button variant="danger" className="h-8 px-3 text-xs" onClick={() => { chemApi.removeElement(Number(edit.z)); setEdit({}); toast('Element deleted', 'success'); }}>{t('delete')}</Button>
            <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => setEdit({})}>{t('cancel')}</Button>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">+ {t('add')} {t('element')}</p>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input placeholder="Symbol" value={add.symbol} onChange={(e) => setAdd({ ...add, symbol: e.target.value })} />
          <Input placeholder="Name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
          <Input placeholder="Mass" value={add.mass} onChange={(e) => setAdd({ ...add, mass: e.target.value })} />
          <Button className="h-9 px-3 text-xs" onClick={addElement}>{t('add')}</Button>
        </div>
      </div>
    </div>
  );
}

function EquationsManager() {
  const { t, toast } = useApp();
  const [edit, setEdit] = useState<{ id?: string; equation: string; category: string; note: string } | null>(null);
  const save = () => {
    if (!edit?.equation) return toast('Equation required', 'error');
    chemApi.saveEquation(edit);
    toast('Equation saved', 'success');
    setEdit(null);
  };
  return (
    <div className="space-y-2">
      {chemApi.equations().map((e) => (
        <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="min-w-0">
            <p className="font-mono text-sm text-slate-800 dark:text-slate-100">{e.equation}</p>
            <p className="text-[11px] text-slate-500">{e.category} · {e.note}</p>
          </div>
          <div className="flex gap-1.5">
            <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEdit({ id: e.id, equation: e.equation, category: e.category, note: e.note ?? '' })}>{t('edit')}</Button>
            <Button variant="ghost" className="h-8 px-2 text-xs text-rose-600" onClick={() => { chemApi.removeEquation(e.id); toast('Equation deleted', 'success'); }}>{t('delete')}</Button>
          </div>
        </div>
      ))}
      <Button className="h-9 px-3 text-xs" onClick={() => setEdit({ equation: '', category: 'General', note: '' })}>+ {t('add')} {t('equation')}</Button>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t('edit') : `+ ${t('equation')}`}>
        <div className="space-y-3">
          <Input placeholder="e.g. Fe + O2 -> Fe2O3" value={edit?.equation ?? ''} onChange={(e) => setEdit({ ...edit!, equation: e.target.value })} />
          <Input placeholder="Category" value={edit?.category ?? ''} onChange={(e) => setEdit({ ...edit!, category: e.target.value })} />
          <Input placeholder="Note (optional)" value={edit?.note ?? ''} onChange={(e) => setEdit({ ...edit!, note: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEdit(null)}>{t('cancel')}</Button>
            <Button onClick={save}>{t('save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ConstantsManager() {
  const { t, toast } = useApp();
  const [edit, setEdit] = useState<{ id?: string; name: string; value: string; unit: string; note: string } | null>(null);
  const save = () => {
    if (!edit?.name) return toast('Name required', 'error');
    chemApi.saveConstant({ id: edit.id, name: edit.name, value: parseFloat(edit.value) || 0, unit: edit.unit, note: edit.note });
    toast('Constant saved', 'success');
    setEdit(null);
  };
  return (
    <div className="space-y-2">
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">Name</th><th className="px-4 py-2 text-left">Value</th><th className="px-4 py-2 text-left">Unit</th><th className="px-4 py-2 text-left">Note</th><th className="px-4 py-2"></th></tr></THead>
        <tbody>
          {chemApi.constants().map((c) => (
            <TRow key={c.id}>
              <TD className="text-sm text-slate-700 dark:text-slate-200">{c.name}</TD>
              <TD className="font-mono text-sm">{c.value}</TD>
              <TD className="text-xs text-slate-500">{c.unit}</TD>
              <TD className="text-xs text-slate-500">{c.note}</TD>
              <TD className="text-end">
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEdit({ id: c.id, name: c.name, value: String(c.value), unit: c.unit, note: c.note ?? '' })}>{t('edit')}</Button>
                <Button variant="ghost" className="h-8 px-2 text-xs text-rose-600" onClick={() => { chemApi.removeConstant(c.id); toast('Constant deleted', 'success'); }}>{t('delete')}</Button>
              </TD>
            </TRow>
          ))}
        </tbody>
      </Table>
      <Button className="h-9 px-3 text-xs" onClick={() => setEdit({ name: '', value: '', unit: '', note: '' })}>+ {t('add')} constant</Button>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t('edit') : `+ constant`}>
        <div className="space-y-3">
          <Input placeholder="Name" value={edit?.name ?? ''} onChange={(e) => setEdit({ ...edit!, name: e.target.value })} />
          <Input placeholder="Value" value={edit?.value ?? ''} onChange={(e) => setEdit({ ...edit!, value: e.target.value })} />
          <Input placeholder="Unit" value={edit?.unit ?? ''} onChange={(e) => setEdit({ ...edit!, unit: e.target.value })} />
          <Input placeholder="Note (optional)" value={edit?.note ?? ''} onChange={(e) => setEdit({ ...edit!, note: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEdit(null)}>{t('cancel')}</Button>
            <Button onClick={save}>{t('save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------------------------- users --------------------------------- */
function UsersView({ admin }: { admin: User }) {
  const { t, toast } = useApp();
  const [role, setRole] = useState<Role | 'all'>('all');
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<User | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const users = usersApi.list(role === 'all' ? undefined : role)
    .filter((u) => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const downloadCsvTemplate = () => {
    const csv = 'name,email,role\nJane Doe,jane@example.com,student\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'users-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card title={t('users')} subtitle={`${users.length} users — full control`}
      action={
        <div className="flex gap-2">
          <Button className="h-9 px-3 text-xs" onClick={() => setLinkOpen(true)}>{t('linkParents')}</Button>
          <Button className="h-9 px-3 text-xs" onClick={() => setImportOpen(true)}>{t('bulkImport')}</Button>
          <Button className="h-9 px-3 text-xs" onClick={() => setAddOpen(true)}>+ {t('newUser')}</Button>
        </div>
      }>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={role} onChange={(e) => setRole(e.target.value as Role | 'all')} className="w-44">
          <option value="all">{t('all')}</option>
          <option value="admin">{t('role_admin')}</option>
          <option value="teacher">{t('role_teacher')}</option>
          <option value="student">{t('role_student')}</option>
          <option value="parent">{t('role_parent')}</option>
        </Select>
        <Input placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
      </div>
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">Name</th><th className="px-4 py-2 text-left">Role</th><th className="px-4 py-2 text-left">Email</th><th className="px-4 py-2 text-left">Phone</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2"></th></tr></THead>
        <tbody>
          {users.map((u) => (
            <TRow key={u.id}>
              <TD><div className="flex items-center gap-2"><Avatar name={u.name} color={u.avatarColor} size={28} /><span className="font-medium text-slate-800 dark:text-slate-100">{u.name}</span></div></TD>
              <TD><Badge tone={u.role === 'admin' ? 'blue' : u.role === 'teacher' ? 'violet' : u.role === 'student' ? 'green' : 'amber'}>{t(`role_${u.role}`)}</Badge></TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{u.email}{!u.emailConfirmed && <span className="ml-1 text-amber-500">⚠</span>}</TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{u.phone ?? '—'}{u.phone && !u.phoneConfirmed && <span className="ml-1 text-amber-500">⚠</span>}</TD>
              <TD>{u.status === 'active' ? <Badge tone="green">{t('active')}</Badge> : <Badge tone="red">{t('suspended')}</Badge>}</TD>
              <TD className="text-end">
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEdit(u)}>{t('edit')}</Button>
                {u.role !== 'admin' && (
                  <Button variant="ghost" className="h-8 px-2 text-xs"
                    onClick={() => { usersApi.setStatus(u.id, u.status === 'active' ? 'suspended' : 'active'); toast('Status updated', 'success'); }}>
                    {u.status === 'active' ? t('suspended') : t('active')}
                  </Button>
                )}
              </TD>
            </TRow>
          ))}
        </tbody>
      </Table>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={t('edit') + ' — ' + (edit?.name ?? '')} wide>
        {edit && <EditUserModal user={edit} admin={admin} onClose={() => setEdit(null)} />}
      </Modal>
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('newUser')}>
        <AddUserForm onDone={() => setAddOpen(false)} />
      </Modal>
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={t('bulkImport')} wide>
        <BulkImportForm onDone={() => setImportOpen(false)} template={downloadCsvTemplate} />
      </Modal>
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title={t('linkParents')}>
        <LinkParentForm onDone={() => setLinkOpen(false)} />
      </Modal>
    </Card>
  );
}

function AddUserForm({ onDone }: { onDone: () => void }) {
  const { t, toast } = useApp();
  const [d, setD] = useState({ name: '', email: '', phone: '', role: 'student' as Role, password: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!d.name || !d.email) return toast('Name and email required', 'error');
    if (d.password && d.password.length < 6) return toast('Password must be at least 6 characters', 'error');
    setBusy(true);
    await usersApi.create(d);
    setBusy(false);
    toast('User added', 'success');
    onDone();
  };
  return (
    <div className="space-y-3">
      <Input placeholder={t('newUser') + ' — name'} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      <Input placeholder="Email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
      <Input placeholder="Phone (optional, e.g. +201000000000)" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
      <Select value={d.role} onChange={(e) => setD({ ...d, role: e.target.value as Role })}>
        <option value="student">{t('role_student')}</option>
        <option value="teacher">{t('role_teacher')}</option>
        <option value="parent">{t('role_parent')}</option>
        <option value="admin">{t('role_admin')}</option>
      </Select>
      <Input placeholder="Password (min 6 chars)" value={d.password} onChange={(e) => setD({ ...d, password: e.target.value })} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('cancel')}</Button>
        <Button onClick={save} disabled={busy}>{busy ? '…' : t('save')}</Button>
      </div>
    </div>
  );
}

function BulkImportForm({ onDone, template }: { onDone: () => void; template: () => void }) {
  const { t, toast } = useApp();
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const n = await usersApi.bulkImport(csv);
    setBusy(false);
    toast(`${n} users imported`, 'success');
    onDone();
  };
  return (
    <div className="space-y-3">
      <Textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="name,email,role\nJane Doe,jane@example.com,student" />
      <Button variant="outline" className="h-9 px-3 text-xs" onClick={template}>Download CSV template</Button>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('cancel')}</Button>
        <Button onClick={save} disabled={busy}>{busy ? '…' : t('save')}</Button>
      </div>
    </div>
  );
}

function LinkParentForm({ onDone }: { onDone: () => void }) {
  const { t, toast } = useApp();
  const parents = usersApi.list('parent');
  const students = usersApi.list('student');
  const [parentId, setParentId] = useState(parents[0]?.id ?? '');
  const [studentId, setStudentId] = useState(students[0]?.id ?? '');
  const link = () => {
    usersApi.linkParentStudent(parentId, studentId);
    toast('Parent linked', 'success');
    onDone();
  };
  return (
    <div className="space-y-3">
      <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
        {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>
      <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
        {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('cancel')}</Button>
        <Button onClick={link}>{t('save')}</Button>
      </div>
    </div>
  );
}

/**
 * EditUserModal — full admin control over a single user:
 * edit name/email/phone, change role, assign/unassign classes, confirm
 * email/phone, reset password and delete the account.
 */
function EditUserModal({ user, admin, onClose }: { user: User; admin: User; onClose: () => void }) {
  const { t, toast } = useApp();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [role, setRole] = useState<Role>(user.role);
  const [resetPw, setResetPw] = useState('');
  const [busy, setBusy] = useState(false);

  const saveProfile = () => {
    usersApi.update(user.id, { name, email, phone: phone || undefined });
    toast('Profile updated', 'success');
  };

  const doConfirm = (target: 'email' | 'phone') => {
    const res = usersApi.confirm(user.id, target, admin.id);
    toast(res.ok ? `${target} confirmed` : res.error ?? 'Failed', res.ok ? 'success' : 'error');
  };

  const resend = (target: 'email' | 'phone') => {
    const res = usersApi.resendConfirmation(user.id, target);
    if ('token' in res) toast(`New ${target} confirmation code: ${res.token}`, 'info');
    else toast(res.error, 'error');
  };

  const doReset = async () => {
    if (resetPw.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    setBusy(true);
    const res = await adminResetPassword(user.id, resetPw, admin.id);
    setBusy(false);
    if (res.ok) { toast('Password reset — new password set', 'success'); setResetPw(''); }
    else toast(res.error ?? 'Failed', 'error');
  };

  const changeRole = () => {
    const res = usersApi.setRole(user.id, role, admin.id);
    toast(res.ok ? `Role changed to ${role}` : res.error ?? 'Failed', res.ok ? 'success' : 'error');
  };

  const doDelete = () => {
    if (!confirm(`Delete ${user.name}? This cannot be undone.`)) return;
    usersApi.remove(user.id, admin.id);
    toast('User deleted', 'success');
    onClose();
  };

  const classes = classApi.list();
  const assignedClassIds = new Set(user.studentClassIds ?? []);

  return (
    <div className="space-y-4">
      {/* profile */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Profile</h3>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (e.g. +201000000000)" />
        <Button onClick={saveProfile}>{t('save')}</Button>
      </div>

      {/* role */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('role')}</h3>
        <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="admin">{t('role_admin')}</option>
          <option value="teacher">{t('role_teacher')}</option>
          <option value="student">{t('role_student')}</option>
          <option value="parent">{t('role_parent')}</option>
        </Select>
        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={changeRole} disabled={role === user.role}>Change role</Button>
      </div>

      {/* classes (students) */}
      {role === 'student' && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('classes')}</h3>
          <div className="flex flex-wrap gap-1.5">
            {classes.map((c) => {
              const on = assignedClassIds.has(c.id);
              return (
                <button key={c.id} onClick={() => { on ? usersApi.unassignClass(user.id, c.id, admin.id) : usersApi.assignClass(user.id, c.id, admin.id); toast('Class updated', 'success'); }}
                  className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40' : 'border-slate-200 dark:border-slate-700'}`}>
                  {c.name} {on ? '✓' : '+'}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* verification */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Verification</h3>
        <div className="flex items-center gap-2">
          <Badge tone={user.emailConfirmed ? 'green' : 'amber'}>Email: {user.emailConfirmed ? 'Confirmed' : 'Unconfirmed'}</Badge>
          <Badge tone={user.phoneConfirmed ? 'green' : 'amber'}>Phone: {user.phoneConfirmed ? 'Confirmed' : 'Unconfirmed'}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {!user.emailConfirmed && <>
            <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => resend('email')}>Resend email code</Button>
            <Button className="h-8 px-3 text-xs" onClick={() => doConfirm('email')}>Confirm email</Button>
          </>}
          {user.phone && !user.phoneConfirmed && <>
            <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => resend('phone')}>Resend phone code</Button>
            <Button className="h-8 px-3 text-xs" onClick={() => doConfirm('phone')}>Confirm phone</Button>
          </>}
        </div>
      </div>

      {/* password reset */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Reset password</h3>
        <Input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="New password (min 6 chars)" />
        <Button onClick={doReset} disabled={busy}>{busy ? '…' : 'Reset password'}</Button>
      </div>

      {/* danger */}
      <div className="space-y-2 border-t border-rose-200 pt-3 dark:border-rose-900">
        <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400">Danger zone</h3>
        <Button variant="danger" onClick={doDelete}>Delete account</Button>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>{t('close')}</Button>
      </div>
    </div>
  );
}

/* ---------------------------------- classes ------------------------------- */
function ClassesView() {
  const { t, toast } = useApp();
  const teachers = usersApi.list('teacher');
  const grades = curriculumApi.list().flatMap((c) => curriculumApi.grades(c.id).map((g) => ({ ...g, curriculumName: c.name })));
  const [d, setD] = useState({ name: '', gradeId: '', teacherId: '', curriculumId: '' });
  const [roster, setRoster] = useState<string | null>(null);

  const save = () => {
    if (!d.name) return toast('Name required', 'error');
    const grade = grades.find((g) => g.id === d.gradeId);
    classApi.save({ ...d, curriculumId: grade?.curriculumId ?? curriculumApi.list()[0].id });
    toast('Class saved', 'success');
    setD({ name: '', gradeId: '', teacherId: '', curriculumId: '' });
  };

  return (
    <Card title={t('classes')} subtitle="Classes & sections — add, edit, delete and manage rosters"
      action={<Button className="h-9 px-3 text-xs" onClick={save}>+ {t('addClass')}</Button>}>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Input placeholder="Class name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <Select value={d.gradeId} onChange={(e) => setD({ ...d, gradeId: e.target.value })}>
          <option value="">Grade…</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.curriculumName})</option>)}
        </Select>
        <Select value={d.teacherId} onChange={(e) => setD({ ...d, teacherId: e.target.value })}>
          <option value="">Teacher…</option>
          {teachers.map((tch) => <option key={tch.id} value={tch.id}>{tch.name}</option>)}
        </Select>
      </div>
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">Class</th><th className="px-4 py-2 text-left">Curriculum</th><th className="px-4 py-2 text-left">Teacher</th><th className="px-4 py-2 text-left">Students</th><th className="px-4 py-2 text-left">{t('attendanceRate')}</th><th className="px-4 py-2"></th></tr></THead>
        <tbody>
          {classApi.list().map((c) => (
            <TRow key={c.id}>
              <TD className="font-medium text-slate-800 dark:text-slate-100">{c.name}</TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{curriculumApi.list().find((x) => x.id === c.curriculumId)?.name}</TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{usersApi.byId(c.teacherId)?.name}</TD>
              <TD>{c.studentIds.length}</TD>
              <TD><Badge tone="green">{attendanceApi.classRate(c.id)}%</Badge></TD>
              <TD className="text-end">
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setRoster(c.id)}>{t('students')}</Button>
                <Button variant="ghost" className="h-8 px-2 text-xs text-rose-600" onClick={() => { if (confirm(`Delete "${c.name}"?`)) { classApi.remove(c.id); toast('Class deleted', 'success'); } }}>{t('delete')}</Button>
              </TD>
            </TRow>
          ))}
        </tbody>
      </Table>

      <Modal open={!!roster} onClose={() => setRoster(null)} title={`${t('students')} — ${classApi.byId(roster ?? '')?.name ?? ''}`} wide>
        {roster && <ClassRoster classId={roster} onClose={() => setRoster(null)} />}
      </Modal>
    </Card>
  );
}

/** Class roster manager — add/remove students in a class. */
function ClassRoster({ classId, onClose }: { classId: string; onClose: () => void }) {
  const { t, toast } = useApp();
  const cls = classApi.byId(classId)!;
  const inClass = new Set(cls.studentIds);
  const candidates = usersApi.list('student').filter((s) => !inClass.has(s.id));
  const students = classApi.students(classId);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {students.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-slate-900/40">
            <div className="flex items-center gap-2"><Avatar name={s.name} color={s.avatarColor} size={26} /><span className="text-sm text-slate-800 dark:text-slate-100">{s.name}</span></div>
            <button onClick={() => { classApi.removeStudent(classId, s.id, 'u-admin'); toast('Student removed', 'success'); }} className="text-xs text-rose-600 hover:underline">Remove</button>
          </div>
        ))}
        {students.length === 0 && <EmptyState>{t('noData')}</EmptyState>}
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">+ {t('add')} {t('students')}</p>
        <div className="flex flex-wrap gap-1.5">
          {candidates.map((s) => (
            <button key={s.id} onClick={() => { classApi.addStudent(classId, s.id, 'u-admin'); toast('Student added', 'success'); }}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-xs hover:border-brand-400 dark:border-slate-700">{s.name} +</button>
          ))}
        </div>
      </div>
      <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>{t('close')}</Button></div>
    </div>
  );
}

/* -------------------------------- announcements ---------------------------- */
function AnnouncementsView({ admin }: { admin: User }) {
  const { t, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ title: '', body: '', roles: [] as Role[], gradeIds: [] as string[], classIds: [] as string[] });

  const post = () => {
    if (!d.title || !d.body) return toast('Title and body required', 'error');
    announcementApi.post(d, admin.id);
    toast('Announcement posted', 'success');
    setOpen(false);
    setD({ title: '', body: '', roles: [], gradeIds: [], classIds: [] });
  };

  const toggle = <K extends 'roles' | 'gradeIds' | 'classIds'>(key: K, value: string) => {
    const arr = d[key] as string[];
    setD({ ...d, [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] });
  };

  const allGrades = curriculumApi.list().flatMap((c) => curriculumApi.grades(c.id));
  const announcements = [...announcementApi.visibleFor(admin)].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Card title={t('announcements')} subtitle="School-wide announcements — target by role, grade or class"
      action={<Button className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>+ {t('postAnnouncement')}</Button>}>
      <div className="space-y-2">
        {announcements.map((a) => (
          <div key={a.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.title}</p>
                <Badge tone="slate">{new Date(a.at).toLocaleDateString()}</Badge>
                {a.targets.roles.map((r) => <Badge key={r} tone="blue">{t(`role_${r}`)}</Badge>) }
                {a.targets.gradeIds.map((g) => <Badge key={g} tone="violet">{allGrades.find((x) => x.id === g)?.name ?? g}</Badge>)}
                {a.targets.classIds.map((c) => <Badge key={c} tone="green">{classApi.byId(c)?.name ?? c}</Badge>)}
                {a.targets.roles.length === 0 && a.targets.classIds.length === 0 && <Badge tone="slate">{t('all')}</Badge>}
              </div>
              <button onClick={() => { db_deleteAnnouncement(a.id); toast('Announcement deleted', 'success'); }} className="text-xs text-rose-600 hover:underline">{t('delete')}</button>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.body}</p>
          </div>
        ))}
        {announcements.length === 0 && <EmptyState>{t('noData')}</EmptyState>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t('postAnnouncement')} wide>
        <div className="space-y-3">
          <Input placeholder="Title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          <Textarea rows={3} placeholder="Message" value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} />
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">{t('targetRoles')}</p>
            <div className="flex gap-2">
              {(['student', 'teacher', 'parent'] as Role[]).map((r) => (
                <button key={r} onClick={() => toggle('roles', r)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize ${d.roles.includes(r) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40' : 'border-slate-200 dark:border-slate-700'}`}>
                  {t(`role_${r}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">{t('targetGrades')}</p>
            <div className="flex flex-wrap gap-2">
              {allGrades.map((g) => (
                <button key={g.id} onClick={() => toggle('gradeIds', g.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${d.gradeIds.includes(g.id) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40' : 'border-slate-200 dark:border-slate-700'}`}>
                  {g.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">{t('targetClasses')}</p>
            <div className="flex flex-wrap gap-2">
              {classApi.list().map((c) => (
                <button key={c.id} onClick={() => toggle('classIds', c.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${d.classIds.includes(c.id) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40' : 'border-slate-200 dark:border-slate-700'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button onClick={post}>{t('postAnnouncement')}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

/** Delete an announcement via the service layer. */
function db_deleteAnnouncement(id: string) {
  announcementApi.remove(id, 'u-admin');
}

/* ---------------------------------- reports -------------------------------- */
function ReportsView() {
  const { t } = useApp();
  const classes = classApi.list();
  const [scope, setScope] = useState('all');

  const download = (name: string, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const gradesCsv = () => {
    const rows: (string | number)[][] = [['student', 'class', 'assessment', 'type', 'score', 'max', 'date']];
    for (const c of classes) {
      for (const g of gradebookApi.forClass(c.id)) {
        rows.push([usersApi.byId(g.studentId)?.name ?? '', c.name, g.title, g.type, g.score ?? '', g.maxScore, g.date]);
      }
    }
    download('grades.csv', exportCsv(rows));
  };

  const attendanceCsv = () => {
    const rows: (string | number)[][] = [['student', 'class', 'date', 'status']];
    for (const c of classes) {
      for (const a of usersApi.list('student').flatMap((s) => c.studentIds.includes(s.id) ? attendanceApi.forStudent(s.id) : [])) {
        rows.push([usersApi.byId(a.studentId)?.name ?? '', c.name, a.date, a.status]);
      }
    }
    download('attendance.csv', exportCsv(rows));
  };

  const classCsv = () => {
    const rows: (string | number)[][] = [['class', 'curriculum', 'teacher', 'students', 'attendance %', 'avg grade %']];
    for (const c of classes) {
      const g = gradebookApi.forClass(c.id).filter((x) => x.score != null);
      const avg = g.length ? Math.round(g.reduce((a, b) => a + (b.score! / b.maxScore) * 100, 0) / g.length) : 0;
      rows.push([c.name, curriculumApi.list().find((x) => x.id === c.curriculumId)?.name ?? '', usersApi.byId(c.teacherId)?.name ?? '', c.studentIds.length, attendanceApi.classRate(c.id), avg]);
    }
    download('performance-by-class.csv', exportCsv(rows));
  };

  const curriculumData = curriculumApi.list().map((c) => {
    const cls = classes.filter((x) => x.curriculumId === c.id);
    const g = cls.flatMap((x) => gradebookApi.forClass(x.id)).filter((y) => y.score != null);
    return {
      label: c.code,
      value: g.length ? Math.round(g.reduce((a, b) => a + (b.score! / b.maxScore) * 100, 0) / g.length) : 0,
    };
  });

  return (
    <div className="space-y-4">
      <Card title={t('reports')} subtitle="Grades, attendance and performance — export CSV or print PDF">
        <div className="no-print flex flex-wrap gap-2">
          <Select value={scope} onChange={(e) => setScope(e.target.value)} className="w-44">
            <option value="all">{t('all')} classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Button className="h-9 px-3 text-xs" onClick={gradesCsv}>{t('exportCsv')} — {t('grades')}</Button>
          <Button className="h-9 px-3 text-xs" onClick={attendanceCsv}>{t('exportCsv')} — {t('attendance')}</Button>
          <Button className="h-9 px-3 text-xs" onClick={classCsv}>{t('exportCsv')} — {t('analytics')}</Button>
          <Button className="h-9 px-3 text-xs" onClick={() => window.print()}>{t('exportPdf')}</Button>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Average grade by curriculum</p>
          <BarChart data={curriculumData} color="#10b981" />
        </div>
      </Card>

      <Card title={t('grades')} subtitle={t('readOnly')}>
        <div className="print-page overflow-x-auto">
          <Table>
            <THead><tr><th className="px-4 py-2 text-left">Student</th><th className="px-4 py-2 text-left">Class</th><th className="px-4 py-2 text-left">Assessment</th><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Score</th></tr></THead>
            <tbody>
              {classes.filter((c) => scope === 'all' || c.id === scope).map((c) =>
                gradebookApi.forClass(c.id).map((g) => (
                  <TRow key={g.id}>
                    <TD>{usersApi.byId(g.studentId)?.name}</TD>
                    <TD>{c.name}</TD>
                    <TD>{g.title}</TD>
                    <TD className="text-xs capitalize text-slate-500 dark:text-slate-400">{g.type}</TD>
                    <TD className="text-xs text-slate-500 dark:text-slate-400">{g.date}</TD>
                    <TD>{g.score == null ? '—' : `${g.score}/${g.maxScore}`}</TD>
                  </TRow>
                )))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------------- audit --------------------------------- */
function AuditView() {
  const { t } = useApp();
  const logs = settingsApi.auditLogs();
  void t;
  return (
    <>
      <Card title={t('auditLog')} subtitle={`${logs.length} events — every admin action is tracked`}>
        <Table>
          <THead><tr><th className="px-4 py-2 text-left">When</th><th className="px-4 py-2 text-left">Actor</th><th className="px-4 py-2 text-left">Action</th><th className="px-4 py-2 text-left">Detail</th></tr></THead>
          <tbody>
            {logs.map((l) => (
              <TRow key={l.id}>
                <TD className="text-xs text-slate-500 dark:text-slate-400">{new Date(l.at).toLocaleString()}</TD>
                <TD className="text-xs text-slate-500 dark:text-slate-400">{usersApi.byId(l.actorId)?.name ?? l.actorId}</TD>
                <TD><Badge tone="slate">{l.action}</Badge></TD>
                <TD className="text-xs text-slate-600 dark:text-slate-300">{l.detail}</TD>
              </TRow>
            ))}
          </tbody>
        </Table>
      </Card>
      <div className="mt-4"><MessageModeration /></div>
    </>
  );
}

/* ---------------------------------- settings ------------------------------- */
function SettingsView() {
  const { t, toast } = useApp();
  const s = settingsApi.get();
  const [d, setD] = useState({ ...s });

  return (
    <Card title={t('schoolSettings')}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('logo')}</span>
            <Input value={d.logoText} onChange={(e) => setD({ ...d, logoText: e.target.value })} maxLength={4} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">School name</span>
            <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('primaryColor')}</span>
            <Select value={d.primaryColor} onChange={(e) => setD({ ...d, primaryColor: e.target.value as typeof d.primaryColor })}>
              <option value="indigo">Indigo</option>
              <option value="teal">Teal</option>
              <option value="amber">Amber</option>
              <option value="rose">Rose</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Default language</span>
            <Select value={d.defaultLanguage} onChange={(e) => setD({ ...d, defaultLanguage: e.target.value as 'en' | 'ar' })}>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </Select>
          </label>
          <Button onClick={() => { settingsApi.update(d); toast('Settings saved', 'success'); }}>{t('save')}</Button>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Brand preview</p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">{d.logoText}</div>
              <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">{d.name}</span>
            </div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-900/15">
            <p className="text-sm font-semibold text-rose-700">Demo data</p>
            <p className="mt-1 text-xs text-rose-600/80">Reset the database to its seeded demo state (all edits are reverted).</p>
            <Button variant="danger" className="mt-2 h-8 px-3 text-xs" onClick={() => { if (confirm('Reset ALL platform data to demo defaults? This reverts every change.')) { settingsApi.resetDemo(); toast('Demo data reset', 'success'); } }}>Reset demo data</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* --------------------------- message moderation --------------------------- */
function MessageModeration() {
  const { t } = useApp();
  const msgs = messageApi.all().slice(0, 20);
  return (
    <Card title={t('moderation')} subtitle="All messaging is logged and visible to Admin">
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">When</th><th className="px-4 py-2 text-left">From</th><th className="px-4 py-2 text-left">To</th><th className="px-4 py-2 text-left">Message</th></tr></THead>
        <tbody>
          {msgs.map((m) => (
            <TRow key={m.id}>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{new Date(m.at).toLocaleString()}</TD>
              <TD className="text-xs text-slate-600 dark:text-slate-300">{usersApi.byId(m.fromId)?.name}</TD>
              <TD className="text-xs text-slate-600 dark:text-slate-300">{usersApi.byId(m.toId)?.name}</TD>
              <TD className="max-w-xs text-xs text-slate-500 dark:text-slate-400">{m.content}</TD>
            </TRow>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
