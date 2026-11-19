/**
 * Lab safety module: GHS hazard pictograms (inline SVG, fully offline),
 * core safety rules, and a short safety quiz that must be passed before
 * practical sessions.
 */
import { useState } from 'react';
import { Badge, Button, Card } from '../../components/ui';
import { gradeAnswer } from '../../services/grading';
import type { Question } from '../../types';

/* ------------------------------ GHS pictograms ----------------------------- */
const PICTOGRAMS: { key: string; title: string; hazards: string }[] = [
  { key: 'health', title: 'Health hazard', hazards: 'Carcinogens, mutagens, reproductive toxins, respiratory sensitisation' },
  { key: 'flame', title: 'Flammable', hazards: 'Flammable liquids/solids/gases, pyrophorics, self-heating' },
  { key: 'corrosion', title: 'Corrosive', hazards: 'Skin corrosion, eye damage, corrosive to metals' },
  { key: 'cylinder', title: 'Gas under pressure', hazards: 'Compressed, liquefied, dissolved and refrigerated gases' },
  { key: 'exclamation', title: 'Exclamation mark', hazards: 'Harmful, irritant, acute toxicity (minor), narcotic effects' },
  { key: 'skull', title: 'Acute toxicity', hazards: 'Fatal or toxic if swallowed, inhaled or absorbed' },
  { key: 'environment', title: 'Environment', hazards: 'Hazardous to aquatic environments' },
  { key: 'flame-circle', title: 'Oxidiser', hazards: 'Causes or intensifies combustion of other materials' },
  { key: 'biohazard', title: 'Biohazard', hazards: 'Biological hazards — biological agents and materials' },
];

function GhsIcon({ kind }: { kind: string }) {
  const inner = (() => {
    switch (kind) {
      case 'health':
        return (<><circle cx="32" cy="24" r="8" fill="#fff" /><path d="M26 34c-4 6-6 14-6 20h28c0-6-2-14-6-20" fill="#fff" /><path d="M22 56h20M32 50v12" stroke="#fff" strokeWidth="2.5" /></>);
      case 'flame':
        return (<path d="M32 8c4 8 10 12 10 22a10 10 0 0 1-20 0c0-4 2-7 4-10 2 2 3 3 4 5-2-6 0-11 2-17z" fill="#fff" />);
      case 'corrosion':
        return (<><path d="M22 20v16c0 3 2 5 4 5v-12l-2-2z" fill="#fff" /><path d="M38 20v16c0 3-2 5-4 5v-12l2-2z" fill="#fff" opacity="0.85" /><path d="M22 22h16" stroke="#fff" strokeWidth="1.5" /></>);
      case 'cylinder':
        return (<><path d="M26 18h12v6c2 3 2 17 0 20v6H26v-6c-2-3-2-17 0-20z" fill="#fff" /><path d="M26 18h12" stroke="#fff" strokeWidth="2" /></>);
      case 'exclamation':
        return (<><path d="M30 14h4v18h-4z" fill="#fff" /><circle cx="32" cy="40" r="3" fill="#fff" /></>);
      case 'skull':
        return (<><path d="M20 30c0-9 6-15 12-15s12 6 12 15v6h-6v4h-12v-4h-6z" fill="#fff" /><circle cx="27" cy="31" r="3" fill="#d62828" /><circle cx="37" cy="31" r="3" fill="#d62828" /><path d="M26 44v4M32 44v6M38 44v4" stroke="#fff" strokeWidth="2.5" /></>);
      case 'environment':
        return (<><path d="M32 14c6 6 9 12 9 19a9 9 0 0 1-18 0c0-7 3-13 9-19z" fill="#fff" /><path d="M32 14v24" stroke="#fff" strokeWidth="1.5" /></>);
      case 'flame-circle':
        return (<><circle cx="32" cy="34" r="12" fill="none" stroke="#fff" strokeWidth="3.5" /><path d="M32 22c2 5 6 7 6 12a6 6 0 0 1-12 0c0-2 2-4 3-6 1 1 2 2 3 3z" fill="#fff" /></>);
      case 'biohazard':
        return (<><path d="M32 12c6 5 9 10 9 17a9 9 0 0 1-18 0c0-7 3-12 9-17z" fill="#fff" /><path d="M26 26h12M32 26v16" stroke="#d62828" strokeWidth="2.5" /><circle cx="32" cy="20" r="2.5" fill="#d62828" /></>);
      default:
        return null;
    }
  })();
  return (
    <svg viewBox="0 0 64 64" className="h-12 w-12">
      <rect x="2" y="2" width="60" height="60" rx="4" fill="#d62828" transform="rotate(45 32 32)" />
      <g transform="rotate(-45 32 32)">{inner}</g>
    </svg>
  );
}

/* --------------------------------- safety quiz ----------------------------- */
function SafetyQuiz() {
  // pull the seeded lab-safety questions (EG curriculum)
  const questions: Question[] = [
    { id: 'sq1', curriculumId: 'c-eg', topicId: 't-lab-safety-eg', loIds: [], difficulty: 'Remember', type: 'mcq', points: 1,
      stem: 'Which GHS pictogram is used for corrosive substances?',
      options: ['Corrosion', 'Flame', 'Environment', 'Gas cylinder'], answer: 'Corrosion', explanation: 'The corrosion pictogram (liquid on hand and metal) signals corrosive hazards.' },
    { id: 'sq2', curriculumId: 'c-eg', topicId: 't-lab-safety-eg', loIds: [], difficulty: 'Understand', type: 'truefalse', points: 1,
      stem: 'When diluting concentrated acid, you should always add the acid to water, never water to acid.',
      answer: 'true', explanation: 'Adding water to concentrated acid causes violent boiling and splashing; adding acid slowly to water dissipates heat safely.' },
    { id: 'sq3', curriculumId: 'c-eg', topicId: 't-lab-safety-eg', loIds: [], difficulty: 'Understand', type: 'truefalse', points: 1,
      stem: 'It is safe to taste laboratory chemicals to identify them.',
      answer: 'false', explanation: 'Never taste or smell chemicals directly — use wafting with caution and proper identification only.' },
    { id: 'sq4', curriculumId: 'c-eg', topicId: 't-lab-safety-eg', loIds: [], difficulty: 'Remember', type: 'mcq', points: 1,
      stem: 'The safest action when a chemical splashes into your eye is to:',
      options: ['Rub the eye immediately', 'Flush with water for at least 15 minutes and seek help',
        'Use a tissue to wipe it away', 'Wait and see if it stops hurting'],
      answer: 'Flush with water for at least 15 minutes and seek help',
      explanation: 'Eyewash stations flush for at least 15 minutes; always report the incident to the teacher.' },
  ];
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<null | { score: number; total: number }>(null);

  const submit = () => {
    const total = questions.reduce((acc, q) => acc + gradeAnswer(q, answers[questions.indexOf(q)]).points, 0);
    setResult({ score: total, total: questions.reduce((a, q) => a + q.points, 0) });
  };

  return (
    <Card title="Safety Quiz — before the practical" subtitle="Pass with 100% to confirm lab readiness (mock record).">
      {!result ? (
        <div className="space-y-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Question {idx + 1} of {questions.length}</p>
          <div>
            <p className="mb-3 text-base font-medium text-slate-800 dark:text-slate-100">{questions[idx].stem}</p>
            {questions[idx].type === 'mcq' && questions[idx].options!.map((opt, i) => (
              <button key={i} type="button" onClick={() => setAnswers((a) => ({ ...a, [idx]: opt }))}
                className={`mb-2 block w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                  answers[idx] === opt ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
                {opt}
              </button>
            ))}
            {questions[idx].type === 'truefalse' && ['true', 'false'].map((v) => (
              <button key={v} type="button" onClick={() => setAnswers((a) => ({ ...a, [idx]: v }))}
                className={`mb-2 mr-2 rounded-lg border px-4 py-2.5 text-sm capitalize transition-colors ${
                answers[idx] === v ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
                {v === 'true' ? 'True' : 'False'}
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>Previous</Button>
            {idx < questions.length - 1
              ? <Button onClick={() => setIdx((i) => i + 1)}>Next</Button>
              : <Button onClick={submit}>Submit quiz</Button>}
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <div className={`text-4xl font-bold ${result.score === result.total ? 'text-emerald-600' : 'text-amber-600'}`}>
            {result.score} / {result.total}
          </div>
          {result.score === result.total
            ? <Badge tone="green">✓ Lab safety confirmed — you are cleared for practical sessions</Badge>
            : <p className="text-sm text-amber-600">Review the safety rules and try again.</p>}
          {questions.map((q, i) => {
            const r = gradeAnswer(q, answers[i]);
            return (
              <div key={q.id} className="rounded-lg border border-slate-200 p-3 text-left text-sm dark:border-slate-700">
                <p className="font-medium text-slate-700 dark:text-slate-200">{q.stem}</p>
                <p className={`mt-1 text-xs ${r.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {r.correct ? '✓ Correct' : `✗ Correct answer: ${q.answer}`}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{q.explanation}</p>
              </div>
            );
          })}
          <Button variant="outline" onClick={() => { setResult(null); setIdx(0); setAnswers({}); }}>Retake quiz</Button>
        </div>
      )}
    </Card>
  );
}

export function LabSafety() {
  return (
    <div className="space-y-4">
      <Card title="GHS Hazard Pictograms" subtitle="Globally Harmonised System — know the symbols before entering the lab.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {PICTOGRAMS.map((p) => (
            <div key={p.key} className="rounded-xl border border-slate-200 p-3 text-center dark:border-slate-700">
              <GhsIcon kind={p.key} />
              <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">{p.title}</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-400" title={p.hazards}>{p.hazards}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Core Lab Safety Rules">
        <ol className="grid gap-2 sm:grid-cols-2">
          {[
            'Wear a lab coat, safety goggles and closed shoes at all times in the lab.',
            'Never taste, directly smell or touch chemicals; waft vapours cautiously if instructed.',
            'Always add acid to water when diluting — never water to acid.',
            'Know the location of the fire blanket, eyewash station and first-aid kit.',
            'Report spills, breakages and exposure to the teacher immediately.',
            'Tie back long hair and secure loose clothing before handling Bunsen burners.',
            'Read the label twice before measuring any reagent.',
            'Dispose of waste in the correct waste containers — never down the sink unless told.',
          ].map((rule, i) => (
            <li key={i} className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <span className="font-semibold text-brand-600 dark:text-brand-300">{i + 1}.</span>{rule}
            </li>
          ))}
        </ol>
      </Card>
      <SafetyQuiz />
    </div>
  );
}
