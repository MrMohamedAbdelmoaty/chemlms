/**
 * Quiz runner: renders every chemistry question type (MCQ, true/false,
 * fill-in-the-blank, matching, balance-the-equation, numeric with units,
 * graph interpretation, essay/CER), enforces the time limit, and grades
 * automatically with the chemistry-aware grader. Essay questions are flagged
 * for teacher manual grading.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { assessmentApi, questionApi } from '../services/api';
import { gradeAnswer } from '../services/grading';
import { Button, Card, ProgressBar } from '../components/ui';
import { KaTeX, ChemText } from './chem/KaTeXText';
import type { Question, Quiz, User } from '../types';

// small seeded shuffle so randomisation is stable per attempt
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const j = Math.floor((seed / 2147483648) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function QuizRunner({ quiz, student, onClose }: { quiz: Quiz; student: User; onClose: () => void }) {
  const { t, toast } = useApp();
  const [phase, setPhase] = useState<'intro' | 'running' | 'results'>('intro');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [order, setOrder] = useState<Question[]>([]);
  const [optMap, setOptMap] = useState<Record<string, string[]>>({});
  const [timeLeft, setTimeLeft] = useState(quiz.timeLimitMin * 60);
  const [cur, setCur] = useState(0);
  const [graded, setGraded] = useState<ReturnType<typeof assessmentApi.submitQuiz> | null>(null);
  const submittedRef = useRef(false);

  const questions = useMemo(
    () => quiz.questionIds.map((id) => questionApi.byId(id)!).filter(Boolean),
    [quiz],
  );

  const start = () => {
    setOrder(quiz.randomize ? shuffle(questions, student.id.length * 97 + questions.length) : questions);
    const om: Record<string, string[]> = {};
    for (const q of questions) {
      if (q.options) om[q.id] = quiz.randomize ? shuffle([...q.options], q.id.length * 31 + 17) : [...q.options];
    }
    setOptMap(om);
    setAnswers({});
    setCur(0);
    setTimeLeft(quiz.timeLimitMin * 60);
    setPhase('running');
  };

  // countdown + auto-submit
  useEffect(() => {
    if (phase !== 'running') return;
    if (timeLeft <= 0 && !submittedRef.current) {
      submittedRef.current = true;
      submit(true);
      return;
    }
    const timer = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft]);

  const submit = (auto = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const res = assessmentApi.submitQuiz(student.id, quiz.id, answers);
    setGraded(res);
    setPhase('results');
    if (auto) toast(t('timeUp'), 'error');
    else toast(`${res.total}/${res.max}`, 'success');
  };

  /* ---------------------------- results view ----------------------------- */
  if (phase === 'results' && graded) {
    return (
      <Card title={`${quiz.title} — ${t('results')}`} action={<Button onClick={onClose}>{t('back')}</Button>}>
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('score')}</p>
          <p className="text-4xl font-bold text-brand-600 dark:text-brand-300">
            {graded.total} / {graded.max}
          </p>
          <div className="w-64">
            <ProgressBar value={graded.total / graded.max} tone={graded.total / graded.max >= 0.6 ? 'green' : 'amber'} />
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {order.map((q, i) => {
            const r = graded.results[q.id];
            const mine = answers[q.id];
            return (
              <div key={q.id} className={`rounded-xl border p-4 ${r.correct ? 'border-emerald-200 dark:border-emerald-900/60' : 'border-rose-200 dark:border-rose-900/50'}`}>
                <p className="mb-2 font-medium text-slate-800 dark:text-slate-100">
                  {i + 1}. <ChemText>{q.stem}</ChemText>
                </p>
                {q.type === 'essay' ? (
                  <p className="text-sm text-amber-600">⏳ {t('manualGrading')} — the teacher will grade this CER response and post feedback.</p>
                ) : (
                  <div className="space-y-1 text-sm">
                    <p className={r.correct ? 'text-emerald-600' : 'text-rose-600'}>
                      {r.correct ? '✓ ' + t('correct') : '✗ ' + t('incorrect')} · {r.points}/{q.points}
                    </p>
                    <p><span className="text-slate-400">{t('yourAnswer')}: </span><span className="font-mono">{String(mine ?? '—')}</span></p>
                    <p><span className="text-slate-400">{t('correctAnswer')}: </span>
                      <span className="font-mono">{q.type === 'balance' ? (q.answer as { coefficients: number[] }).coefficients.join(', ')
                        : q.type === 'numeric' ? (q.answer as { value: number; unit: string }).value + ' ' + (q.answer as { unit: string }).unit
                          : String(q.answer)}</span>
                    </p>
                    {r.note && <p className="text-amber-600">⚑ {r.note}</p>}
                    <p className="text-slate-500 dark:text-slate-400"><ChemText>{q.explanation}</ChemText></p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  /* ------------------------------ intro view ------------------------------ */
  if (phase === 'intro') {
    return (
      <Card title={quiz.title} subtitle={quiz.description} action={<Button onClick={onClose}>{t('cancel')}</Button>}>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <li>{questions.length} questions · {quiz.timeLimitMin} min · auto-graded</li>
          <li>{quiz.randomize ? 'Question order and options are randomized.' : 'Fixed order.'}</li>
          <li>Numeric answers accept equivalent units and check significant figures.</li>
        </ul>
        <Button className="mt-5" onClick={start}>{t('startQuiz')}</Button>
      </Card>
    );
  }

  /* ------------------------------ running view ----------------------------- */
  const q = order[cur];
  const idx = cur;
  const set = (key: string, val: unknown) => setAnswers((a) => ({ ...a, [key]: val }));
  const mm = Math.floor(timeLeft / 60);
  const ss = timeLeft % 60;

  return (
    <Card
      title={`${quiz.title} (${idx + 1}/${order.length})`}
      action={
        <span className={`font-mono text-sm ${timeLeft < 60 ? 'text-rose-600' : 'text-slate-500'}`}>
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </span>
      }
    >
      <div className="mb-4 w-full"><ProgressBar value={((idx + 1) / order.length) * 100} /></div>

      <div className="space-y-5">
        <div>
          <p className="mb-3 text-base font-medium text-slate-800 dark:text-slate-100">
            <ChemText>{q.stem}</ChemText>
          </p>
          <p className="mb-4"><KaTeX tex={`\\text{${q.difficulty}}`} /> · {q.points} {q.type === 'essay' ? '(manual)' : 'pts'}</p>

          {q.type === 'mcq' && q.options && (
            <div className="space-y-2">
              {optMap[q.id]?.map((opt, oi) => (
                <button key={oi} type="button" onClick={() => set(q.id, opt)}
                  className={`block w-full rounded-lg border px-4 py-2.5 text-start text-sm transition-colors ${
                    answers[q.id] === opt ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
                  <ChemText>{opt}</ChemText>
                </button>
              ))}
            </div>
          )}

          {q.type === 'truefalse' && (
            <div className="flex gap-3">
              {['true', 'false'].map((v) => (
                <button key={v} type="button" onClick={() => set(q.id, v)} className={`flex-1 rounded-lg border px-4 py-2.5 font-medium capitalize transition-colors ${
                answers[q.id] === v ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
                  {v === 'true' ? 'True' : 'False'}
                </button>
              ))}
            </div>
          )}

          {q.type === 'fill' && (
            <input value={String(answers[q.id] ?? '')} onChange={(e) => set(q.id, e.target.value)}
              placeholder="Type your answer" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
          )}

          {q.type === 'matching' && (() => {
            const pairs = (q.answer as { pairs: { left: string; right: string }[] }).pairs;
            return (
              <div className="space-y-2">
                {pairs.map((p) => (
                  <div key={p.left} className="flex items-center gap-2">
                    <span className="w-48 shrink-0 rounded bg-slate-100 px-2 py-1.5 text-sm dark:bg-slate-800"><ChemText>{p.left}</ChemText></span>
                    <ChemText>→</ChemText>
                    <select value={String(answers[`${q.id}:${p.left}`] ?? '')} onChange={(e) => set(`${q.id}:${p.left}`, e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                      <option value="">Select…</option>
                      {pairs.map((p2) => <option key={p2.right} value={p2.right}><ChemText>{p2.right}</ChemText></option>)}
                    </select>
                  </div>
                ))}
                <p className="text-xs text-slate-400">Answers are matched as text; order does not matter.</p>
              </div>
            );
          })()}

          {q.type === 'balance' && (
            <input value={String(answers[q.id] ?? '')} onChange={(e) => set(q.id, e.target.value)}
              placeholder="Coefficients, e.g. 4 3 2" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
          )}

          {q.type === 'numeric' && (
            <div className="flex gap-2">
              <input value={String(answers[q.id] ?? '')} onChange={(e) => set(q.id, e.target.value)}
                placeholder="e.g. 29.2 g" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
            </div>
          )}

          {q.type === 'graph' && q.data?.graph && (
            <div className="space-y-3">
              <GraphSvg labels={q.data.graph.labels} series={q.data.graph.series} />
              {q.options?.map((opt, oi) => (
                <button key={oi} type="button" onClick={() => set(q.id, opt)}
                  className={`block w-full rounded-lg border px-4 py-2.5 text-start text-sm transition-colors ${
                    answers[q.id] === opt ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
                  <ChemText>{opt}</ChemText>
                </button>
              ))}
            </div>
          )}

          {q.type === 'essay' && (
            <textarea rows={6} value={String(answers[q.id] ?? '')} onChange={(e) => set(q.id, e.target.value)}
              placeholder="Write your CER response (Claim, Evidence, Reasoning)…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={idx === 0}>{t('prev')}</Button>
          {idx < order.length - 1
            ? <Button onClick={() => setCur((c) => c + 1)}>{t('next')}</Button>
            : <Button onClick={() => submit(false)}>{t('finish')}</Button>}
        </div>
      </div>
    </Card>
  );
}

/** Inline SVG line graph used for graph-interpretation questions. */
function GraphSvg({ labels, series }: { labels: string[]; series: { name: string; values: number[] }[] }) {
  const w = 320;
  const h = 160;
  const max = Math.max(...series.flatMap((s) => s.values));
  const colors = ['#6366f1', '#f43f5e', '#10b981'];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Question graph">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1="30" y1={h - 10 - t * (h - 30)} x2={w - 10} y2={h - 10 - t * (h - 30)} stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-700" />
          <text x="4" y={h - 10 - t * (h - 30) + 3} fontSize="9" fill="currentColor" className="text-slate-400">{Math.round(t * max)}</text>
        </g>
      ))}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => [
          30 + (i / (s.values.length - 1)) * (w - 40),
          h - 10 - (v / max) * (h - 30),
        ]);
        return (
          <g key={s.name}>
            <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')} fill="none" stroke={colors[si % colors.length]} strokeWidth="2" />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={colors[si % colors.length]} />)}
          </g>
        );
      })}
      {labels.map((l, i) => (
        <text key={i} x={30 + (i / Math.max(labels.length - 1, 1)) * (w - 40)} y={h - 1} fontSize="9" fill="currentColor" className="text-slate-400">{l}</text>
      ))}
    </svg>
  );
}
