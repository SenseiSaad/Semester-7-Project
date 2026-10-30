/* Admin console — single admin account, session kept in sessionStorage.
   Views: Overview · Students · Subjects · Mark attendance · Reports · Settings */
'use strict';
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  let db = AEDB.load();

  /* ---------- tiny UI helpers ---------- */

  let toastTimer;
  function toast(msg, type = 'ok') {
    const root = $('#toast-root');
    root.innerHTML = `<div class="toast t-${type}">${esc(msg)}</div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { root.innerHTML = ''; }, 2800);
  }

  function fmtPct(p) { return p == null ? '—' : p.toFixed(1) + '%'; }
  function pctClass(p) { return p == null ? 'pct-none' : p >= db.settings.passMark ? 'pct-ok' : p >= db.settings.warnMark ? 'pct-warn' : 'pct-bad'; }

  function badgeOf(v) {
    return v === 'ok' ? '<span class="badge b-ok">Eligible</span>'
         : v === 'warn' ? '<span class="badge b-warn">At risk</span>'
         : v === 'bad' ? '<span class="badge b-bad">Not eligible</span>'
         : '<span class="badge b-muted">No data</span>';
  }

  function armDelete(btn, fn, label = 'Confirm?') {
    if (btn.dataset.armed) { fn(); return; }
    btn.dataset.armed = '1';
    const old = btn.innerHTML;
    btn.classList.add('btn-armed');
    btn.textContent = label;
    setTimeout(() => {
      if (!btn.isConnected) return;
      delete btn.dataset.armed;
      btn.classList.remove('btn-armed');
      btn.innerHTML = old;
    }, 3000);
  }

  function openModal(html, wide) {
    $('#modal-root').innerHTML =
      `<div class="modal-backdrop" id="mb"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`;
    $('#mb').addEventListener('mousedown', e => { if (e.target.id === 'mb') closeModal(); });
    const first = $('#mb .input');
    if (first) first.focus();
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  function downloadCsv(filename, rows) {
    const blob = new Blob(['\ufeff' + AEDB.csv(rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  const ICONS = {
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    printer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  };

  /* ================= AUTH ================= */

  const AUTH_KEY = 'ae_admin';
  const FAIL_KEY = 'ae_fails', LOCK_KEY = 'ae_lockuntil';
  const MAX_FAILS = 3, LOCK_MS = 30 * 1000;
  const isAuthed = () => sessionStorage.getItem(AUTH_KEY) === '1';

  function lockRemaining() { return Math.max(0, (+localStorage.getItem(LOCK_KEY) || 0) - Date.now()); }

  function attemptLogin(user, pass) {
    if (lockRemaining() > 0) return { ok: false, error: `Too many failed attempts. Locked for ${Math.ceil(lockRemaining() / 1000)}s.` };
    const s = db.settings;
    if (user === s.adminUser && AEDB.hash(pass) === s.adminPassHash) {
      sessionStorage.setItem(AUTH_KEY, '1');
      localStorage.removeItem(FAIL_KEY);
      return { ok: true };
    }
    const fails = (+localStorage.getItem(FAIL_KEY) || 0) + 1;
    if (fails >= MAX_FAILS) {
      localStorage.setItem(LOCK_KEY, String(Date.now() + LOCK_MS));
      localStorage.removeItem(FAIL_KEY);
      return { ok: false, error: 'Too many failed attempts. Login locked for 30 seconds.' };
    }
    return { ok: false, error: `Wrong username or password (attempt ${fails} of ${MAX_FAILS}).` };
  }

  function showLogin() {
    $('#login-screen').classList.remove('hidden');
    $('#app').classList.add('hidden');
    // honor an existing lockout even after a page refresh
    const tick = () => {
      const left = lockRemaining();
      const btn = $('#login-btn');
      if (!btn) return;
      if (left > 0) {
        btn.disabled = true;
        btn.textContent = `Locked — retry in ${Math.ceil(left / 1000)}s`;
      } else {
        btn.disabled = false;
        btn.textContent = 'Sign in';
      }
    };
    tick();
    clearInterval(showLogin._iv);
    showLogin._iv = setInterval(tick, 500);
  }
  function showApp() {
    $('#login-screen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#side-uni').textContent = db.settings.university;
    render();
  }

  $('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const res = attemptLogin($('#login-user').value.trim(), $('#login-pass').value);
    const err = $('#login-error');
    if (!res.ok) {
      err.textContent = res.error;
      err.classList.remove('hidden');
      if (lockRemaining() > 0) $('#login-btn').disabled = true;
      return;
    }
    err.classList.add('hidden');
    $('#login-pass').value = '';
    showApp();
  });

  $('#logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem(AUTH_KEY);
    history.replaceState(null, '', location.pathname);
    showLogin();
  });

  /* ================= ROUTER ================= */

  const TITLES = {
    overview: 'Overview', students: 'Students', subjects: 'Subjects',
    attendance: 'Mark attendance', reports: 'Reports', settings: 'Settings',
  };

  function render() {
    if (!isAuthed()) { showLogin(); return; }
    const view = (location.hash.slice(1) || 'overview');
    if (!TITLES[view]) { history.replaceState(null, '', '#overview'); return render(); }
    $$('#side-nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    $('#view-title').textContent = TITLES[view];
    ({ overview: viewOverview, students: viewStudents, subjects: viewSubjects,
       attendance: viewAttendance, reports: viewReports, settings: viewSettings }[view])();
  }
  window.addEventListener('hashchange', render);

  /* ================= VIEW: OVERVIEW ================= */

  function viewOverview() {
    const a = AEDB.aggregate(db);
    const { ok, warn, bad } = a.counts;
    const total = ok + warn + bad;
    const donut = total > 0
      ? `background:conic-gradient(var(--ok) 0 ${ok / total * 100}%, var(--warn) 0 ${(ok + warn) / total * 100}%, var(--bad) 0 100%)`
      : 'background:#e2e8f0';

    $('#view').innerHTML = `
      <div class="stat-grid">
        <div class="card stat"><div class="s-label">Students</div><div class="s-value">${a.totalStudents}</div><div class="s-sub">enrolled this semester</div></div>
        <div class="card stat"><div class="s-label">Classes recorded</div><div class="s-value">${a.totalEntries}</div><div class="s-sub">across ${a.totalSubjects} subjects</div></div>
        <div class="card stat"><div class="s-label">Average attendance</div><div class="s-value">${a.avgPct == null ? '—' : a.avgPct.toFixed(1) + '%'}</div><div class="s-sub">semester to date</div></div>
        <div class="card stat"><div class="s-label">Last marked</div><div class="s-value" style="font-size:22px;padding-top:6px">${a.lastDate || '—'}</div><div class="s-sub">most recent class date</div></div>
      </div>

      <div class="grid-2">
        <div class="card card-pad">
          <h3 style="font-size:15px;margin-bottom:16px">Exam eligibility distribution</h3>
          <div class="donut-wrap">
            <div class="donut" style="${donut}">
              <div class="donut-label"><b>${total ? Math.round(ok / total * 100) + '%' : '—'}</b><span>eligible</span></div>
            </div>
            <div class="legend">
              <div class="li"><span class="dot" style="background:var(--ok)"></span>Eligible (≥ ${db.settings.passMark}%)<b>${ok}</b></div>
              <div class="li"><span class="dot" style="background:var(--warn)"></span>At risk — condonation<b>${warn}</b></div>
              <div class="li"><span class="dot" style="background:var(--bad)"></span>Not eligible<b>${bad}</b></div>
            </div>
          </div>
        </div>

        <div class="card card-pad">
          <h3 style="font-size:15px;margin-bottom:16px">Average attendance by subject</h3>
          <div class="bar-chart">
            ${a.perSubject.map(r => `
              <div class="brow">
                <span class="blabel" title="${esc(r.subject.name)}">${esc(r.subject.code)}</span>
                <div class="btrack"><div class="bfill" style="width:${r.pct == null ? 0 : Math.min(100, r.pct)}%"></div></div>
                <span class="bval">${fmtPct(r.pct)}</span>
              </div>`).join('') || '<div class="empty">No subjects yet.</div>'}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div><h3>Watchlist — students closest to losing eligibility</h3><div class="sub">Lowest overall attendance first</div></div>
          <a class="btn btn-ghost btn-sm" href="#students">All students</a>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Roll</th><th>Name</th><th>Overall</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${a.watchlist.map(r => `
                <tr>
                  <td class="cell-main">${esc(r.student.roll)}</td>
                  <td>${esc(r.student.name)}</td>
                  <td style="min-width:160px"><div class="mini-progress"><div class="progress ${r.status}"><i style="width:${Math.min(100, r.overall.pct)}%"></i></div><b class="${pctClass(r.overall.pct)}">${fmtPct(r.overall.pct)}</b></div></td>
                  <td>${badgeOf(r.status)}</td>
                  <td class="actions"><a class="icon-btn" title="Open student report" href="check.html?roll=${encodeURIComponent(r.student.roll)}" target="_blank" rel="noopener">${ICONS.eye}</a></td>
                </tr>`).join('') || '<tr><td colspan="5"><div class="empty">No attendance data yet.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  /* ================= VIEW: STUDENTS ================= */

  function viewStudents() {
    const q = ($('#student-search')?.value || '').trim().toLowerCase();
    const students = db.students
      .filter(s => !q || s.roll.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .map(s => ({ s, r: AEDB.reportFor(db, s.roll) }));

    $('#view').innerHTML = `
      <div class="card">
        <div class="card-head" style="flex-wrap:wrap">
          <div><h3>Enrolled students (${db.students.length})</h3><div class="sub">Attendance is computed live from the class log</div></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <div class="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input class="input" id="student-search" placeholder="Search roll or name…" value="${esc(q)}">
            </div>
            <button class="btn btn-ghost btn-sm" id="export-students">${ICONS.download} CSV</button>
            <button class="btn btn-primary btn-sm" id="add-student">${ICONS.plus} Add student</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Roll</th><th>Name</th><th>Overall</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${students.map(({ s, r }) => `
                <tr data-roll="${esc(s.roll)}">
                  <td class="cell-main">${esc(s.roll)}</td>
                  <td>${esc(s.name)}<div class="cell-sub">${esc(s.semester || '')}${s.section ? ' · Sec ' + esc(s.section) : ''}</div></td>
                  <td style="min-width:160px">
                    ${r.overall.held ? `<div class="mini-progress"><div class="progress ${r.status}"><i style="width:${Math.min(100, r.overall.pct)}%"></i></div><b class="${pctClass(r.overall.pct)}">${fmtPct(r.overall.pct)}</b></div>` : '<span class="pct-none">no classes yet</span>'}
                  </td>
                  <td>${badgeOf(r.status)}</td>
                  <td class="actions">
                    <button class="icon-btn act-view" title="Per-subject report">${ICONS.eye}</button>
                    <button class="icon-btn act-edit" title="Edit">${ICONS.edit}</button>
                    <button class="icon-btn danger act-del" title="Delete">${ICONS.trash}</button>
                  </td>
                </tr>`).join('') || `<tr><td colspan="5"><div class="empty"><b>${q ? 'No match for "' + esc(q) + '"' : 'No students yet'}</b>Add students to start tracking attendance.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;

    let deb;
    $('#student-search').addEventListener('input', () => {
      clearTimeout(deb);
      deb = setTimeout(() => viewStudents(), 250);
    });
    $('#student-search').focus();

    $('#add-student').addEventListener('click', () => studentModal(null));
    $('#export-students').addEventListener('click', () => {
      const rows = [['Roll', 'Name', 'Semester', 'Section', 'Overall %', 'Status']];
      students.forEach(({ s, r }) => rows.push([s.roll, s.name, s.semester || '', s.section || '',
        r.overall.pct == null ? '' : r.overall.pct.toFixed(1), r.status]));
      downloadCsv('attendease-students.csv', rows);
      toast('CSV exported (check your downloads)');
    });

    $$('#view tbody tr[data-roll]').forEach(tr => {
      const roll = tr.dataset.roll;
      $('.act-view', tr).addEventListener('click', () => studentDetailModal(roll));
      $('.act-edit', tr).addEventListener('click', () => studentModal(roll));
      $('.act-del', tr).addEventListener('click', (e) => armDelete(e.currentTarget, () => {
        const st = db.students.find(s => s.roll === roll);
        AEDB.deleteStudent(db, roll);
        toast(`Deleted ${st ? st.name : roll} and their attendance marks`);
        render();
      }, 'Sure?'));
    });
  }

  function studentModal(roll) {
    const st = roll ? db.students.find(s => s.roll === roll) : null;
    openModal(`
      <h3>${st ? 'Edit student' : 'Add student'}</h3>
      <form id="student-form">
        <div class="field">
          <label>Roll number</label>
          <input class="input" id="f-roll" maxlength="24" value="${esc(st ? st.roll : '')}" placeholder="e.g. 2022-CS-013" ${st ? '' : 'autofocus'}>
          <div class="hint">Letters, digits, dash, slash. Case and extra spaces are normalized.</div>
        </div>
        <div class="field"><label>Full name</label><input class="input" id="f-name" maxlength="40" value="${esc(st ? st.name : '')}" placeholder="e.g. Ayesha Khan"></div>
        <div class="field-row">
          <div class="field"><label>Semester</label><input class="input" id="f-sem" maxlength="20" value="${esc(st ? (st.semester || '') : 'Semester 7')}"></div>
          <div class="field"><label>Section</label><input class="input" id="f-sec" maxlength="10" value="${esc(st ? (st.section || '') : 'A')}"></div>
        </div>
        <div class="error-text hidden" id="form-err"></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" id="m-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">${st ? 'Save changes' : 'Add student'}</button>
        </div>
      </form>`);

    $('#m-cancel').addEventListener('click', closeModal);
    $('#student-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = { roll: $('#f-roll').value, name: $('#f-name').value, semester: $('#f-sem').value, section: $('#f-sec').value };
      const res = st ? AEDB.updateStudent(db, roll, data) : AEDB.addStudent(db, data);
      if (!res.ok) { const el = $('#form-err'); el.textContent = res.error; el.classList.remove('hidden'); return; }
      closeModal();
      toast(st ? 'Student updated' : 'Student added');
      render();
    });
  }

  function studentDetailModal(roll) {
    const r = AEDB.reportFor(db, roll);
    if (!r) return;
    openModal(`
      <h3>${esc(r.student.name)} <span class="roll-chip">${esc(r.student.roll)}</span></h3>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Subject</th><th>Attended</th><th>%</th><th>Status</th></tr></thead>
          <tbody>
            ${r.subjects.map(s => `
              <tr>
                <td><span class="cell-main">${esc(s.subject.code)}</span> ${esc(s.subject.name)}</td>
                <td class="num">${s.attended} / ${s.held}</td>
                <td class="num ${pctClass(s.pct)}">${fmtPct(s.pct)}</td>
                <td>${badgeOf(s.verdict)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="modal-foot">
        <a class="btn btn-ghost" href="check.html?roll=${encodeURIComponent(r.student.roll)}" target="_blank" rel="noopener">Open student view</a>
        <button class="btn btn-primary" id="m-close">Done</button>
      </div>`, true);
    $('#m-close').addEventListener('click', closeModal);
  }

  /* ================= VIEW: SUBJECTS ================= */

  function viewSubjects() {
    $('#view').innerHTML = `
      <div class="card">
        <div class="card-head">
          <div><h3>Subjects (${db.subjects.length})</h3><div class="sub">Deleting a subject also removes its recorded classes</div></div>
          <button class="btn btn-primary btn-sm" id="add-subject">${ICONS.plus} Add subject</button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Code</th><th>Subject</th><th>Faculty</th><th>Classes held</th><th></th></tr></thead>
            <tbody>
              ${db.subjects.map(sub => `
                <tr data-id="${esc(sub.id)}">
                  <td class="cell-main">${esc(sub.code)}</td>
                  <td>${esc(sub.name)}</td>
                  <td>${esc(sub.faculty || '—')}</td>
                  <td class="num">${AEDB.classesHeld(db, sub.id)}</td>
                  <td class="actions">
                    <button class="icon-btn act-edit" title="Edit">${ICONS.edit}</button>
                    <button class="icon-btn danger act-del" title="Delete">${ICONS.trash}</button>
                  </td>
                </tr>`).join('') || '<tr><td colspan="5"><div class="empty">No subjects yet.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;

    $('#add-subject').addEventListener('click', () => subjectModal(null));
    $$('#view tbody tr[data-id]').forEach(tr => {
      const id = tr.dataset.id;
      $('.act-edit', tr).addEventListener('click', () => subjectModal(id));
      $('.act-del', tr).addEventListener('click', (e) => armDelete(e.currentTarget, () => {
        AEDB.deleteSubject(db, id);
        toast('Subject and its class records deleted');
        render();
      }, 'Sure?'));
    });
  }

  function subjectModal(id) {
    const sub = id ? db.subjects.find(s => s.id === id) : null;
    openModal(`
      <h3>${sub ? 'Edit subject' : 'Add subject'}</h3>
      <form id="subject-form">
        <div class="field-row">
          <div class="field"><label>Code</label><input class="input" id="s-code" maxlength="20" value="${esc(sub ? sub.code : '')}" placeholder="CS-307"></div>
          <div class="field"><label>Faculty</label><input class="input" id="s-fac" maxlength="60" value="${esc(sub ? (sub.faculty || '') : '')}" placeholder="Dr. Someone"></div>
        </div>
        <div class="field"><label>Subject name</label><input class="input" id="s-name" maxlength="60" value="${esc(sub ? sub.name : '')}" placeholder="e.g. Computer Networks"></div>
        <div class="error-text hidden" id="form-err"></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" id="m-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">${sub ? 'Save changes' : 'Add subject'}</button>
        </div>
      </form>`);
    $('#m-cancel').addEventListener('click', closeModal);
    $('#subject-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = { code: $('#s-code').value, name: $('#s-name').value, faculty: $('#s-fac').value };
      const res = sub ? AEDB.updateSubject(db, id, data) : AEDB.addSubject(db, data);
      if (!res.ok) { const el = $('#form-err'); el.textContent = res.error; el.classList.remove('hidden'); return; }
      closeModal();
      toast(sub ? 'Subject updated' : 'Subject added');
      render();
    });
  }

  /* ================= VIEW: MARK ATTENDANCE ================= */

  let att = { subjectId: '', date: '', marks: {} };

  function viewAttendance() {
    if (!att.subjectId || !db.subjects.some(s => s.id === att.subjectId)) att.subjectId = db.subjects[0] ? db.subjects[0].id : '';
    if (!att.date) att.date = AEDB.todayISO();
    const existing = db.log.find(e => e.subjectId === att.subjectId && e.date === att.date);
    // (re)load marks for the chosen day: existing record wins, otherwise everyone starts present
    att.marks = {};
    db.students.forEach(s => { att.marks[s.roll] = 1; });
    if (existing) db.students.forEach(s => {
      if (existing.marks[s.roll] !== undefined) att.marks[s.roll] = existing.marks[s.roll];
    });

    $('#view').innerHTML = `
      <div class="card card-pad">
        <div class="day-head">
          <div class="field" style="flex:1;min-width:240px">
            <label>Subject</label>
            <select class="select" id="att-subject">
              ${db.subjects.map(s => `<option value="${esc(s.id)}" ${s.id === att.subjectId ? 'selected' : ''}>${esc(s.code)} — ${esc(s.name)} (${AEDB.classesHeld(db, s.id)} held)</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Date</label>
            <input class="input" type="date" id="att-date" value="${esc(att.date)}" max="${AEDB.todayISO()}">
          </div>
        </div>
        <div id="day-banner">
          ${existing ? '<div class="banner info" style="margin:14px 0 0">ℹ️ This subject already has a record for this date — saving will <b>update</b> it.</div>' : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-head" style="flex-wrap:wrap">
          <div><h3>${db.students.length} students</h3><div class="sub">Tap P / A for each student, then save</div></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" id="all-p">All present</button>
            <button class="btn btn-ghost btn-sm" id="all-a">All absent</button>
            <button class="btn btn-primary btn-sm" id="save-day">Save attendance</button>
          </div>
        </div>
        <div>
          ${db.students.map(s => `
            <div class="att-row" data-roll="${esc(s.roll)}">
              <span class="a-roll">${esc(s.roll)}</span>
              <span class="a-name">${esc(s.name)}</span>
              <div class="seg">
                <button type="button" class="seg-p ${att.marks[s.roll] === 1 ? 'on-p' : ''}">P</button>
                <button type="button" class="seg-a ${att.marks[s.roll] === 0 ? 'on-a' : ''}">A</button>
              </div>
            </div>`).join('') || '<div class="empty">No students enrolled yet.</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div><h3>Recent class records</h3><div class="sub">Latest 8 · deleting removes that class from every calculation</div></div></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Date</th><th>Subject</th><th>Present</th><th></th></tr></thead>
            <tbody>
              ${[...db.log].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map(e => {
                const sub = db.subjects.find(s => s.id === e.subjectId);
                const present = Object.values(e.marks || {}).filter(v => v === 1).length;
                return `<tr data-id="${esc(e.id)}">
                  <td class="num">${esc(e.date)}</td>
                  <td>${sub ? esc(sub.code) + ' — ' + esc(sub.name) : '<span class="pct-none">deleted subject</span>'}</td>
                  <td class="num">${present} / ${Object.keys(e.marks || {}).length}</td>
                  <td class="actions"><button class="icon-btn danger act-del-day" title="Delete this class record">${ICONS.trash}</button></td>
                </tr>`;
              }).join('') || '<tr><td colspan="4"><div class="empty">Nothing recorded yet.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;

    $('#att-subject').addEventListener('change', e => { att.subjectId = e.target.value; viewAttendance(); });
    $('#att-date').addEventListener('change', e => { att.date = e.target.value; viewAttendance(); });
    $('#all-p').addEventListener('click', () => { db.students.forEach(s => att.marks[s.roll] = 1); viewAttendance(); });
    $('#all-a').addEventListener('click', () => { db.students.forEach(s => att.marks[s.roll] = 0); viewAttendance(); });
    $('#save-day').addEventListener('click', () => {
      const res = AEDB.saveDay(db, att.subjectId, att.date, att.marks);
      if (!res.ok) { toast(res.error, 'error'); return; }
      toast(res.replaced ? 'Existing record for that day updated' : 'Attendance saved');
      viewAttendance();
    });

    $$('#view .att-row').forEach(row => {
      const roll = row.dataset.roll;
      const pBtn = $('.seg-p', row), aBtn = $('.seg-a', row);
      pBtn.addEventListener('click', () => { att.marks[roll] = 1; pBtn.classList.add('on-p'); aBtn.classList.remove('on-a'); });
      aBtn.addEventListener('click', () => { att.marks[roll] = 0; aBtn.classList.add('on-a'); pBtn.classList.remove('on-p'); });
    });

    $$('#view .act-del-day').forEach(btn => btn.addEventListener('click', e => armDelete(btn, () => {
      AEDB.deleteDay(db, btn.closest('tr').dataset.id);
      toast('Class record deleted');
      viewAttendance();
    }, 'Sure?')));
  }

  /* ================= VIEW: REPORTS ================= */

  function viewReports() {
    const reps = db.students.map(s => AEDB.reportFor(db, s.roll)).filter(Boolean);
    const defaulters = reps
      .map(r => ({ r, bad: r.subjects.filter(s => s.verdict === 'warn' || s.verdict === 'bad') }))
      .filter(x => x.bad.length > 0)
      .sort((a, b) => a.r.overall.pct - b.r.overall.pct);

    $('#view').innerHTML = `
      <div class="card print-area">
        <div class="card-head" style="flex-wrap:wrap">
          <div>
            <h3>Exam eligibility matrix</h3>
            <div class="sub">${esc(db.settings.university)} · pass ≥ ${db.settings.passMark}% · condonation floor ${db.settings.warnMark}%</div>
          </div>
          <div style="display:flex;gap:10px" class="no-print">
            <button class="btn btn-ghost btn-sm" id="print-report">${ICONS.printer} Print</button>
            <button class="btn btn-ghost btn-sm" id="export-matrix">${ICONS.download} Export CSV</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table matrix">
            <thead>
              <tr>
                <th class="st-col">Student</th>
                ${db.subjects.map(s => `<th title="${esc(s.name)}">${esc(s.code)}</th>`).join('')}
                <th>Overall</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${reps.map(r => `
                <tr>
                  <td><span class="cell-main">${esc(r.student.name)}</span><div class="cell-sub">${esc(r.student.roll)}</div></td>
                  ${r.subjects.map(s => `<td class="num ${pctClass(s.pct)}">${fmtPct(s.pct)}</td>`).join('')}
                  <td class="num ${pctClass(r.overall.pct)}">${fmtPct(r.overall.pct)}</td>
                  <td>${badgeOf(r.status)}</td>
                </tr>`).join('') || '<tr><td colspan="20"><div class="empty">No students yet.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div><h3>Defaulters — below ${db.settings.passMark}% in at least one subject</h3><div class="sub">Sorted by overall attendance</div></div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Student</th><th>Subject(s) short</th><th>Recovery</th></tr></thead>
            <tbody>
              ${defaulters.map(({ r, bad }) => `
                <tr>
                  <td><span class="cell-main">${esc(r.student.name)}</span><div class="cell-sub">${esc(r.student.roll)}</div></td>
                  <td>${bad.map(s => `<span class="badge b-${s.verdict}" style="margin:2px 4px 2px 0">${esc(s.subject.code)} ${fmtPct(s.pct)}</span>`).join('')}</td>
                  <td class="num">${bad.map(s => `${s.subject.code}: attend ${AEDB.needChain(s.attended, s.held, db.settings.passMark)} in a row`).join(' · ')}</td>
                </tr>`).join('') || '<tr><td colspan="3"><div class="empty"><b>Everyone is above the line 🎉</b>No defaulters this semester.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;

    $('#print-report').addEventListener('click', () => window.print());
    $('#export-matrix').addEventListener('click', () => {
      const rows = [['Roll', 'Name', ...db.subjects.map(s => s.code + ' %'), ...db.subjects.map(s => s.code + ' status'), 'Overall %', 'Overall status']];
      reps.forEach(r => rows.push([
        r.student.roll, r.student.name,
        ...r.subjects.map(s => s.pct == null ? '' : s.pct.toFixed(1)),
        ...r.subjects.map(s => s.verdict),
        r.overall.pct == null ? '' : r.overall.pct.toFixed(1), r.status,
      ]));
      downloadCsv('attendease-eligibility.csv', rows);
      toast('Eligibility matrix exported');
    });
  }

  /* ================= VIEW: SETTINGS ================= */

  function viewSettings() {
    const s = db.settings;
    $('#view').innerHTML = `
      <div class="settings-grid">
        <div class="card card-pad">
          <h3 style="font-size:15px;margin-bottom:14px">University &amp; exam rules</h3>
          <form id="settings-form">
            <div class="field"><label>University name</label><input class="input" id="set-uni" maxlength="80" value="${esc(s.university)}"></div>
            <div class="field"><label>Semester label</label><input class="input" id="set-sem" maxlength="40" value="${esc(s.semesterLabel || '')}"></div>
            <div class="field-row">
              <div class="field">
                <label>Pass mark (%)</label>
                <input class="input" id="set-pass" type="number" min="1" max="99" value="${s.passMark}">
                <div class="hint">Minimum attendance for exam eligibility</div>
              </div>
              <div class="field">
                <label>Condonation floor (%)</label>
                <input class="input" id="set-warn" type="number" min="1" max="99" value="${s.warnMark}">
                <div class="hint">Below this = detained, no condonation</div>
              </div>
            </div>
            <div class="field">
              <label style="display:flex;align-items:center;gap:9px;cursor:pointer;font-weight:600">
                <input type="checkbox" id="set-public" ${s.publicCheck ? 'checked' : ''} style="width:16px;height:16px">
                Allow students to check attendance online by roll number
              </label>
              <div class="hint">Off = the check page shows a “contact exam office” notice instead.</div>
            </div>
            <div class="error-text hidden" id="set-err"></div>
            <button class="btn btn-primary" type="submit">Save rules</button>
          </form>
        </div>

        <div style="display:flex;flex-direction:column;gap:20px">
          <div class="card card-pad">
            <h3 style="font-size:15px;margin-bottom:14px">Change admin password</h3>
            <form id="pw-form">
              <div class="field"><label>Current password</label><input class="input" id="pw-cur" type="password" autocomplete="current-password"></div>
              <div class="field-row">
                <div class="field"><label>New password</label><input class="input" id="pw-new" type="password" autocomplete="new-password"></div>
                <div class="field"><label>Confirm new</label><input class="input" id="pw-new2" type="password" autocomplete="new-password"></div>
              </div>
              <div class="error-text hidden" id="pw-err"></div>
              <button class="btn btn-primary" type="submit">Update password</button>
            </form>
          </div>

          <div class="card card-pad danger-zone">
            <h3 style="font-size:15px;margin-bottom:6px;color:var(--bad-deep)">Danger zone</h3>
            <p style="font-size:13px;color:var(--muted);margin-bottom:14px">These actions cannot be undone.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btn-danger btn-sm" id="reset-demo">Restore demo data</button>
              <button class="btn btn-danger btn-sm" id="wipe-all">Clear ALL students, subjects &amp; attendance</button>
            </div>
          </div>
        </div>
      </div>`;

    $('#settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const err = $('#set-err');
      const uni = AEDB.cleanText($('#set-uni').value, 80);
      const pass = parseInt($('#set-pass').value, 10);
      const warn = parseInt($('#set-warn').value, 10);
      if (!uni) { err.textContent = 'University name is required.'; err.classList.remove('hidden'); return; }
      if (!Number.isInteger(pass) || pass < 1 || pass > 99) { err.textContent = 'Pass mark must be a number from 1 to 99.'; err.classList.remove('hidden'); return; }
      if (!Number.isInteger(warn) || warn < 1 || warn > 99) { err.textContent = 'Condonation floor must be a number from 1 to 99.'; err.classList.remove('hidden'); return; }
      if (warn >= pass) { err.textContent = 'Condonation floor must be BELOW the pass mark.'; err.classList.remove('hidden'); return; }
      db.settings.university = uni;
      db.settings.semesterLabel = AEDB.cleanText($('#set-sem').value, 40);
      db.settings.passMark = pass;
      db.settings.warnMark = warn;
      db.settings.publicCheck = $('#set-public').checked;
      AEDB.save(db);
      $('#side-uni').textContent = uni;
      err.classList.add('hidden');
      toast('Rules saved — eligibility recalculated everywhere');
      render();
    });

    $('#pw-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const err = $('#pw-err');
      const show = (m) => { err.textContent = m; err.classList.remove('hidden'); };
      if (AEDB.hash($('#pw-cur').value) !== db.settings.adminPassHash) return show('Current password is incorrect.');
      const n1 = $('#pw-new').value, n2 = $('#pw-new2').value;
      if (n1.length < 6) return show('New password must be at least 6 characters.');
      if (n1 !== n2) return show('New passwords do not match.');
      db.settings.adminPassHash = AEDB.hash(n1);
      AEDB.save(db);
      $('#pw-cur').value = $('#pw-new').value = $('#pw-new2').value = '';
      err.classList.add('hidden');
      toast('Password updated');
    });

    $('#reset-demo').addEventListener('click', e => armDelete(e.currentTarget, () => {
      db = AEDB.reset();
      $('#side-uni').textContent = db.settings.university;
      toast('Demo data restored (fresh dates, 12 students)');
      render();
    }, 'Restore now?'));

    $('#wipe-all').addEventListener('click', e => armDelete(e.currentTarget, () => {
      db.students = []; db.subjects = []; db.log = [];
      AEDB.save(db);
      toast('All academic data cleared');
      render();
    }, 'Wipe everything?'));
  }

  /* ---------- boot ---------- */
  if (isAuthed()) showApp(); else showLogin();
})();
