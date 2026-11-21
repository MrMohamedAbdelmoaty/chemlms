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
  /** Uploaded file for a file-type assignment (base64 data URL — permanent). */
  file?: AssignmentFile;
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

/**
 * Uploaded video — stored as a base64 data URL inside the Supabase store so
 * the file is permanent (survives reloads, never expires). Videos are uploaded
 * by admins/teachers and can be linked to a course or lesson.
 */
export interface Video {
  id: string;
  title: string;
  description: string;
  category: string; // e.g. 'Titration', 'Lab safety', 'Stoichiometry'
  courseId?: string;
  lessonId?: string;
  /** Supabase Storage object path (primary — supports large files). */
  storagePath?: string;
  /** Public URL of the stored object (derived from storagePath). */
  storageUrl?: string;
  /** Base64 data URL — fallback when Storage is not configured. */
  dataUrl?: string;
  /** Which storage mechanism holds the file. */
  storageProvider: 'storage' | 'base64';
  sizeBytes: number;
  mimeType: string;
  uploadedBy: string;
  at: string;
}

/**
 * Uploaded assignment file — a student's submission for a file-type assignment.
 * Stored as a base64 data URL so the uploaded file is permanent and the teacher
 * can download/review it.
 */
export interface AssignmentFile {
  name: string;
  /** Supabase Storage object path (primary — supports large files). */
  storagePath?: string;
  /** Public URL of the stored object (derived from storagePath). */
  storageUrl?: string;
  /** Base64 data URL — fallback when Storage is not configured. */
  dataUrl?: string;
  /** Which storage mechanism holds the file. */
  storageProvider: 'storage' | 'base64';
  sizeBytes: number;
  mimeType: string;
}

/**
 * Deliverable Studio — files uploaded to the "file extraction / deliverable
 * generation" studio. The teacher uploads base/template files (PDFs, etc.) and
 * a lesson file; these are fed to the master prompt when a deliverable is
 * generated. Stored in Supabase Storage (permanent) with base64 fallback.
 */
export interface StudioFile {
  id: string;
  /** Bucket folder: 'base' for template/base files, 'lesson' for lesson content. */
  folder: 'base' | 'lesson';
  name: string;
  /** Supabase Storage object path (primary — supports large files). */
  storagePath?: string;
  /** Public URL of the stored object (derived from storagePath). */
  storageUrl?: string;
  /** Base64 data URL — fallback when Storage is not configured. */
  dataUrl?: string;
  /** Which storage mechanism holds the file. */
  storageProvider: 'storage' | 'base64';
  sizeBytes: number;
  mimeType: string;
  at: string;
}

/** Deliverable types supported by the studio (maps to the master prompt wizard). */
export type DeliverableType =
  | 'summary'        // [A] Comprehensive Summary
  | 'worksheet'      // [B] Lesson Worksheet
  | 'quiz'           // [C] Lesson Quiz (20 Marks)
  | 'exam'           // [D] Unit Exam (40 Marks)
  | 'lesson-plan'    // [E] Professional Lesson Plan
  | 'full-package'   // [F] Full Lesson Package
  | 'booklet'        // [H] Final Revision Booklet
  | 'night-revision'; // [I] Exam-Night Revision

export type DeliverableJobStatus = 'draft' | 'ready' | 'running' | 'delivered' | 'cancelled';

/**
 * A deliverable-generation job — created when the teacher presses "Generate".
 * The job captures the chosen deliverable type, the attached base files and
 * lesson file, and the handoff notes. The actual generation is executed by the
 * agent (via Arena) following the master prompt, and the status + progress are
 * updated as the wizard progresses (0–100). `stage` shows what is happening now
 * and `progressLog` keeps the completed steps, so the UI can show live progress
 * and what the agent is currently doing.
 */
export interface DeliverableJob {
  id: string;
  type: DeliverableType;
  title: string;
  baseFileIds: string[];
  lessonFileIds: string[];
  notes: string;
  status: DeliverableJobStatus;
  /** Progress 0–100, updated as the agent executes the wizard. */
  progress: number;
  /** Human-readable description of the current step (what is happening now). */
  stage: string;
  /** Completed steps log, oldest first — shown to track progress step by step. */
  progressLog: { text: string; at: string }[];
  createdBy: string;
  at: string;
}

/**
 * The master prompt — the fixed prompt that drives all deliverable generation.
 * Stored once and reused for every job. Visible/editable to admins only.
 */
export interface MasterPromptConfig {
  id: string;        // fixed id 'master-prompt'
  prompt: string;
  updatedBy: string;
  updatedAt: string;
}

/**
 * A generated deliverable result file — produced when a job is delivered.
 * Stored in Supabase (permanent) and linked to its job, with a download link
 * in the studio. The master prompt drives generation; this holds the output.
 */
export interface DeliverableResult {
  id: string;
  jobId: string;
  name: string;
  /** Supabase Storage object path (primary — supports large files). */
  storagePath?: string;
  /** Public URL of the stored object (derived from storagePath). */
  storageUrl?: string;
  /** Base64 data URL — fallback when Storage is not configured. */
  dataUrl?: string;
  /** Which storage mechanism holds the file. */
  storageProvider: 'storage' | 'base64';
  sizeBytes: number;
  mimeType: string;
  at: string;
}

/**
 * Editable chemistry reference data — the admin can add / edit / delete
 * elements, preset equations and constants so the chemistry tools respond to
 * real platform data instead of a static dataset.
 */
export interface ChemEquationEntry {
  id: string;
  equation: string; // e.g. "Fe + O2 -> Fe2O3"
  category: string; // e.g. "Combustion", "Acid-base"
  note?: string;
}

export interface ChemConstantEntry {
  id: string;
  name: string; // e.g. "R (gas constant)"
  value: number;
  unit: string; // e.g. "J/mol·K"
  note?: string;
}

export interface ChemData {
  elements: { z: number; symbol: string; name: string; mass: number; category: string; block: 's' | 'p' | 'd' | 'f'; electronegativity: number; radiusPm: number; phase: 'solid' | 'liquid' | 'gas' }[];
  equations: ChemEquationEntry[];
  constants: ChemConstantEntry[];
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
  /** Editable chemistry reference data (elements, equations, constants) */
  chemData: ChemData;
  /** Uploaded videos (base64 data URLs — permanent, in Supabase) */
  videos: Video[];
  /** Deliverable Studio: master prompt, base/lesson files, jobs and results */
  deliverables: (StudioFile | DeliverableJob | MasterPromptConfig | DeliverableResult)[];
}

/** Auth result returned by the mock auth service. */
export interface AuthResult {
  ok: boolean;
  user?: User;
  error?: string;
}
