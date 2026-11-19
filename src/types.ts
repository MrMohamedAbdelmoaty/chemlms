/**
 * Domain models for ChemLMS.
 * These interfaces mirror the REST API contract a real backend would expose
 * (users, roles, parent-student links, curricula, grades, classes, courses,
 * lessons, questions, quizzes, submissions, gradebook, attendance,
 * live_sessions, messages, announcements, notifications, audit_logs).
 */

export type Role = 'admin' | 'teacher' | 'student' | 'parent';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarColor: string; // initials background token
  status: 'active' | 'suspended';
  /**
   * PBKDF2 password hash (`pbkdf2$iterations$salt$hash`). Passwords are never
   * stored in plain text — login re-derives the hash and compares.
   */
  passwordHash: string;
  /** Optional phone number for registration/login by phone. */
  phone?: string;
  /** Whether the email has been confirmed. */
  emailConfirmed: boolean;
  /** Whether the phone has been confirmed. */
  phoneConfirmed: boolean;
  /** Pending email-confirmation token (cleared once confirmed). */
  emailToken?: string;
  /** Pending phone-confirmation token (cleared once confirmed). */
  phoneToken?: string;
  /** Parent -> linked student ids */
  children?: string[];
  /** Student -> linked parent/guardian ids */
  guardians?: string[];
  /** Teacher -> assigned class ids */
  classIds?: string[];
  /** Student -> class ids (homeroom classes) */
  studentClassIds?: string[];
}

export interface Curriculum {
  id: string;
  name: string; // e.g. "Egyptian National (English Track)"
  code: string;
  color: string; // tailwind accent class suffix
  description: string;
  examStyle: string;
  gradeIds: string[];
}

export interface Grade {
  id: string;
  curriculumId: string;
  name: string; // e.g. "Grade 11"
  order: number;
}

export interface SchoolClass {
  id: string;
  name: string;
  gradeId: string;
  curriculumId: string;
  teacherId: string;
  studentIds: string[];
}

export interface Topic {
  id: string;
  curriculumId: string;
  unit: string;
  name: string; // e.g. "Stoichiometry"
}

export interface LearningOutcome {
  id: string;
  curriculumId: string;
  topicId: string;
  code: string; // e.g. "LO-STOC-03"
  text: string;
}

export interface Resource {
  type: 'video' | 'pdf' | 'slides' | 'link';
  title: string;
  url: string;
  durationMin?: number;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  summary: string;
  content: string; // short markdown-ish text shown in the player
  topicId: string;
  loIds: string[];
  resources: Resource[];
  recordedMinutes: number;
  order: number;
}

export type CourseProgressMap = Record<string, number>; // lessonId -> % watched

export interface Course {
  id: string;
  classId: string;
  curriculumId: string;
  subject: string;
  title: string;
  description: string;
  teacherId: string;
  lessonIds: string[];
}

export type QuestionType =
  | 'mcq'
  | 'truefalse'
  | 'fill'
  | 'matching'
  | 'balance'
  | 'numeric'
  | 'graph'
  | 'essay';

export type BloomLevel =
  | 'Remember'
  | 'Understand'
  | 'Apply'
  | 'Analyze'
  | 'Evaluate'
  | 'Create';

export interface NumericAnswer {
  value: number;
  unit: string;
  sigfigs: number;
  tolerance: number; // fractional tolerance, e.g. 0.01 = 1%
  accepts: string[]; // raw accepted strings (variants)
}

export interface MatchingAnswer {
  pairs: { left: string; right: string }[];
}

export interface BalanceAnswer {
  equation: string; // as displayed, e.g. "Fe + O2 -> Fe2O3"
  coefficients: number[]; // expected coefficients in compound order
}

export interface Question {
  id: string;
  curriculumId: string;
  topicId: string;
  loIds: string[];
  difficulty: BloomLevel;
  type: QuestionType;
  stem: string;
  /** MCQ/matching/graph options */
  options?: string[];
  /**
   * Expected answer. Type depends on question.type:
   *  mcq       -> string (option index or text)
   *  truefalse -> 'true' | 'false'
   *  fill      -> string | string[] (accepted variants)
   *  matching  -> MatchingAnswer
   *  balance   -> BalanceAnswer
   *  numeric   -> NumericAnswer
   *  graph     -> string (option index or text)
   *  essay     -> '' (manual grading only)
   */
  answer: string | string[] | MatchingAnswer | NumericAnswer | BalanceAnswer;
  explanation: string;
  points: number;
  /** Optional graph data for graph-interpretation questions */
  data?: { graph?: { labels: string[]; series: { name: string; values: number[] }[] } };
}

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description: string;
  questionIds: string[];
  timeLimitMin: number;
  deadline: string; // ISO date
  attempts: number;
  randomize: boolean;
  published: boolean;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  deadline: string;
  maxScore: number;
  type: 'file' | 'text';
}

export type SubmissionStatus = 'submitted' | 'graded' | 'late' | 'missing' | 'returned';

export interface Submission {
  id: string;
  assessmentId: string; // quiz id or assignment id
  assessmentKind: 'quiz' | 'assignment';
  classId: string;
  studentId: string;
  answers: Record<string, unknown>; // questionId -> student answer
  score: number | null; // null until auto/manual graded
  maxScore: number;
  feedback: string;
  submittedAt: string;
  status: SubmissionStatus;
}

export interface GradebookEntry {
  id: string;
  classId: string;
  studentId: string;
  assessmentId: string;
  title: string;
  type: 'quiz' | 'assignment' | 'lab' | 'exam';
  score: number | null; // null when not yet graded / missing
  maxScore: number;
  date: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface AttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
}

export interface LiveSession {
  id: string;
  classId: string;
  title: string;
  start: string; // ISO datetime
  durationMin: number;
  platform: 'zoom' | 'google-meet' | 'jitsi';
  link: string;
  teacherId: string;
  joinedStudentIds: string[]; // auto-marked attendance on join
}

export interface Message {
  id: string;
  fromId: string;
  toId: string;
  content: string;
  at: string;
  read: boolean;
}

export interface AnnouncementTargets {
  roles: Role[];
  gradeIds: string[];
  classIds: string[];
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  targets: AnnouncementTargets;
  at: string;
  byId: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'absence' | 'late' | 'grade' | 'assignment' | 'exam' | 'announcement' | 'message' | 'meeting';
  title: string;
  body: string;
  at: string;
  read: boolean;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  detail: string;
  at: string;
}

export interface SchoolSettings {
  name: string;
  logoText: string;
  primaryColor: 'indigo' | 'teal' | 'amber' | 'rose';
  defaultLanguage: 'en' | 'ar';
  theme: 'light' | 'dark';
}

/** In-memory "database" shape — the mock backend. */
export interface Database {
  users: User[];
  curricula: Curriculum[];
  grades: Grade[];
  classes: SchoolClass[];
  topics: Topic[];
  learningOutcomes: LearningOutcome[];
  courses: Course[];
  lessons: Lesson[];
  questions: Question[];
  quizzes: Quiz[];
  assignments: Assignment[];
  submissions: Submission[];
  gradebook: GradebookEntry[];
  attendance: AttendanceRecord[];
  liveSessions: LiveSession[];
  messages: Message[];
  announcements: Announcement[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  settings: SchoolSettings;
  /** Parent-student links (explicit link table, one row per guardian link) */
  parentStudentLinks: { parentId: string; studentId: string }[];
  /** Lesson progress per student (demo-only convenience store) */
  progress: Record<string, CourseProgressMap>;
}

/** Auth result returned by the mock auth service. */
export interface AuthResult {
  ok: boolean;
  user?: User;
  error?: string;
}
