# ChemLMS — Chemistry-Focused School E-Learning Platform

A multi-curriculum, role-based LMS with chemistry-specific tools, built with
**React + TypeScript + Tailwind CSS**. It ships with a complete in-memory mock
backend behind a service layer, so the whole product is clickable and demo-ready
without a server. The data access is isolated in `src/services/`, so a real REST
API can be plugged in later without touching any UI.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 (live preview on 0.0.0.0)
npm run build    # type-check + production build
npm run preview  # serve the production build
```

## Demo accounts (one-click on the login screen)

| Role    | Email                 | Password     |
|---------|-----------------------|--------------|
| Admin   | admin@chemlms.edu     | `admin123`   |
| Teacher | lena@chemlms.edu      | `teacher123` |
| Student | student1@chemlms.edu  | `student123` |
| Parent  | parent3@chemlms.edu   | `parent123`  |

## What is implemented

### 1. Platform basics
- English (LTR) primary with a full **Arabic (RTL) toggle**; **light/dark mode**;
  responsive layout; WCAG-AA focus styles and semantic landmarks.
- Four roles with enforced permissions: **Admin, Teacher, Student, Parent**.
  Every service function is role-scoped (data isolation).
- Role-based login with demo accounts.

### 2. Multi-curriculum support
- 3 seeded curricula: **Egyptian National (English track)**, **American Diploma /
  SAT / AP**, **IGCSE / A-Level**, each with grades, topics, learning outcomes
  (LOs) and exam styles. Admins can create custom curricula.
- Classes and courses are linked to curricula; every lesson and question is
  tagged with curriculum, topic, LO and Bloom difficulty.

### 3. Admin dashboard
- Overview stats (students, teachers, parents, classes, attendance rate, avg grades).
- Curriculum & grade management, class/section creation, teacher assignment.
- User management: add / edit / suspend, **bulk CSV import**, parent–student
  linking (one parent → many children, one student → many guardians).
- Timetable & exam schedule, school-wide **announcements** (targetable by role,
  grade or class), **reports with CSV export** (grades, attendance, performance
  by class/curriculum) + printable PDF, **audit log**, and school settings
  (logo, primary color, theme).

### 4. Teacher dashboard
- **Course builder**: units, lessons, resources (video/PDF/slides/links).
- **Lesson player** with progress memory, notes and bookmarks.
- **Live classes**: schedule Zoom / Google Meet / Jitsi sessions; student join
  auto-marks attendance.
- **Question bank** tagged by curriculum, topic, LO, Bloom level.
- Quizzes/exams/assignments with deadlines, time limits, randomization,
  auto-grading + manual grading with feedback.
- Gradebook per class, attendance sheet, **LO analytics** (weak topics per
  class and per student), messaging with students/parents, **printable
  worksheets/exam papers with answer keys**.

### 5. Student dashboard
- Home with courses, live classes, deadlines, notifications, progress.
- Lesson player with resume, notes; quizzes/assignments with uploads, grades,
  feedback; live-class join; weak-area insights by LO; gamification (points,
  badges, streaks); completion **certificates**; messaging with own teachers only.

### 6. Parent dashboard
- **Child switcher** supporting multiple children; strictly **read-only**
  academic views (no grading, submissions or quizzes).
- Per child: grades, assignment status, exams, attendance, live schedule,
  teacher feedback, progress trend, weak topics, report card / certificate
  download, automatic notifications, messaging with own children's teachers,
  meeting requests, screen-time/notification preferences (mock).

### 7. Chemistry tools (core)
1. **Interactive periodic table** — all 118 elements, category filters, trend
   heat-maps (electronegativity, mass, radius), search, electron configuration
   and properties on click.
2. **Chemical notation** — KaTeX + mhchem `\ce{}` for formulas, ionic charges,
   equations, state symbols, with a live playground.
3. **Equation balancer** — exact rational Gaussian elimination, step-by-step
   working (atom counts + matrix), verified on 9 classic equations.
4. **Calculators** — moles/molar mass, molarity, stoichiometry, gas laws, all
   with step-by-step working.
5. **3D molecule viewer** — drag-to-rotate ball-and-stick canvas renderer with
   8 molecules (H₂O, CO₂, CH₄, NH₃, C₂H₄, C₆H₆, O₂, NaCl).
6. **Virtual lab** — titration (live pH curve, equivalence point, indicator
   choice), interactive pH scale, reaction-rate explorer — all with data tables.
7. **Lab safety** — 9 GHS pictograms, safety rules, and a pass-required quiz.
8. **Chemistry question types** — MCQ, true/false, fill-in-the-blank,
   matching, balance-the-equation, numerical with units & significant figures,
   graph interpretation, essay/CER.
9. **Smart auto-grading** — accepts formula variants, unit equivalents
   (mol/mmol, g/kg/mg, L/mL, atm/kPa/mmHg, K/°C), fractional tolerance and
   sig-fig checks; essays routed to manual grading.

### 8. Security & safety (demo-level)
- Password hashing is **mocked** (documented in the code); audit log records
  logins, mutations, messaging. Students message only their own teachers;
  parents message only their children's teachers; Admin sees all messages for
  moderation. Parent/student data isolation enforced in the service layer.

## Seed data
3 curricula · 5 classes · 1 admin · 3 teachers · 20 students · 12 parents
(some with multiple children) · 8 chemistry lessons per course · 35 tagged
questions · quizzes, assignments, grades, attendance, live sessions, messages,
announcements, notifications and audit logs. Deterministic seeded RNG —
"Reset demo data" in Admin settings restores the seed.

## Architecture

```
src/
  types.ts                  # domain models (the REST contract)
  data/seed.ts              # in-memory seed data
  data/elements.ts          # periodic table dataset + config builder
  services/db.ts            # mutable in-memory database (swap point)
  services/api.ts           # role-scoped service layer (backend-ready)
  services/grading.ts       # chemistry-aware auto-grading engine
  context/AppContext.tsx    # auth, theme, i18n, toasts
  i18n/index.ts             # en / ar dictionaries
  components/               # UI primitives, charts, app shell
  features/
    chem/                   # periodic table, balancer, calculators, molecules,
                             # virtual lab, lab safety, KaTeX renderer
    auth/Login.tsx
    Messaging.tsx           # role-scoped messaging + contact rules
    QuizRunner.tsx          # all 8 question types + grading + results
    admin/  teacher/  student/  parent/   # the four dashboards
  App.tsx                   # role routing & navigation
```

## What is mocked vs. real

**Mocked (in-memory, no server):** persistence, authentication (plain
credentials), live-class links, file uploads, notifications generation,
gamification backends, PDF generation (print-to-PDF via the browser), and
simulated analytics derived from seeded data.

**Real, fully functional:** all UI, role permissions and data isolation,
curriculum/lesson/question/quiz management flows, the complete chemistry
engine (periodic table, notation, balancer, calculators, molecule viewer,
virtual labs, safety quiz), auto-grading, gradebook/attendance editing,
messaging, announcements, reports export and the audit trail.

## Next steps (plugging in a real backend)
1. Replace `src/services/db.ts` + `src/services/api.ts` bodies with `fetch()`
   calls to the REST API; the domain models in `src/types.ts` already define
   the contract.
2. Add real auth (hashed passwords, sessions/JWT, optional 2FA) and server-side
   row-level authorization mirroring `contactsFor()`.
3. Persist lessons/resources to a CDN or object storage; wire real Zoom/Meet/
   Jitsi meeting creation.
4. Replace print-based PDF/CSV export with a report service; add real
   attendance webhooks and notification channels.
