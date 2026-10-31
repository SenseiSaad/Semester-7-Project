import { Link } from 'react-router-dom'
import { useAuth, homeFor, useDB } from '../auth'
import { Logo } from '../Layout'
import ThemeToggle from '../ThemeToggle'
import { eligibilityStats } from '../logic/eligibility'

function LiveStats() {
  const db = useDB()
  const students = db.users.filter((u) => u.role === 'student').length
  let sum = 0, n = 0
  db.courses.forEach((c) => {
    const { avg } = eligibilityStats(db, c.id)
    if (avg != null) { sum += avg; n++ }
  })
  const cells = [
    ['Students', students], ['Courses', db.courses.length],
    ['Classes recorded', db.sessions.length], ['Avg attendance', n ? (sum / n).toFixed(1) + '%' : '—'],
  ]
  return (
    <div className="grid grid-cols-2 gap-px border border-lineDark bg-lineDark md:grid-cols-4">
      {cells.map(([label, value]) => (
        <div key={label} className="bg-panel px-4 py-6 text-center">
          <div className="font-display text-3xl tracking-wide text-paper">{value}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest2 text-taupe">{label}</div>
        </div>
      ))}
    </div>
  )
}

function Arches() {
  return (
    <div className="relative mx-auto flex w-full max-w-sm items-end justify-center gap-4">
      <div className="arch h-64 w-28 border border-lineDark bg-panel" />
      <div className="arch h-80 w-32 bg-gradient-to-b from-[#3A3226] to-panel" />
      <div className="arch h-56 w-28 border border-lineDark bg-gradient-to-b from-[#4A4030] to-panel" />
      <span className="absolute -left-2 top-10 h-2.5 w-2.5 rounded-full bg-bronze" />
      <span className="absolute right-0 bottom-24 h-2 w-2 rounded-full bg-taupe" />
    </div>
  )
}

function Step({ n, title, children, dark = false }) {
  return (
    <div className="flex gap-5">
      <span className="font-display text-2xl text-bronze">{n}</span>
      <div>
        <h4 className={`font-display text-lg tracking-wide ${dark ? 'text-paper' : ''}`}>{title}</h4>
        <p className={`mt-1 text-sm leading-relaxed ${dark ? 'text-taupe' : 'text-stone'}`}>{children}</p>
      </div>
    </div>
  )
}

function Feature({ title, children }) {
  return (
    <div className="card p-5">
      <h3 className="font-display text-[17px] tracking-wide">{title}</h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-stone">{children}</p>
    </div>
  )
}

export default function Landing() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-coal">
      {/* cover */}
      <header className="border-b border-lineDark">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
          <Logo dark />
          <nav className="ml-4 hidden items-center gap-6 text-sm font-semibold text-taupe lg:flex">
            <a href="#about" className="hover:text-paper">What is this</a>
            <a href="#student" className="hover:text-paper">Students</a>
            <a href="#teacher" className="hover:text-paper">Teachers</a>
            <a href="#violations" className="hover:text-paper">Violations</a>
            <a href="#terms" className="hover:text-paper">Terms</a>
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle dark />
            {user ? (
              <Link className="btn btn-paper btn-sm" to={homeFor(user)}>Go to dashboard</Link>
            ) : (
              <Link className="btn btn-ghost-dark btn-sm" to="/login">Log in</Link>
            )}
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 md:grid-cols-2">
          <div>
            <p className="kicker">Student attendance &amp; exam eligibility</p>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] tracking-wide text-paper md:text-6xl">
              ATTENDANCE &amp;<br />EXAM ELIGIBILITY
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-taupe">
              A working demo of how a university records who attended each class and
              decides who sits the final exam. Everything runs in your browser.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="btn btn-paper">Teacher login →</Link>
              <Link to="/login?role=student" className="btn btn-ghost-dark">Student login</Link>
            </div>
          </div>
          <Arches />
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-14"><LiveStats /></div>
      </header>

      {/* what is this project */}
      <section id="about" className="bg-page text-ink">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="kicker">What is this project</p>
          <div className="mt-5 grid gap-10 md:grid-cols-[1.1fr_1fr]">
            <div>
              <h2 className="font-display text-4xl leading-tight tracking-wide">
                The record-keeping behind every exam hall.
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-stone">
                Universities track attendance per class, then apply a minimum-percentage
                rule to decide exam eligibility. This app implements that workflow end to end:
                the teacher keeps a roster and marks each session, students mark themselves
                with a one-time QR token, and the eligibility list computes from the
                attendance records.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-stone">
                It is a single React app with its own built-in sign-in. All business logic
                lives in plain JS modules separate from the UI, and all data is stored in
                your browser — no server, so it deploys anywhere as static files.
              </p>
            </div>
            <div className="grid gap-3">
              <Feature title="Three marking methods">Manual checklist, CSV upload, and per-student QR tokens all write to the same record store.</Feature>
              <Feature title="One-time QR tokens">Each student gets one token per session. A second scan marks nothing — it logs a violation.</Feature>
              <Feature title="Instant eligibility">Percentage = present ÷ sessions held. Change a course threshold and every status recomputes.</Feature>
              <Feature title="Duplicate-proof records">A student has at most one record per session; a later method updates it instead of adding one.</Feature>
            </div>
          </div>
        </div>
      </section>

      {/* student portal */}
      <section id="student" className="border-t border-line bg-page text-ink">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="kicker">Inside the student portal</p>
          <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight tracking-wide">
            What students see, and what they can do.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] text-stone">
            Students sign in with the account their teacher created. The portal shows only
            their own data — nobody else's.
          </p>
          <div className="mt-10 grid gap-3 md:grid-cols-2">
            <div className="card p-6">
              <h3 className="font-display text-xl tracking-wide">Dashboard</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">
                Overall percentage, plus a card per course: attendance percentage, a progress
                bar against that course's threshold, missed-class count, and the eligible /
                not-eligible verdict. The verdict updates the moment any attendance changes.
              </p>
            </div>
            <div className="card p-6">
              <h3 className="font-display text-xl tracking-wide">Scan</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">
                While a session is open, the student taps <b>Mark me present</b> — or scans the
                join QR from the projector, which opens this same page. Their one-time token is
                spent, attendance is recorded, and the spent token can never count twice.
              </p>
            </div>
            <div className="card p-6">
              <h3 className="font-display text-xl tracking-wide">History</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">
                Every attendance record with date, course, status, and how it was marked —
                QR token, CSV upload, or manual entry by the teacher.
              </p>
            </div>
            <div className="card p-6">
              <h3 className="font-display text-xl tracking-wide">Alerts</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">
                The student's violation record. A rejected duplicate scan shows up here with
                an explanation — including private warnings issued under the good-standing
                policy.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className="card p-5">
              <div className="kicker">Step 1</div>
              <p className="mt-2 text-sm text-stone">Log in during class time while the teacher's session is open.</p>
            </div>
            <div className="card p-5">
              <div className="kicker">Step 2</div>
              <p className="mt-2 text-sm text-stone">Open Scan and mark yourself present — your token is spent instantly.</p>
            </div>
            <div className="card p-5">
              <div className="kicker">Step 3</div>
              <p className="mt-2 text-sm text-stone">Track your percentage all semester; the verdict tells you where you stand before the exam.</p>
            </div>
          </div>
        </div>
      </section>

      {/* teacher authority */}
      <section id="teacher" className="dark-section border-t border-lineDark">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="kicker">What the instructor can do</p>
          <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight tracking-wide text-paper">
            One admin account, full authority over the record store.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] text-taupe">
            The teacher is the single administrator. Students can never edit anything;
            every change to attendance, courses, or rosters goes through this account.
          </p>
          <div className="mt-10 grid gap-x-14 gap-y-9 md:grid-cols-2">
            <Step n="01" dark title="Courses & thresholds">Sign in and create courses. Each course sets its own eligibility threshold, and every student's verdict recomputes the moment it changes.</Step>
            <Step n="02" dark title="Rosters & accounts">Add students to a course; the app creates their sign-in. The roster shows every enrolled student in one place.</Step>
            <Step n="03" dark title="Sessions">Open a session for today — a join QR appears and one attendance token is issued per enrolled student. Close it when class ends.</Step>
            <Step n="04" dark title="Mark attendance three ways">Let students scan the join QR, tick the manual checklist, or upload a CSV file. Rows are validated: unknown students are skipped with a reason, and duplicates for the same session are blocked.</Step>
            <Step n="05" dark title="Manual editor with admin override">Correct any record. Closed sessions freeze their records — the teacher can still edit them behind an explicit admin override.</Step>
            <Step n="06" dark title="Violations & eligibility reports">See every duplicate-QR attempt with student and time, review the eligibility list with filters, and export the whole matrix as CSV for the exam cell.</Step>
          </div>
        </div>
      </section>

      {/* violations & effects */}
      <section id="violations" className="border-t border-line bg-page text-ink">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="kicker">Violations &amp; their effects</p>
          <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight tracking-wide">
            What counts as a violation, and what actually happens.
          </h2>
          <div className="mt-10 grid gap-3 md:grid-cols-2">
            <div className="card p-6">
              <h3 className="font-display text-xl tracking-wide">The violation</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">
                A student tries to use a session QR token that was already spent — for example,
                scanning for a friend after marking themselves, or re-submitting a saved code.
                The system rejects the scan: <b>attendance never double-counts</b>, and the
                attempt is logged with student, course, session, and time.
              </p>
            </div>
            <div className="card p-6">
              <h3 className="font-display text-xl tracking-wide">What the student sees</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">
                An immediate warning on the scan page and a permanent entry in their Alerts.
                The student always knows where they stand — nothing is silently recorded.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="card p-6" style={{ borderColor: 'var(--warn)' }}>
              <span className="badge b-at_risk">Warning — private</span>
              <h3 className="mt-3 font-display text-xl tracking-wide">First offense while in good standing</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">
                Good standing means: eligible in that course (at or above its threshold) and
                no earlier violation in it. Such a student gets a private warning in their
                alerts. <b>It is not escalated to the instructor's violations log.</b>
              </p>
            </div>
            <div className="card p-6" style={{ borderColor: 'var(--bad)' }}>
              <span className="badge b-not-eligible">Escalated</span>
              <h3 className="mt-3 font-display text-xl tracking-wide">Repeat offense, or already below the line</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">
                A second violation in the same course — or any violation by a student who is
                not eligible in it — appears directly in the instructor's violations log with
                full detail.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* terms & conditions */}
      <section id="terms" className="dark-section border-t border-lineDark">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="kicker">Terms &amp; conditions</p>
          <h2 className="mt-4 font-display text-4xl tracking-wide text-paper">The house rules, in plain words.</h2>
          <div className="mt-10 grid gap-x-14 gap-y-7 md:grid-cols-2">
            <Step n="T1" dark title="One token, one mark">Each student receives exactly one attendance token per session. It is spent on first use; further attempts add no attendance.</Step>
            <Step n="T2" dark title="Every rejected attempt is logged">Duplicate scans are recorded with the student, session, and timestamp. Logging cannot be avoided by either role.</Step>
            <Step n="T3" dark title="Good-standing first offense stays private">Eligible students with a clean record in that course receive a warning visible only in their own portal. It is not escalated to the instructor.</Step>
            <Step n="T4" dark title="Escalation is automatic">A repeat violation in the same course, or any violation while below the threshold, goes to the instructor's log. No one can suppress it.</Step>
            <Step n="T5" dark title="Only the admin changes records">Students cannot edit attendance. The teacher may correct records; closed sessions require the explicit admin override, and manual changes are attributed.</Step>
            <Step n="T6" dark title="Eligibility is arithmetic, not opinion">Eligibility is the threshold rule applied to the recorded attendance. The teacher sets the threshold per course; the system applies it to everyone equally.</Step>
          </div>
        </div>
      </section>

      {/* demo logins */}
      <section id="demo" className="border-t border-line bg-page text-ink">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="kicker">Try it now</p>
          <h2 className="mt-4 font-display text-4xl tracking-wide">Demo accounts</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="card p-6">
              <h3 className="font-display text-xl tracking-wide">Teacher</h3>
              <p className="mt-1 text-sm text-stone">Full admin authority: rosters, sessions, records, violations.</p>
              <div className="mt-4 rounded-xl bg-surface2 px-4 py-3 font-mono text-[13px]">
                teacher@uni.edu<br />teach1234
              </div>
              <Link to="/login" className="btn btn-dark btn-sm mt-5">Log in as teacher</Link>
            </div>
            <div className="card p-6">
              <h3 className="font-display text-xl tracking-wide">Student</h3>
              <p className="mt-1 text-sm text-stone">Own dashboard, scan, history and alerts only.</p>
              <div className="mt-4 rounded-xl bg-surface2 px-4 py-3 font-mono text-[13px]">
                2022-cs-001@uni.edu<br />study1234
              </div>
              <Link to="/login?role=student" className="btn btn-ghost btn-sm mt-5">Log in as student</Link>
            </div>
          </div>
          <p className="mt-6 text-[13px] text-stone">
            Students 2022-CS-002 … 2022-CS-008 use the same password. 007 and 008 sit below the line — good for seeing the not-eligible state.
          </p>
        </div>
      </section>

      <footer className="border-t border-lineDark bg-coal py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 text-[13px] text-taupe">
          <span>© 2026 attendwise · single-page course project, demo data in your browser</span>
          <span>React · Vite · Tailwind</span>
        </div>
      </footer>
    </div>
  )
}
