/* courses.js — course + roster mutations (teacher/admin only by convention;
   the route guards decide who may call these). */

import { uid, hashPassword } from './seed.js';
import { findSession } from './attendance.js';

export function addCourse(db, { name, code, totalClasses = 0, eligibilityThreshold = 75 }) {
  code = String(code || '').trim().toUpperCase();
  name = String(name || '').trim();
  const threshold = Number(eligibilityThreshold);
  if (!name) return { ok: false, error: 'Course name is required.' };
  if (!code) return { ok: false, error: 'Course code is required.' };
  if (db.courses.some((c) => c.code.toUpperCase() === code)) return { ok: false, error: 'A course with this code already exists.' };
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 99) return { ok: false, error: 'Threshold must be between 1 and 99.' };
  const course = { id: uid('c'), name, code, teacherId: null, totalClasses: Math.max(0, Number(totalClasses) || 0), eligibilityThreshold: threshold };
  db.courses.push(course);
  return { ok: true, course };
}

/* Threshold changes recompute instantly: eligibility is derived, nothing to store. */
export function setThreshold(db, courseId, threshold) {
  const course = db.courses.find((c) => c.id === courseId);
  const t = Number(threshold);
  if (!course) return { ok: false, error: 'Course not found.' };
  if (!Number.isFinite(t) || t < 1 || t > 99) return { ok: false, error: 'Threshold must be between 1 and 99.' };
  course.eligibilityThreshold = t;
  return { ok: true, course };
}

export function setTotalClasses(db, courseId, totalClasses) {
  const course = db.courses.find((c) => c.id === courseId);
  if (!course) return { ok: false, error: 'Course not found.' };
  course.totalClasses = Math.max(0, Number(totalClasses) || 0);
  return { ok: true, course };
}

/* Add a brand-new student user and enroll them in the course in one step. */
export function addStudentToCourse(db, { courseId, name, rollNo, email, password = 'study1234' }) {
  const course = db.courses.find((c) => c.id === courseId);
  if (!course) return { ok: false, error: 'Course not found.' };
  name = String(name || '').trim();
  rollNo = String(rollNo || '').trim().toUpperCase();
  email = String(email || '').trim().toLowerCase();
  if (name.length < 2) return { ok: false, error: 'Name is required.' };
  if (!rollNo) return { ok: false, error: 'Roll number is required.' };
  if (db.users.some((u) => u.rollNo && u.rollNo.toUpperCase() === rollNo)) return { ok: false, error: 'A student with this roll number already exists.' };
  if (db.users.some((u) => u.email.toLowerCase() === email)) return { ok: false, error: 'A user with this email already exists.' };
  const user = { id: uid('u'), name, role: 'student', email, rollNo, passwordHash: hashPassword(password) };
  db.users.push(user);
  db.enrollments.push({ id: uid('e'), studentId: user.id, courseId });
  return { ok: true, user };
}

/* Roster of a course, enriched with user info. */
export function getRoster(db, courseId) {
  return db.enrollments
    .filter((e) => e.courseId === courseId)
    .map((e) => db.users.find((u) => u.id === e.studentId))
    .filter(Boolean);
}

export function getSessions(db, courseId) {
  return db.sessions
    .filter((s) => s.courseId === courseId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id < a.id ? -1 : 1));
}

export function presentCount(db, sessionId) {
  return db.attendanceRecords.filter((r) => r.sessionId === sessionId && r.status === 'present').length;
}

export function sessionRows(db, sessionId) {
  const session = findSession(db, sessionId);
  if (!session) return [];
  const marked = new Map(
    db.attendanceRecords.filter((r) => r.sessionId === sessionId).map((r) => [r.studentId, r]));
  return db.enrollments
    .filter((e) => e.courseId === session.courseId)
    .map((e) => {
      const u = db.users.find((x) => x.id === e.studentId);
      const r = marked.get(e.studentId);
      return {
        studentId: e.studentId, name: u ? u.name : 'Unknown', rollNo: u ? u.rollNo : '',
        status: r ? r.status : 'unmarked', method: r ? r.method : null,
        recordId: r ? r.id : null,
      };
    });
}

export function unmarkedStudents(db, sessionId) {
  return sessionRows(db, sessionId).filter((r) => r.status === 'unmarked');
}
