/* qr.js — one-time tokens. One unique token is generated per student per
   session. Redeeming a valid unused token marks the student present; redeeming
   an already-used token does NOT change attendance — it logs a duplicate_qr
   violation instead. */

import { uid } from './seed.js';
import { markAttendance, findSession } from './attendance.js';
import { recordViolation } from './policy.js';
import { isEnrolled } from './attendance.js';

export function ensureTokens(db, sessionId) {
  const session = findSession(db, sessionId);
  if (!session) return [];
  const have = new Set(db.qrTokens.filter((t) => t.sessionId === sessionId).map((t) => t.studentId));
  const enrolled = db.enrollments.filter((e) => e.courseId === session.courseId);
  for (const e of enrolled) {
    if (!have.has(e.studentId)) {
      db.qrTokens.push({ token: uid('tok'), sessionId, studentId: e.studentId, used: false, usedAt: null });
    }
  }
  return db.qrTokens.filter((t) => t.sessionId === sessionId);
}

export function getTokenForStudent(db, sessionId, studentId) {
  return db.qrTokens.find((t) => t.sessionId === sessionId && t.studentId === studentId) || null;
}

export function findToken(db, token) {
  return db.qrTokens.find((t) => t.token === token) || null;
}

/* Student-side scan. Returns:
   {ok:true, created|updated}                  token was valid and unused
   {ok:false, reason:'duplicate_qr', violation:true, warning}  token already used —
                                               logged as a warning or escalated per policy
   {ok:false, reason:'not_enrolled'}           no token exists for this student+session
   {ok:false, reason:'session_closed'}         session closed */
export function redeemToken(db, { sessionId, studentId }) {
  ensureTokens(db, sessionId);
  const session = findSession(db, sessionId);
  if (!session) return { ok: false, reason: 'session_not_found', error: 'Session not found.' };
  const token = getTokenForStudent(db, sessionId, studentId);
  if (!token) return { ok: false, reason: 'not_enrolled', error: 'You are not enrolled in this course.' };
  if (token.used) {
    const { goodStanding } = recordViolation(db, { studentId, sessionId, type: 'duplicate_qr' });
    return {
      ok: false, reason: 'duplicate_qr', violation: true, warning: goodStanding,
      error: goodStanding
        ? 'This token was already used. Recorded as a private warning under the good-standing policy.'
        : 'This QR token was already used for this session. The violation has been escalated to your instructor.',
    };
  }
  const res = markAttendance(db, { sessionId, studentId, status: 'present', method: 'qr', actorRole: 'student' });
  if (!res.ok) return res;
  token.used = true;
  token.usedAt = Date.now();
  return res;
}
