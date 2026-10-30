/* Node-based unit tests for the pure logic in js/db.js.
   Run: node test/unit.js  (shims localStorage + window-free environment) */
'use strict';

// minimal localStorage shim (db.js only touches it in load/save/reset)
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'db.js'), 'utf8') + '\n;globalThis.AEDB = AEDB;');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ FAIL: ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function eq(a, b, name) { ok(a === b, name, { got: a, want: b }); }
function near(a, b, eps, name) { ok(Math.abs(a - b) <= eps, name, { got: a, want: b }); }

console.log('— seed & verdicts —');
const db = AEDB.load();
eq(db.students.length, 12, '12 seeded students');
eq(db.subjects.length, 6, '6 seeded subjects');
const heldPerSubject = db.subjects.map(s => db.log.filter(e => e.subjectId === s.id).length);
ok(heldPerSubject.every(h => h > 0), 'every subject has classes', heldPerSubject);

// verify the scatter generator really hits each target
const targets = [0.96, 0.92, 0.90, 0.88, 0.86, 0.84, 0.82, 0.79, 0.78, 0.71, 0.66, 0.48];
db.students.forEach((st, i) => {
  const rep = AEDB.reportFor(db, st.roll);
  const expectAbsent = db.subjects.map(s => Math.round(heldPerSubject[db.subjects.indexOf(s)] * (1 - targets[i])));
  const actual = rep.subjects.map(r => r.held - r.attended);
  ok(JSON.stringify(actual) === JSON.stringify(expectAbsent),
     `absences exact for ${st.roll} (target ${(targets[i] * 100).toFixed(0)}%)`, { actual, expectAbsent });
});

const statuses = db.students.map(st => AEDB.reportFor(db, st.roll).status);
eq(statuses.filter(s => s === 'ok').length, 9, '9 students eligible');
eq(statuses.filter(s => s === 'warn').length, 2, '2 students at risk');
eq(statuses.filter(s => s === 'bad').length, 1, '1 student not eligible');

console.log('— canSkip / needChain math —');
eq(AEDB.canSkip(23, 24, 75), 6, 'canSkip 23/24 → 6');
eq(AEDB.canSkip(23, 25, 75), 5, 'canSkip 23/25 → 5');
eq(AEDB.canSkip(18, 24, 75), 0, 'canSkip at exactly 75% → 0');
eq(AEDB.canSkip(17, 24, 75), 0, 'canSkip below threshold → 0');
eq(AEDB.needChain(17, 24, 75), 4, 'needChain 17/24 → 4');
eq(AEDB.needChain(16, 24, 75), 8, 'needChain 16/24 → 8');
eq(AEDB.needChain(18, 24, 75), 0, 'needChain at threshold → 0');
eq(AEDB.needChain(0, 0, 75), 0, 'needChain no classes → 0');
// verify needChain claim by simulation
for (const [att, held] of [[10, 20], [3, 15], [30, 50], [1, 5]]) {
  const n = AEDB.needChain(att, held, 75);
  ok((att + n) / (held + n) >= 0.75, `needChain ${att}/${held} simulates to ≥75% (n=${n})`);
  ok(n === 0 || (att + n - 1) / (held + n - 1) < 0.75, `needChain ${att}/${held} is minimal (n=${n})`);
}
// verify canSkip claim by simulation
for (const [att, held] of [[23, 24], [40, 50], [100, 120], [7, 8]]) {
  const x = AEDB.canSkip(att, held, 75);
  ok(att / (held + x) >= 0.75, `canSkip ${att}/${held} simulates to ≥75% (x=${x})`);
  ok(att / (held + x + 1) < 0.75, `canSkip ${att}/${held} is maximal (x=${x})`);
}

console.log('— roll normalization & validation —');
eq(AEDB.normRoll('  2022-cs-001 '), '2022-CS-001', 'normRoll trims + uppercases');
const add = (input) => AEDB.addStudent(db, input);
ok(!add({ roll: '', name: 'A B' }).ok, 'empty roll rejected');
ok(!add({ roll: '2022-CS-001', name: 'Duplicate' }).ok, 'duplicate roll rejected');
ok(!add({ roll: '2022-cs-001', name: 'Dup case' }).ok, 'duplicate roll rejected case-insensitively');
ok(!add({ roll: '<img src=x>', name: 'Xss' }).ok, 'roll with HTML rejected');
ok(!add({ roll: 'OK-ROLL-1', name: 'A' }).ok, '1-char name rejected');
ok(!add({ roll: 'OK-ROLL-1', name: '   ' }).ok, 'blank name rejected');
const r1 = add({ roll: ' test-roll-9 ', name: '  Test Person  ' });
ok(r1.ok && r1.student.roll === 'TEST-ROLL-9', 'valid add normalizes roll', r1);

console.log('— update / delete keeps log consistent —');
const u1 = AEDB.updateStudent(db, 'TEST-ROLL-9', { roll: 'TEST-ROLL-10' });
ok(u1.ok, 'roll rename works');
ok(!AEDB.updateStudent(db, '2022-CS-001', { roll: 'TEST-ROLL-10' }).ok, 'rename onto existing roll rejected');
ok(!AEDB.updateStudent(db, 'NOPE', { name: 'Ghost' }).ok, 'rename of missing student rejected');
// rename a seeded student: marks must follow
const before = AEDB.reportFor(db, '2022-CS-005').overall;
ok(AEDB.updateStudent(db, '2022-CS-005', { roll: 'MOVED-1' }).ok, 'seeded rename ok');
const after = AEDB.reportFor(db, 'MOVED-1').overall;
eq(before.attended, after.attended, 'attendance follows roll rename');
ok(!AEDB.reportFor(db, '2022-CS-005'), 'old roll gone');
AEDB.updateStudent(db, 'MOVED-1', { roll: '2022-CS-005' });

const del = AEDB.deleteStudent(db, 'TEST-ROLL-10');
ok(del.ok, 'delete student works');
ok(!AEDB.reportFor(db, 'TEST-ROLL-10'), 'deleted student has no report');
const orphanMarks = db.log.reduce((n, e) => n + (e.marks['TEST-ROLL-10'] !== undefined ? 1 : 0), 0);
eq(orphanMarks, 0, 'no orphan marks after delete');

console.log('— attendance day handling —');
// a date outside the seeded 70-day window so we don't collide with demo records
const pastD = new Date(); pastD.setDate(pastD.getDate() - 100);
const pastFree = pastD.getFullYear() + '-' + String(pastD.getMonth() + 1).padStart(2, '0') + '-' + String(pastD.getDate()).padStart(2, '0');
const d = new Date(); d.setDate(d.getDate() + 5);
const futureISO = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
ok(!AEDB.saveDay(db, db.subjects[0].id, futureISO, {}).ok, 'future date rejected');
ok(!AEDB.saveDay(db, 'sub-x', pastFree, {}).ok, 'unknown subject rejected');
ok(!AEDB.saveDay(db, db.subjects[0].id, 'not-a-date', {}).ok, 'malformed date rejected');
const held0 = AEDB.classesHeld(db, db.subjects[0].id);
const marks = {}; db.students.forEach(s => marks[s.roll] = s.roll === '2022-CS-001' ? 0 : 1);
let res = AEDB.saveDay(db, db.subjects[0].id, pastFree, marks);
ok(res.ok && !res.replaced, 'save new day works');
eq(AEDB.classesHeld(db, db.subjects[0].id), held0 + 1, 'classes held incremented');
res = AEDB.saveDay(db, db.subjects[0].id, pastFree, marks);
ok(res.ok && res.replaced, 'same day re-save replaces, not duplicates');
eq(AEDB.classesHeld(db, db.subjects[0].id), held0 + 1, 'no duplicate entry after re-save');
// junk marks object is coerced
ok(AEDB.saveDay(db, db.subjects[0].id, pastFree, { '2022-CS-001': 0, HACKER: 1, '2022-CS-002': 'yes' }).ok, 'junk marks tolerated');
const e2 = db.log.find(e => e.subjectId === db.subjects[0].id && e.date === pastFree);
ok(e2.marks['2022-CS-001'] === 0, 'absent recorded');
ok(e2.marks['2022-CS-002'] === 1, 'non-zero coerced to present');
ok(e2.marks['HACKER'] === undefined, 'unknown roll dropped from marks');
AEDB.deleteDay(db, e2.id);
eq(AEDB.classesHeld(db, db.subjects[0].id), held0, 'deleteDay restores count');

console.log('— subjects —');
ok(!AEDB.addSubject(db, { code: 'CS-301', name: 'Dup' }).ok, 'duplicate subject code rejected (case-insensitive)');
ok(!AEDB.addSubject(db, { code: '', name: 'X' }).ok, 'empty code rejected');
const s1 = AEDB.addSubject(db, { code: 'CS-999', name: 'Test Subject', faculty: 'T.F.' });
ok(s1.ok, 'subject add works');
const subId = s1.subject.id;
const m2 = {}; db.students.forEach(st => m2[st.roll] = 1);
AEDB.saveDay(db, subId, pastFree, m2);
AEDB.deleteSubject(db, subId);
eq(db.log.filter(e => e.subjectId === subId).length, 0, 'subject delete removes its class log');
ok(!db.subjects.some(s => s.id === subId), 'subject gone');

console.log('— CSV injection guard —');
eq(AEDB.csvCell('=HYPERLINK("http://evil","pwn")'), '"\'=HYPERLINK(""http://evil"",""pwn"")"', '=formula cell neutralized (apostrophe + proper quoting)');
eq(AEDB.csvCell('+1+1'), "'+1+1", '+ neutralized');
eq(AEDB.csvCell('-2+3'), "'-2+3", '- neutralized');
eq(AEDB.csvCell('@x'), "'@x", '@ neutralized');
eq(AEDB.csvCell('Normal, "name"'), '"Normal, ""name"""', 'quotes/commas wrapped');
eq(AEDB.csv([['r1c1', 'r1c2'], ['r2c1', 'r2c2']]), 'r1c1,r1c2\r\nr2c1,r2c2', 'csv() row joining');

console.log('— settings validation sanity —');
ok(AEDB.verdictOf(75, { passMark: 75, warnMark: 65 }) === 'ok', 'exactly 75% is eligible');
ok(AEDB.verdictOf(74.9, { passMark: 75, warnMark: 65 }) === 'warn', '74.9% is at risk');
ok(AEDB.verdictOf(65, { passMark: 75, warnMark: 65 }) === 'warn', 'exactly 65% is at risk');
ok(AEDB.verdictOf(64.9, { passMark: 75, warnMark: 65 }) === 'bad', '64.9% is detained');
ok(AEDB.verdictOf(null, { passMark: 75, warnMark: 65 }) === 'none', 'no data verdict');

console.log('— persistence —');
const raw = JSON.parse(store['attendease_db_v1']);
ok(Array.isArray(raw.log) && raw.log.length > 0, 'db persisted to localStorage');
AEDB.deleteStudent(db, '2022-CS-012');
const db2 = AEDB.load();
ok(db2.students.length === db.students.length, 'load returns saved state');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
