import { describe, it, expect } from 'vitest';
import { buildSeed } from '../seed.js';
import { redeemToken, getTokenForStudent } from '../qr.js';
import { recordViolation, priorViolationCount } from '../policy.js';
import { getViolations } from '../attendance.js';

const seed = () => buildSeed();
const studentByRoll = (db, roll) => db.users.find((u) => u.rollNo === roll);
const openSession = (db) => db.sessions.find((s) => s.status === 'open');

describe('good-standing violation policy', () => {
  it('an eligible student\'s first violation is a private warning, not escalated', () => {
    const db = seed();
    const session = openSession(db);
    const s = studentByRoll(db, '2022-CS-001'); // eligible everywhere
    db.attendanceRecords = db.attendanceRecords.filter((r) => !(r.sessionId === session.id && r.studentId === s.id));
    db.qrTokens = db.qrTokens.filter((t) => !(t.sessionId === session.id && t.studentId === s.id));

    redeemToken(db, { sessionId: session.id, studentId: s.id });          // spend token
    const second = redeemToken(db, { sessionId: session.id, studentId: s.id }); // duplicate
    expect(second.ok).toBe(false);
    expect(second.warning).toBe(true); // good standing → private warning
    const v = getViolations(db, { studentId: s.id })[0];
    expect(v.warning).toBe(true);
    expect(v.escalated).toBe(false);
  });

  it('an already not-eligible student is escalated immediately', () => {
    const db = seed();
    const session = openSession(db);
    const s = studentByRoll(db, '2022-CS-008'); // far below threshold
    // mark 008 present first so the token can be spent, then force the duplicate
    db.attendanceRecords.push({ id: 'r_x', sessionId: session.id, studentId: s.id, status: 'present', method: 'qr', timestamp: Date.now() });
    getTokenForStudent(db, session.id, s.id).used = true;

    const second = redeemToken(db, { sessionId: session.id, studentId: s.id });
    expect(second.warning).toBe(false);
    const v = getViolations(db, { studentId: s.id })[0];
    expect(v.escalated).toBe(true);
  });

  it('a second violation in the same course escalates even for good standing', () => {
    const db = seed();
    const session = openSession(db);
    const s = studentByRoll(db, '2022-CS-001'); // eligible
    const first = recordViolation(db, { studentId: s.id, sessionId: session.id, type: 'duplicate_qr' });
    expect(first.goodStanding).toBe(true);
    const second = recordViolation(db, { studentId: s.id, sessionId: session.id, type: 'duplicate_qr' });
    expect(second.goodStanding).toBe(false);
    expect(second.violation.escalated).toBe(true);
    expect(second.violation.warning).toBe(false);
  });
});
