/* policy.js — the violation policy ("terms and conditions") in code.

   A violation is logged for every rejected QR reuse. What happens next depends
   on the student's standing in that course:

   - GOOD STANDING (first violation in the course AND currently eligible):
     the event stays a private WARNING. The student sees it in their alerts;
     it is NOT escalated to the instructor's main violations log.
   - OTHERWISE (repeat violation, or already below the threshold):
     the violation is ESCALATED — it appears in the instructor's log.

   The instructor can always see warnings in a separate, clearly-marked
   section: nothing is hidden, only not escalated. */

import { addViolation, findSession } from './attendance.js';
import { getStudentCourseSummary } from './eligibility.js';

export function priorViolationCount(db, studentId, courseId, exceptId = null) {
  return db.violations.filter((v) => {
    if (v.studentId !== studentId || v.id === exceptId) return false;
    const s = findSession(db, v.sessionId);
    return s && s.courseId === courseId;
  }).length;
}

export function recordViolation(db, { studentId, sessionId, type }) {
  const v = addViolation(db, { studentId, sessionId, type });
  const session = findSession(db, sessionId);
  const courseId = session ? session.courseId : null;
  const summary = courseId ? getStudentCourseSummary(db, studentId, courseId) : { eligible: false };
  const first = priorViolationCount(db, studentId, courseId, v.id) === 0;
  const goodStanding = Boolean(courseId) && summary.eligible && first;

  v.warning = goodStanding;      // private warning, not escalated
  v.escalated = !goodStanding;   // instructor's log
  return { violation: v, goodStanding };
}
