# AttendWise — Student Attendance & Exam Eligibility System

A complete, standalone attendance and exam-eligibility portal built as a single
React application. The "backend" is a set of pure JavaScript modules inside the
app, so the whole project deploys to **Vercel as static files** — no server to
run, no database to provision. All data lives in the browser's localStorage and
every business rule is unit-tested.

**Live sections:** landing page (what it is · student portal · teacher
authority · violations & effects · terms & conditions) → role-based login →
teacher or student portal.

---

## Quick start

```bash
cd frontend
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # 24 unit tests (vitest)
npm run build      # production build → dist/
```

## Deploy to Vercel

1. Push the project to GitHub and import it at vercel.com.
2. Root directory: `frontend` · Framework preset: **Vite** (auto-detected).
3. Deploy. `vercel.json` rewrites all routes to `index.html` for the router,
   and seed data is created on first load — the deployed app works immediately.

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Teacher (admin) | `teacher@uni.edu` | `teach1234` |
| Students | `2022-cs-001@uni.edu` … `2022-cs-008@uni.edu` | `study1234` |

Students 007 and 008 sit below the eligibility line. The CS-301 session is
open from first load — log in as a student and scan.

---

## What each role can do

### Student portal
| Page | Functionality |
|------|---------------|
| **Dashboard** | Overall percentage; per-course card with percentage, progress bar against that course's threshold, missed-class count, eligible / not-eligible verdict. Recomputes the moment anything changes. |
| **Scan** | Lists open sessions for enrolled courses. One tap spends the student's unique one-time QR token and marks present. A second attempt marks nothing and logs a violation. |
| **History** | Every attendance record: date, course, status, and the method that produced it (QR token / CSV / manual). |
| **Alerts** | The student's violation record — warnings and escalations, each with a plain-language explanation. |

### Teacher (admin) — full authority
| Functionality | What it does |
|------|---------------|
| **Courses & thresholds** | Create courses; each sets its own eligibility threshold (1–99). Changing it reclassifies every student instantly. |
| **Rosters & accounts** | Add students to a course — the app creates their sign-in. |
| **Sessions** | Open a session (a join QR appears; one token is issued per enrolled student) and close it when class ends. |
| **Manual checklist** | Toggle present/absent per student and save — one record per student per session, always. |
| **CSV upload** | Parse `rollNo,status` rows. Every row is validated: unknown students are skipped with a reason, invalid statuses are reported, duplicates for the same session are blocked. |
| **QR tokens** | One unique token per student per session. First scan spends it; a second scan logs a violation instead of a mark. |
| **Manual editor + admin override** | Correct any record. Closed sessions are frozen for students; the teacher can edit them only behind an explicit override. |
| **Violations log** | Every duplicate-QR attempt, split into *escalated* and *warnings (not escalated)*, filterable by course and type. |
| **Eligibility report** | Filterable, searchable list with present/held, percentage, missed classes and verdicts; one-click CSV export (formula-injection safe). |

### Violations & their effects
A violation is a rejected attempt to reuse an already-spent session QR token.
The scan never double-counts; the attempt is logged with student, course,
session and timestamp. Effects depend on standing:

- **Warning (private)** — first violation in a course by a student who is
  currently *eligible* in it. Visible only in the student's own Alerts and in
  a separate, clearly-marked "not escalated" section of the teacher's log.
- **Escalated** — a repeat violation in the same course, or any violation by a
  student below that course's threshold. Appears directly in the
  instructor's violations log.

The full policy ships on the landing page under **Terms & conditions** and is
enforced in code (`src/logic/policy.js`), not just in copy.

---

## Architecture

```
frontend/
├── vercel.json                  SPA rewrite for client-side routing
└── src/
    ├── logic/                   ← the "backend": pure, testable, no UI code
    │   ├── storage.js           swappable persistence driver (localStorage / memory)
    │   ├── seed.js              demo data + demo-grade password hash
    │   ├── auth.js              login by role, session persistence, route-guard helpers
    │   ├── eligibility.js       percentage, verdicts, summaries, CSV export
    │   ├── attendance.js        marking rules, duplicate prevention, violations
    │   ├── qr.js                one-time token generation & redemption
    │   ├── csv.js               parse + validate attendance CSV
    │   ├── courses.js           course / roster / session management
    │   ├── policy.js            good-standing warning vs escalation
    │   └── __tests__/           24 unit tests (vitest)
    ├── pages/                   React screens (talk only to logic/)
    ├── ThemeToggle.jsx          light / dark switch
    └── index.css                design tokens as CSS variables (light + dark)
```

**Data model:** `User(role, email, rollNo, passwordHash)` ·
`Course(eligibilityThreshold, totalClasses)` · `Enrollment` ·
`Session(status)` · `AttendanceRecord(status, method, timestamp)` ·
`QRToken(used, usedAt)` · `Violation(type, warning, escalated)`.

**Core rules**

- `percentage = present / sessions held × 100`; zero sessions held yields
  `null` with `eligible: false` — no division by zero anywhere.
- Eligibility: `percentage >= course threshold`. The teacher can change the
  threshold per course; all statuses recompute instantly.
- One record per (session, student): a later method **updates** the record
  rather than adding a new one. CSV imports block duplicates outright.
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

Editorial light/dark theme in the spirit of a premium presentation deck —
warm charcoal cover, cream surfaces, Marcellus serif display type, hairline
borders. The palette is defined once as CSS variables and flipped by a
`.dark` class on `<html>`; the toggle in the navigation persists the choice
and an inline script applies it before first paint (no flash). Layouts are
responsive from 320 px phones to wide desktops.

## Honest limitations

Frontend auth guards the UI only: passwords are demo-grade hashed and data
sits in localStorage, so treat this as a course-project demo, not a production
system. `_legacy-django/` contains the earlier Django + DRF version for
reference; the active app no longer uses it.
