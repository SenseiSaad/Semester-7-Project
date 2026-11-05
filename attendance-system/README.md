# AttendWise — Student Attendance & Exam Eligibility System

A complete, standalone attendance and exam-eligibility portal. **One folder is
the whole project**: React on the front, a pure-JS "backend" (business logic
modules) inside the same app, data persisted in the browser. Push this folder
to Vercel and it works — no server, no database, no environment variables.

**Demo accounts (pre-filled on the sign-in screen — just press the button):**

| Role | Email | Password |
|------|-------|----------|
| Instructor (admin) | `teacher@uni.edu` | `teach1234` |
| Students | `2022-cs-001@uni.edu` … `2022-cs-012@uni.edu` | `study1234` |

---

## Quick start

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # 25 unit tests (vitest)
npm run build      # production build → dist/
```

## Deploy to Vercel

1. Push this folder to GitHub and import it at vercel.com.
2. Framework preset: **Vite** (auto-detected). No other settings needed.
3. Deploy. `vercel.json` rewrites all routes to `index.html` for the router,
   and demo data is created on first load — the deployed app works immediately.

## Pages

| Route | Who | What |
|-------|-----|------|
| `/` | everyone | Landing page: what the project is, the student portal, teacher authority, violations & effects, terms & conditions, demo accounts |
| `/guide` | everyone | **How-to walkthrough with a Student ↔ Instructor toggle** — every feature explained step by step in easy wording |
| `/login` | everyone | Role toggle with pre-filled demo credentials — one click to sign in |
| `/t/*` | instructor | Dashboard, courses & thresholds, roster, session screen with join QR, manual editor, violations log, eligibility report + CSV |
| `/s/*` | student | Dashboard, scan, history, alerts |
| `/scan` | student | Target of the session join QR; spends the student's one-time token |

## What each role can do

### Student portal
- **Dashboard** — overall percentage; per-course card with percentage, progress
  bar against that course's threshold, missed classes, and the
  eligible / not-eligible verdict. Updates the moment anything changes.
- **Scan** — while a session is open, one tap spends the student's unique
  one-time QR token and marks present. A second attempt marks nothing and logs
  a violation.
- **History** — every record: date, course, status, method (QR / CSV / manual).
- **Alerts** — the student's violation record with plain-language explanations.

### Instructor (single admin — full authority)
- **Courses & thresholds** — per-course eligibility threshold (1–99); changing
  it reclassifies every student instantly.
- **Rosters & accounts** — add students; the app creates their sign-in.
- **Sessions** — open (issues one token per enrolled student, shows a join QR)
  and close. One open session per course; the app blocks and explains a second.
- **Three marking methods** — student QR tokens, manual checklist, CSV upload
  (`rollNo,status` rows; unknown students skipped with reasons, wrong statuses
  reported, duplicates for the session blocked). All write one record store.
- **Manual editor + admin override** — correct any record; closed sessions are
  frozen for students and editable only behind an explicit override.
- **Violations log** — split into *Escalated* and *Warnings (not escalated)*.
- **Eligibility report** — filter chips, search, missed counts, CSV export
  (formula-injection safe).

### Violations & the good-standing policy
A violation is a rejected attempt to reuse an already-spent session QR token.
The scan never double-counts; the attempt is logged with student, course,
session and timestamp. Effects depend on standing:

- **Warning (private)** — first violation in a course by a student currently
  *eligible* in it. Visible only in the student's Alerts, plus a clearly
  marked "not escalated" section of the teacher's log. **Never sent to the
  instructor as a violation.**
- **Escalated** — a repeat violation in the same course, or any violation by a
  student below that course's threshold. Appears in the instructor's log.

The policy ships on the landing page (Terms & conditions) and is enforced in
code (`src/logic/policy.js`), not just in copy.

---

## Architecture — the backend lives inside the frontend

```
├── index.html                     entry (applies saved theme before first paint)
├── vercel.json                    SPA rewrite for client-side routing
└── src/
    ├── logic/                     ← the "backend": pure, testable, no UI code
    │   ├── storage.js             swappable persistence driver (localStorage / memory)
    │   ├── seed.js                demo data: 12 students, 4 courses, 40 sessions, violations
    │   ├── auth.js                login by role, session persistence
    │   ├── eligibility.js         percentage, verdicts, summaries, CSV export
    │   ├── attendance.js          marking rules, duplicate prevention, violations
    │   ├── qr.js                  one-time token generation & redemption
    │   ├── csv.js                 parse + validate attendance CSV
    │   ├── courses.js             course / roster / session management
    │   ├── policy.js              good-standing warning vs escalation
    │   └── __tests__/             25 unit tests (vitest)
    ├── pages/                     React screens (talk only to logic/)
    ├── ThemeToggle.jsx            light / dark switch
    └── index.css                  design tokens as CSS variables (light + dark)
```

**Data model:** `User(role, email, rollNo, passwordHash)` ·
`Course(eligibilityThreshold, totalClasses)` · `Enrollment` ·
`Session(status)` · `AttendanceRecord(status, method, timestamp)` ·
`QRToken(used, usedAt)` · `Violation(type, warning, escalated)`.

**Core rules**

- `percentage = present / sessions held × 100`; zero sessions held yields
  `null` with `eligible: false` — no division by zero anywhere.
- Eligibility: `percentage >= course threshold`; the teacher changes the
  threshold per course and every verdict recomputes instantly.
- One record per (session, student): a later method **updates** it. CSV
  imports block duplicates outright and report every skipped row.
- Unenrolled students are rejected by every marking path.
- Closed sessions reject student writes; the admin can override explicitly.

**Pure output functions** (unit-tested, storage-independent):

```js
getStudentCourseSummary(db, studentId, courseId)  // {percentage, eligible, missedClasses, …}
getCourseEligibilityList(db, courseId)            // verdicts for every enrolled student
getViolations(db, { studentId, courseId, sessionId, type })
exportEligibilityCSV(db, courseId)                // {filename, text}
```

## Design

Editorial light/dark theme — warm charcoal cover, cream surfaces, Marcellus
serif display type, hairline borders. The palette is defined once as CSS
variables and flipped by a `.dark` class on `<html>`; the toggle persists the
choice and an inline script applies it before first paint (no flash).
Layouts are responsive from 320 px phones to wide desktops.

## Honest limitations

Frontend auth guards the UI only: passwords are demo-grade hashed and data
sits in localStorage, so treat this as a course-project demo, not a
production system.
