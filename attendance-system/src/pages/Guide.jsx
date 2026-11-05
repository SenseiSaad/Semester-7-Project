import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Logo } from '../Layout'
import ThemeToggle from '../ThemeToggle'

/* Dedicated how-to page: one toggle, two detailed manuals.
   Public route — readable without signing in. */

function Section({ id, title, children }) {
  return (
    <section className="mb-10">
      <h3 id={id} className="font-display text-2xl tracking-wide">{title}</h3>
      <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-stone">{children}</div>
    </section>
  )
}

function Numbered({ n, title, children }) {
  return (
    <div className="card flex gap-4 p-5">
      <span className="font-display text-2xl text-bronze">{n}</span>
      <div>
        <h4 className="font-display text-[17px] tracking-wide">{title}</h4>
        <p className="mt-1 text-[14px] leading-relaxed text-stone">{children}</p>
      </div>
    </div>
  )
}

function Note({ children }) {
  return (
    <div className="rounded-xl border border-[var(--warn)] bg-[var(--warn-bg)] px-4 py-3 text-[13.5px] font-medium text-[var(--warn-text)]">
      {children}
    </div>
  )
}

function StudentManual() {
  return (
    <div>
      <Section title="1 · Signing in">
        <p>Your teacher creates your account when adding you to a course roster — there is no self-signup. The sign-in screen has a <b>Student / Instructor</b> toggle; make sure <b>Student</b> is selected.</p>
        <p>Demo account: <b>2022-cs-001@uni.edu</b> with password <b>study1234</b> (already typed in for you — just press the button). Students 002 through 012 use the same password.</p>
        <Note>Wrong role selected? The app tells you the email belongs to the other role — flip the toggle and try again.</Note>
      </Section>

      <Section title="2 · Your dashboard">
        <p>The dashboard is your semester at a glance. At the top you get four numbers: your overall percentage, how many courses you are eligible in, how many you are not, and total classes attended.</p>
        <p>Below that, one card per course shows:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><b>Percentage</b> — present ÷ sessions held × 100 for that course.</li>
          <li><b>Progress bar</b> — how far you are from the course's threshold (shown next to it, e.g. "need ≥75%").</li>
          <li><b>Eligible / Not eligible</b> — the verdict that decides whether you sit the final exam.</li>
          <li><b>Missed classes</b> — how many sessions you were absent or unmarked for.</li>
        </ul>
        <p>Everything on this page updates the instant attendance is recorded — nothing to refresh.</p>
      </Section>

      <Section title="3 · Marking your attendance (Scan)">
        <p>While your teacher's session is open, open <b>Scan</b> from the menu. Every open session for your courses appears as a card with a <b>Mark me present</b> button.</p>
        <p>You can also scan the QR code shown on the projector: it opens this same page, already pointed at the running session, and marks you the moment you land on it (you'll be asked to sign in first if you weren't).</p>
        <p>Behind the scenes you hold exactly <b>one attendance token per session</b>. Marking yourself present spends it. The card then shows <b>Marked</b> — that's your confirmation.</p>
        <Note>Scanning again does nothing to your attendance. The rejected attempt is logged as a violation — see the Alerts section below.</Note>
      </Section>

      <Section title="4 · History">
        <p>History lists every attendance record ever created for you, newest first: the date, the course, whether you were present or absent, and how the record was produced — your own QR scan, a CSV upload by the teacher, or a manual entry.</p>
        <p>Use it before the exam: if a number on your dashboard looks wrong, History shows exactly which sessions you were marked for.</p>
      </Section>

      <Section title="5 · Alerts & violations">
        <p>If a scan of yours is ever rejected, the reason appears here permanently. There are two kinds of entries:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><b>Warning (private)</b> — your first violation in a course while you are eligible in it. Only you see it in your portal; it is not sent to your instructor.</li>
          <li><b>Escalated</b> — a repeat violation in the same course, or any violation while you are below that course's threshold. These go straight to your instructor's log.</li>
        </ul>
      </Section>

      <Section title="6 · What eligibility means">
        <p>Each course has a threshold set by your instructor (75% for most, 70% for Database Systems in the demo). You are <b>eligible</b> when your percentage is at or above it, and <b>not eligible</b> below it. There is no negotiation in the arithmetic — attend classes and the number takes care of itself.</p>
      </Section>
    </div>
  )
}

function TeacherManual() {
  return (
    <div>
      <Section title="1 · Signing in">
        <p>Choose the <b>Instructor</b> toggle on the sign-in screen. The demo account is <b>teacher@uni.edu</b> with password <b>teach1234</b> (already filled in). As the single admin you can see and edit everything — students can only see their own data.</p>
      </Section>

      <Section title="2 · Courses & the eligibility rule">
        <p>Open <b>Courses</b> to create a course (code, name, planned class count, threshold). The threshold is the minimum attendance percentage a student needs in that course to sit the exam — 75% is the common university rule, and the demo's Database Systems course uses 70% to show it can differ.</p>
        <p>On a course page you can change the threshold at any time. Every student's verdict recomputes instantly because eligibility is always derived from the records — there is nothing to refresh or re-save.</p>
      </Section>

      <Section title="3 · Roster & student accounts">
        <p>Inside a course, use <b>Add student</b> to enroll someone: name, roll number, and optionally an email. The app creates their sign-in with the default password <b>study1234</b> — share it with them.</p>
        <p>Every enrolled student automatically gets an attendance token whenever you open a session, so late-added students can scan right away.</p>
      </Section>

      <Section title="4 · Running a session">
        <p>Press <b>Start session</b> on a course page. A session opens for today and the session screen shows:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><b>Join QR</b> — project it. Students scan it with their phone; it opens the Scan page, asks them to sign in if needed, and spends their one-time token.</li>
          <li><b>Present now</b> — a live counter with a progress bar, updated on every scan.</li>
          <li><b>Marks</b> — who is present and how the mark was made (QR token, CSV, manual).</li>
          <li><b>Not yet scanned</b> — enrolled students with no record yet, so you know who to chase before closing.</li>
        </ul>
        <p>Press <b>Close session</b> when class ends. Closed sessions stop accepting scans from students.</p>
        <Note>Only one session per course can be open at a time — the app blocks a second one and tells you.</Note>
      </Section>

      <Section title="5 · Three ways to mark attendance">
        <p>All three write to the same record store, and a student can only ever have one record per session:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><b>Student QR tokens</b> — the default. Each student's token works once; reuse is rejected and logged.</li>
          <li><b>Manual checklist</b> — in the session screen or Manual editor, tap Present/Absent per student and save. Adding a record for a student who has none creates it; changing an existing one updates it.</li>
          <li><b>CSV upload</b> — paste or upload a file of <b>rollNo,status</b> rows. Every row is validated: unknown students and wrong statuses are skipped with the row number and reason, students not in the course are rejected, and anyone already marked for that session is blocked as a duplicate.</li>
        </ul>
      </Section>

      <Section title="6 · Correcting records (admin override)">
        <p>The <b>Manual editor</b> works on any session. Open sessions are freely editable. Closed sessions are frozen for students — as admin you can still correct them by ticking <b>Admin override</b> first. The override is deliberate and visible, so accidental edits are unlikely.</p>
      </Section>

      <Section title="7 · Violations & the good-standing policy">
        <p>Every rejected duplicate scan is logged with student, course, session, and time. The violations log splits into two lists:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li><b>Escalated</b> — repeat violations in the same course, or any violation by a student who is below that course's threshold. These need your attention.</li>
          <li><b>Warnings — not escalated</b> — first offenses by students who were eligible at the time. They stay private to the student; this section exists so you have the full picture without the log turning into noise.</li>
        </ul>
        <p>The same policy runs in the student's Alerts, so they always know where they stand.</p>
      </Section>

      <Section title="8 · Eligibility report & CSV export">
        <p>The <b>Eligibility</b> page is the exam-cell document: per course, every student with present/held counts, percentage, missed classes, and verdict. Filter with the status chips (All / Eligible / Not eligible), search by name or roll number, and press <b>Export CSV</b> to download the list — spreadsheet-safe, with an apostrophe added in front of anything that could be read as a formula.</p>
      </Section>
    </div>
  )
}

export default function Guide() {
  const [params] = useSearchParams()
  const [role, setRole] = useState(params.get('role') === 'teacher' ? 'teacher' : 'student')

  return (
    <div className="min-h-screen">
      <header className="topbar sticky top-0 z-40 border-b border-line backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-4 px-5">
          <Logo />
          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle />
            <Link to="/login" className="btn btn-dark btn-sm">Log in</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12">
        <p className="kicker">How to use this platform</p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-wide md:text-5xl">
          The complete walkthrough.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-stone">
          Everything this system does, for both roles, step by step. Pick your side and read
          your manual — it takes about three minutes and covers every button you will meet.
        </p>

        {/* role toggle */}
        <div className="sticky top-[72px] z-30 mt-8 grid grid-cols-2 gap-1 rounded-full border border-line bg-surface p-1 shadow-soft">
          {[
            ['student', '🎓 Student'],
            ['teacher', '📋 Instructor'],
          ].map(([r, label]) => (
            <button key={r} onClick={() => setRole(r)}
              className={`rounded-full py-2.5 text-sm font-bold transition ${
                role === r ? 'bg-primary text-onprimary' : 'text-stone hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-10">
          {role === 'student' ? <StudentManual /> : <TeacherManual />}
        </div>

        <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h3 className="font-display text-xl tracking-wide">Ready to try it?</h3>
            <p className="mt-1 text-sm text-stone">The demo accounts are pre-filled on the sign-in screen.</p>
          </div>
          <Link to={`/login?role=${role}`} className="btn btn-dark btn-sm">
            Log in as {role === 'student' ? 'student' : 'instructor'}
          </Link>
        </div>
      </main>

      <footer className="border-t border-line py-8">
        <div className="mx-auto max-w-4xl px-5 text-[13px] text-stone">
          attendwise · Student Attendance &amp; Exam Eligibility · frontend-only project
        </div>
      </footer>
    </div>
  )
}
