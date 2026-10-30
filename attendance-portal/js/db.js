/* ============================================================
   AttendEase — shared data layer
   All data lives in localStorage under one key. Deliberate demo
   choice: zero setup, no backend. To go multi-user/production,
   swap this module for a REST client — every page only talks
   to the AEDB API below.
   ============================================================ */
'use strict';

const AEDB = (() => {
  const KEY = 'attendease_db_v1';

  /* ---------- helpers ---------- */

  // Demo-grade string hash for the admin password (NOT production security).
  // Synchronous on purpose so login works even on file:// where crypto.subtle may not.
  function cyrb53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return String(4294967296 * (2097151 & h2) + (h1 >>> 0));
  }

  let seq = 0;
  function uid() { return 'e' + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 7); }

  // Rolls are compared case-insensitively and with collapsed spaces.
  function normRoll(r) { return String(r == null ? '' : r).trim().toUpperCase().replace(/\s+/g, ' '); }

  function todayISO(d = new Date()) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function cleanText(v, max) {
    return String(v == null ? '' : v)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .trim()
      .slice(0, max);
  }

  function pctOf(att, held) { return held > 0 ? (att / held) * 100 : null; }

  /* ---------- seed data (demo) ---------- */

  const SEED_SUBJECTS = [
    { id: 'sub1', code: 'CS-301', name: 'Discrete Mathematics',          faculty: 'Dr. Ayesha Khan'  },
    { id: 'sub2', code: 'CS-302', name: 'Data Structures',               faculty: 'Dr. Bilal Ahmed'  },
    { id: 'sub3', code: 'CS-303', name: 'Database Systems',              faculty: 'Prof. Sara Malik' },
    { id: 'sub4', code: 'CS-304', name: 'Operating Systems',             faculty: 'Dr. Hassan Raza'  },
    { id: 'sub5', code: 'CS-305', name: 'Digital Logic Design',          faculty: 'Prof. Maryam Noor'},
    { id: 'sub6', code: 'CS-306', name: 'Technical & Business Writing',  faculty: 'Ms. Zara Sheikh'  },
  ];
  const SEED_CLASSES = { sub1: 24, sub2: 22, sub3: 26, sub4: 24, sub5: 22, sub6: 24 };

  // t = target attendance ratio; the generator below hits it exactly.
  const SEED_STUDENTS = [
    { roll: '2022-CS-001', name: 'Ahmed Raza',      t: 0.96 },
    { roll: '2022-CS-002', name: 'Fatima Zahra',    t: 0.92 },
    { roll: '2022-CS-003', name: 'Muhammad Bilal',  t: 0.90 },
    { roll: '2022-CS-004', name: 'Ayesha Siddiqui', t: 0.88 },
    { roll: '2022-CS-005', name: 'Usman Ghani',     t: 0.86 },
    { roll: '2022-CS-006', name: 'Hira Naz',        t: 0.84 },
    { roll: '2022-CS-007', name: 'Ali Hamza',       t: 0.82 },
    { roll: '2022-CS-008', name: 'Zainab Tariq',    t: 0.79 },
    { roll: '2022-CS-009', name: 'Hamza Yousuf',    t: 0.78 },
    { roll: '2022-CS-010', name: 'Sana Javed',      t: 0.71 },
    { roll: '2022-CS-011', name: 'Imran Qureshi',   t: 0.66 },
    { roll: '2022-CS-012', name: 'Kamran Shah',     t: 0.48 },
  ];

  function seed() {
    const settings = {
      university: 'Demo University of Engineering & Technology',
      semesterLabel: 'Semester 7 · Fall 2026',
      passMark: 75,          // minimum % required in EVERY subject to sit the exam
      warnMark: 65,          // below this = detained; in between = condonation case
      publicCheck: true,     // students may look themselves up by roll number
      adminUser: 'admin',
      adminPassHash: cyrb53('admin123'),
    };
    const subjects = SEED_SUBJECTS.map(s => ({ ...s }));
    const students = SEED_STUDENTS.map(({ t, ...s }) => ({ ...s, semester: 'Semester 7', section: 'A' }));

    // One log entry = one class of one subject on one date.
    // Absences are scattered deterministically so each student's % lands
    // exactly on their target (a verdict-safe spread for the demo).
    const log = [];
    const WINDOW_DAYS = 70;
    subjects.forEach((sub, si) => {
      const n = SEED_CLASSES[sub.id];
      for (let k = 0; k < n; k++) {
        const d = new Date();
        d.setDate(d.getDate() - Math.round(WINDOW_DAYS * (1 - k / (n - 1))));
        const marks = {};
        SEED_STUDENTS.forEach((st, i) => {
          const absent = Math.round(n * (1 - st.t));
          const isAbsent = ((k * 7 + i * 13) % n) < absent;
          marks[st.roll] = isAbsent ? 0 : 1;
        });
        log.push({ id: uid(), subjectId: sub.id, date: todayISO(d), marks });
      }
    });

    return { settings, subjects, students, log };
  }

  /* ---------- persistence ---------- */

  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { console.error('AttendEase: could not persist data', e); }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const db = JSON.parse(raw);
        if (db && db.settings && Array.isArray(db.students) && Array.isArray(db.subjects) && Array.isArray(db.log)) return db;
      }
    } catch (e) { /* corrupt store -> re-seed below */ }
    const db = seed();
    save(db);
    return db;
  }

  function reset() { localStorage.removeItem(KEY); return load(); }

  /* ---------- rule math ---------- */

  function verdictOf(pct, settings) {
    if (pct == null) return 'none';
    if (pct >= settings.passMark) return 'ok';
    if (pct >= settings.warnMark) return 'warn';
    return 'bad';
  }

  // How many MORE classes can the student miss while staying >= passMark?
  function canSkip(att, held, passMark) {
    if (held <= 0) return 0;
    const p = passMark / 100;
    if (att / held < p) return 0;
    return Math.max(0, Math.floor(att / p - held));
  }

  // How many classes IN A ROW must the student attend to climb back to passMark?
  function needChain(att, held, passMark) {
    if (held <= 0 || att / held >= passMark / 100) return 0;
    return Math.ceil((passMark / 100 * held - att) / (1 - passMark / 100));
  }

  /* ---------- reports ---------- */

  function reportFor(db, roll) {
    roll = normRoll(roll);
    const student = db.students.find(s => s.roll === roll);
    if (!student) return null;
    const s = db.settings;

    const subjects = db.subjects.map(sub => {
      let held = 0, attended = 0;
      for (const e of db.log) {
        if (e.subjectId !== sub.id) continue;
        held++;
        if (e.marks && e.marks[roll] === 1) attended++;
      }
      const pct = pctOf(attended, held);
      return { subject: sub, held, attended, pct, verdict: verdictOf(pct, s) };
    });

    const held = subjects.reduce((a, x) => a + x.held, 0);
    const attended = subjects.reduce((a, x) => a + x.attended, 0);
    const overall = { held, attended, pct: pctOf(attended, held) };

    let status = 'none';
    if (subjects.length && subjects.some(x => x.verdict !== 'none')) {
      status = subjects.every(x => x.verdict === 'ok' || x.verdict === 'none') ? 'ok'
             : subjects.some(x => x.verdict === 'bad') ? 'bad' : 'warn';
    }

    const lastDate = db.log.reduce((m, e) => (e.date > m ? e.date : m), '');
    return { student, subjects, overall, status, lastDate };
  }

  function aggregate(db) {
    const reps = db.students.map(st => reportFor(db, st.roll)).filter(Boolean);
    const counts = { ok: 0, warn: 0, bad: 0 };
    reps.forEach(r => counts[r.status]++);

    const withPct = reps.filter(r => r.overall.held > 0);
    const avgPct = withPct.length ? withPct.reduce((a, r) => a + r.overall.pct, 0) / withPct.length : null;

    const perSubject = db.subjects.map(sub => {
      let held = 0, attended = 0;
      reps.forEach(r => {
        const row = r.subjects.find(x => x.subject.id === sub.id);
        if (row) { held += row.held; attended += row.attended; }
      });
      return { subject: sub, pct: pctOf(attended, held) };
    });

    const watchlist = [...withPct].sort((a, b) => a.overall.pct - b.overall.pct).slice(0, 5);
    const lastDate = db.log.reduce((m, e) => (e.date > m ? e.date : m), '');

    return {
      counts, avgPct, perSubject, watchlist, lastDate,
      totalStudents: db.students.length,
      totalEntries: db.log.length,
      totalSubjects: db.subjects.length,
    };
  }

  /* ---------- students CRUD ---------- */

  const ROLL_RE = /^[A-Z0-9][A-Z0-9\-\/ ]{1,19}$/; // tested AFTER normRoll

  function addStudent(db, input) {
    const roll = normRoll(input.roll);
    const name = cleanText(input.name, 40);
    if (!roll) return { ok: false, error: 'Roll number is required.' };
    if (!ROLL_RE.test(roll)) return { ok: false, error: 'Roll number must be 2–20 characters (letters, digits, dash, slash, spaces only).' };
    if (db.students.some(s => s.roll === roll)) return { ok: false, error: 'A student with this roll number already exists.' };
    if (name.length < 2) return { ok: false, error: 'Name must be at least 2 characters.' };
    const student = {
      roll, name,
      semester: cleanText(input.semester, 20) || 'Semester 7',
      section: cleanText(input.section, 10) || 'A',
    };
    db.students.push(student);
    save(db);
    return { ok: true, student };
  }

  function updateStudent(db, oldRoll, patch) {
    oldRoll = normRoll(oldRoll);
    const st = db.students.find(s => s.roll === oldRoll);
    if (!st) return { ok: false, error: 'Student not found.' };

    if (patch.roll != null) {
      const nr = normRoll(patch.roll);
      if (!nr) return { ok: false, error: 'Roll number is required.' };
      if (!ROLL_RE.test(nr)) return { ok: false, error: 'Roll number must be 2–20 characters (letters, digits, dash, slash, spaces only).' };
      if (db.students.some(s => s.roll === nr && s.roll !== oldRoll)) return { ok: false, error: 'Another student already uses this roll number.' };
      if (nr !== oldRoll) {
        // carry their attendance history to the new roll
        db.log.forEach(e => {
          if (e.marks && e.marks[oldRoll] !== undefined) { e.marks[nr] = e.marks[oldRoll]; delete e.marks[oldRoll]; }
        });
        st.roll = nr;
      }
    }
    if (patch.name != null) {
      const n = cleanText(patch.name, 40);
      if (n.length < 2) return { ok: false, error: 'Name must be at least 2 characters.' };
      st.name = n;
    }
    if (patch.semester != null) st.semester = cleanText(patch.semester, 20) || st.semester;
    if (patch.section != null) st.section = cleanText(patch.section, 10) || st.section;
    save(db);
    return { ok: true };
  }

  function deleteStudent(db, roll) {
    roll = normRoll(roll);
    const before = db.students.length;
    db.students = db.students.filter(s => s.roll !== roll);
    db.log.forEach(e => { if (e.marks) delete e.marks[roll]; }); // no orphan marks
    save(db);
    return { ok: db.students.length < before };
  }

  /* ---------- subjects CRUD ---------- */

  function addSubject(db, input) {
    const code = cleanText(input.code, 20);
    const name = cleanText(input.name, 60);
    const faculty = cleanText(input.faculty, 60);
    if (!code) return { ok: false, error: 'Subject code is required.' };
    if (!name) return { ok: false, error: 'Subject name is required.' };
    if (db.subjects.some(s => s.code.toLowerCase() === code.toLowerCase())) return { ok: false, error: 'A subject with this code already exists.' };
    const subject = { id: uid(), code, name, faculty };
    db.subjects.push(subject);
    save(db);
    return { ok: true, subject };
  }

  function updateSubject(db, id, patch) {
    const sub = db.subjects.find(s => s.id === id);
    if (!sub) return { ok: false, error: 'Subject not found.' };
    if (patch.code != null) {
      const c = cleanText(patch.code, 20);
      if (!c) return { ok: false, error: 'Subject code is required.' };
      if (db.subjects.some(s => s.code.toLowerCase() === c.toLowerCase() && s.id !== id)) return { ok: false, error: 'Another subject already uses this code.' };
      sub.code = c;
    }
    if (patch.name != null) { const n = cleanText(patch.name, 60); if (!n) return { ok: false, error: 'Subject name is required.' }; sub.name = n; }
    if (patch.faculty != null) sub.faculty = cleanText(patch.faculty, 60);
    save(db);
    return { ok: true };
  }

  function deleteSubject(db, id) {
    db.subjects = db.subjects.filter(s => s.id !== id);
    db.log = db.log.filter(e => e.subjectId !== id); // drop that subject's classes too
    save(db);
    return { ok: true };
  }

  /* ---------- attendance ---------- */

  function saveDay(db, subjectId, date, marks) {
    if (!db.subjects.some(s => s.id === subjectId)) return { ok: false, error: 'Unknown subject.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return { ok: false, error: 'Pick a valid date.' };
    if (date > todayISO()) return { ok: false, error: 'Attendance cannot be marked for a future date.' };
    // keep only known students; coerce everything else to present(1)/absent(0)
    const clean = {};
    db.students.forEach(st => { clean[st.roll] = marks && marks[st.roll] === 0 ? 0 : 1; });
    const existing = db.log.find(e => e.subjectId === subjectId && e.date === date);
    let replaced = false;
    if (existing) { existing.marks = clean; replaced = true; }
    else db.log.push({ id: uid(), subjectId, date, marks: clean });
    save(db);
    return { ok: true, replaced };
  }

  function deleteDay(db, id) {
    db.log = db.log.filter(e => e.id !== id);
    save(db);
    return { ok: true };
  }

  function classesHeld(db, subjectId) { return db.log.filter(e => e.subjectId === subjectId).length; }

  /* ---------- CSV (with spreadsheet formula-injection guard) ---------- */

  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralize =cmd / =HYPERLINK style injection
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csv(rows) { return rows.map(r => r.map(csvCell).join(',')).join('\r\n'); }

  /* ---------- public API ---------- */

  return {
    KEY, load, save, seed, reset,
    normRoll, todayISO, cleanText, pctOf,
    verdictOf, canSkip, needChain,
    reportFor, aggregate,
    addStudent, updateStudent, deleteStudent,
    addSubject, updateSubject, deleteSubject,
    saveDay, deleteDay, classesHeld,
    csv, csvCell,
    hash: cyrb53,
  };
})();
