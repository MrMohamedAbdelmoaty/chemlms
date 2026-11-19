/**
 * Chemistry-aware auto-grading engine.
 *
 * Handles all question types and accepts "equivalent answers":
 *  - MCQ / true-false / graph: case-insensitive, whitespace-trimmed compare
 *  - fill-in-the-blank: a list of accepted variants
 *  - matching: unordered pair comparison
 *  - balance-the-equation: coefficient vectors compared after gcd reduction
 *  - numeric: unit conversion (mol/mmol, g/kg/mg, L/mL, atm/kPa/mmHg/bar,
 *    K/°C), fractional tolerance, and a significant-figures note
 *  - essay/CER: manual grading only (returns null)
 */
import type { Question } from '../types';

export interface GradeResult {
  correct: boolean;
  points: number;
  note?: string; // e.g. significant-figures warning
}

/** Remove whitespace, unify case and strip common formatting. */
export function normalize(s: unknown): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[​-‏﻿]/g, '')
    .replace(/[_()*]/g, '')
    .replace(/×/g, 'x')
    .replace(/,/g, '');
}

/** Count significant figures of a numeric string. */
export function countSigFigs(input: string): number {
  const s = input.replace(/[^0-9.]/g, '');
  if (!s || s === '.') return 0;
  const neg = s.startsWith('-');
  let str = neg ? s.slice(1) : s;
  const dot = str.indexOf('.');
  if (dot >= 0) str = str.replace('.', '');
  let leading = 0;
  while (leading < str.length - 1 && str[leading] === '0') leading++;
  str = str.slice(leading);
  return str.replace(/0+$/, (m) => (m.length === str.length ? m : '')).length;
}

/* ----------------------------- unit equivalence ----------------------------- */
type Dim = 'mass' | 'amount' | 'volume' | 'pressure' | 'temp' | 'energy';
interface UnitEntry { dim: Dim; base: string; factor: number; offset?: number }
const UNITS: Record<string, UnitEntry> = {
  g: { dim: 'mass', base: 'g', factor: 1 }, gram: { dim: 'mass', base: 'g', factor: 1 },
  kg: { dim: 'mass', base: 'g', factor: 1000 }, mg: { dim: 'mass', base: 'g', factor: 0.001 },
  mol: { dim: 'amount', base: 'mol', factor: 1 }, mole: { dim: 'amount', base: 'mol', factor: 1 },
  mmol: { dim: 'amount', base: 'mol', factor: 0.001 },
  l: { dim: 'volume', base: 'L', factor: 1 },
  ml: { dim: 'volume', base: 'L', factor: 0.001 }, cm3: { dim: 'volume', base: 'L', factor: 0.001 },
  atm: { dim: 'pressure', base: 'atm', factor: 1 },
  kpa: { dim: 'pressure', base: 'atm', factor: 0.009869233 },
  mmhg: { dim: 'pressure', base: 'atm', factor: 0.00131579 },
  bar: { dim: 'pressure', base: 'atm', factor: 0.9869233 },
  k: { dim: 'temp', base: 'K', factor: 1 },
  c: { dim: 'temp', base: 'K', factor: 1, offset: 273.15 },
  j: { dim: 'energy', base: 'J', factor: 1 },
  kj: { dim: 'energy', base: 'J', factor: 1000 },
};

function toBase(value: number, unit: string): number | null {
  const u = normalize(unit).replace(/[°]/g, '');
  const key = u === 'l' ? 'l' : u === 'c' || u === '°c' ? 'c' : u;
  const entry = UNITS[key];
  if (!entry) return null;
  return entry.offset ? entry.factor * value + entry.offset : entry.factor * value;
}

function dimOf(unit: string): Dim | null {
  const key = normalize(unit).replace(/[°]/g, '');
  return UNITS[key]?.dim ?? null;
}

/* --------------------------- coefficient matching --------------------------- */
function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/** Parse "4 3 2" / "4,3,2" / "4 3 2  " into [4,3,2], reduced by gcd. */
export function parseCoefficients(s: unknown): number[] | null {
  const parts = String(s ?? '')
    .split(/[,;\s]+/)
    .map((p) => parseInt(p.replace(/[^\d.-]/g, ''), 10))
    .filter((n) => !Number.isNaN(n));
  if (parts.length === 0) return null;
  let g = parts[0];
  for (const p of parts) g = gcd(g, p);
  if (g === 0) return null;
  return parts.map((p) => Math.round((p / g) * 1000) / 1000);
}

/* ------------------------------ main grader ------------------------------- */
export function gradeAnswer(question: Question, answer: unknown): GradeResult {
  const pts = question.points;

  switch (question.type) {
    case 'mcq':
    case 'graph': {
      const correct = normalize(answer) === normalize(question.answer);
      return { correct, points: correct ? pts : 0 };
    }
    case 'truefalse': {
      const correct = ['true', 'false'].includes(normalize(answer)) && normalize(answer) === normalize(question.answer);
      return { correct, points: correct ? pts : 0 };
    }
    case 'fill': {
      const accepts = Array.isArray(question.answer) ? question.answer : [question.answer as string];
      const correct = accepts.some((a) => normalize(a) === normalize(answer));
      return { correct, points: correct ? pts : 0 };
    }
    case 'matching': {
      const expected = (question.answer as { pairs: { left: string; right: string }[] }).pairs;
      const got = (answer ?? {}) as Record<string, string>;
      let correctCount = 0;
      for (const p of expected) {
        if (normalize(got[p.left]) === normalize(p.right)) correctCount++;
      }
      const correct = correctCount === expected.length;
      const points = Math.round((correctCount / expected.length) * pts);
      return { correct, points };
    }
    case 'balance': {
      const expected = (question.answer as { coefficients: number[] }).coefficients;
      const got = parseCoefficients(answer);
      if (!got || got.length !== expected.length) return { correct: false, points: 0 };
      const expectedRed = reduceCoeffs(expected);
      const gotRed = reduceCoeffs(got);
      const correct = expectedRed.every((v, i) => Math.abs(v - gotRed[i]) < 1e-6);
      return { correct, points: correct ? pts : 0 };
    }
    case 'numeric': {
      const expected = question.answer as {
        value: number; unit: string; sigfigs: number; tolerance: number; accepts: string[];
      };
      const raw = String(answer ?? '');
      // 1) accept explicit variant strings first
      if (expected.accepts.some((a) => normalize(a) === normalize(raw))) {
        return { correct: true, points: pts, note: checkSigfigs(raw, expected.sigfigs) };
      }
      const num = parseFloat(raw.replace(/[^\d.\-eE]/g, ''));
      if (Number.isNaN(num)) return { correct: false, points: 0 };
      const studentUnit = (raw.match(/[a-z°]+/i) || [''])[0];
      const expUnit = studentUnit || expected.unit;
      const expDim = dimOf(expected.unit);
      const stuDim = dimOf(expUnit);
      // unit dimension must match the expected answer (or be absent)
      if (expDim && stuDim && expDim !== stuDim) return { correct: false, points: 0 };
      const expBase = toBase(expected.value, expected.unit) ?? expected.value;
      const stuBase = toBase(num, expUnit);
      if (stuBase === null) return { correct: false, points: 0 };
      const relErr = Math.abs(stuBase - expBase) / Math.max(Math.abs(expBase), 1e-9);
      const correct = relErr <= expected.tolerance;
      const note = checkSigfigs(raw, expected.sigfigs);
      return { correct, points: correct ? pts : 0, note };
    }
    case 'essay':
      // CER essays are graded manually by the teacher.
      return { correct: false, points: 0, note: 'Manual grading required' };
    default:
      return { correct: false, points: 0 };
  }
}

function reduceCoeffs(cs: number[]): number[] {
  let g = cs[0];
  for (const c of cs) g = gcd(g, c);
  if (g === 0) return cs;
  return cs.map((c) => Math.round((c / g) * 1000) / 1000);
}

function checkSigfigs(raw: string, expectedSigfigs: number): string | undefined {
  const num = raw.replace(/[^\d.\-eE]/g, '');
  if (!num) return undefined;
  const got = countSigFigs(num);
  return got !== expectedSigfigs ? `Significant figures: expected ${expectedSigfigs}, got ${got}` : undefined;
}

/** Grade a whole set of answers; returns total score and per-question results. */
export function gradeAll(
  questions: Question[],
  answers: Record<string, unknown>,
): { total: number; max: number; results: Record<string, GradeResult>; needsManual: string[] } {
  const results: Record<string, GradeResult> = {};
  let total = 0;
  let max = 0;
  const needsManual: string[] = [];
  for (const q of questions) {
    max += q.points;
    const r = gradeAnswer(q, answers[q.id]);
    results[q.id] = r;
    total += r.points;
    if (q.type === 'essay' || r.note === 'Manual grading required') needsManual.push(q.id);
  }
  return { total, max, results, needsManual };
}
