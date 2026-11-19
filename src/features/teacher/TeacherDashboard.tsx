/**
 * Teacher dashboard: overview, course builder (units/lessons/resources),
 * question bank with tags, quizzes & assignments management with manual
 * grading, gradebook, attendance sheet, live-class scheduling, LO analytics,
 * printable worksheets and messaging.
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  analyticsApi, assessmentApi, attendanceApi, classApi, courseApi,
  curriculumApi, gradebookApi, liveApi, questionApi, usersApi,
} from '../../services/api';
import {
  Badge, Button, Card, EmptyState, Input, Modal, Select, StatCard, Table, THead, TRow, TD, Textarea,
} from '../../components/ui';
import { BarChart, MasteryBar } from '../../components/charts';
import { ChemText } from '../../features/chem/KaTeXText';
import { Messaging, contactsFor } from '../../features/Messaging';
import { BLOOM_LEVELS } from '../../data/seed';
import type { Question, QuestionType, User } from '../../types';

export function TeacherDashboard({ teacher, view, setView }: {
  teacher: User; view: string; setView: (v: string) => void;
}) {
  const { t } = useApp();
  const myClasses = useMemo(() => classApi.forTeacher(teacher.id), [teacher]);

  switch (view) {
    case 'dashboard':
      return <TeacherOverview teacher={teacher} myClasses={myClasses} setView={setView} />;
    case 'courses':
      return <CourseBuilder teacher={teacher} myClasses={myClasses} />;
    case 'questionBank':
      return <QuestionBank />;
    case 'quizzes':
      return <AssessManager teacher={teacher} myClasses={myClasses} />;
    case 'gradebook':
      return <GradebookView myClasses={myClasses} />;
    case 'attendance':
      return <AttendanceView myClasses={myClasses} />;
    case 'live':
      return <LiveClasses teacher={teacher} myClasses={myClasses} />;
    case 'analytics':
      return <AnalyticsView myClasses={myClasses} />;
    case 'worksheets':
      return <Worksheets myClasses={myClasses} />;
    case 'messages':
      return <Messaging me={teacher} allowedPartners={contactsFor(teacher)} title={t('messaging')} />;
    default:
      return <TeacherOverview teacher={teacher} myClasses={myClasses} setView={setView} />;
  }
}

/* ---------------------------------- overview ------------------------------- */
function TeacherOverview({ teacher, myClasses, setView }: {
  teacher: User; myClasses: ReturnType<typeof classApi.forTeacher>; setView: (v: string) => void;
}) {
  const { t } = useApp();
  const students = myClasses.flatMap((c) => c.studentIds);
  const pending = assessmentApi.submissionsForClasses(teacher.classIds ?? [])
    .filter((s) => s.status === 'submitted' && s.assessmentKind === 'assignment');
  const avg = myClasses.length
    ? Math.round(myClasses.reduce((acc, c) => acc + attendanceApi.classRate(c.id), 0) / myClasses.length)
    : 0;
  const classGrades = myClasses.map((c) => {
    const rows = gradebookApi.forClass(c.id);
    const pcts = rows.filter((r) => r.score != null).map((r) => (r.score! / r.maxScore) * 100);
    return { label: c.name.slice(0, 10), value: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0 };
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('classesCount')} value={myClasses.length} icon="📚" tone="blue" />
        <StatCard label={t('students')} value={students.length} icon="🎓" tone="violet" />
        <StatCard label={t('manualGrading')} value={pending.length} sub="Awaiting review" icon="✍️" tone="amber" />
        <StatCard label={t('attendanceRate')} value={`${avg}%`} icon="✅" tone="green" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('classes')}>
          <div className="space-y-2">
            {myClasses.map((c) => (
              <button key={c.id} onClick={() => setView('courses')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-start transition-colors hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-600">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.studentIds.length} students · {curriculumApi.list().find((x) => x.id === c.curriculumId)?.name}</p>
                </div>
                <Badge tone="blue">{t('grades')} →</Badge>
              </button>
            ))}
          </div>
        </Card>

        <Card title={t('manualGrading')} subtitle="Submissions needing manual review" action={<Button variant="ghost" onClick={() => setView('quizzes')} className="text-sm">{t('all')} →</Button>}>
          <div className="space-y-2">
            {pending.length === 0 && <EmptyState>{t('noData')}</EmptyState>}
            {pending.slice(0, 6).map((s) => {
              const stu = usersApi.byId(s.studentId);
              const asg = assessmentApi.assignmentById(s.assessmentId) ?? null;
              return (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{asg?.title ?? s.assessmentId}</p>
                    <p className="text-xs text-slate-400">{stu?.name}</p>
                  </div>
                  <Button className="h-8 px-3 text-xs" onClick={() => setView('quizzes')}>Grade</Button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title={t('avgGrades')} subtitle="Class averages (%)">
        <BarChart data={classGrades} color="#6366f1" />
      </Card>
    </div>
  );
}

/* ------------------------------ course builder ----------------------------- */
function CourseBuilder({ teacher, myClasses }: { teacher: User; myClasses: ReturnType<typeof classApi.forTeacher> }) {
  const { t, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: '', summary: '', content: '', topicId: '', recordedMinutes: '20' });

  const saveLesson = () => {
    if (!draft.title.trim()) return toast('Title is required', 'error');
    courseApi.saveLesson({
      courseId: myClasses[0]?.id ?? '', ...draft, topicId: draft.topicId || curriculumApi.topics(myClasses[0]?.curriculumId ?? '')[0]?.id,
      recordedMinutes: parseInt(draft.recordedMinutes, 10) || 20,
    });
    toast('Lesson added', 'success');
    setOpen(false);
    setDraft({ title: '', summary: '', content: '', topicId: '', recordedMinutes: '20' });
  };

  return (
    <div className="space-y-4">
      {myClasses.map((c) => {
        const course = courseApi.forClass(c.id);
        const lessons = course ? courseApi.lessons(course.id) : [];
        return (
          <Card key={c.id} title={course?.title ?? c.name} subtitle={course?.description}
            action={<Button className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>+ {t('lessons')}</Button>}>
            <div className="grid gap-3 sm:grid-cols-2">
              {lessons.map((l) => {
                const los = curriculumApi.outcomes(c.curriculumId).filter((lo) => l.loIds.includes(lo.id));
                return (
                  <div key={l.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{l.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{l.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="blue">{curriculumApi.topics(c.curriculumId).find((tp) => tp.id === l.topicId)?.name ?? l.topicId}</Badge>
                      {los.map((lo) => <Badge key={lo.id} tone="violet">{lo.code}</Badge>)}
                      <Badge tone="slate">{l.recordedMinutes} min</Badge>
                    </div>
                    <div className="mt-2 space-y-1">
                      {l.resources.map((r, i) => (
                        <p key={i} className="text-xs text-slate-500 dark:text-slate-400">
                          <Badge tone={r.type === 'video' ? 'blue' : r.type === 'pdf' ? 'red' : 'violet'}>{r.type}</Badge> {r.title}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <Modal open={open} onClose={() => setOpen(false)} title="Add lesson (course builder)" wide>
        <div className="space-y-3">
          <Input placeholder="Lesson title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Input placeholder="One-line summary" value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
          <Textarea placeholder="Lesson content (supports \ce{} chemical notation)" rows={5} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={draft.topicId} onChange={(e) => setDraft({ ...draft, topicId: e.target.value })}>
              <option value="">Topic…</option>
              {curriculumApi.topics(myClasses[0]?.curriculumId ?? '').map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
            </Select>
            <Input type="number" placeholder="Recorded minutes" value={draft.recordedMinutes} onChange={(e) => setDraft({ ...draft, recordedMinutes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button onClick={saveLesson}>{t('save')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------ question bank ------------------------------ */
const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: 'MCQ', truefalse: 'True / False', fill: 'Fill in the blank', matching: 'Matching',
  balance: 'Balance equation', numeric: 'Numerical (units + sig-figs)', graph: 'Graph interpretation', essay: 'Essay / CER',
};

function QuestionBank() {
  const { t } = useApp();
  const [filters, setFilters] = useState({ curriculumId: '', topicId: '', difficulty: '', type: '', search: '' });
  const [editing, setEditing] = useState<Question | null>(null);
  const [adding, setAdding] = useState(false);

  const questions = questionApi.list({
    curriculumId: filters.curriculumId || undefined, topicId: filters.topicId || undefined,
    difficulty: filters.difficulty || undefined, type: filters.type || undefined,
    search: filters.search || undefined,
  });

  return (
    <Card title={t('questionBank')} subtitle={`${questions.length} questions tagged by curriculum · topic · LO · Bloom level`}
      action={<Button className="h-9 px-3 text-xs" onClick={() => { setEditing(null); setAdding(true); }}>+ {t('add')}</Button>}>
      <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Select value={filters.curriculumId} onChange={(e) => setFilters({ ...filters, curriculumId: e.target.value, topicId: '' })}>
          <option value="">{t('curricula')}…</option>
          {curriculumApi.list().map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={filters.topicId} onChange={(e) => setFilters({ ...filters, topicId: e.target.value })}>
          <option value="">{t('topic')}…</option>
          {curriculumApi.topics(filters.curriculumId).map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
        </Select>
        <Select value={filters.difficulty} onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}>
          <option value="">{t('difficulty')}…</option>
          {BLOOM_LEVELS.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
        <Select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">Type…</option>
          {(Object.keys(TYPE_LABEL) as QuestionType[]).map((tp) => <option key={tp} value={tp}>{TYPE_LABEL[tp]}</option>)}
        </Select>
        <Input placeholder={t('search')} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
      </div>

      <Table>
        <THead><tr><th className="px-4 py-2 text-left">Question</th><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Curriculum</th><th className="px-4 py-2 text-left">{t('difficulty')}</th><th className="px-4 py-2 text-left">Pts</th><th className="px-4 py-2"></th></tr></THead>
        <tbody>
          {questions.map((q) => (
            <TRow key={q.id}>
              <TD className="max-w-md"><ChemText>{q.stem}</ChemText></TD>
              <TD><Badge tone="blue">{TYPE_LABEL[q.type]}</Badge></TD>
              <TD className="text-xs text-slate-500 dark:text-slate-400">{curriculumApi.list().find((c) => c.id === q.curriculumId)?.code}</TD>
              <TD><Badge tone="violet">{q.difficulty}</Badge></TD>
              <TD className="text-xs">{q.points}</TD>
              <TD><Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditing(q)}>{t('edit')}</Button></TD>
            </TRow>
          ))}
        </tbody>
      </Table>
      {questions.length === 0 && <div className="mt-4"><EmptyState>{t('noData')}</EmptyState></div>}

      <QuestionEditor
        open={adding || !!editing} question={editing}
        onClose={() => { setAdding(false); setEditing(null); }}
      />
    </Card>
  );
}

/** Parse "left : right" lines into matching pairs. */
function parsePairs(text: string): { pairs: { left: string; right: string }[] } {
  return {
    pairs: text.split('\n').filter(Boolean).map((l) => {
      const [left, right] = l.split(':').map((x) => x.trim());
      return { left: left ?? '', right: right ?? '' };
    }),
  };
}

/** Format matching pairs back to "left : right" lines for the editor. */
function formatPairs(answer: unknown): string {
  const pairs = (answer as { pairs?: { left: string; right: string }[] } | undefined)?.pairs;
  return pairs ? pairs.map((p) => `${p.left} : ${p.right}`).join('\n') : '';
}

/** Editor for all 8 chemistry question types with answer keys. */
function QuestionEditor({ open, question, onClose }: { open: boolean; question: Question | null; onClose: () => void }) {
  const { t, toast } = useApp();
  const curricula = curriculumApi.list();
  const [d, setD] = useState<Question>(question ?? {
    id: '', curriculumId: curricula[0].id, topicId: curriculumApi.topics(curricula[0].id)[0]?.id ?? '', loIds: [],
    difficulty: 'Understand', type: 'mcq', stem: '', options: ['', '', '', ''], answer: '', explanation: '', points: 2,
  });

  const update = (patch: Partial<Question>) => setD((prev) => ({ ...prev, ...patch }));

  const save = () => {
    if (!d.stem.trim()) return toast('Stem is required', 'error');
    questionApi.save({ ...d, id: d.id || undefined });
    toast('Question saved', 'success');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={question ? 'Edit question' : 'New question'} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Select value={d.curriculumId} onChange={(e) => { const c = e.target.value; const topics = curriculumApi.topics(c); update({ curriculumId: c, topicId: topics[0]?.id ?? '', loIds: [] }); }}>
            {curricula.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={d.topicId} onChange={(e) => update({ topicId: e.target.value, loIds: [] })}>
            {curriculumApi.topics(d.curriculumId).map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
          </Select>
          <Select value={d.difficulty} onChange={(e) => update({ difficulty: e.target.value as Question['difficulty'] })}>
            {BLOOM_LEVELS.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
          <Select value={d.type} onChange={(e) => update({ type: e.target.value as QuestionType })}>
            {(Object.keys(TYPE_LABEL) as QuestionType[]).map((tp) => <option key={tp} value={tp}>{TYPE_LABEL[tp]}</option>)}
          </Select>
          <Input type="number" value={d.points} onChange={(e) => update({ points: parseInt(e.target.value, 10) || 2 })} placeholder="Points" />
        </div>

        <Textarea rows={2} placeholder="Question stem (supports \ce{} notation)" value={d.stem} onChange={(e) => update({ stem: e.target.value })} />

        {d.type === 'mcq' && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">Options (select the correct one in the answer field)</p>
            {(d.options ?? []).map((o, i) => (
              <div key={i} className="mb-1 flex gap-2">
                <Input value={o} onChange={(e) => { const opts = [...(d.options ?? [])]; opts[i] = e.target.value; update({ options: opts }); }} placeholder={`Option ${i + 1}`} />
                <Badge tone={String(d.answer) === o ? 'green' : 'slate'}>{String(d.answer) === o ? '✓' : ''}</Badge>
              </div>
            ))}
            <Input value={String(d.answer)} onChange={(e) => update({ answer: e.target.value })} placeholder="Correct option text" />
          </div>
        )}

        {d.type === 'truefalse' && (
          <Select value={String(d.answer)} onChange={(e) => update({ answer: e.target.value })}>
            <option value="true">True</option><option value="false">False</option>
          </Select>
        )}

        {d.type === 'fill' && (
          <Input value={Array.isArray(d.answer) ? d.answer.join(' | ') : String(d.answer)}
            onChange={(e) => update({ answer: e.target.value.split(' | ') })} placeholder="Accepted answers separated by |" />
        )}

        {d.type === 'matching' && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">Pairs: left = item, right = match (one per line, "left : right")</p>
            <Textarea rows={4} value={formatPairs(d.answer)} onChange={(e) => update({ answer: parsePairs(e.target.value) })} />
          </div>
        )}

        {d.type === 'balance' && (
          <div className="grid grid-cols-2 gap-3">
            <Input value={(d.answer as { equation?: string })?.equation ?? ''} onChange={(e) => update({ answer: { equation: e.target.value, coefficients: [] } as never })} placeholder="Equation e.g. Fe + O2 -> Fe2O3" />
            <Input value={(d.answer as { coefficients?: number[] })?.coefficients?.join(', ') ?? ''} onChange={(e) => update({ answer: { equation: (d.answer as { equation?: string })?.equation ?? '', coefficients: e.target.value.split(',').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n)) } as never })} placeholder="Coefficients e.g. 4,3,2" />
          </div>
        )}

        {d.type === 'numeric' && (
          <div className="grid grid-cols-4 gap-3">
            <Input type="number" value={(d.answer as { value?: number })?.value ?? 0} onChange={(e) => update({ answer: { value: parseFloat(e.target.value), unit: (d.answer as { unit?: string })?.unit ?? 'mol', sigfigs: (d.answer as { sigfigs?: number })?.sigfigs ?? 2, tolerance: (d.answer as { tolerance?: number })?.tolerance ?? 0.01, accepts: [] } as never })} placeholder="Value" />
            <Input value={(d.answer as { unit?: string })?.unit ?? 'mol'} onChange={(e) => update({ answer: { value: (d.answer as { value?: number })?.value ?? 0, unit: e.target.value, sigfigs: (d.answer as { sigfigs?: number })?.sigfigs ?? 2, tolerance: (d.answer as { tolerance?: number })?.tolerance ?? 0.01, accepts: [] } as never })} placeholder="Unit" />
            <Input type="number" value={(d.answer as { sigfigs?: number })?.sigfigs ?? 2} onChange={(e) => update({ answer: { value: (d.answer as { value?: number })?.value ?? 0, unit: (d.answer as { unit?: string })?.unit ?? 'mol', sigfigs: parseInt(e.target.value, 10), tolerance: (d.answer as { tolerance?: number })?.tolerance ?? 0.01, accepts: [] } as never })} placeholder="Sig-figs" />
            <Input value={(d.answer as { accepts?: string[] })?.accepts?.join(' | ') ?? ''} onChange={(e) => update({ answer: { value: (d.answer as { value?: number })?.value ?? 0, unit: (d.answer as { unit?: string })?.unit ?? 'mol', sigfigs: (d.answer as { sigfigs?: number })?.sigfigs ?? 2, tolerance: (d.answer as { tolerance?: number })?.tolerance ?? 0.01, accepts: e.target.value.split(' | ').filter(Boolean) } as never })} placeholder="Accepted variants" />
          </div>
        )}

        {d.type === 'graph' && (
          <div className="grid grid-cols-2 gap-3">
            <Textarea rows={3} placeholder={'Labels: 0,5,10,15\nValues: 1,2,5,7'} value="" onChange={() => {}} />
            <Input value={String(d.answer)} onChange={(e) => update({ answer: e.target.value })} placeholder="Correct option" />
            <p className="text-xs text-slate-400">Graph data is seeded in code; set the correct option above.</p>
          </div>
        )}

        <Textarea rows={2} placeholder="Explanation shown after grading" value={d.explanation} onChange={(e) => update({ explanation: e.target.value })} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
          <Button onClick={save}>{t('save')}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------- quizzes & assignments -------------------------- */
function AssessManager({ teacher, myClasses }: { teacher: User; myClasses: ReturnType<typeof classApi.forTeacher> }) {
  const { t, toast } = useApp();
  const [classId, setClassId] = useState(myClasses[0]?.id ?? '');
  const [tab, setTab] = useState<'quiz' | 'assignment'>('quiz');
  const [grading, setGrading] = useState<{ id: string; score: number; feedback: string } | null>(null);
  const [newQuiz, setNewQuiz] = useState(false);

  const cls = classApi.byId(classId);
  const course = classId ? courseApi.forClass(classId) : null;
  const quizzes = course ? assessmentApi.quizzesForCourse(course.id) : [];
  const assignments = course ? assessmentApi.assignmentsForCourse(course.id) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-52">
          {myClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div className="flex gap-2">
          {(['quiz', 'assignment'] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${tab === k ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
              {k === 'quiz' ? 'Quizzes' : 'Assignments'}
            </button>
          ))}
        </div>
        <Button className="ml-auto h-9 px-3 text-xs" onClick={() => setNewQuiz(true)}>+ New {tab === 'quiz' ? 'quiz' : 'assignment'}</Button>
      </div>

      {tab === 'quiz' ? (
        <div className="space-y-3">
          {quizzes.map((q) => {
            const subs = assessmentApi.submissionsForAssessment(q.id);
            return (
              <Card key={q.id} title={q.title} subtitle={`${q.questionIds.length} questions · ${q.timeLimitMin} min · due ${q.deadline}`}>
                <div className="grid gap-3 md:grid-cols-[1fr_300px]">
                  <Table>
                    <THead><tr><th className="px-4 py-2 text-left">Student</th><th className="px-4 py-2 text-left">Score</th><th className="px-4 py-2 text-left">Status</th></tr></THead>
                    <tbody>
                      {cls?.studentIds.map((sid) => {
                        const sub = subs.find((s) => s.studentId === sid);
                        return (
                          <TRow key={sid}>
                            <TD>{usersApi.byId(sid)?.name}</TD>
                            <TD>{sub?.score != null ? `${sub.score}/${sub.maxScore}` : <Badge tone="red">{t('missing')}</Badge>}</TD>
                            <TD>{sub ? <Badge tone={sub.status === 'graded' ? 'green' : 'amber'}>{sub.status}</Badge> : <Badge tone="red">—</Badge>}</TD>
                          </TRow>
                        );
                      })}
                    </tbody>
                  </Table>
                  <div className="space-y-2">
                    {subs.filter((s) => s.status === 'submitted' || s.assessmentKind === 'quiz').slice(0, 4).map((s) => (
                      <button key={s.id} onClick={() => setGrading({ id: s.id, score: s.score ?? 0, feedback: s.feedback })}
                        className="block w-full rounded-lg border border-slate-200 p-2 text-start text-xs hover:border-brand-300 dark:border-slate-700">
                        <p className="font-medium text-slate-700 dark:text-slate-200">{usersApi.byId(s.studentId)?.name}</p>
                        <p className="text-slate-400">{s.score ?? 'pending'}/{s.maxScore}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
          {quizzes.length === 0 && <EmptyState>{t('noData')}</EmptyState>}
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const subs = assessmentApi.submissionsForAssessment(a.id);
            return (
              <Card key={a.id} title={a.title} subtitle={`Due ${a.deadline} · max ${a.maxScore}`}>
                <Table>
                  <THead><tr><th className="px-4 py-2 text-left">Student</th><th className="px-4 py-2 text-left">Submitted</th><th className="px-4 py-2 text-left">Score / feedback</th><th className="px-4 py-2 text-left"></th></tr></THead>
                  <tbody>
                    {cls?.studentIds.map((sid) => {
                      const sub = subs.find((s) => s.studentId === sid);
                      return (
                        <TRow key={sid}>
                          <TD>{usersApi.byId(sid)?.name}</TD>
                          <TD>{sub ? <Badge tone="green">{t('submitted')}</Badge> : <Badge tone="red">{t('missing')}</Badge>}</TD>
                          <TD className="max-w-xs">
                            {sub?.score != null
                              ? <span>{sub.score}/{sub.maxScore} — <span className="text-slate-500 dark:text-slate-400">{sub.feedback || 'No feedback'}</span></span>
                              : '—'}
                          </TD>
                          <TD className="max-w-xs">
                            {sub?.file ? (
                              <a href={assessmentApi.fileUrl(sub.file)} download={sub.file.name}
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300">
                                📎 {sub.file.name}
                              </a>
                            ) : <span className="text-xs text-slate-400">—</span>}
                          </TD>
                          <TD>{sub && <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setGrading({ id: sub.id, score: sub.score ?? 0, feedback: sub.feedback })}>{t('manualGrading')}</Button>}</TD>
                        </TRow>
                      );
                    })}
                  </tbody>
                </Table>
              </Card>
            );
          })}
          {assignments.length === 0 && <EmptyState>{t('noData')}</EmptyState>}
        </div>
      )}

      {/* manual grading modal */}
      <Modal open={!!grading} onClose={() => setGrading(null)} title="Manual grading & feedback">
        {grading && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Adjust the score and leave feedback; the student is notified.</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Score
                <Input type="number" value={grading.score} onChange={(e) => setGrading({ ...grading, score: parseFloat(e.target.value) || 0 })} />
              </label>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Max score
                <Input value="20" readOnly />
              </label>
            </div>
            <Textarea rows={4} placeholder="Feedback for the student" value={grading.feedback} onChange={(e) => setGrading({ ...grading, feedback: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setGrading(null)}>{t('cancel')}</Button>
              <Button onClick={() => { assessmentApi.manualGrade(grading.id, grading.score, grading.feedback, teacher.id); toast('Graded & saved', 'success'); setGrading(null); }}>{t('save')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* new quiz creator */}
      <Modal open={newQuiz} onClose={() => setNewQuiz(false)} title="New quiz" wide>
        <NewAssessmentCreator classId={classId} kind={tab} onClose={() => setNewQuiz(false)} />
      </Modal>
    </div>
  );
}

function NewAssessmentCreator({ classId, kind, onClose }: { classId: string; kind: 'quiz' | 'assignment'; onClose: () => void }) {
  const { t, toast } = useApp();
  const course = courseApi.forClass(classId);
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState(new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
  const [limit, setLimit] = useState('20');
  const [selected, setSelected] = useState<string[]>([]);

  const allQuestions = questionApi.list({ curriculumId: course?.curriculumId });

  const save = () => {
    if (!title.trim()) return toast('Title required', 'error');
    if (kind === 'quiz') {
      if (!selected.length) return toast('Select at least one question', 'error');
      assessmentApi.saveQuiz({ courseId: course!.id, title, questionIds: selected, timeLimitMin: parseInt(limit, 10) || 20, deadline, attempts: 2, randomize: true, published: true });
    } else {
      assessmentApi.saveAssignment({ courseId: course!.id, title, deadline, maxScore: 20, type: 'file' });
    }
    toast('Saved', 'success');
    onClose();
  };

  return (
    <div className="space-y-3">
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        {kind === 'quiz' && <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Time limit (min)" />}
      </div>
      {kind === 'quiz' && (
        <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
          {allQuestions.map((q) => (
            <label key={q.id} className="flex items-center gap-2 border-b border-slate-100 p-2 text-sm last:border-0 dark:border-slate-700/50">
              <input type="checkbox" checked={selected.includes(q.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, q.id] : s.filter((x) => x !== q.id))} className="accent-brand-600" />
              <span className="flex-1"><ChemText>{q.stem}</ChemText></span>
              <Badge tone="violet">{q.difficulty}</Badge>
            </label>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={save}>{t('save')}</Button>
      </div>
    </div>
  );
}

/* -------------------------------- gradebook -------------------------------- */
function GradebookView({ myClasses }: { myClasses: ReturnType<typeof classApi.forTeacher> }) {
  const { t } = useApp();
  const [classId, setClassId] = useState(myClasses[0]?.id ?? '');
  const rows = classId ? gradebookApi.forClass(classId) : [];
  const students = myClasses.find((c) => c.id === classId)?.studentIds ?? [];
  const assessments = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(`${r.studentId}|${r.assessmentId}`, r.id));
    return m;
  }, [rows]);

  const setScore = (entryId: string, score: number | null) => {
    const e = rows.find((r) => r.id === entryId);
    if (e) {
      e.score = score;
      // keep submission in sync for consistency
      const sub = assessmentApi.submissionsForAssessment(e.assessmentId).find((s) => s.studentId === e.studentId);
      if (sub) { sub.score = score; sub.feedback = sub.feedback || 'Updated by teacher'; sub.status = 'graded'; }
    }
  };

  return (
    <Card title={t('gradebook')} action={<Select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-52">{myClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}>
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">Student</th>{rows.filter((r, i, arr) => arr.findIndex((x) => x.assessmentId === r.assessmentId) === i).map((r) => <th key={r.assessmentId} className="px-4 py-2 text-left text-xs">{r.title}</th>)}<th className="px-4 py-2 text-left">{t('average')}</th></tr></THead>
        <tbody>
          {students.map((sid) => {
            const stuRows = rows.filter((r) => r.studentId === sid);
            const pcts = stuRows.filter((r) => r.score != null).map((r) => (r.score! / r.maxScore) * 100);
            const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
            return (
              <TRow key={sid}>
                <TD className="font-medium text-slate-800 dark:text-slate-100">{usersApi.byId(sid)?.name}</TD>
                {stuRows.map((r) => (
                  <TD key={r.id}>
                    <input type="number" value={r.score ?? ''} placeholder="—"
                      onChange={(e) => setScore(r.id, e.target.value === '' ? null : parseFloat(e.target.value))}
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900" />
                  </TD>
                ))}
                <TD><Badge tone={avg >= 80 ? 'green' : avg >= 60 ? 'amber' : 'red'}>{avg}%</Badge></TD>
              </TRow>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

/* --------------------------------- attendance ------------------------------ */
function AttendanceView({ myClasses }: { myClasses: ReturnType<typeof classApi.forTeacher> }) {
  const { t } = useApp();
  const [classId, setClassId] = useState(myClasses[0]?.id ?? '');
  const dates = classId ? attendanceApi.dates(classId) : [];
  const [date, setDate] = useState(dates[0] ?? '');
  const students = myClasses.find((c) => c.id === classId)?.studentIds ?? [];
  const records = classId ? attendanceApi.forClass(classId, date) : [];

  const setStatus = (sid: string, status: 'present' | 'absent' | 'late') =>
    attendanceApi.setStatus(classId, sid, date, status, 'u-admin');

  const statusTone = (s: string) => s === 'present' ? 'green' : s === 'late' ? 'amber' : 'red';

  return (
    <Card title={t('attendance')} action={<Select value={classId} onChange={(e) => { setClassId(e.target.value); setDate(attendanceApi.dates(e.target.value)[0] ?? ''); }} className="w-52">{myClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}>
      <div className="mb-3 flex items-center gap-3">
        <Select value={date} onChange={(e) => setDate(e.target.value)} className="w-44">
          {dates.map((d) => <option key={d} value={d}>{new Date(d).toLocaleDateString()}</option>)}
        </Select>
        <span className="text-sm text-slate-400">{t('attendanceRate')}: {attendanceApi.classRate(classId)}%</span>
      </div>
      <Table>
        <THead><tr><th className="px-4 py-2 text-left">Student</th><th className="px-4 py-2 text-left">Status</th></tr></THead>
        <tbody>
          {students.map((sid) => {
            const rec = records.find((r) => r.studentId === sid);
            const status = rec?.status ?? 'present';
            return (
              <TRow key={sid}>
                <TD className="font-medium text-slate-800 dark:text-slate-100">{usersApi.byId(sid)?.name}</TD>
                <TD>
                  <div className="flex gap-2">
                    {(['present', 'late', 'absent'] as const).map((s) => (
                      <button key={s} onClick={() => setStatus(sid, s)}
                        className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition-colors ${
                          status === s ? `bg-${status === 'present' ? 'emerald' : status === 'late' ? 'amber' : 'rose'}-100 text-${statusTone(s)} dark:bg-slate-700` : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </TD>
              </TRow>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

/* -------------------------------- live classes ----------------------------- */
function LiveClasses({ teacher, myClasses }: { teacher: User; myClasses: ReturnType<typeof classApi.forTeacher> }) {
  const { t, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ classId: myClasses[0]?.id ?? '', title: '', platform: 'zoom' as 'zoom' | 'google-meet' | 'jitsi', when: '', duration: '45' });

  const sessions = liveApi.list().filter((s) => myClasses.some((c) => c.id === s.classId));

  const create = () => {
    if (!d.title.trim() || !d.when) return toast('Title and time are required', 'error');
    liveApi.create({ classId: d.classId, title: d.title, platform: d.platform, start: new Date(d.when).toISOString(), durationMin: parseInt(d.duration, 10) || 45, teacherId: teacher.id });
    toast('Live session scheduled', 'success');
    setOpen(false);
    setD({ classId: myClasses[0]?.id ?? '', title: '', platform: 'zoom', when: '', duration: '45' });
  };

  return (
    <Card title={t('liveClasses')} subtitle="Schedule Zoom / Google Meet / Jitsi sessions; joining auto-marks attendance"
      action={<Button className="h-9 px-3 text-xs" onClick={() => setOpen(true)}>+ {t('schedule')}</Button>}>
      <div className="space-y-3">
        {sessions.map((s) => {
          const cls = classApi.byId(s.classId);
          return (
            <div key={s.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.title}</p>
                  <p className="text-xs text-slate-400">{cls?.name} · {new Date(s.start).toLocaleString()} · {s.platform}</p>
                </div>
                <Badge tone={s.joinedStudentIds.length >= (cls?.studentIds.length ?? 1) * 0.8 ? 'green' : 'slate'}>
                  {s.joinedStudentIds.length}/{cls?.studentIds.length} joined
                </Badge>
              </div>
              <p className="mt-1 font-mono text-[11px] text-brand-600 dark:text-brand-300">{s.link}</p>
            </div>
          );
        })}
        {sessions.length === 0 && <EmptyState>{t('noData')}</EmptyState>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t('schedule')}>
        <div className="space-y-3">
          <Select value={d.classId} onChange={(e) => setD({ ...d, classId: e.target.value })}>
            {myClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input placeholder="Session title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select value={d.platform} onChange={(e) => setD({ ...d, platform: e.target.value as 'zoom' | 'google-meet' | 'jitsi' })}>
              <option value="zoom">Zoom</option><option value="google-meet">Google Meet</option><option value="jitsi">Jitsi</option>
            </Select>
            <Input type="number" value={d.duration} onChange={(e) => setD({ ...d, duration: e.target.value })} placeholder="Duration (min)" />
          </div>
          <Input type="datetime-local" value={d.when} onChange={(e) => setD({ ...d, when: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button onClick={create}>{t('save')}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

/* --------------------------------- analytics -------------------------------- */
function AnalyticsView({ myClasses }: { myClasses: ReturnType<typeof classApi.forTeacher> }) {
  const { t } = useApp();
  const [classId, setClassId] = useState(myClasses[0]?.id ?? '');
  const los = classId ? analyticsApi.classOutcomeMastery(classId) : [];
  const students = myClasses.find((c) => c.id === classId)?.studentIds ?? [];
  const perStudent = students.map((sid) => {
    const rows = gradebookApi.forClass(classId).filter((r) => r.studentId === sid);
    const pcts = rows.filter((r) => r.score != null).map((r) => (r.score! / r.maxScore) * 100);
    return { sid, avg: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0 };
  }).sort((a, b) => a.avg - b.avg);

  return (
    <Card title={t('analytics')} subtitle="Mastery by learning outcome — weak topics per class and per student"
      action={<Select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-52">{myClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Class mastery by learning outcome</p>
          <div className="space-y-2">
            {los.map((l) => <MasteryBar key={l.lo.id} value={l.mastery} label={`${l.lo.code} · ${l.lo.text.slice(0, 52)}…`} />)}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Class average (%)</p>
          <BarChart data={perStudent.map((p) => ({ label: usersApi.byId(p.sid)?.name.split(' ')[0] ?? p.sid, value: p.avg }))} color="#f43f5e" />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Students needing support (lowest averages)</p>
          <Table>
            <THead><tr><th className="px-4 py-2 text-left">Student</th><th className="px-4 py-2 text-left">Average</th><th className="px-4 py-2 text-left">Focus</th></tr></THead>
            <tbody>
              {perStudent.slice(0, 5).map((p) => {
                const weak = los.filter((l) => l.mastery < 65).slice(0, 2);
                return (
                  <TRow key={p.sid}>
                    <TD className="font-medium text-slate-800 dark:text-slate-100">{usersApi.byId(p.sid)?.name}</TD>
                    <TD><Badge tone={p.avg >= 80 ? 'green' : p.avg >= 60 ? 'amber' : 'red'}>{p.avg}%</Badge></TD>
                    <TD className="text-xs text-slate-500 dark:text-slate-400">{weak.map((w) => w.lo.code).join(', ') || 'None'}</TD>
                  </TRow>
                );
              })}
            </tbody>
          </Table>
        </div>
      </div>
    </Card>
  );
}

/* --------------------------------- worksheets ------------------------------ */
function Worksheets({ myClasses }: { myClasses: ReturnType<typeof classApi.forTeacher> }) {
  const { t } = useApp();
  const [classId, setClassId] = useState(myClasses[0]?.id ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);
  const course = classApi.byId(classId);
  const questions = questionApi.list({ curriculumId: course?.curriculumId });

  const print = () => window.print();

  return (
    <Card title={t('worksheets')} subtitle="Pick questions → print a worksheet or exam paper with an answer key">
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSelected([]); }} className="w-52">
          {myClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <label className="text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} className="mr-1 accent-brand-600" /> Show answer key</label>
        <Button onClick={print} disabled={!selected.length}>{t('print')} / {t('exportPdf')}</Button>
        <span className="text-xs text-slate-400">{selected.length} questions selected</span>
      </div>

      <div className="print-page no-print mb-6 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
        {questions.map((q) => (
          <label key={q.id} className="flex items-start gap-2 border-b border-slate-100 p-2 text-sm last:border-0 dark:border-slate-700/50">
            <input type="checkbox" checked={selected.includes(q.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, q.id] : s.filter((x) => x !== q.id))} className="mt-1 accent-brand-600" />
            <span className="flex-1"><ChemText>{q.stem}</ChemText></span>
            <Badge tone="violet">{q.difficulty}</Badge>
          </label>
        ))}
      </div>

      {/* printable sheet */}
      <div className="print-page hidden rounded-xl border border-slate-200 p-8 dark:border-slate-700 print:block">
        <h1 className="text-center text-xl font-bold">Chemistry Worksheet — {course?.name}</h1>
        <p className="text-center text-sm text-slate-500">Name: ____________________ · Date: ____________ · Marks: ______</p>
        {selected.map((id, i) => {
          const q = questionApi.byId(id);
          if (!q) return null;
          return (
            <div key={id} className="mt-6">
              <p className="font-semibold">{i + 1}. <ChemText>{q.stem}</ChemText> <span className="text-xs text-slate-400">({q.points} pts)</span></p>
              {q.options && <ul className="ml-6 mt-1 space-y-1 text-sm text-slate-600">{q.options.map((o) => <li key={o}><ChemText>{o}</ChemText></li>)}</ul>}
              <p className="mt-2 text-xs text-slate-300">Answer: ____________________</p>
              {showKey && <p className="mt-1 text-xs font-semibold text-emerald-700">
                Answer key: {q.type === 'balance' ? (q.answer as { coefficients: number[] }).coefficients.join(', ')
                  : q.type === 'numeric' ? `${(q.answer as { value: number; unit: string }).value} ${(q.answer as { unit: string }).unit}`
                  : String(q.answer)}
              </p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
