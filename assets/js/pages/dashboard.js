/* dashboard.html — 현황(2행 5열) + 통계 차트 + 처리 패널 4개(최신 5건, 전체보기) */
DA.page('dashboard', async function (main) {
  var D = DA, esc = D.esc;
  var now = Date.now(), day = 864e5;
  var r = await Promise.all([
    D.q(D.sb.from('submissions').select('id, receipt_no, research_title, researcher_name, nationality, status, submitted_at, last_submitted_at, current_version, supplement_deadline, resubmit_deadline').order('submitted_at', { ascending: false })),
    D.q(D.sb.from('edit_requests').select('id, created_at, reason, submissions(id, receipt_no, research_title, researcher_name)').eq('status', 'pending').order('created_at', { ascending: false })),
    D.q(D.sb.from('submission_events').select('created_at, data, submissions(id, receipt_no, research_title, researcher_name)').eq('event_type', 'edited').order('created_at', { ascending: false })),
    D.q(D.sb.from('mail_outbox').select('id').eq('status', 'failed')),
    D.q(D.sb.from('calls').select('*').limit(1)),
    D.q(D.sb.from('submission_results').select('submission_id, result, published_at'))
  ]);
  var subs = r[0], pending = r[1], edits = r[2], failed = r[3].length, call = r[4][0], results = r[5];
  var active = subs.filter(function (s) { return s.status !== 'withdrawn'; });
  var count = function (st) { return subs.filter(function (s) { return s.status === st; }).length; };
  var inDays = function (n) { return active.filter(function (s) { return now - Date.parse(s.submitted_at) < n * day; }).length; };
  var resMap = {}; results.forEach(function (x) { resMap[x.submission_id] = x; });
  var rc = function (k) { return active.filter(function (s) { return resMap[s.id] && resMap[s.id].result === k; }).length; };
  var ap = rc('approved'), rv = rc('revise'), na = rc('not_approved'), undecided = active.length - ap - rv - na;
  var reviewed = active.filter(function (s) { return resMap[s.id] && resMap[s.id].published_at; }).length;
  var unpublished = results.filter(function (x) { return !x.published_at; }).length;
  var KIND = { edit: '수정', supplement: '보완', resubmit: '권한 수정' };
  var link = function (s, t) { return s ? '<a href="submission.html?id=' + s.id + '">' + esc(t || s.receipt_no) + '</a>' : '-'; };
  var waiting = subs.filter(function (s) { return s.status === 'supplement_requested' || s.status === 'resubmit_allowed'; })
    .sort(function (a, b) { return Date.parse(a.supplement_deadline || a.resubmit_deadline) - Date.parse(b.supplement_deadline || b.resubmit_deadline); });

  /* 화면 전용 스타일 */
  var st = document.createElement('style');
  st.textContent =
    '.kpi{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr 1.4fr;grid-template-rows:auto auto;gap:12px;margin-bottom:18px}' +
    '.kpi .stat{text-decoration:none;color:inherit;display:block}.kpi a.stat:hover{border-color:#b9c3dd}' +
    '.kpi .k-total{grid-column:1;grid-row:1 / 3;display:flex;flex-direction:column;justify-content:center;background:var(--ink);color:#fff;border-color:var(--ink)}' +
    '.kpi .k-total b{font-size:46px}.kpi .k-total .muted{color:#c9cfe4}' +
    '.kpi .k-result{grid-column:5;grid-row:1 / 3}.kpi .k-result .rr{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line);font-size:15px}' +
    '.kpi .k-result .rr:last-child{border-bottom:0}.kpi .k-result .rr b{font-size:20px;margin:0;display:inline}' +
    '.panels{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:16px}.panels .card{display:flex;flex-direction:column;min-height:360px;margin:0}' +
    '.panels .card h2{display:flex;justify-content:space-between;align-items:center}.panels .card h2 a{font-size:14px;font-weight:600;text-decoration:none}' +
    '.panels .card .tbl{flex:1}.panels .card .tbl td{padding:10px 8px}.panels .empty{flex:1;display:flex;align-items:center;justify-content:center;color:var(--soft)}' +
    '@media(max-width:1100px){.kpi{grid-template-columns:1fr 1fr 1fr}.kpi .k-total,.kpi .k-result{grid-column:auto;grid-row:auto}.panels{grid-template-columns:1fr}}';
  document.head.appendChild(st);

  function card(title, n, href, rowsHtml) {
    return '<div class="card"><h2><span>' + title + ' <span class="muted">' + n + '건</span></span><a href="' + href + '">전체보기 →</a></h2>' +
      (rowsHtml ? '<table class="tbl"><tbody>' + rowsHtml + '</tbody></table>' : '<div class="empty">없습니다.</div>') + '</div>';
  }
  var stat = function (st2) {
    return '<a class="stat" href="submissions.html?status=' + st2 + '">' + D.STATUS[st2][0] + '<b style="color:' + D.STATUS[st2][1] + '">' + count(st2) + '</b></a>';
  };

  main.innerHTML = '<div class="row" style="justify-content:space-between"><h1>대시보드</h1>' +
    '<span><b style="color:' + (call && call.is_published ? '#1f7a4d' : '#b3261e') + '">● ' + (call && call.is_published ? '접수 중' : '접수 중지') + '</b> <a class="muted" href="form.html">지원서 설정</a></span></div>' +
    (failed ? '<div class="msg err">메일 발송 실패 ' + failed + '건이 있습니다. <a href="mail-logs.html?status=failed">메일 발송 로그 확인</a></div>' : '') +

    '<div class="kpi">' +
    '<a class="stat k-total" href="submissions.html">전체 접수<b>' + active.length + '</b><span class="muted">취소 제외 · 오늘 ' + inDays(1) + ' · 7일 ' + inDays(7) + ' · 30일 ' + inDays(30) + '</span></a>' +
    stat('submitted') + stat('reviewing') + stat('supplement_requested') +
    stat('resubmit_allowed') + stat('withdrawn') +
    '<a class="stat" href="submissions.html?revised=1">수정·보완 제출<b>' + active.filter(function (s) { return s.current_version > 1; }).length + '</b></a>' +
    '<div class="stat k-result">검토 결과<div style="margin-top:8px">' +
    '<div class="rr"><span>지원 결정</span><b style="color:#1f7a4d">' + ap + '</b></div>' +
    '<div class="rr"><span>보완 후 재검토</span><b style="color:#9a5b00">' + rv + '</b></div>' +
    '<div class="rr"><span>지원하지 않음</span><b style="color:#5f6577">' + na + '</b></div>' +
    '<div class="rr"><span>검토완료(안내됨)</span><b>' + reviewed + '</b></div>' +
    '<div class="rr muted"><span>미입력 ' + undecided + '</span><span>미안내 ' + unpublished + '</span></div></div></div>' +
    '</div>' +

    '<div class="split" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">' +
    '<div class="card"><h2>월별 제출 건수 (최근 12개월)</h2><div style="height:280px"><canvas id="c-month"></canvas></div></div>' +
    '<div class="card"><h2>진행 상태</h2><div style="height:280px"><canvas id="c-status"></canvas></div></div></div>' +
    '<div class="split" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">' +
    '<div class="card"><h2>검토 결과</h2><div style="height:260px"><canvas id="c-result"></canvas></div></div>' +
    '<div class="card"><h2>국적별 제출 (상위 10)</h2><div style="height:260px"><canvas id="c-nat"></canvas></div></div></div>' +

    '<div class="panels">' +
    card('처리 대기 — 수정요청', pending.length, 'edit-requests.html', pending.slice(0, 5).map(function (p) {
      return '<tr><td>' + link(p.submissions) + '</td><td>' + esc(p.submissions && p.submissions.research_title) + '<br><span class="muted">' + esc(String(p.reason).slice(0, 50)) + '</span></td><td class="muted" style="white-space:nowrap">' + D.fmt(p.created_at) + '</td></tr>';
    }).join('')) +
    card('연구자 보완·수정 대기', waiting.length, 'submissions.html?status=supplement_requested', waiting.slice(0, 5).map(function (s) {
      var dl = s.supplement_deadline || s.resubmit_deadline, late = Date.parse(dl) < now;
      return '<tr><td>' + link(s) + '</td><td>' + esc(s.research_title) + '<br>' + D.badge(s.status) + '</td><td style="white-space:nowrap;color:' + (late ? '#b3261e' : '') + '">기한 ' + D.fmt(dl) + (late ? ' (지남)' : '') + '</td></tr>';
    }).join('')) +
    card('최근 수정·보완 제출', edits.length, 'submissions.html?revised=1', edits.slice(0, 5).map(function (e) {
      return '<tr><td>' + link(e.submissions) + '</td><td>' + esc(e.submissions && e.submissions.research_title) + '<br><span class="muted">' + (KIND[e.data && e.data.kind] || '수정') + ' · v' + esc(e.data && e.data.version) + '</span></td><td class="muted" style="white-space:nowrap">' + D.fmt(e.created_at) + '</td></tr>';
    }).join('')) +
    card('최근 제출', subs.length, 'submissions.html', subs.slice(0, 5).map(function (s) {
      return '<tr><td>' + link(s) + '</td><td>' + esc(s.research_title) + '<br><span class="muted">' + esc(s.researcher_name) + '</span></td><td>' + D.badge(s.status, resMap[s.id] && resMap[s.id].published_at) + '</td><td class="muted" style="white-space:nowrap">' + D.fmt(s.submitted_at) + '</td></tr>';
    }).join('')) +
    '</div>';

  /* 차트 */
  if (!window.Chart) return;
  var C = window.Chart;
  C.defaults.font.family = getComputedStyle(document.body).fontFamily; C.defaults.color = '#5a6383'; C.defaults.font.size = 13;
  var base = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };
  var intTicks = { beginAtZero: true, ticks: { precision: 0 } };
  var months = [], mKey = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); };
  for (var i = 11; i >= 0; i--) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(mKey(d)); }
  var perMonth = function (list, f) { return months.map(function (m) { return list.filter(function (x) { return mKey(new Date(f(x))) === m; }).length; }); };
  new C(document.getElementById('c-month'), { type: 'bar', data: { labels: months.map(function (m) { return m.slice(2).replace('-', '.'); }), datasets: [
    { label: '신규 제출', data: perMonth(subs, function (s) { return s.submitted_at; }), backgroundColor: '#1d2a57', borderRadius: 3 },
    { label: '수정·보완 제출', data: perMonth(edits, function (e) { return e.created_at; }), backgroundColor: '#8fa8e8', borderRadius: 3 }] },
    options: Object.assign({}, base, { scales: { y: intTicks, x: { grid: { display: false } } } }) });
  var stKeys = ['submitted', 'reviewing', 'supplement_requested', 'resubmit_allowed', 'withdrawn'];
  new C(document.getElementById('c-status'), { type: 'doughnut', data: { labels: stKeys.map(function (k) { return D.STATUS[k][0]; }).concat(['검토완료']), datasets: [
    { data: stKeys.map(function (k) { return subs.filter(function (s) { return s.status === k && !(resMap[s.id] && resMap[s.id].published_at && k !== 'withdrawn'); }).length; }).concat([reviewed]),
      backgroundColor: stKeys.map(function (k) { return D.STATUS[k][1]; }).concat(['#1f7a4d']), borderWidth: 0 }] },
    options: Object.assign({}, base, { cutout: '62%' }) });
  new C(document.getElementById('c-result'), { type: 'doughnut', data: { labels: ['지원 결정', '보완 후 재검토', '지원하지 않음', '미입력'], datasets: [
    { data: [ap, rv, na, undecided], backgroundColor: ['#1f7a4d', '#e0a33a', '#9aa1b5', '#e3e6ee'], borderWidth: 0 }] },
    options: Object.assign({}, base, { cutout: '62%' }) });
  var nat = {}; active.forEach(function (s) { var k = (s.nationality || '미입력').replace(/ [(].*[)]$/, ''); nat[k] = (nat[k] || 0) + 1; });
  var natTop = Object.keys(nat).sort(function (a, b) { return nat[b] - nat[a]; }).slice(0, 10);
  new C(document.getElementById('c-nat'), { type: 'bar', data: { labels: natTop, datasets: [
    { label: '제출 건수', data: natTop.map(function (k) { return nat[k]; }), backgroundColor: '#2b5fd9', borderRadius: 3 }] },
    options: Object.assign({}, base, { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: intTicks, y: { grid: { display: false } } } }) });
});
