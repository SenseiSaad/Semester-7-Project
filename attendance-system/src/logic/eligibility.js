/* eligibility.js — pure calculations. Every function takes the db object as
   its first argument and touches nothing else, so tests can pass plain objects.

   percentage = present / sessions_held * 100, with sessions_held = 0 handled
   explicitly (percentage null, not eligible) — the division-by-zero edge case. */

export function sessionsHeld(db, courseId) {
  return db.sessions.filter((s) => s.courseId === courseId).length;
}

export function courseOf(db, courseId) {
  return db.courses.find((c) => c.id === courseId) || null;
}

export function studentOf(db, studentId) {
  return db.users.find((u) => u.id === studentId) || null;
}

export function attendanceCount(db, studentId, courseId) {
  const sessionIds = new Set(db.sessions.filter((s) => s.courseId === courseId).map((s) => s.id));
  let present = 0;
  for (const r of db.attendanceRecords) {
    if (r.studentId === studentId && r.status === 'present' && sessionIds.has(r.sessionId)) present++;
  }
  return present;
}

export function getStudentCourseSummary(db, studentId, courseId) {
  const course = courseOf(db, courseId);
  const held = sessionsHeld(db, courseId);
  const present = attendanceCount(db, studentId, courseId);
  const percentage = held > 0 ? (present / held) * 100 : null;
  return {
    percentage,
    // no sessions held yet → nobody is eligible (division-by-zero rule)
    eligible: percentage != null && course != null && percentage >= course.eligibilityThreshold,
    missedClasses: Math.max(0, held - present),
    present,
    held,
    threshold: course ? course.eligibilityThreshold : null,
  };
}

export function getCourseEligibilityList(db, courseId) {
  return db.enrollments
    .filter((e) => e.courseId === courseId)
    .map((e) => {
      const student = studentOf(db, e.studentId);
      const summary = getStudentCourseSummary(db, e.studentId, courseId);
      return {
        studentId: e.studentId,
        name: student ? student.name : 'Unknown',
        rollNo: student ? student.rollNo : '',
        ...summary,
      };
    })
    .sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1));
}

export function eligibilityStats(db, courseId) {
  const rows = getCourseEligibilityList(db, courseId);
  const withPct = rows.filter((r) => r.percentage != null);
  return {
    rows,
    eligible: rows.filter((r) => r.eligible).length,
    notEligible: rows.length - rows.filter((r) => r.eligible).length,
    avg: withPct.length ? withPct.reduce((a, r) => a + r.percentage, 0) / withPct.length : null,
  };
}

const csvCell = (v) => {
  let s = String(v ?? '');
  if (s && /^[=+\-@\t\r]/.test(s)) s = "'" + s; // spreadsheet formula-injection guard
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export function exportEligibilityCSV(db, courseId) {
  const course = courseOf(db, courseId);
  const rows = getCourseEligibilityList(db, courseId);
  const head = ['Roll No', 'Name', 'Present', 'Sessions held', 'Percentage', 'Eligible', 'Missed'];
  const lines = [head.join(',')];
  for (const r of rows) {
    lines.push([r.rollNo, r.name, r.present, r.held,
      r.percentage == null ? '' : r.percentage.toFixed(1),
      r.eligible ? 'yes' : 'no', r.missedClasses].map(csvCell).join(','));
  }
  return { filename: `${course ? course.code : 'course'}-eligibility.csv`, text: lines.join('\r\n') };
}
