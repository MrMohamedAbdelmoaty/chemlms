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
import { supabaseEnabled, saveCollection, uploadToStorage, deleteFromStorage } from './supabase';
import { createDatabase as createDatabaseFresh } from '../data/seed';
import { gradeAll, type GradeResult } from './grading';
import { hashPassword, verifyPassword, normalizePhone, isValidPhone } from './password';
import type {
  AuthResult, Role, User, Database, Video, AssignmentFile,
  StudioFile, DeliverableJob, DeliverableType, MasterPromptConfig, DeliverableResult,
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

/** Read a File into a base64 data URL (fallback when Storage is unavailable). */
function readAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Generate a short numeric confirmation code (demo-grade "verification"). */
function genToken(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/* ------------------------------------ auth ----------------------------------- */
/**
 * Authenticate by email **or** phone + password. The supplied password is
 * verified against the stored PBKDF2 hash (never compared in plain text).
 * Returns the user on success, or an error otherwise.
 */
export async function login(identifier: string, password: string): Promise<AuthResult> {
  const id = identifier.trim().toLowerCase();
  const user = db.users.find(
    (u) => u.email.toLowerCase() === id || (u.phone && normalizePhone(u.phone) === normalizePhone(id)),
  );
  if (!user) {
    return { ok: false, error: 'No account found with that email or phone number.' };
  }
  if (user.status === 'suspended') {
    return { ok: false, error: 'This account has been suspended. Contact an administrator.' };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: 'Incorrect password. Please try again.' };
  }
  audit(user.id, 'login', `${user.name} signed in as ${user.role} (${user.email})`);
  return { ok: true, user };
}

/**
 * Register a brand-new account by email **or** phone + password. The
 * password is hashed before storage; the plain text never touches the DB.
 * New accounts start unconfirmed; a confirmation code is generated and
 * returned (in a real backend this would be emailed/SMS'd).
 */
export async function register(input: {
  name: string; password: string; role?: Role;
  email?: string; phone?: string; identifier?: string;
}): Promise<AuthResult & { confirmationToken?: string; confirmationTarget?: string }> {
  const role: Role = input.role ?? 'student';
  let email = (input.email ?? '').trim().toLowerCase();
  let phone = input.phone ? normalizePhone(input.phone) : '';
  // Fall back to identifier if email/phone weren't provided explicitly.
  if (!email && !phone && input.identifier) {
    if (input.identifier.includes('@')) { email = input.identifier.trim().toLowerCase(); }
    else { phone = normalizePhone(input.identifier); }
  }

  // Require at least one identifier.
  if (!email && !phone) {
    return { ok: false, error: 'Provide an email or phone number.' };
  }
  // Check uniqueness.
  if (email && db.users.some((u) => u.email.toLowerCase() === email)) {
    return { ok: false, error: 'An account with this email already exists.' };
  }
  if (phone && db.users.some((u) => u.phone && normalizePhone(u.phone) === phone)) {
    return { ok: false, error: 'An account with this phone number already exists.' };
  }

  const passwordHash = await hashPassword(input.password);
  const id = `u-${Date.now().toString(36)}`;

  // Generate a confirmation token for the provided identifier.
  const token = genToken();
  const target = email ? email : phone;
  const user: User = {
    id, name: input.name.trim(), email: email || `unconfirmed-${id}@local`, role,
    avatarColor: 'bg-indigo-500', status: 'active', passwordHash,
    phone: phone || undefined,
    emailConfirmed: !!email ? false : true, // no email => nothing to confirm
    phoneConfirmed: !!phone ? false : true,
    emailToken: email ? token : undefined,
    phoneToken: phone ? token : undefined,
    children: role === 'parent' ? [] : undefined,
    guardians: role === 'student' ? [] : undefined,
    classIds: role === 'teacher' ? [] : undefined,
    studentClassIds: role === 'student' ? [] : undefined,
  };
  db.users.push(user);
  audit(id, 'user.registered', `${user.name} (${user.role}) — self-registration`);
  persist('users');
  return { ok: true, user, confirmationToken: token, confirmationTarget: target };
}

/**
 * Confirm an account using the token issued at registration. Marks the
 * matching email/phone as confirmed and clears the token.
 */
export function confirmAccount(userId: string, token: string): AuthResult {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return { ok: false, error: 'Account not found.' };
  if (u.emailToken && u.emailToken === token) {
    u.emailConfirmed = true;
    u.emailToken = undefined;
    audit(userId, 'email.confirmed', `Confirmed ${u.email}`);
    persist('users');
    return { ok: true, user: u };
  }
  if (u.phoneToken && u.phoneToken === token) {
    u.phoneConfirmed = true;
    u.phoneToken = undefined;
    audit(userId, 'phone.confirmed', `Confirmed ${u.phone}`);
    persist('users');
    return { ok: true, user: u };
  }
  return { ok: false, error: 'Invalid or expired confirmation token.' };
}

/**
 * Change a user's own password. The current password must verify before the
 * new one (hashed) is stored. Returns a clear error on mismatch.
 */
export async function changePassword(
  userId: string, currentPassword: string, newPassword: string,
): Promise<AuthResult> {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return { ok: false, error: 'Account not found.' };
  const valid = await verifyPassword(currentPassword, u.passwordHash);
  if (!valid) return { ok: false, error: 'Current password is incorrect.' };
  if (newPassword.length < 6) return { ok: false, error: 'New password must be at least 6 characters.' };
  u.passwordHash = await hashPassword(newPassword);
  audit(userId, 'password.changed', 'Password updated by user');
  persist('users');
  return { ok: true, user: u };
}

/**
 * Admin-initiated password reset. Sets a new (hashed) password directly.
 * In a real backend this would email a one-time reset link.
 */
export async function adminResetPassword(userId: string, newPassword: string, actorId: string): Promise<AuthResult> {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return { ok: false, error: 'Account not found.' };
  if (newPassword.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
  u.passwordHash = await hashPassword(newPassword);
  audit(actorId, 'password.admin_reset', `Reset password for ${u.name} (${u.email})`);
  persist('users');
  return { ok: true, user: u };
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
  async create(input: Partial<User> & { name: string; email: string; role: Role; password?: string; phone?: string }): Promise<User> {
    const id = `u-${Date.now().toString(36)}`;
    // Hash the provided password; default to a random placeholder if omitted.
    const plain = input.password && input.password.length >= 4 ? input.password : `tmp-${id}`;
    const passwordHash = await hashPassword(plain);
    const phone = input.phone ? normalizePhone(input.phone) : undefined;
    const user: User = {
      id, name: input.name, email: input.email, role: input.role,
      avatarColor: 'bg-indigo-500', status: 'active', passwordHash,
      phone,
      emailConfirmed: !!input.emailConfirmed,
      phoneConfirmed: !!phone && !!input.phoneConfirmed,
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
  /** Admin: delete a user entirely (and unlink them everywhere). */
  remove(id: string, actorId: string): void {
    const u = db.users.find((x) => x.id === id);
    if (!u) return;
    db.users = db.users.filter((x) => x.id !== id);
    // Unlink from parents/students and classes.
    db.parentStudentLinks = db.parentStudentLinks.filter((l) => l.parentId !== id && l.studentId !== id);
    for (const other of db.users) {
      if (other.children) other.children = other.children.filter((c) => c !== id);
      if (other.guardians) other.guardians = other.guardians.filter((g) => g !== id);
      if (other.classIds) other.classIds = other.classIds.filter((c) => c !== id);
    }
    db.classes = db.classes.map((c) => ({ ...c, studentIds: (c.studentIds ?? []).filter((s) => s !== id) }));
    audit(actorId, 'user.deleted', `Removed ${u.name} (${u.email})`);
    persist('users');
    persist('classes');
    persist('parentStudentLinks');
  },
  /** Admin: confirm a user's email/phone directly (no token needed). */
  confirm(id: string, target: 'email' | 'phone', actorId: string): AuthResult {
    const u = db.users.find((x) => x.id === id);
    if (!u) return { ok: false, error: 'Account not found.' };
    if (target === 'email') { u.emailConfirmed = true; u.emailToken = undefined; }
    else { u.phoneConfirmed = true; u.phoneToken = undefined; }
    audit(actorId, target === 'email' ? 'email.confirmed' : 'phone.confirmed', `Admin confirmed ${u.name}'s ${target}`);
    persist('users');
    return { ok: true, user: u };
  },
  /** Admin: generate a fresh confirmation token for a user. */
  resendConfirmation(id: string, target: 'email' | 'phone'): { token: string } | { error: string } {
    const u = db.users.find((x) => x.id === id);
    if (!u) return { error: 'Account not found.' };
    const token = genToken();
    if (target === 'email') { u.emailToken = token; }
    else { if (!u.phone) return { error: 'User has no phone number.' }; u.phoneToken = token; }
    persist('users');
    return { token };
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
  /** Admin: change a user's role (e.g. promote a teacher to admin). */
  setRole(id: string, role: Role, actorId: string): AuthResult {
    const u = db.users.find((x) => x.id === id);
    if (!u) return { ok: false, error: 'Account not found.' };
    if (u.role === 'admin' && role !== 'admin') {
      return { ok: false, error: 'The primary admin role cannot be removed.' };
    }
    u.role = role;
    // Adjust role-scoped collections so a new student/teacher/parent starts clean.
    if (role === 'student') { u.studentClassIds ??= []; }
    if (role === 'teacher') { u.classIds ??= []; }
    if (role === 'parent') { u.children ??= []; }
    audit(actorId, 'user.role_changed', `${u.name}: ${u.role} -> ${role}`);
    persist('users');
    return { ok: true, user: u };
  },
  /** Admin: assign a student to (or remove from) a class's roster. */
  assignClass(userId: string, classId: string, actorId: string): void {
    const u = db.users.find((x) => x.id === userId);
    const cls = db.classes.find((c) => c.id === classId);
    if (!u || !cls) return;
    if (u.studentClassIds) u.studentClassIds = [...new Set([...u.studentClassIds, classId])];
    cls.studentIds = [...new Set([...cls.studentIds, userId])];
    audit(actorId, 'user.assigned_class', `${u.name} -> ${cls.name}`);
    persist('users');
    persist('classes');
  },
  unassignClass(userId: string, classId: string, actorId: string): void {
    const u = db.users.find((x) => x.id === userId);
    const cls = db.classes.find((c) => c.id === classId);
    if (!u || !cls) return;
    if (u.studentClassIds) u.studentClassIds = u.studentClassIds.filter((c) => c !== classId);
    cls.studentIds = cls.studentIds.filter((s) => s !== userId);
    audit(actorId, 'user.unassigned_class', `${u.name} - ${cls.name}`);
    persist('users');
    persist('classes');
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
  removeGrade(id: string): void {
    db.grades = db.grades.filter((g) => g.id !== id);
    // Also drop classes that referenced the removed grade.
    db.classes = db.classes.filter((c) => c.gradeId !== id);
    audit('u-admin', 'grade.deleted', id);
    persist('grades');
    persist('classes');
  },
  topics(curriculumId: string) {
    return db.topics.filter((t) => t.curriculumId === curriculumId);
  },
  saveTopic(input: { id?: string; curriculumId: string; unit: string; name: string }): void {
    if (input.id) {
      const t = db.topics.find((x) => x.id === input.id);
      if (t) Object.assign(t, { unit: input.unit, name: input.name });
    } else {
      db.topics.push({ id: `t-${Date.now().toString(36)}`, curriculumId: input.curriculumId, unit: input.unit, name: input.name });
      audit('u-admin', 'topic.created', input.name);
    }
    persist('topics');
  },
  removeTopic(id: string): void {
    db.topics = db.topics.filter((t) => t.id !== id);
    db.learningOutcomes = db.learningOutcomes.filter((l) => l.topicId !== id);
    audit('u-admin', 'topic.deleted', id);
    persist('topics');
    persist('learningOutcomes');
  },
  outcomes(curriculumId: string) {
    return db.learningOutcomes.filter((l) => l.curriculumId === curriculumId);
  },
  saveOutcome(input: { id?: string; curriculumId: string; topicId: string; code: string; text: string }): void {
    if (input.id) {
      const l = db.learningOutcomes.find((x) => x.id === input.id);
      if (l) Object.assign(l, { topicId: input.topicId, code: input.code, text: input.text });
    } else {
      db.learningOutcomes.push({
        id: `lo-${Date.now().toString(36)}`, curriculumId: input.curriculumId,
        topicId: input.topicId, code: input.code, text: input.text,
      });
      audit('u-admin', 'outcome.created', input.code);
    }
    persist('learningOutcomes');
  },
  removeOutcome(id: string): void {
    db.learningOutcomes = db.learningOutcomes.filter((l) => l.id !== id);
    audit('u-admin', 'outcome.deleted', id);
    persist('learningOutcomes');
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
  /** Admin: assign/remove students in a class roster (also keeps user's classIds in sync). */
  addStudent(classId: string, studentId: string, actorId: string): void {
    const cls = db.classes.find((c) => c.id === classId);
    const u = db.users.find((x) => x.id === studentId);
    if (!cls || !u) return;
    cls.studentIds = [...new Set([...cls.studentIds, studentId])];
    if (u.studentClassIds) u.studentClassIds = [...new Set([...u.studentClassIds, classId])];
    audit(actorId, 'class.student_added', `${u.name} -> ${cls.name}`);
    persist('classes');
    persist('users');
  },
  removeStudent(classId: string, studentId: string, actorId: string): void {
    const cls = db.classes.find((c) => c.id === classId);
    const u = db.users.find((x) => x.id === studentId);
    if (!cls) return;
    cls.studentIds = cls.studentIds.filter((s) => s !== studentId);
    if (u && u.studentClassIds) u.studentClassIds = u.studentClassIds.filter((c) => c !== classId);
    audit(actorId, 'class.student_removed', `${u?.name ?? studentId} - ${cls.name}`);
    persist('classes');
    persist('users');
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
  list() {
    return [...db.courses];
  },
  byId(id: string) {
    return db.courses.find((c) => c.id === id);
  },
  save(input: Partial<Database['courses'][number]> & { classId: string; title: string }): void {
    if (input.id) {
      const c = db.courses.find((x) => x.id === input.id);
      if (c) Object.assign(c, input);
    } else {
      const cls = db.classes.find((c) => c.id === input.classId);
      db.courses.push({
        id: `cr-${Date.now().toString(36)}`, classId: input.classId,
        curriculumId: input.curriculumId ?? cls?.curriculumId ?? db.curricula[0].id,
        subject: input.subject ?? 'Chemistry', title: input.title,
        description: input.description ?? '', teacherId: input.teacherId ?? cls?.teacherId ?? db.users.find((u) => u.role === 'teacher')!.id,
        lessonIds: input.lessonIds ?? [],
      });
      audit('u-admin', 'course.created', input.title);
    }
    persist('courses');
  },
  remove(id: string): void {
    db.courses = db.courses.filter((c) => c.id !== id);
    db.lessons = db.lessons.filter((l) => l.courseId !== id);
    audit('u-admin', 'course.deleted', id);
    persist('courses');
    persist('lessons');
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
  removeLesson(id: string): void {
    db.lessons = db.lessons.filter((l) => l.id !== id);
    // Also detach from the course's lessonIds.
    for (const c of db.courses) c.lessonIds = (c.lessonIds ?? []).filter((lid) => lid !== id);
    audit('u-admin', 'lesson.deleted', id);
    persist('lessons');
    persist('courses');
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
  removeQuiz(id: string): void {
    db.quizzes = db.quizzes.filter((q) => q.id !== id);
    audit('u-admin', 'quiz.deleted', id);
    persist('quizzes');
  },
  /** Admin: publish/unpublish a quiz (unpublished quizzes are hidden from students). */
  setQuizPublished(id: string, published: boolean, actorId: string): void {
    const q = db.quizzes.find((x) => x.id === id);
    if (!q) return;
    q.published = published;
    audit(actorId, published ? 'quiz.published' : 'quiz.unpublished', q.title);
    persist('quizzes');
  },
  removeAssignment(id: string): void {
    db.assignments = db.assignments.filter((a) => a.id !== id);
    audit('u-admin', 'assignment.deleted', id);
    persist('assignments');
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
  submitAssignment(studentId: string, assignmentId: string, note: string, file?: AssignmentFile): void {
    const asg = db.assignments.find((a) => a.id === assignmentId)!;
    const cls = db.classes.find((c) => db.courses.some((co) => co.id === asg.courseId && co.classId === c.id))!;
    const existing = db.submissions.find((s) => s.assessmentId === assignmentId && s.studentId === studentId);
    if (existing) {
      existing.answers = { note };
      if (file) existing.file = file;
      existing.submittedAt = new Date().toISOString();
      existing.status = 'submitted';
    } else {
      db.submissions.push({
        id: `sub-${assignmentId}-${studentId}`, assessmentId: assignmentId, assessmentKind: 'assignment',
        classId: cls.id, studentId, answers: { note }, file, score: null, maxScore: asg.maxScore, feedback: '',
        submittedAt: new Date().toISOString(), status: 'submitted',
      });
    }
    audit(studentId, 'assignment.submitted', asg.title);
    createNotification(studentId, 'assignment', 'Assignment submitted', `${asg.title} — awaiting grading`);
    persist('submissions');
    persist('notifications');
  },
  /**
   * Upload an assignment file to Supabase Storage (with base64 fallback).
   * Returns the AssignmentFile payload ready for submitAssignment.
   */
  async saveAssignmentFile(file: File): Promise<AssignmentFile> {
    try {
      const path = `assignments/${Date.now().toString(36)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { path: storedPath, url } = await uploadToStorage(path, file, file.type || 'application/octet-stream');
      return {
        name: file.name, storagePath: storedPath, storageUrl: url,
        storageProvider: 'storage', sizeBytes: file.size,
        mimeType: file.type || 'application/octet-stream',
      };
    } catch {
      const dataUrl = await readAsDataUrl(file);
      return {
        name: file.name, dataUrl, storageProvider: 'base64',
        sizeBytes: file.size, mimeType: file.type || 'application/octet-stream',
      };
    }
  },
  /** Resolve the downloadable URL for an assignment file (storage preferred). */
  fileUrl(f: AssignmentFile): string {
    return f.storageUrl ?? f.dataUrl ?? '';
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
  /** Admin/teacher: set or clear a student's gradebook score for an assessment. */
  setScore(entryId: string, score: number | null, actorId: string): void {
    const e = db.gradebook.find((g) => g.id === entryId);
    if (!e) return;
    e.score = score;
    const sub = db.submissions.find((s) => s.assessmentId === e.assessmentId && s.studentId === e.studentId);
    if (sub) {
      sub.score = score;
      sub.status = score == null ? 'submitted' : 'graded';
      sub.feedback = score == null ? sub.feedback : sub.feedback;
    }
    audit(actorId, 'gradebook.score_set', `${e.studentId}/${e.assessmentId}: ${score ?? 'cleared'}`);
    persist('gradebook');
    persist('submissions');
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
  /** Admin: delete an attendance record (undo a wrong mark). */
  remove(classId: string, studentId: string, date: string): void {
    db.attendance = db.attendance.filter(
      (a) => !(a.classId === classId && a.studentId === studentId && a.date === date),
    );
    audit('u-admin', 'attendance.deleted', `${classId} ${date} ${studentId}`);
    persist('attendance');
  },
  /** Admin: delete a student's whole attendance history (e.g. data reset). */
  removeStudentHistory(studentId: string): void {
    const removed = db.attendance.filter((a) => a.studentId === studentId).length;
    db.attendance = db.attendance.filter((a) => a.studentId !== studentId);
    audit('u-admin', 'attendance.history_deleted', `${studentId} (${removed} records)`);
    persist('attendance');
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
  /** Admin: delete a message from the platform (moderation action). */
  remove(id: string, actorId: string): void {
    const m = db.messages.find((x) => x.id === id);
    db.messages = db.messages.filter((x) => x.id !== id);
    audit(actorId, 'message.deleted', `${id} — ${m?.content.slice(0, 40) ?? ''}`);
    persist('messages');
  },
  /** Admin: broadcast a message to one or more recipients. */
  broadcast(fromId: string, recipientIds: string[], content: string): number {
    for (const toId of recipientIds) {
      db.messages.push({ id: `m${Date.now()}-${toId}`, fromId, toId, content, at: new Date().toISOString(), read: false });
    }
    audit(fromId, 'message.broadcast', `${recipientIds.length} recipients`);
    persist('messages');
    return recipientIds.length;
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
  /** Admin: delete an announcement from the platform. */
  remove(id: string, actorId: string): void {
    const a = db.announcements.find((x) => x.id === id);
    db.announcements = db.announcements.filter((x) => x.id !== id);
    audit(actorId, 'announcement.deleted', a?.title ?? id);
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
  /** Admin: delete a notification (e.g. an erroneous system notice). */
  remove(id: string): void {
    db.notifications = db.notifications.filter((n) => n.id !== id);
    persist('notifications');
  },
  /** Admin: delete all notifications for a user. */
  clearForUser(userId: string): void {
    db.notifications = db.notifications.filter((n) => n.userId !== userId);
    audit('u-admin', 'notifications.cleared', userId);
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

/* ---------------------------- chemistry reference data ---------------------- */
/**
 * Admin-managed chemistry data: periodic-table elements, preset equations and
 * constants. These drive the chemistry tools (periodic table, balancer,
 * calculators) so the admin can add or correct entries on the platform.
 */
export const chemApi = {
  elements: () => db.chemData.elements,
  saveElement(input: Partial<Database['chemData']['elements'][number]> & { symbol: string; name: string }) {
    if (input.z != null) {
      const existing = db.chemData.elements.find((e) => e.z === input.z);
      if (existing) {
        existing.symbol = input.symbol.toUpperCase();
        existing.name = input.name;
        if (input.mass != null) existing.mass = input.mass;
        if (input.category) existing.category = input.category;
        if (input.block) existing.block = input.block;
        if (input.electronegativity != null) existing.electronegativity = input.electronegativity;
        if (input.radiusPm != null) existing.radiusPm = input.radiusPm;
        if (input.phase) existing.phase = input.phase;
      } else {
        db.chemData.elements.push({
          z: input.z, symbol: input.symbol.toUpperCase(), name: input.name,
          mass: input.mass ?? 0, category: input.category ?? 'nonmetal',
          block: input.block ?? 'p', electronegativity: input.electronegativity ?? 0,
          radiusPm: input.radiusPm ?? 100, phase: input.phase ?? 'solid',
        });
      }
    } else {
      const z = Math.max(0, ...db.chemData.elements.map((e) => e.z)) + 1;
      db.chemData.elements.push({
        z, symbol: input.symbol.toUpperCase(), name: input.name,
        mass: input.mass ?? 0, category: input.category ?? 'nonmetal',
        block: input.block ?? 'p', electronegativity: input.electronegativity ?? 0,
        radiusPm: input.radiusPm ?? 100, phase: input.phase ?? 'solid',
      });
    }
    audit('u-admin', 'chem.element_saved', input.symbol || input.name);
    persist('chemData');
  },
  removeElement(z: number) {
    db.chemData.elements = db.chemData.elements.filter((e) => e.z !== z);
    audit('u-admin', 'chem.element_deleted', `Z=${z}`);
    persist('chemData');
  },
  equations: () => db.chemData.equations,
  saveEquation(input: { id?: string; equation: string; category?: string; note?: string }) {
    if (input.id) {
      const e = db.chemData.equations.find((x) => x.id === input.id);
      if (e) Object.assign(e, input);
    } else {
      db.chemData.equations.push({
        id: `eq-${Date.now().toString(36)}`, equation: input.equation,
        category: input.category ?? 'General', note: input.note ?? '',
      });
      audit('u-admin', 'chem.equation_saved', input.equation);
    }
    persist('chemData');
  },
  removeEquation(id: string) {
    db.chemData.equations = db.chemData.equations.filter((e) => e.id !== id);
    audit('u-admin', 'chem.equation_deleted', id);
    persist('chemData');
  },
  constants: () => db.chemData.constants,
  saveConstant(input: { id?: string; name: string; value: number; unit?: string; note?: string }) {
    if (input.id) {
      const c = db.chemData.constants.find((x) => x.id === input.id);
      if (c) Object.assign(c, input);
    } else {
      db.chemData.constants.push({
        id: `c-${Date.now().toString(36)}`, name: input.name,
        value: input.value, unit: input.unit ?? '', note: input.note ?? '',
      });
      audit('u-admin', 'chem.constant_saved', input.name);
    }
    persist('chemData');
  },
  removeConstant(id: string) {
    db.chemData.constants = db.chemData.constants.filter((c) => c.id !== id);
    audit('u-admin', 'chem.constant_deleted', id);
    persist('chemData');
  },
  /** Reset chemistry data back to the seeded defaults (elements.ts + presets). */
  resetChemData() {
    const fresh = createDatabaseFreshChem();
    db.chemData.elements = fresh.elements;
    db.chemData.equations = fresh.equations;
    db.chemData.constants = fresh.constants;
    audit('u-admin', 'chem.reset', 'Chemistry data reset to defaults');
    persist('chemData');
  },
};

/** Fresh copy of the seeded chemistry data (used by the reset action). */
function createDatabaseFreshChem() {
  return createDatabaseFresh().chemData;
}

/* --------------------------------- videos ---------------------------------- */
/**
 * Video library — admins/teachers upload videos (stored as base64 data URLs
 * in Supabase, so they are permanent and survive reloads). Videos can be
 * linked to a course/lesson or kept as standalone library content.
 */
export const videosApi = {
  list() {
    return [...db.videos].sort((a, b) => b.at.localeCompare(a.at));
  },
  byId(id: string) {
    return db.videos.find((v) => v.id === id);
  },
  forCourse(courseId: string) {
    return db.videos.filter((v) => v.courseId === courseId);
  },
  forLesson(lessonId: string) {
    return db.videos.filter((v) => v.lessonId === lessonId);
  },
  /**
   * Upload (or update) a video. The file is preferably stored in Supabase
   * Storage (`storagePath`/`storageUrl`); if Storage is unavailable it falls
   * back to a base64 `dataUrl`. `storageProvider` records which was used.
   */
  save(input: {
    id?: string; title: string; description?: string; category?: string;
    courseId?: string; lessonId?: string;
    storagePath?: string; storageUrl?: string; dataUrl?: string;
    storageProvider: 'storage' | 'base64';
    sizeBytes: number; mimeType: string;
  }, actorId: string): Video {
    const video: Video = {
      id: input.id ?? `vid-${Date.now().toString(36)}`,
      title: input.title,
      description: input.description ?? '',
      category: input.category ?? 'General',
      courseId: input.courseId,
      lessonId: input.lessonId,
      storagePath: input.storagePath,
      storageUrl: input.storageUrl,
      dataUrl: input.dataUrl,
      storageProvider: input.storageProvider,
      sizeBytes: input.sizeBytes,
      mimeType: input.mimeType,
      uploadedBy: actorId,
      at: new Date().toISOString(),
    };
    const idx = db.videos.findIndex((v) => v.id === video.id);
    if (idx >= 0) db.videos[idx] = video;
    else db.videos.push(video);
    audit(actorId, 'video.uploaded', video.title);
    persist('videos');
    return video;
  },
  /** Resolve the playable URL for a video (storage preferred, base64 fallback). */
  playableUrl(v: Video): string {
    return v.storageUrl ?? v.dataUrl ?? '';
  },
  /** Admin: delete a video and its stored object. */
  remove(id: string, actorId: string): void {
    const v = db.videos.find((x) => x.id === id);
    db.videos = db.videos.filter((x) => x.id !== id);
    if (v?.storagePath) {
      // Best-effort object cleanup (fire-and-forget).
      void deleteFromStorage(v.storagePath).catch(() => {});
    }
    audit(actorId, 'video.deleted', v?.title ?? id);
    persist('videos');
  },
};

/* ------------------------------- deliverable studio ------------------------- */
/**
 * Deliverable Studio (file extraction / generation).
 *
 * The teacher stores the master prompt once, uploads base/template files and a
 * lesson file, then presses "Generate". The actual deliverable generation is
 * executed by the agent (via Arena) following the master prompt's interactive
 * wizard. This service persists the prompt, the files and the job records so
 * everything is permanent and reproducible.
 */
const MASTER_PROMPT_ID = 'master-prompt';

/** Upload a file to the studio (Supabase Storage preferred, base64 fallback). */
async function uploadStudioFile(folder: 'base' | 'lesson', file: File): Promise<StudioFile> {
  try {
    const path = `${folder}/${Date.now().toString(36)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { path: storedPath, url } = await uploadToStorage(path, file, file.type || 'application/octet-stream');
    return {
      id: `sf-${Date.now().toString(36)}`, folder, name: file.name,
      storagePath: storedPath, storageUrl: url, storageProvider: 'storage',
      sizeBytes: file.size, mimeType: file.type || 'application/octet-stream',
      at: new Date().toISOString(),
    };
  } catch {
    const dataUrl = await readAsDataUrl(file);
    return {
      id: `sf-${Date.now().toString(36)}`, folder, name: file.name,
      dataUrl, storageProvider: 'base64',
      sizeBytes: file.size, mimeType: file.type || 'application/octet-stream',
      at: new Date().toISOString(),
    };
  }
}

export const deliverableApi = {
  /* ---- master prompt ---- */
  getMasterPrompt(): MasterPromptConfig | undefined {
    return db.deliverables.find((d): d is MasterPromptConfig => (d as MasterPromptConfig).id === MASTER_PROMPT_ID);
  },
  saveMasterPrompt(text: string, actorId: string): MasterPromptConfig {
    const cfg: MasterPromptConfig = {
      id: MASTER_PROMPT_ID, prompt: text, updatedBy: actorId, updatedAt: new Date().toISOString(),
    };
    const idx = db.deliverables.findIndex((d) => (d as MasterPromptConfig).id === MASTER_PROMPT_ID);
    if (idx >= 0) db.deliverables[idx] = cfg;
    else db.deliverables.push(cfg);
    audit(actorId, 'deliverable.master_prompt_saved', `${text.length} chars`);
    persist('deliverables');
    return cfg;
  },

  /* ---- studio files ---- */
  /** Upload a file into the studio (folder: 'base' or 'lesson'). */
  async uploadFile(folder: 'base' | 'lesson', file: File, actorId: string): Promise<StudioFile> {
    const sf = await uploadStudioFile(folder, file);
    db.deliverables.push(sf);
    audit(actorId, 'deliverable.file_uploaded', `${folder}/${sf.name}`);
    persist('deliverables');
    return sf;
  },
  /** List studio files for a folder. */
  files(folder: 'base' | 'lesson'): StudioFile[] {
    return db.deliverables
      .filter((d): d is StudioFile => 'folder' in d && d.id.startsWith('sf-') && d.folder === folder)
      .sort((a, b) => b.at.localeCompare(a.at));
  },
  /** All base + lesson files together. */
  allFiles(): StudioFile[] {
    return db.deliverables.filter((d): d is StudioFile => d.id.startsWith('sf-'));
  },
  /** Delete a studio file (and its stored object if applicable). */
  removeFile(id: string, actorId: string): void {
    const f = db.deliverables.find((d): d is StudioFile => d.id === id);
    if (!f) return;
    if (f.storagePath) void deleteFromStorage(f.storagePath).catch(() => {});
    db.deliverables = db.deliverables.filter((d) => d.id !== id);
    audit(actorId, 'deliverable.file_deleted', f.name);
    persist('deliverables');
  },

  /* ---- jobs ---- */
  listJobs(): DeliverableJob[] {
    return db.deliverables
      .filter((d): d is DeliverableJob => d.id.startsWith('job-'))
      .sort((a, b) => b.at.localeCompare(a.at));
  },
  job(id: string): DeliverableJob | undefined {
    return db.deliverables.find((d): d is DeliverableJob => d.id === id);
  },
  /** Create a generation job when the teacher presses "Generate". */
  createJob(input: {
    type: DeliverableType; title: string; notes: string;
    baseFileIds: string[]; lessonFileIds: string[]; actorId: string;
  }): DeliverableJob {
    const job: DeliverableJob = {
      id: `job-${Date.now().toString(36)}`,
      type: input.type, title: input.title, notes: input.notes,
      baseFileIds: input.baseFileIds, lessonFileIds: input.lessonFileIds,
      status: 'running', progress: 0, stage: 'Starting…', progressLog: [],
      createdBy: input.actorId, at: new Date().toISOString(),
    };
    db.deliverables.push(job);
    audit(input.actorId, 'deliverable.job_created', `${input.type}: ${input.title}`);
    persist('deliverables');
    return job;
  },
  /** Update a job's status / notes / progress / stage (used as the wizard progresses). */
  updateJob(id: string, patch: Partial<Pick<DeliverableJob, 'status' | 'notes' | 'title' | 'progress' | 'type' | 'stage'>>, actorId: string): void {
    const job = db.deliverables.find((d): d is DeliverableJob => d.id === id);
    if (!job) return;
    Object.assign(job, patch);
    audit(actorId, 'deliverable.job_updated', `${id}: ${patch.status ?? `${patch.progress ?? ''}%`}`);
    persist('deliverables');
  },
  /**
   * Report progress for a running job — updates the percentage, the current
   * stage description, and appends a step to the progress log. This is the
   * method the agent calls as it executes, so the UI shows live progress and
   * what is happening step by step.
   */
  updateJobProgress(id: string, progress: number, stage: string, logText?: string, actorId = 'u-admin'): void {
    const job = db.deliverables.find((d): d is DeliverableJob => d.id === id);
    if (!job) return;
    job.progress = Math.max(0, Math.min(100, progress));
    job.stage = stage;
    if (logText) {
      job.progressLog.push({ text: logText, at: new Date().toISOString() });
    }
    audit(actorId, 'deliverable.job_progress', `${id}: ${job.progress}% — ${stage}`);
    persist('deliverables');
  },
  /** Cancel a running job (sets status to 'cancelled', freezes progress). */
  cancelJob(id: string, actorId: string): void {
    const job = db.deliverables.find((d): d is DeliverableJob => d.id === id);
    if (!job) return;
    job.status = 'cancelled';
    audit(actorId, 'deliverable.job_cancelled', `${id}: ${job.title}`);
    persist('deliverables');
  },

  /* ---- generated result files ---- */
  /**
   * Save a generated deliverable file (the produced exam/quiz/etc.) and link
   * it to its job. Stored in Supabase Storage (permanent), with base64
   * fallback. Accepts a real File or a plain {name, dataUrl, ...} payload.
   */
  async saveResultFile(jobId: string, file: File | { name: string; dataUrl: string; mimeType: string; sizeBytes: number }): Promise<DeliverableResult> {
    let result: DeliverableResult;
    const isBlob = typeof Blob !== 'undefined' && (file instanceof Blob);
    if (isBlob) {
      try {
        const path = `results/${Date.now().toString(36)}-${(file as File).name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { path: storedPath, url } = await uploadToStorage(path, file, (file as File).type || 'application/octet-stream');
        result = {
          id: `res-${Date.now().toString(36)}`, jobId, name: (file as File).name,
          storagePath: storedPath, storageUrl: url, storageProvider: 'storage',
          sizeBytes: (file as File).size, mimeType: (file as File).type || 'application/octet-stream',
          at: new Date().toISOString(),
        };
      } catch {
        const dataUrl = await readAsDataUrl(file);
        result = {
          id: `res-${Date.now().toString(36)}`, jobId, name: (file as File).name,
          dataUrl, storageProvider: 'base64',
          sizeBytes: (file as File).size, mimeType: (file as File).type || 'application/octet-stream',
          at: new Date().toISOString(),
        };
      }
    } else {
      const p = file as { name: string; dataUrl: string; mimeType: string; sizeBytes: number };
      result = {
        id: `res-${Date.now().toString(36)}`, jobId, name: p.name,
        dataUrl: p.dataUrl, storageProvider: 'base64',
        sizeBytes: p.sizeBytes, mimeType: p.mimeType, at: new Date().toISOString(),
      };
    }
    db.deliverables.push(result);
    audit('u-admin', 'deliverable.result_saved', `${jobId}: ${result.name}`);
    persist('deliverables');
    return result;
  },
  /** List result files for a job. */
  resultsForJob(jobId: string): DeliverableResult[] {
    return db.deliverables
      .filter((d): d is DeliverableResult => 'jobId' in d && d.id.startsWith('res-') && d.jobId === jobId)
      .sort((a, b) => b.at.localeCompare(a.at));
  },
  /** All result files (latest first). */
  allResults(): DeliverableResult[] {
    return db.deliverables
      .filter((d): d is DeliverableResult => d.id.startsWith('res-'))
      .sort((a, b) => b.at.localeCompare(a.at));
  },
  /** Resolve the download URL for a result file (storage preferred). */
  resultUrl(r: DeliverableResult): string {
    return r.storageUrl ?? r.dataUrl ?? '';
  },
  /** Delete a result file (and its stored object if applicable). */
  removeResult(id: string, actorId: string): void {
    const r = db.deliverables.find((d): d is DeliverableResult => d.id === id);
    if (!r) return;
    if (r.storagePath) void deleteFromStorage(r.storagePath).catch(() => {});
    db.deliverables = db.deliverables.filter((d) => d.id !== id);
    audit(actorId, 'deliverable.result_deleted', r.name);
    persist('deliverables');
  },
};

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
    for (const key of ['users','curricula','grades','classes','topics','learningOutcomes','courses','lessons','questions','quizzes','assignments','submissions','gradebook','attendance','liveSessions','messages','announcements','notifications','settings','chemData']) {
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
