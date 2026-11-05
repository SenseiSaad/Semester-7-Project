/* seed.js — demo data so the app works immediately after deploy / first load.
   Attendance targets are chosen to show every eligibility outcome:
   comfortably eligible, borderline, and clearly short of the threshold.
   Two seeded violations demonstrate the good-standing policy: a private
   warning (Fatima, eligible) and escalated ones (Zainab, below the line). */

let seq = 0;
const uid = (p) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;
export { uid };

export function hashPassword(pw) {
  // Demo-grade deterministic hash. Frontend-only auth is a UI guard, not
  // security — any real deployment needs a server-side identity provider.
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < String(pw).length; i++) {
    const ch = String(pw).charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return String(4294967296 * (2097151 & h2) + (h1 >>> 0));
}

// rollNo, name, target attendance ratio
const STUDENTS = [
  ['2022-CS-001', 'Ahmed Raza', 0.96],
  ['2022-CS-002', 'Fatima Zahra', 0.92],
  ['2022-CS-003', 'Muhammad Bilal', 0.90],
  ['2022-CS-004', 'Ayesha Siddiqui', 0.88],
  ['2022-CS-005', 'Usman Ghani', 0.86],
  ['2022-CS-006', 'Hira Naz', 0.84],
  ['2022-CS-007', 'Ali Hamza', 0.78],
  ['2022-CS-008', 'Zainab Tariq', 0.62],
  ['2022-CS-009', 'Imran Qureshi', 0.72],
  ['2022-CS-010', 'Kamran Shah', 0.55],
  ['2022-CS-011', 'Sana Javed', 0.81],
  ['2022-CS-012', 'Hassan Raza', 0.68],
];

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function buildSeed() {
  const db = { users: [], courses: [], enrollments: [], sessions: [], attendanceRecords: [], qrTokens: [], violations: [] };

  db.users.push({
    id: uid('u'), name: 'Dr. Ayesha Khan', role: 'teacher',
    email: 'teacher@uni.edu', rollNo: null, passwordHash: hashPassword('teach1234'),
  });
  STUDENTS.forEach(([rollNo, name]) => {
    db.users.push({
      id: uid('u'), name, role: 'student',
      email: `${rollNo.toLowerCase()}@uni.edu`, rollNo,
      passwordHash: hashPassword('study1234'),
    });
  });
  const teacher = db.users[0];
  const students = db.users.filter((u) => u.role === 'student');

  const courses = [
    { name: 'Discrete Mathematics', code: 'CS-301', threshold: 75, total: 40, closed: 12 },
    { name: 'Data Structures', code: 'CS-302', threshold: 75, total: 32, closed: 8 },
    { name: 'Database Systems', code: 'CS-303', threshold: 70, total: 30, closed: 10 },
    { name: 'Operating Systems', code: 'CS-304', threshold: 75, total: 36, closed: 9 },
  ];
  courses.forEach(({ name, code, threshold, total, closed }) => {
    const course = { id: uid('c'), name, code, teacherId: teacher.id, totalClasses: total, eligibilityThreshold: threshold };
    db.courses.push(course);
    students.forEach((s) => db.enrollments.push({ id: uid('e'), studentId: s.id, courseId: course.id }));

    // closed sessions; per-student absence scatter hits the target exactly
    for (let k = 0; k < closed; k++) {
      const session = { id: uid('s'), courseId: course.id, date: isoDaysAgo(closed - k), status: 'closed' };
      db.sessions.push(session);
      students.forEach((s, i) => {
        const target = STUDENTS[i][2];
        const absentOn = ((k * 7 + i * 13) % closed) < Math.round(closed * (1 - target));
        db.attendanceRecords.push({
          id: uid('r'), sessionId: session.id, studentId: s.id,
          status: absentOn ? 'absent' : 'present', method: 'qr', timestamp: Date.now() - (closed - k) * 86400000,
        });
      });
    }
  });

  // one open session today so the QR + manual flows are immediately usable
  const cs301 = db.courses[0];
  const open = { id: uid('s'), courseId: cs301.id, date: isoDaysAgo(0), status: 'open' };
  db.sessions.push(open);
  students.forEach((s, i) => {
    if (i < 6) {
      db.attendanceRecords.push({
        id: uid('r'), sessionId: open.id, studentId: s.id, status: 'present', method: 'qr', timestamp: Date.now(),
      });
    }
    db.qrTokens.push({ token: uid('tok'), sessionId: open.id, studentId: s.id, used: i < 6, usedAt: i < 6 ? Date.now() : null });
  });

  // seeded violations: one private warning, two escalated — so the logs and
  // alerts have real content on first load
  const byRoll = (roll) => students.find((s) => s.rollNo === roll);
  const closedSessions = db.sessions.filter((s) => s.status === 'closed' && s.courseId === cs301.id);
  db.violations.push(
    { id: uid('v'), studentId: byRoll('2022-CS-002').id, sessionId: closedSessions[3].id,
      type: 'duplicate_qr', timestamp: Date.now() - 3 * 86400000, warning: true, escalated: false },
    { id: uid('v'), studentId: byRoll('2022-CS-008').id, sessionId: closedSessions[1].id,
      type: 'duplicate_qr', timestamp: Date.now() - 6 * 86400000, warning: false, escalated: true },
    { id: uid('v'), studentId: byRoll('2022-CS-008').id, sessionId: closedSessions[7].id,
      type: 'duplicate_qr', timestamp: Date.now() - 2 * 86400000, warning: false, escalated: true },
  );

  return db;
}
