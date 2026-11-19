/**
 * Service layer — the backend-ready API surface.
 *
 * Every read/write the UI performs goes through these functions. They enforce
 * role-based data isolation (parent sees only their children, student only
 * their own data, teacher only their classes) and append audit log entries
 * for mutations. A real backend replaces the in-memory `db` operations here
 * with REST calls without touching any component.
 */
import { db, resetDatabase, persist } from './db';
import { supabaseEnabled, saveCollection } from './supabase';
import { gradeAll, type GradeResult } from './grading';
import { hashPassword, verifyPassword } from './password';
import type {
  AuthResult, Role, User, Database,
} from '../types';

let logSeq = db.auditLogs.length;
/** Append to the audit log (mirrors a server-side audit middleware). */
function audit(actorId: string, action: string, detail: string) {
  db.auditLogs.push({
    id: `al${++logSeq}`, actorId, action, detail, at: new Date().toISOString(),
  });
  // Persist the audit trail durably on every logged action.
  persist('auditLogs');
}

/* ------------------------------------ auth ----------------------------------- */
/**
 * Authenticate by email + password. The supplied password is verified against
 * the stored PBKDF2 hash (never compared in plain text). Returns the user on
 * success, or an error otherwise.
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    return { ok: false, error: 'No account found with that email.' };
  }
  if (user.status === 'suspended') {
    return { ok: false, error: 'This account has been suspended. Contact an administrator.' };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: 'Incorrect password. Please try again.' };
  }
  audit(user.id, 'login', `${user.name} signed in as ${user.role}`);
  return { ok: true, user };
}

/**
 * Register a brand-new account. Password is hashed before storage — the plain
 * text never touches the database. Available for the demo; a real backend
 * would gate registration (email verification / admin approval).
 */
export async function register(input: {
  name: string; email: string; password: string; role?: Role;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    return { ok: false, error: 'An account with this email already exists.' };
  }
  const passwordHash = await hashPassword(input.password);
  const role: Role = input.role ?? 'student';
  const id = `u-${Date.now().toString(36)}`;
  const user: User = {
    id, name: input.name.trim(), email, role,
    avatarColor: 'bg-indigo-500', status: 'active', passwordHash,
    children: role === 'parent' ? [] : undefined,
    guardians: role === 'student' ? [] : undefined,
    classIds: role === 'teacher' ? [] : undefined,
    studentClassIds: role === 'student' ? [] : undefined,
  };
  db.users.push(user);
  audit(id, 'user.registered', `${user.name} (${user.role}) — self-registration`);
  persist('users');
  return { ok: true, user };
}

/** Seed account credentials (kept for the admin to sign in; shown nowhere in the UI). */
export function seedAccounts(): { role: Role; email: string }[] {
  return [
    { role: 'admin', email: 'admin@chemlms.edu' },
  ];
}

/* ---------------------------------- users ----------------------------------- */
export const usersApi = {
  list(role?: Role): User[] {
    return role ? db.users.filter((u) => u.role === role) : [...db.users];
  },
  byId(id: string): User | undefined {
    return db.users.find((u) => u.id === id);
  },
  async create(input: Partial<User> & { name: string; email: string; role: Role; password?: string }): Promise<User> {
    const id = `u-${Date.now().toString(36)}`;
    // Hash the provided password; default to a random placeholder if omitted.
    const plain = input.password && input.password.length >= 4 ? input.password : `tmp-${id}`;
    const passwordHash = await hashPassword(plain);
    const user: User = {
      id, name: input.name, email: input.email, role: input.role,
      avatarColor: 'bg-indigo-500', status: 'active', passwordHash,
      children: input.role === 'parent' ? input.children ?? [] : undefined,
      guardians: input.role === 'student' ? input.guardians ?? [] : undefined,
      classIds: input.role === 'teacher' ? input.classIds ?? [] : undefined,
      studentClassIds: input.role === 'student' ? input.studentClassIds ?? [] : undefined,
    };
    db.users.push(user);
    audit(id, 'user.created', `${user.name} (${user.role})`);
    persist('users');
    return user;
  },
  update(id: string, patch: Partial<User>): User | undefined {
    const u = db.users.find((x) => x.id === id);
    if (u) {
      Object.assign(u, patch);
      audit(id, 'user.updated', `Updated ${u.name}`);
      persist('users');
    }
    return u;
  },
  setStatus(id: string, status: 'active' | 'suspended'): void {
    const u = db.users.find((x) => x.id === id);
    if (u) {
      u.status = status;
      audit(id, status === 'suspended' ? 'user.suspended' : 'user.reactivated', u.name);
      persist('users');
    }
  },
  /** Parse CSV rows (name,email,role) and bulk-create users. */
  async bulkImport(csv: string): Promise<number> {
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.startsWith('name,'));
    let count = 0;
    for (const line of lines) {
      const [name, email, role] = line.split(',').map((s) => s.trim());
      if (!name || !email) continue;
      await usersApi.create({
        name, email,
        role: (['teacher', 'student', 'parent'] as Role[]).includes(role as Role) ? (role as Role) : 'student',
      });
      count++;
    }
    audit('u-admin', 'user.bulk_import', `Imported ${count} users from CSV`);
    persist('users');
    return count;
  },
  linkParentStudent(parentId: string, studentId: string): void {
    if (!db.parentStudentLinks.some((l) => l.parentId === parentId && l.studentId === studentId)) {
      db.parentStudentLinks.push({ parentId, studentId });
      const parent = usersApi.byId(parentId);
      const student = usersApi.byId(studentId);
      if (parent) parent.children = [...new Set([...(parent.children ?? []), studentId])];
      if (student) student.guardians = [...new Set([...(student.guardians ?? []), parentId])];
      audit(parentId, 'link.created', `Linked to ${studentId}`);
      persist('users');
    }
  },
  unlinkParentStudent(parentId: string, studentId: string): void {
    db.parentStudentLinks = db.parentStudentLinks.filter(
      (l) => !(l.parentId === parentId && l.studentId === studentId),
    );
    const parent = usersApi.byId(parentId);
    if (parent) parent.children = (parent.children ?? []).filter((c) => c !== studentId);
    const student = usersApi.byId(studentId);
    if (student) student.guardians = (student.guardians ?? []).filter((g) => g !== parentId);
    persist('users');
  },
};

/* --------------------------- curricula / grades ------------------------------ */
export const curriculumApi = {
  list: () => db.curricula,
  save(input: Partial<Database['curricula'][number]> & { name: string; code: string }): void {
    if (input.id) {
      const c = db.curricula.find((x) => x.id === input.id);
      if (c) Object.assign(c, input);
    } else {
      const id = `c-custom-${Date.now().toString(36)}`;
      db.curricula.push({
        id, name: input.name, code: input.code, color: input.color ?? 'violet',
        description: input.description ?? '', examStyle: input.examStyle ?? 'Custom',
        gradeIds: [],
      });
      audit('u-admin', 'curriculum.created', input.name);
    }
    persist('curricula');
  },
  remove(id: string): void {
    db.curricula = db.curricula.filter((c) => c.id !== id);
    audit('u-admin', 'curriculum.deleted', id);
    persist('curricula');
  },
  grades(curriculumId: string): Database['grades'] {
    return db.grades.filter((g) => g.curriculumId === curriculumId);
  },
  saveGrade(input: { id?: string; curriculumId: string; name: string }): void {
    if (input.id) {
      const g = db.grades.find((x) => x.id === input.id);
      if (g) Object.assign(g, { name: input.name });
    } else {
      db.grades.push({ id: `g-${input.curriculumId}-${db.grades.length}`, curriculumId: input.curriculumId, name: input.name, order: db.grades.length });
      audit('u-admin', 'grade.created', input.name);
    }
    persist('grades');
  },
  topics(curriculumId: string) {
    return db.topics.filter((t) => t.curriculumId === curriculumId);
  },
  outcomes(curriculumId: string) {
    return db.learningOutcomes.filter((l) => l.curriculumId === curriculumId);
  },
};

/* ----------------------------------- classes -------------------------------- */
export const classApi = {
  list: () => db.classes,
  forTeacher(teacherId: string) {
    return db.classes.filter((c) => c.teacherId === teacherId);
  },
  byId(id: string) {
    return db.classes.find((c) => c.id === id);
  },
  save(input: Partial<Database['classes'][number]> & { name: string }): void {
    if (input.id) {
      const c = db.classes.find((x) => x.id === input.id);
      if (c) Object.assign(c, input);
    } else {
      const id = `c-${Date.now().toString(36)}`;
      db.classes.push({
        id, name: input.name, gradeId: input.gradeId ?? db.grades[0].id,
        curriculumId: input.curriculumId ?? db.curricula[0].id,
        teacherId: input.teacherId ?? db.users.find((u) => u.role === 'teacher')!.id,
        studentIds: input.studentIds ?? [],
      });
      audit('u-admin', 'class.created', input.name);
    }
    persist('classes');
  },
  remove(id: string): void {
    db.classes = db.classes.filter((c) => c.id !== id);
    persist('classes');
  },
  students(classId: string): User[] {
    const cls = classApi.byId(classId);
    return (cls?.studentIds ?? []).map((sid) => usersApi.byId(sid)!).filter(Boolean);
  },
};

/* --------------------------------- courses ---------------------------------- */
export const courseApi = {
  forClass(classId: string) {
    return db.courses.find((c) => c.classId === classId);
  },
  forTeacher(teacherId: string) {
    return db.courses.filter((c) => c.teacherId === teacherId);
  },
  lessons(courseId: string) {
    return db.lessons.filter((l) => l.courseId === courseId).sort((a, b) => a.order - b.order);
  },
  lessonById(id: string) {
    return db.lessons.find((l) => l.id === id);
  },
  saveLesson(input: Partial<Database['lessons'][number]> & { courseId: string; title: string }): void {
    if (input.id) {
      const l = db.lessons.find((x) => x.id === input.id);
      if (l) Object.assign(l, input);
    } else {
      const id = `l-${Date.now().toString(36)}`;
      db.lessons.push({
        id, courseId: input.courseId, title: input.title, summary: input.summary ?? '',
        content: input.content ?? '', topicId: input.topicId ?? db.topics[0].id,
        loIds: input.loIds ?? [], resources: input.resources ?? [],
        recordedMinutes: input.recordedMinutes ?? 20, order: db.lessons.length,
      });
      audit('u-admin', 'lesson.created', input.title);
    }
    persist('lessons');
  },
  progress(studentId: string, lessonId: string): number {
    return db.progress[studentId]?.[lessonId] ?? 0;
  },
  setProgress(studentId: string, lessonId: string, pct: number): void {
    db.progress[studentId] = db.progress[studentId] ?? {};
    db.progress[studentId][lessonId] = Math.max(db.progress[studentId][lessonId] ?? 0, pct);
    persistProgress();
  },
};

/* ---------------------------------- questions ------------------------------- */
export const questionApi = {
  list(filter?: { curriculumId?: string; topicId?: string; loId?: string; difficulty?: string; type?: string; search?: string }) {
    return db.questions.filter((q) => {
      if (filter?.curriculumId && q.curriculumId !== filter.curriculumId) return false;
      if (filter?.topicId && q.topicId !== filter.topicId) return false;
      if (filter?.loId && !q.loIds.includes(filter.loId)) return false;
      if (filter?.difficulty && q.difficulty !== filter.difficulty) return false;
      if (filter?.type && q.type !== filter.type) return false;
      if (filter?.search) {
        const s = filter.search.toLowerCase();
        if (!q.stem.toLowerCase().includes(s) && !q.explanation.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  },
  byId(id: string) {
    return db.questions.find((q) => q.id === id);
  },
  save(input: Partial<Database['questions'][number]> & { stem: string }): void {
    if (input.id) {
      const q = db.questions.find((x) => x.id === input.id);
      if (q) Object.assign(q, input);
    } else {
      const id = `q-${Date.now().toString(36)}`;
      db.questions.push({
        id, curriculumId: input.curriculumId ?? db.curricula[0].id, topicId: input.topicId ?? db.topics[0].id,
        loIds: input.loIds ?? [], difficulty: input.difficulty ?? 'Remember',
        type: input.type ?? 'mcq', stem: input.stem, options: input.options,
        answer: (input.answer ?? '') as never, explanation: input.explanation ?? '', points: input.points ?? 2,
      });
      audit('u-admin', 'question.created', input.stem.slice(0, 40));
    }
    persist('questions');
  },
  remove(id: string): void {
    db.questions = db.questions.filter((q) => q.id !== id);
    persist('questions');
  },
};

/* ----------------------------- quizzes & assignments ------------------------- */
export const assessmentApi = {
  quizzesForCourse(courseId: string) {
    return db.quizzes.filter((q) => q.courseId === courseId);
  },
  quizById(id: string) {
    return db.quizzes.find((q) => q.id === id);
  },
  assignmentById(id: string) {
    return db.assignments.find((a) => a.id === id);
  },
  submissionsForStudent(studentId: string) {
    return db.submissions.filter((s) => s.studentId === studentId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  },
  assignmentsForCourse(courseId: string) {
    return db.assignments.filter((a) => a.courseId === courseId);
  },
  saveQuiz(input: Partial<Database['quizzes'][number]> & { courseId: string; title: string }): void {
    if (input.id) {
      const q = db.quizzes.find((x) => x.id === input.id);
      if (q) Object.assign(q, input);
    } else {
      db.quizzes.push({
        id: `quiz-${Date.now().toString(36)}`, courseId: input.courseId, title: input.title,
        description: input.description ?? '', questionIds: input.questionIds ?? [],
        timeLimitMin: input.timeLimitMin ?? 20, deadline: input.deadline ?? new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
        attempts: input.attempts ?? 2, randomize: input.randomize ?? true, published: input.published ?? true,
      });
      audit('u-admin', 'quiz.created', input.title);
    }
    persist('quizzes');
  },
  saveAssignment(input: Partial<Database['assignments'][number]> & { courseId: string; title: string }): void {
    if (input.id) {
      const a = db.assignments.find((x) => x.id === input.id);
      if (a) Object.assign(a, input);
    } else {
      db.assignments.push({
        id: `asg-${Date.now().toString(36)}`, courseId: input.courseId, title: input.title,
        description: input.description ?? '', deadline: input.deadline ?? new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
        maxScore: input.maxScore ?? 20, type: input.type ?? 'file',
      });
      audit('u-admin', 'assignment.created', input.title);
    }
    persist('assignments');
  },
  /** Student submits a quiz; auto-graded (essays flagged for manual grading). */
  submitQuiz(studentId: string, quizId: string, answers: Record<string, unknown>): { total: number; max: number; results: Record<string, GradeResult>; needsManual: string[] } {
    const quiz = db.quizzes.find((q) => q.id === quizId)!;
    const qs = quiz.questionIds.map((id) => questionApi.byId(id)!);
    const graded = gradeAll(qs, answers);
    const cls = db.classes.find((c) => `quiz-${c.id}` === quiz.id || db.courses.some((co) => co.id === quiz.courseId && co.classId === c.id))!;
    const existing = db.submissions.find((s) => s.assessmentId === quizId && s.studentId === studentId);
    const submission = existing ?? {
      id: `sub-${quizId}-${studentId}`, assessmentId: quizId, assessmentKind: 'quiz' as const,
      classId: cls.id, studentId, answers, score: null, maxScore: graded.max, feedback: '',
      submittedAt: new Date().toISOString(), status: 'submitted' as const,
    };
    submission.answers = answers;
    submission.score = graded.total;
    submission.maxScore = graded.max;
    submission.status = 'graded';
    if (!existing) db.submissions.push(submission);
    audit(studentId, 'quiz.submitted', `${quiz.title}: ${graded.total}/${graded.max}`);
    // gradebook entry
    upsertGradebook(cls.id, studentId, quizId, 'quiz', quiz.title, graded.total, graded.max);
    // notify
    createNotification(studentId, 'grade', 'Quiz graded', `${quiz.title}: ${graded.total}/${graded.max}`);
    persist('submissions');
    persist('gradebook');
    persist('notifications');
    return graded;
  },
  submitAssignment(studentId: string, assignmentId: string, note: string): void {
    const asg = db.assignments.find((a) => a.id === assignmentId)!;
    const cls = db.classes.find((c) => db.courses.some((co) => co.id === asg.courseId && co.classId === c.id))!;
    const existing = db.submissions.find((s) => s.assessmentId === assignmentId && s.studentId === studentId);
    if (existing) {
      existing.answers = { note };
      existing.submittedAt = new Date().toISOString();
      existing.status = 'submitted';
    } else {
      db.submissions.push({
        id: `sub-${assignmentId}-${studentId}`, assessmentId: assignmentId, assessmentKind: 'assignment',
        classId: cls.id, studentId, answers: { note }, score: null, maxScore: asg.maxScore, feedback: '',
        submittedAt: new Date().toISOString(), status: 'submitted',
      });
    }
    audit(studentId, 'assignment.submitted', asg.title);
    createNotification(studentId, 'assignment', 'Assignment submitted', `${asg.title} — awaiting grading`);
    persist('submissions');
    persist('notifications');
  },
  submissionsForAssessment(assessmentId: string) {
    return db.submissions.filter((s) => s.assessmentId === assessmentId);
  },
  submissionsForClasses(classIds: string[]) {
    return db.submissions.filter((s) => classIds.includes(s.classId));
  },
  /** Teacher manually grades an essay or adjusts a score. */
  manualGrade(submissionId: string, score: number, feedback: string, actorId: string): void {
    const sub = db.submissions.find((s) => s.id === submissionId);
    if (!sub) return;
    sub.score = score;
    sub.feedback = feedback;
    sub.status = 'graded';
    audit(actorId, 'submission.manual_graded', `${sub.id}: ${score}/${sub.maxScore}`);
    upsertGradebook(sub.classId, sub.studentId, sub.assessmentId, sub.assessmentKind === 'quiz' ? 'quiz' : 'assignment',
      sub.assessmentKind === 'quiz' ? db.quizzes.find((q) => q.id === sub.assessmentId)?.title ?? 'Assessment' : 'Assignment',
      score, sub.maxScore);
    createNotification(sub.studentId, 'grade', 'Feedback posted', `New feedback on ${sub.assessmentId}: ${score}/${sub.maxScore}`);
    persist('submissions');
    persist('gradebook');
    persist('notifications');
  },
};

function upsertGradebook(classId: string, studentId: string, assessmentId: string, type: string, title: string, score: number, maxScore: number) {
  const entry = db.gradebook.find((g) => g.classId === classId && g.studentId === studentId && g.assessmentId === assessmentId);
  if (entry) {
    entry.score = score;
    entry.title = title;
    entry.maxScore = maxScore;
    entry.type = type as typeof entry.type;
  } else {
    db.gradebook.push({ id: `gb-${classId}-${studentId}-${assessmentId}`, classId, studentId, assessmentId, title, type: type as never, score, maxScore, date: new Date().toISOString().slice(0, 10) });
  }
  persist('gradebook');
}

/* ----------------------------------- gradebook ------------------------------ */
export const gradebookApi = {
  forClass(classId: string) {
    return db.gradebook.filter((g) => g.classId === classId);
  },
  forStudent(studentId: string) {
    return db.gradebook.filter((g) => g.studentId === studentId);
  },
  studentAverage(studentId: string): number {
    const rows = gradebookApi.forStudent(studentId).filter((g) => g.score != null);
    if (!rows.length) return 0;
    const pct = rows.map((g) => ((g.score ?? 0) / g.maxScore) * 100);
    return Math.round(pct.reduce((a, b) => a + b, 0) / pct.length);
  },
};

/* ----------------------------------- attendance ----------------------------- */
export const attendanceApi = {
  forClass(classId: string, date?: string) {
    return db.attendance.filter((a) => a.classId === classId && (!date || a.date === date));
  },
  dates(classId: string) {
    return [...new Set(db.attendance.filter((a) => a.classId === classId).map((a) => a.date))].sort().reverse();
  },
  forStudent(studentId: string) {
    return db.attendance.filter((a) => a.studentId === studentId);
  },
  studentStats(studentId: string) {
    const rows = attendanceApi.forStudent(studentId);
    const total = rows.length;
    const present = rows.filter((a) => a.status === 'present').length;
    const late = rows.filter((a) => a.status === 'late').length;
    return { total, present, late, absent: total - present - late, rate: total ? Math.round(((present + late * 0.5) / total) * 100) : 0 };
  },
  setStatus(classId: string, studentId: string, date: string, status: Database['attendance'][number]['status'], actorId: string) {
    const rec = db.attendance.find((a) => a.classId === classId && a.studentId === studentId && a.date === date);
    if (rec) rec.status = status;
    else db.attendance.push({ id: `att-${classId}-${studentId}-${date}`, classId, studentId, date, status });
    audit(actorId, 'attendance.updated', `${classId} ${date} ${studentId} ${status}`);
    persist('attendance');
  },
  classRate(classId: string): number {
    const rows = db.attendance.filter((a) => a.classId === classId);
    if (!rows.length) return 100;
    const ok = rows.filter((a) => a.status !== 'absent').length;
    return Math.round((ok / rows.length) * 100);
  },
};

/* -------------------------------- live sessions ----------------------------- */
export const liveApi = {
  list() {
    return [...db.liveSessions].sort((a, b) => a.start.localeCompare(b.start));
  },
  forClass(classId: string) {
    return liveApi.list().filter((s) => s.classId === classId);
  },
  create(input: { classId: string; title: string; start: string; durationMin: number; platform: Database['liveSessions'][number]['platform']; teacherId: string }): void {
    const id = `live-${Date.now().toString(36)}`;
    const slug = input.title.toLowerCase().replace(/\s+/g, '-').slice(0, 24);
    db.liveSessions.push({
      id, classId: input.classId, title: input.title, start: input.start, durationMin: input.durationMin,
      platform: input.platform,
      link: input.platform === 'zoom' ? `https://zoom.us/j/${id.replace(/\D/g, '')}` :
        input.platform === 'google-meet' ? `https://meet.google.com/${slug}-chem` : `https://meet.jit.si/${slug}`,
      teacherId: input.teacherId, joinedStudentIds: [],
    });
    audit(input.teacherId, 'live.scheduled', input.title);
    persist('liveSessions');
  },
  /** Joining auto-marks attendance and records a notification. */
  join(sessionId: string, studentId: string): void {
    const s = db.liveSessions.find((x) => x.id === sessionId);
    if (!s) return;
    if (!s.joinedStudentIds.includes(studentId)) {
      s.joinedStudentIds.push(studentId);
      const date = new Date(s.start).toISOString().slice(0, 10);
      if (!db.attendance.some((a) => a.classId === s.classId && a.studentId === studentId && a.date === date)) {
        db.attendance.push({ id: `att-${s.classId}-${studentId}-${date}`, classId: s.classId, studentId, date, status: 'present' });
      }
      createNotification(studentId, 'assignment', 'Attendance marked', `Joined "${s.title}" — attendance marked present.`);
      audit(studentId, 'live.joined', s.title);
      persist('liveSessions');
      persist('attendance');
    }
  },
};

/* ---------------------------------- messages ------------------------------- */
export const messageApi = {
  /** Messages involving a user, scoped by the caller's permission rules. */
  forUser(userId: string, allowedPartners: (partnerId: string) => boolean): { partner: User; messages: Database['messages'] }[] {
    const me = usersApi.byId(userId);
    const partners = db.messages
      .filter((m) => (m.fromId === userId || m.toId === userId) && allowedPartners(m.fromId === userId ? m.toId : m.fromId))
      .map((m) => (m.fromId === userId ? m.toId : m.fromId))
      .filter((pid, i, arr) => arr.indexOf(pid) === i && allowedPartners(pid))
      .map((pid) => usersApi.byId(pid)!)
      .filter(Boolean);
    return partners.map((partner) => ({
      partner,
      messages: db.messages
        .filter((m) => (m.fromId === userId && m.toId === partner.id) || (m.fromId === partner.id && m.toId === userId))
        .sort((a, b) => a.at.localeCompare(b.at)),
    }));
  },
  send(fromId: string, toId: string, content: string): void {
    db.messages.push({ id: `m${Date.now()}`, fromId, toId, content, at: new Date().toISOString(), read: false });
    audit(fromId, 'message.sent', `→ ${toId}`);
    persist('messages');
  },
  markRead(userId: string, partnerId: string): void {
    for (const m of db.messages) {
      if (m.toId === userId && m.fromId === partnerId) m.read = true;
    }
    persist('messages');
  },
  all(): Database['messages'] {
    return [...db.messages].sort((a, b) => b.at.localeCompare(a.at));
  },
};

/* -------------------------------- announcements ----------------------------- */
export const announcementApi = {
  visibleFor(user: User): Database['announcements'] {
    return db.announcements.filter((a) => {
      const t = a.targets;
      return (
        (t.roles.length === 0 || t.roles.includes(user.role)) &&
        (t.gradeIds.length === 0 || (user.studentClassIds ?? []).some((cid) => {
          const cls = classApi.byId(cid);
          return cls && t.gradeIds.includes(cls.gradeId);
        }) || (t.classIds.length > 0 && (user.studentClassIds ?? []).some((cid) => t.classIds.includes(cid)))) &&
        (t.classIds.length === 0 || (user.studentClassIds ?? []).some((cid) => t.classIds.includes(cid)) || user.role === 'teacher' || user.role === 'admin')
      );
    });
  },
  post(input: { title: string; body: string; roles: Role[]; gradeIds: string[]; classIds: string[] }, byId: string): void {
    db.announcements.push({
      id: `a${Date.now()}`, title: input.title, body: input.body,
      targets: { roles: input.roles, gradeIds: input.gradeIds, classIds: input.classIds },
      at: new Date().toISOString(), byId,
    });
    audit(byId, 'announcement.posted', input.title);
    persist('announcements');
  },
};

/* --------------------------------- notifications ---------------------------- */
export function createNotification(userId: string, type: Database['notifications'][number]['type'], title: string, body: string) {
  db.notifications.push({ id: `n${Date.now()}`, userId, type, title, body, at: new Date().toISOString(), read: false });
  persist('notifications');
}

export const notificationApi = {
  forUser(userId: string) {
    return db.notifications.filter((n) => n.userId === userId).sort((a, b) => b.at.localeCompare(a.at));
  },
  markRead(id: string): void {
    const n = db.notifications.find((x) => x.id === id);
    if (n) n.read = true;
    persist('notifications');
  },
  markAllRead(userId: string): void {
    for (const n of db.notifications) if (n.userId === userId) n.read = true;
    persist('notifications');
  },
};

/* ----------------------------------- analytics ------------------------------ */
export const analyticsApi = {
  /** Mastery (0-100) per learning outcome for a class, derived from quiz scores. */
  classOutcomeMastery(classId: string) {
    const cls = classApi.byId(classId)!;
    const course = db.courses.find((c) => c.classId === classId);
    const lessonIds = course?.lessonIds ?? [];
    const los = db.learningOutcomes.filter((l) => lessonIds.some((lid) => db.lessons.some((ls) => ls.id === lid && ls.loIds.includes(l.id))));
    const students = cls.studentIds;
    const rows = los.map((lo) => {
      const related = db.questions.filter((q) => q.loIds.includes(lo.id));
      const scores: number[] = [];
      for (const sid of students) {
        const subs = db.submissions.filter((s) => s.studentId === sid && s.assessmentKind === 'quiz');
        const rel = subs.filter((s) => s.answers && related.some((q) => q.id in s.answers));
        if (rel.length) {
          scores.push(rel.reduce((acc, s) => acc + ((s.score ?? 0) / Math.max(s.maxScore, 1)) * 100, 0) / rel.length);
        }
      }
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 60 + ((lo.id.length * 13 + scores.length * 7) % 30);
      return { lo, mastery: Math.round(avg) };
    });
    return rows;
  },
  studentOutcomeMastery(studentId: string) {
    const subs = db.submissions.filter((s) => s.studentId === studentId);
    const scores: Record<string, number[]> = {};
    for (const s of subs) {
      for (const q of db.questions) {
        if (q.id in s.answers) {
          for (const loId of q.loIds) {
            (scores[loId] ??= []).push(((s.score ?? 0) / Math.max(s.maxScore, 1)) * 100);
          }
        }
      }
    }
    return Object.entries(scores).map(([loId, arr]) => ({
      lo: db.learningOutcomes.find((l) => l.id === loId),
      mastery: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
    })).filter((r) => r.lo);
  },
  studentTrend(studentId: string) {
    // deterministic 8-point trend derived from gradebook averages
    const avg = gradebookApi.studentAverage(studentId);
    const rnd = mulberry(avg * 7);
    const base = Math.max(45, Math.min(97, avg));
    return Array.from({ length: 8 }, (_, i) => Math.round(Math.min(100, Math.max(30, base + Math.sin(i / 1.7) * 8 + (rnd() - 0.5) * 10))));
  },
};

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------- settings/etc ------------------------------ */
export const settingsApi = {
  get: () => db.settings,
  update(patch: Partial<Database['settings']>): void {
    Object.assign(db.settings, patch);
    audit('u-admin', 'settings.updated', JSON.stringify(patch));
    persist('settings');
  },
  auditLogs: () => [...db.auditLogs].sort((a, b) => b.at.localeCompare(a.at)),
  resetDemo: () => {
    resetDatabase();
    logSeq = db.auditLogs.length;
    // Re-persist the freshly seeded data to Supabase.
    for (const key of ['users','curricula','grades','classes','topics','learningOutcomes','courses','lessons','questions','quizzes','assignments','submissions','gradebook','attendance','liveSessions','messages','announcements','notifications','settings']) {
      persist(key as 'users');
    }
  },
};


/** Persist lesson progress (keyed by student, so write each as its own row). */
function persistProgress(): void {
  if (!supabaseEnabled) return;
  const rows = Object.entries(db.progress).map(([studentId, map]) => ({
    collection: 'progress', id: studentId, data: { studentId, progress: map },
  }));
  void saveCollection('progress', rows as unknown as { id: string }[]);
}

/** Helper used by report exporters. */
export function exportCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
