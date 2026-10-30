/* Student check page — roll-number lookup, NO login.
   Reads the shared demo database; students can never write anything. */
'use strict';
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const db = AEDB.load();
  const form = $('#check-form');
  const input = $('#roll-input');
  const errBox = $('#check-error');
  const result = $('#result');

  // Exam cell can switch public checking off in admin Settings.
  if (!db.settings.publicCheck) {
    $('#check-disabled').classList.remove('hidden');
    form.classList.add('hidden');
  } else {
    // helpful autocomplete (same info as the notice board)
    $('#roll-list').innerHTML = db.students
      .map(s => `<option value="${esc(s.roll)}">${esc(s.name)}</option>`).join('');
  }

  function showError(msg) {
    errBox.textContent = msg;
    errBox.classList.remove('hidden');
    result.innerHTML = '';
  }
  function clearError() { errBox.classList.add('hidden'); }

  const VERDICTS = {
    ok:   { title: '🎓 Exam Eligible', cls: 'v-ok',
            sub: (r) => `You meet the ${db.settings.passMark}% attendance rule in every subject. Buffer: you can still miss ${r.minBuffer} class${r.minBuffer === 1 ? '' : 'es'} overall and stay eligible — but keep each subject above ${db.settings.passMark}%.` },
    warn: { title: '⚠️ At Risk — Condonation Case', cls: 'v-warn',
            sub: () => `You are below ${db.settings.passMark}% in one or more subjects (but not below ${db.settings.warnMark}%). Your eligibility depends on the attendance committee. Details per subject below.` },
    bad:  { title: '⛔ Not Eligible — Detained', cls: 'v-bad',
            sub: () => `You are below ${db.settings.warnMark}% in one or more subjects, so under university rules you are detained from the exam in those subjects. Contact your academic advisor now.` },
    none: { title: 'No attendance recorded yet', cls: 'v-none',
            sub: () => 'The exam cell has not recorded any classes for your roll number yet. Check again later.' },
  };

  function adviceFor(row) {
    const p = row.pct, pass = db.settings.passMark;
    if (p == null) return 'No classes recorded in this subject yet.';
    if (row.verdict === 'ok') {
      const skip = AEDB.canSkip(row.attended, row.held, pass);
      return skip > 0
        ? `Buffer: you can miss up to <b>${skip}</b> more class${skip === 1 ? '' : 'es'} and stay eligible.`
        : `You are exactly on the ${pass}% line — attend every class from here.`;
    }
    const need = AEDB.needChain(row.attended, row.held, pass);
    return row.verdict === 'warn'
      ? `Attend the next <b>${need}</b> class${need === 1 ? '' : 'es'} in a row to reach ${pass}%.`
      : `Detained zone. Attending the next <b>${need}</b> class${need === 1 ? '' : 'es'} in a row would bring you to ${pass}% — talk to your advisor first.`;
  }

  function renderReport(rep) {
    const v = VERDICTS[rep.status];
    const pct = rep.overall.pct;
    const buffer = Math.min(...rep.subjects.filter(s => s.verdict === 'ok')
      .map(s => AEDB.canSkip(s.attended, s.held, db.settings.passMark)), Infinity);
    const vdata = { ...v, minBuffer: Number.isFinite(buffer) ? buffer : 0 };

    const color = rep.status === 'ok' ? 'var(--ok)' : rep.status === 'warn' ? 'var(--warn)' : rep.status === 'bad' ? 'var(--bad)' : 'var(--faint)';
    const ringStyle = pct == null ? '' :
      `style="background:conic-gradient(${color} ${pct}%, #e2e8f0 0)"`;

    const sub = vdata.sub(rep);
    const st = rep.student;

    result.innerHTML = `
      <div class="card card-pad">
        <div class="report-head">
          <div class="who">
            <b>${esc(st.name)}</b>
            <span><span class="roll-chip">${esc(st.roll)}</span>
            &nbsp;·&nbsp; ${esc(st.semester || '')} ${st.section ? '· Section ' + esc(st.section) : ''}</span>
          </div>
          <span class="badge b-${rep.status}">${rep.status === 'ok' ? 'Eligible' : rep.status === 'warn' ? 'At risk' : rep.status === 'bad' ? 'Not eligible' : 'No data'}</span>
        </div>

        <div class="verdict ${v.cls}">
          <div class="v-icon">${rep.status === 'ok' ? '🎉' : rep.status === 'warn' ? '⚠️' : rep.status === 'bad' ? '⛔' : '🗓️'}</div>
          <div class="v-main">
            <div class="v-title">${v.title}</div>
            <div class="v-sub">${sub}</div>
          </div>
          <div class="ring" ${ringStyle}>
            <div class="r-label"><b>${pct == null ? '—' : pct.toFixed(1) + '%'}</b><span>overall</span></div>
          </div>
        </div>

        <div class="subj-grid">
          ${rep.subjects.map(row => {
            const rj = row.verdict;
            const p = row.pct == null ? '—' : row.pct.toFixed(1) + '%';
            const barW = row.pct == null ? 0 : Math.min(100, row.pct);
            return `
            <div class="subj-card">
              <div class="sj-top">
                <div>
                  <div class="sj-code">${esc(row.subject.code)}</div>
                  <div class="sj-name">${esc(row.subject.name)}</div>
                  <div class="sj-fac">${esc(row.subject.faculty || '')}</div>
                </div>
                <span class="badge b-${rj}">${rj === 'ok' ? 'Eligible' : rj === 'warn' ? 'At risk' : rj === 'bad' ? 'Detained' : 'No data'}</span>
              </div>
              <div class="sj-stats">
                <span class="sj-pct pct-${rj}">${p}</span>
                <span class="sj-held">(${row.attended} of ${row.held} classes)</span>
              </div>
              <div class="progress ${rj}"><i style="width:${barW}%"></i></div>
              <div class="advice">${adviceFor(row)}</div>
            </div>`;
          }).join('')}
        </div>

        <div class="report-foot">
          <span>Generated ${new Date().toLocaleString()} · Data as recorded by the exam cell (last entry: ${esc(rep.lastDate || '—')})</span>
          <button class="btn btn-ghost btn-sm no-print" id="print-btn">🖨 Print / save as PDF</button>
        </div>
      </div>`;

    $('#print-btn').addEventListener('click', () => window.print());
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function run(rawRoll) {
    clearError();
    const roll = AEDB.normRoll(rawRoll);
    if (!roll) { showError('Please enter your roll number first.'); input.focus(); return; }
    if (roll.length > 24) { showError('That does not look like a valid roll number.'); return; }
    const rep = AEDB.reportFor(db, roll);
    if (!rep) { showError(`No student found with roll number "${roll}". Check your ID card and try again.`); return; }
    renderReport(rep);
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); run(input.value); });

  // deep link: check.html?roll=2022-CS-001
  const param = new URLSearchParams(location.search).get('roll');
  if (param && db.settings.publicCheck) { input.value = param; run(param); }
})();
