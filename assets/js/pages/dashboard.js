/* dashboard.html — 현황 + 통계 차트 (월별 제출, 상태, 결과, 국적, 수정·보완) */
DA.page('dashboard', async function (main) {
  var D = DA, esc = D.esc;
  var now = Date.now(), day = 864e5;
  var r = await Promise.all([
    D.q(D.sb.from('submissions').select('id, receipt_no, research_title, researcher_name, nationality, status, submitted_at, last_submitted_at, current_version, supplement_deadline, resubmit_deadline').order('submitted_at', { ascending: false })),
    D.q(D.sb.from('edit_requests').select('id, created_at, reason, submissions(id, receipt_no, research_title)').eq('status', 'pending').order('created_at')),
    D.q(D.sb.from('submission_events').select('created_at, data, submissions(id, receipt_no, research_title)').eq('event_type', 'edited').order('created_at', { ascending: false })),
    D.q(D.sb.from('mail_outbox').select('id').eq('status', 'failed')),
    D.q(D.sb.from('calls').select('*').limit(1)),
    D.q(D.sb.from('submission_results').select('submission_id, result, published_at'))
  ]);
  var subs = r[0], pending = r[1], edits = r[2], failed = r[3].length, call = r[4][0], results = r[5];
  var active = subs.filter(function (s) { return s.status !== 'withdrawn'; });
  var count = function (st) { return subs.filter(function (s) { return s.status === st; }).length; };
  var inDays = function (n) { return active.filter(function (s) { return now - Date.parse(s.submitted_at) < n * day; }).length; };
  var KIND = { edit: '수정', supplement: '보완', resubmit: '요청 승인 후 수정' };
  var link = function (s) { return s ? '<a href="submission.html?id=' + s.id + '">' + esc(s.receipt_no) + '</a>' : '-'; };
  var waiting = subs.filter(function (s) { return s.status === 'supplement_requested' || s.status === 'resubmit_allowed'; });

  /* 통계 데이터 */
  var months = [], mKey = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); };
  for (var i = 11; i >= 0; i--) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(mKey(d)); }
  var perMonth = function (list, f) { return months.map(function (m) { return list.filter(function (x) { return mKey(new Date(f(x))) === m; }).length; }); };
  var newByMonth = perMonth(subs, function (s) { return s.submitted_at; });
  var editByMonth = perMonth(edits, function (e) { return e.created_at; });
  var resMap = {}; results.forEach(function (x) { resMap[x.submission_id] = x.result; });
  var rc = function (k) { return active.filter(function (s) { return resMap[s.id] === k; }).length; };
  var ap = rc('approved'), rv = rc('revise'), na = rc('not_approved'), undecided = active.length - ap - rv - na;
  var unpublished = results.filter(function (x) { return !x.published_at; }).length;
  var nat = {}; active.forEach(function (s) { var k = (s.nationality || '미입력').replace(/\s*\(.*\)$/, ''); nat[k] = (nat[k] || 0) + 1; });
  var natTop = Object.keys(nat).sort(function (a, b) { return nat[b] - nat[a]; }).slice(0, 10);

  main.innerHTML = '<div class="row" style="justify-content:space-between"><h1>대시보드</h1>' +
    '<span><b style="color:' + (call && call.is_published ? '#1f7a4d' : '#b3261e') + '">● ' + (call && call.is_published ? '접수 중' : '접수 중지') + '</b> <a class="muted" href="form.html">지원서 설정</a></span></div>' +
    (failed ? '<div class="msg err">메일 발송 실패 ' + failed + '건이 있습니다. <a href="mail-logs.html?status=failed">메일 발송 로그 확인</a></div>' : '') +

    '<div class="stats" style="margin-bottom:16px">' +
    '<div class="stat">전체 접수 (취소 제외)<b>' + active.length + '</b><span class="muted">오늘 ' + inDays(1) + ' · 7일 ' + inDays(7) + ' · 30일 ' + inDays(30) + '</span></div>' +
    ['submitted', 'reviewing', 'supplement_requested', 'resubmit_allowed', 'withdrawn'].map(function (st) {
      return '<a class="stat" style="text-decoration:none;color:inherit" href="submissions.html?status=' + st + '">' + D.STATUS[st][0] + '<b style="color:' + D.STATUS[st][1] + '">' + count(st) + '</b></a>';
    }).join('') +
    '<a class="stat" style="text-decoration:none;color:inherit" href="submissions.html?revised=1">수정·보완 제출된 건<b>' + active.filter(function (s) { return s.current_version > 1; }).length + '</b></a>' +
    '<div class="stat">검토 결과 (지원 / 보완 / 미지원)<b><span style="color:#1f7a4d">' + ap + '</span> / <span style="color:#9a5b00">' + rv + '</span> / <span style="color:#5f6577">' + na + '</span></b><span class="muted">미입력 ' + undecided + ' · 미안내 ' + unpublished + '</span></div></div>' +

    '<div class="split" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">' +
    '<div class="card"><h2>월별 제출 건수 (최근 12개월)</h2><div style="height:280px"><canvas id="c-month"></canvas></div></div>' +
    '<div class="card"><h2>진행 상태</h2><div style="height:280px"><canvas id="c-status"></canvas></div></div></div>' +
    '<div class="split" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">' +
    '<div class="card"><h2>심사 결과</h2><div style="height:260px"><canvas id="c-result"></canvas></div></div>' +
    '<div class="card"><h2>국적별 제출 (상위 10)</h2><div style="height:260px"><canvas id="c-nat"></canvas></div></div></div>' +

    '<div class="split" style="grid-template-columns:1fr 1fr">' +
    '<div class="card"><h2>처리 대기 — 수정요청 ' + pending.length + '건</h2>' + (pending.length ? '<table class="tbl"><tbody>' + pending.map(function (p) {
      return '<tr><td>' + link(p.submissions) + '</td><td>' + esc(p.submissions && p.submissions.research_title) + '<br><span class="muted">' + esc(String(p.reason).slice(0, 60)) + '</span></td><td class="muted">' + D.fmt(p.created_at) + '</td></tr>';
    }).join('') + '</tbody></table><p><a href="edit-requests.html">수정요청 처리하기 →</a></p>' : '<p class="muted">대기 중인 수정요청이 없습니다.</p>') + '</div>' +
    '<div class="card"><h2>연구자 보완·수정 대기 ' + waiting.length + '건</h2>' + (waiting.length ? '<table class="tbl"><tbody>' + waiting.map(function (s) {
      var dl = s.supplement_deadline || s.resubmit_deadline, late = Date.parse(dl) < now;
      return '<tr><td>' + link(s) + '</td><td>' + esc(s.research_title) + '<br>' + D.badge(s.status) + '</td><td style="white-space:nowrap;color:' + (late ? '#b3261e' : '') + '">기한 ' + D.fmt(dl) + (late ? ' (지남)' : '') + '</td></tr>';
    }).join('') + '</tbody></table>' : '<p class="muted">없습니다.</p>') + '</div></div>' +

    '<div class="split" style="grid-template-columns:1fr 1fr">' +
    '<div class="card"><h2>최근 수정·보완 제출</h2>' + (edits.length ? '<table class="tbl"><tbody>' + edits.slice(0, 8).map(function (e) {
      return '<tr><td>' + link(e.submissions) + '</td><td>' + esc(e.submissions && e.submissions.research_title) + '<br><span class="muted">' + (KIND[e.data && e.data.kind] || '수정') + ' · v' + esc(e.data && e.data.version) + '</span></td><td class="muted" style="white-space:nowrap">' + D.fmt(e.created_at) + '</td></tr>';
    }).join('') + '</tbody></table>' : '<p class="muted">아직 없습니다.</p>') + '</div>' +
    '<div class="card"><h2>최근 제출</h2>' + (subs.length ? '<table class="tbl"><tbody>' + subs.slice(0, 8).map(function (s) {
      return '<tr><td>' + link(s) + '</td><td>' + esc(s.research_title) + '<br><span class="muted">' + esc(s.researcher_name) + '</span></td><td>' + D.badge(s.status) + '</td><td class="muted" style="white-space:nowrap">' + D.fmt(s.submitted_at) + '</td></tr>';
    }).join('') + '</tbody></table><p><a href="submissions.html">전체 제출내역 →</a></p>' : '<p class="muted">아직 제출이 없습니다.</p>') + '</div></div>';

  /* 차트 */
  if (!window.Chart) return;
  var C = window.Chart;
  C.defaults.font.family = getComputedStyle(document.body).fontFamily; C.defaults.color = '#5a6383';
  var base = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };
  var intTicks = { beginAtZero: true, ticks: { precision: 0 } };

  new C(document.getElementById('c-month'), { type: 'bar', data: { labels: months.map(function (m) { return m.slice(2).replace('-', '.'); }), datasets: [
    { label: '신규 제출', data: newByMonth, backgroundColor: '#1d2a57', borderRadius: 3 },
    { label: '수정·보완 제출', data: editByMonth, backgroundColor: '#8fa8e8', borderRadius: 3 }] },
    options: Object.assign({}, base, { scales: { y: intTicks, x: { grid: { display: false } } } }) });

  var stKeys = ['submitted', 'reviewing', 'supplement_requested', 'resubmit_allowed', 'withdrawn'];
  new C(document.getElementById('c-status'), { type: 'doughnut', data: { labels: stKeys.map(function (k) { return D.STATUS[k][0]; }), datasets: [
    { data: stKeys.map(count), backgroundColor: stKeys.map(function (k) { return D.STATUS[k][1]; }), borderWidth: 0 }] },
    options: Object.assign({}, base, { cutout: '62%' }) });

  new C(document.getElementById('c-result'), { type: 'doughnut', data: { labels: ['지원 결정', '보완 후 재검토', '지원하지 않음', '미입력'], datasets: [
    { data: [ap, rv, na, undecided], backgroundColor: ['#1f7a4d', '#e0a33a', '#9aa1b5', '#e3e6ee'], borderWidth: 0 }] },
    options: Object.assign({}, base, { cutout: '62%' }) });

  new C(document.getElementById('c-nat'), { type: 'bar', data: { labels: natTop, datasets: [
    { label: '제출 건수', data: natTop.map(function (k) { return nat[k]; }), backgroundColor: '#2b5fd9', borderRadius: 3 }] },
    options: Object.assign({}, base, { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: intTicks, y: { grid: { display: false } } } }) });
});
