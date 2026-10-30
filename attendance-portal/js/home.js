/* Landing page — fills the live stats strip from the shared demo database. */
'use strict';
(function () {
  const db = AEDB.load();
  const agg = AEDB.aggregate(db);
  const put = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  put('stat-students', agg.totalStudents);
  put('stat-classes', agg.totalEntries);
  put('stat-avg', agg.avgPct == null ? '—' : agg.avgPct.toFixed(1) + '%');
  put('stat-eligible', agg.counts.ok);
})();
