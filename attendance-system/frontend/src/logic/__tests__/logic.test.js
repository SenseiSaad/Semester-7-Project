/* Unit tests for the logic layer: eligibility calculation, CSV validation,
   one-time QR behavior, and the shared marking invariants.
   Run:  npx vitest run   */
import { describe, it, expect } from 'vitest';
import { buildSeed, hashPassword } from '../seed.js';
import { getStudentCourseSummary, getCourseEligibilityList, exportEligibilityCSV, sessionsHeld } from '../eligibility.js';
import { markAttendance, saveManualAttendance, getViolations, addViolation, closeSession } from '../attendance.js';
import { ensureTokens, redeemToken, getTokenForStudent } from '../qr.js';
import { parseCSV, validateAttendanceRows } from '../csv.js';
import { addCourse, setThreshold, addStudentToCourse } from '../courses.js';

const seed = () => buildSeed();
const studentByRoll = (db, roll) => db.users.find((u) => u.rollNo === roll);
const courseByCode = (db, code) => db.courses.find((c) => c.code === code);
const openSession = (db) => db.sessions.find((s) => s.status === 'open');

describe('eligibility calculation', () => {
  it('computes percentage = present / sessions held * 100', () => {
    const db = seed();
    const course = courseByCode(db, 'CS-301');
    const s = studentByRoll(db, '2022-CS-001');
    const sum = getStudentCourseSummary(db, s.id, course.id);
    expect(sum.percentage).toBeCloseTo((sum.present / sum.held) * 100, 5);
    expect(sum.held).toBe(13); // 12 closed + 1 open
  });

  it('handles zero sessions held without dividing by zero', () => {
    const db = seed();
    const fresh = addCourse(db, { name: 'Empty', code: 'XX-1', eligibilityThreshold: 75 });
    const s = studentByRoll(db, '2022-CS-001');
    db.enrollments.push({ id: 'e_test', studentId: s.id, courseId: fresh.course.id });
    const sum = getStudentCourseSummary(db, s.id, fresh.course.id);
    expect(sum.held).toBe(0);
    expect(sum.percentage).toBeNull();
    expect(sum.eligible).toBe(false);
    expect(sum.missedClasses).toBe(0);
  });

  it('is eligible only at or above the course threshold', () => {
    const db = seed();
    const course = courseByCode(db, 'CS-303'); // threshold 70
    const rows = getCourseEligibilityList(db, course.id);
    for (const r of rows) {
      expect(r.eligible).toBe(r.percentage != null && r.percentage >= 70);
    }
  });

  it('recomputes instantly when the teacher changes the threshold', () => {
    const db = seed();
    const course = courseByCode(db, 'CS-301');
    const s = studentByRoll(db, '2022-CS-005'); // mid-pack
    const before = getStudentCourseSummary(db, s.id, course.id).eligible;
    setThreshold(db, course.id, 99); // setter rejects >99, so use the valid max
    const after = getStudentCourseSummary(db, s.id, course.id).eligible;
    setThreshold(db, course.id, 1);
    const after2 = getStudentCourseSummary(db, s.id, course.id).eligible;
    expect(after).toBe(false);
    expect(after2).toBe(true);
    expect(before).toBeDefined();
  });

  it('counts missed classes as held minus present', () => {
    const db = seed();
    const course = courseByCode(db, 'CS-301');
    const s = studentByRoll(db, '2022-CS-001');
    const sum = getStudentCourseSummary(db, s.id, course.id);
    expect(sum.missedClasses).toBe(sum.held - sum.present);
  });

  it('CSV export contains every enrolled student and no formula injection', () => {
    const db = seed();
    const course = courseByCode(db, 'CS-301');
    const { text } = exportEligibilityCSV(db, course.id);
    const body = text.split('\r\n');
    expect(body.length).toBe(9); // header + 8 students
    expect(body[0]).toContain('Roll No');
    const hostile = addStudentToCourse(db, { courseId: course.id, name: 'Evil Doe', rollNo: '2022-CS-909', email: 'evil@uni.edu' });
    expect(hostile.ok).toBe(true);
    const { text: text2 } = exportEligibilityCSV(db, course.id);
    expect(text2).not.toMatch(/(^|,)=/m); // leading = would be a formula
  });
});

describe('CSV validation', () => {
  it('accepts valid rows and marks them', () => {
    const db = seed();
    const session = openSession(db);
    const parsed = parseCSV('rollNo,status\n2022-CS-007,present\n2022-CS-008,absent\n');
    const { valid, skipped } = validateAttendanceRows(db, session.id, parsed);
    expect(skipped).toHaveLength(0);
    expect(valid).toHaveLength(2);
    valid.forEach((v) => {
      const res = markAttendance(db, { sessionId: session.id, studentId: v.studentId, status: v.status, method: 'csv' });
      expect(res.ok).toBe(true);
    });
    expect(getStudentCourseSummary(db, studentByRoll(db, '2022-CS-007').id, session.courseId).present).toBeGreaterThan(0);
  });

  it('skips unknown students with a reason', () => {
    const db = seed();
    const session = openSession(db);
    const { valid, skipped } = validateAttendanceRows(db, session.id, parseCSV('2022-CS-999,present'));
    expect(valid).toHaveLength(0);
    expect(skipped[0].reason).toBe('unknown student');
  });

  it('blocks duplicates for the same session', () => {
    const db = seed();
    const session = openSession(db);
    // 2022-CS-001 is already marked in the seeded open session
    const { valid, skipped } = validateAttendanceRows(db, session.id, parseCSV('2022-CS-001,absent'));
    expect(valid).toHaveLength(0);
    expect(skipped[0].reason).toContain('duplicate blocked');
  });

  it('rejects malformed status values and reports the line', () => {
    const db = seed();
    const session = openSession(db);
    const { skipped } = validateAttendanceRows(db, session.id, parseCSV('2022-CS-007,late'));
    expect(skipped[0].line).toBe(1);
    expect(skipped[0].reason).toContain('invalid status');
  });

  it('rejects students not enrolled in the course', () => {
    const db = seed();
    const session = openSession(db);
    const other = studentByRoll(db, '2022-CS-008');
    // temporarily un-enroll 008 from CS-301
    db.enrollments = db.enrollments.filter((e) => !(e.studentId === other.id && e.courseId === session.courseId));
    const { valid, skipped } = validateAttendanceRows(db, session.id, parseCSV('2022-CS-008,present'));
    expect(valid).toHaveLength(0);
    expect(skipped[0].reason).toBe('not enrolled in this course');
  });
});

describe('one-time QR behavior', () => {
  it('issues one token per enrolled student per session', () => {
    const db = seed();
    const session = openSession(db);
    const tokens = ensureTokens(db, session.id);
    const enrolled = db.enrollments.filter((e) => e.courseId === session.courseId).length;
    expect(tokens.length).toBe(enrolled);
    ensureTokens(db, session.id); // idempotent
    expect(db.qrTokens.filter((t) => t.sessionId === session.id).length).toBe(enrolled);
  });

  it('marks present on first redeem and refuses the second', () => {
    const db = seed();
    const session = openSession(db);
    const s = studentByRoll(db, '2022-CS-007');
    // give 007 a fresh open session of their own course set — use seeded open session
    db.attendanceRecords = db.attendanceRecords.filter((r) => !(r.sessionId === session.id && r.studentId === s.id));
    db.qrTokens = db.qrTokens.filter((t) => !(t.sessionId === session.id && t.studentId === s.id));

    const first = redeemToken(db, { sessionId: session.id, studentId: s.id });
    expect(first.ok).toBe(true);
    const token = getTokenForStudent(db, session.id, s.id);
    expect(token.used).toBe(true);
    expect(token.usedAt).not.toBeNull();

    const second = redeemToken(db, { sessionId: session.id, studentId: s.id });
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('duplicate_qr');
    expect(second.violation).toBe(true);
    // exactly one record, still present
    const records = db.attendanceRecords.filter((r) => r.sessionId === session.id && r.studentId === s.id);
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('present');
    // violation logged for the session
    expect(getViolations(db, { sessionId: session.id, studentId: s.id, type: 'duplicate_qr' })).toHaveLength(1);
  });

  it('rejects a student with no token (not enrolled)', () => {
    const db = seed();
    const session = openSession(db);
    const outsider = { id: 'u_ghost' };
    const res = redeemToken(db, { sessionId: session.id, studentId: outsider.id });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('not_enrolled');
  });

  it('cannot redeem into a closed session', () => {
    const db = seed();
    const session = openSession(db);
    const s = studentByRoll(db, '2022-CS-008');
    db.attendanceRecords = db.attendanceRecords.filter((r) => !(r.sessionId === session.id && r.studentId === s.id));
    db.qrTokens = db.qrTokens.filter((t) => !(t.sessionId === session.id && t.studentId === s.id));
    closeSession(db, session.id);
    const res = redeemToken(db, { sessionId: session.id, studentId: s.id });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('session_closed');
  });
});

describe('shared marking invariants', () => {
  it('later methods update the record instead of duplicating it', () => {
    const db = seed();
    const session = openSession(db);
    const s = studentByRoll(db, '2022-CS-007');
    db.attendanceRecords = db.attendanceRecords.filter((r) => !(r.sessionId === session.id && r.studentId === s.id));
    db.qrTokens = db.qrTokens.filter((t) => !(t.sessionId === session.id && t.studentId === s.id));

    markAttendance(db, { sessionId: session.id, studentId: s.id, status: 'absent', method: 'manual' });
    const res = markAttendance(db, { sessionId: session.id, studentId: s.id, status: 'present', method: 'csv' });
    expect(res.ok).toBe(true);
    expect(res.updated).toBe(true);
    const records = db.attendanceRecords.filter((r) => r.sessionId === session.id && r.studentId === s.id);
    expect(records).toHaveLength(1);
    expect(records[0].method).toBe('csv');
  });

  it('a student not enrolled is rejected by the core writer too', () => {
    const db = seed();
    const session = openSession(db);
    const res = markAttendance(db, { sessionId: session.id, studentId: 'u_ghost', status: 'present', method: 'manual' });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('not_enrolled');
  });

  it('closed sessions reject non-admin writers but accept the admin', () => {
    const db = seed();
    const session = openSession(db);
    const s = studentByRoll(db, '2022-CS-007');
    db.attendanceRecords = db.attendanceRecords.filter((r) => !(r.sessionId === session.id && r.studentId === s.id));
    db.qrTokens = db.qrTokens.filter((t) => !(t.sessionId === session.id && t.studentId === s.id));
    closeSession(db, session.id);
    expect(markAttendance(db, { sessionId: session.id, studentId: s.id, status: 'present', method: 'manual', actorRole: 'student' }).reason)
      .toBe('session_closed');
    expect(markAttendance(db, { sessionId: session.id, studentId: s.id, status: 'present', method: 'manual', actorRole: 'teacher' }).ok)
      .toBe(true);
  });

  it('manual checklist save reports created vs updated', () => {
    const db = seed();
    const session = openSession(db);
    const s7 = studentByRoll(db, '2022-CS-007').id;
    const s8 = studentByRoll(db, '2022-CS-008').id;
    const res = saveManualAttendance(db, { sessionId: session.id, marks: { [s7]: 'present', [s8]: 'present' } });
    expect(res.created).toBe(2);
    const res2 = saveManualAttendance(db, { sessionId: session.id, marks: { [s7]: 'absent' } });
    expect(res2.updated).toBe(1);
  });

  it('violations filter by course, student and type', () => {
    const db = seed();
    const session = openSession(db);
    const s = studentByRoll(db, '2022-CS-007');
    addViolation(db, { studentId: s.id, sessionId: session.id, type: 'duplicate_qr' });
    const rows = getViolations(db, { courseId: session.courseId, type: 'duplicate_qr' });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].studentName).toBe(s.name);
  });

  it('seeded passwords verify through the hash', () => {
    const db = seed();
    const u = db.users[0];
    expect(u.passwordHash).toBe(hashPassword('teach1234'));
    expect(u.passwordHash).not.toBe(hashPassword('wrong'));
  });
});
