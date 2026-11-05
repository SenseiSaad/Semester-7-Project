/* csv.js — parsing + validation for attendance CSV uploads.
   Expected format (header optional):  rollNo,status   e.g.  2022-CS-001,present

   Validation rules from the spec:
   - every row is validated; unknown students are SKIPPED (reported, not fatal)
   - duplicates for the same session are BLOCKED (reported per row)
   - malformed rows are reported with their line number */

export function parseCSV(text) {
  const rows = [];
  String(text || '').split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const cells = line.split(',').map((c) => c.trim());
    rows.push({ line: i + 1, cells });
  });
  return rows;
}

/* Validates parsed rows against the db. Returns {valid, skipped} where skipped
   carries {line, rollNo, reason} for every rejected row. */
export function validateAttendanceRows(db, sessionId, parsed) {
  const session = db.sessions.find((s) => s.id === sessionId);
  if (!session) return { valid: [], skipped: [{ line: 0, rollNo: '', reason: 'session not found' }] };

  const byRoll = new Map(db.users.filter((u) => u.role === 'student' && u.rollNo).map((u) => [u.rollNo.toUpperCase(), u]));
  const enrolledIds = new Set(
    db.enrollments.filter((e) => e.courseId === session.courseId).map((e) => e.studentId));
  const alreadyMarked = new Set(
    db.attendanceRecords.filter((r) => r.sessionId === sessionId).map((r) => r.studentId));

  const valid = [];
  const skipped = [];
  const seen = new Set();

  parsed.forEach(({ line, cells }) => {
    const [rawRoll = '', rawStatus = ''] = cells;
    const rollNo = rawRoll.toUpperCase();
    const status = rawStatus.toLowerCase();
    if (line === 1 && /^(roll|rollno|roll_no|student_?id)$/i.test(rollNo)) return; // header
    if (!rollNo) { skipped.push({ line, rollNo, reason: 'missing rollNo' }); return; }
    if (status !== 'present' && status !== 'absent') {
      skipped.push({ line, rollNo, reason: `invalid status "${rawStatus}" (use present/absent)` });
      return;
    }
    if (seen.has(rollNo)) { skipped.push({ line, rollNo, reason: 'duplicate row in file' }); return; }
    seen.add(rollNo);
    const user = byRoll.get(rollNo);
    if (!user) { skipped.push({ line, rollNo, reason: 'unknown student' }); return; }
    if (!enrolledIds.has(user.id)) { skipped.push({ line, rollNo, reason: 'not enrolled in this course' }); return; }
    if (alreadyMarked.has(user.id)) { skipped.push({ line, rollNo, reason: 'already marked for this session (duplicate blocked)' }); return; }
    valid.push({ studentId: user.id, rollNo, status });
  });

  return { valid, skipped };
}
