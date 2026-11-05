/* attendance.js — marking rules shared by all three methods (manual / csv / qr).

   Invariants enforced here:
   - one record per (session, student): a later method UPDATES the record, never duplicates it
   - a closed session is editable by the admin (teacher) only
   - a student not enrolled in the course is rejected
   - violations are logged and filterable */

import { uid } from './seed.js';

export const MARKING_METHODS = ['manual', 'csv', 'qr'];

export function findSession(db, sessionId) {
  return db.sessions.find((s) => s.id === sessionId) || null;
}

export function isEnrolled(db, studentId, courseId) {
  return db.enrollments.some((e) => e.studentId === studentId && e.courseId === courseId);
}

export function findRecord(db, sessionId, studentId) {
  return db.attendanceRecords.find((r) => r.sessionId === sessionId && r.studentId === studentId) || null;
}

/* Single-record writer. Returns {ok, created|updated} or {ok:false, error, reason}. */
export function markAttendance(db, { sessionId, studentId, status = 'present', method, actorRole = 'teacher' }) {
  const session = findSession(db, sessionId);
  if (!session) return { ok: false, reason: 'session_not_found', error: 'Session not found.' };
  if (!MARKING_METHODS.includes(method)) return { ok: false, reason: 'bad_method', error: 'Unknown marking method.' };
  if (status !== 'present' && status !== 'absent') return { ok: false, reason: 'bad_status', error: 'Status must be present or absent.' };
  if (session.status === 'closed' && actorRole !== 'teacher') {
    return { ok: false, reason: 'session_closed', error: 'This session is closed.' };
  }
  if (!isEnrolled(db, studentId, session.courseId)) {
    return { ok: false, reason: 'not_enrolled', error: 'Student is not enrolled in this course.' };
  }
  const existing = findRecord(db, sessionId, studentId);
  if (existing) {
    existing.status = status;
    existing.method = method;
    existing.timestamp = Date.now();
    return { ok: true, updated: true, record: existing };
  }
  const record = { id: uid('r'), sessionId, studentId, status, method, timestamp: Date.now() };
  db.attendanceRecords.push(record);
  return { ok: true, created: true, record };
}

/* Teacher checklist save: marks is { [studentId]: 'present' | 'absent' }. */
export function saveManualAttendance(db, { sessionId, marks, actorRole = 'teacher' }) {
  let created = 0, updated = 0;
  const errors = [];
  for (const [studentId, status] of Object.entries(marks)) {
    const res = markAttendance(db, { sessionId, studentId, status, method: 'manual', actorRole });
    if (res.ok) res.created ? created++ : updated++;
    else errors.push({ studentId, reason: res.reason });
  }
  return { ok: errors.length === 0, created, updated, errors };
}

export function openSession(db, sessionId) {
  const s = findSession(db, sessionId);
  if (s) s.status = 'open';
  return s;
}

export function closeSession(db, sessionId) {
  const s = findSession(db, sessionId);
  if (s) s.status = 'closed';
  return s;
}

/* ---------------- violations ---------------- */

export function addViolation(db, { studentId, sessionId, type }) {
  const v = { id: uid('v'), studentId, sessionId, type, timestamp: Date.now() };
  db.violations.push(v);
  return v;
}

export function getViolations(db, filters = {}) {
  return db.violations
    .filter((v) => {
      if (filters.studentId && v.studentId !== filters.studentId) return false;
      if (filters.sessionId && v.sessionId !== filters.sessionId) return false;
      if (filters.type && v.type !== filters.type) return false;
      if (filters.courseId) {
        const s = findSession(db, v.sessionId);
        if (!s || s.courseId !== filters.courseId) return false;
      }
      return true;
    })
    .map((v) => {
      const student = db.users.find((u) => u.id === v.studentId);
      const session = findSession(db, v.sessionId);
      const course = session ? db.courses.find((c) => c.id === session.courseId) : null;
      return { ...v, studentName: student ? student.name : 'Unknown', studentRollNo: student ? student.rollNo : '', courseCode: course ? course.code : '' };
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}
