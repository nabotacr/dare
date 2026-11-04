/* dashboard.html — 상시 접수 1개 기준 현황: 상태별 건수, 처리 대기, 수정·보완 제출, 최근 제출 */
DA.page('dashboard', async function (main) {
  var D = DA, esc = D.esc;
  var now = Date.now(), day = 864e5;
  var r = await Promise.all([
    D.q(D.sb.from('submissions').select('id, receipt_no, research_title, researcher_name, status, submitted_at, last_submitted_at, current_version, supplement_deadline, resubmit_deadline').order('submitted_at', { ascending: false })),
    D.q(D.sb.from('edit_requests').select('id, created_at, reason, submissions(id, receipt_no, research_title, researcher_name)').eq('status', 'pending').order('created_at')),
    D.q(D.sb.from('submission_events').select('created_at, data, submissions(id, receipt_no, research_title, researcher_name, status)').eq('event_type', 'edited').order('created_at', { ascending: false }).limit(10)),
    D.q(D.sb.from('mail_outbox').select('id').eq('status', 'failed')),
    D.q(D.sb.from('calls').select('*').limit(1))
  ]);
  var subs = r[0], pending = r[1], edits = r[2], failed = r[3].length, call = r[4][0];
  var count = function (st) { return subs.filter(function (s) { return s.status === st; }).length; };
  var active = subs.filter(function (s) { return s.status !== 'withdrawn'; });
  var inDays = function (n) { return active.filter(function (s) { return now - Date.parse(s.submitted_at) < n * day; }).length; };
  var open = call && call.is_published;
  var KIND = { edit: '수정', supplement: '보완', resubmit: '요청 승인 후 수정' };
  var link = function (s, text) { return s ? '<a href="submission.html?id=' + s.id + '">' + esc(text || s.receipt_no) + '</a>' : '-'; };

  var waitingSup = subs.filter(function (s) { return s.status === 'supplement_requested' || s.status === 'resubmit_allowed'; })
    .sort(function (a, b) { return Date.parse(a.supplement_deadline || a.resubmit_deadline) - Date.parse(b.supplement_deadline || b.resubmit_deadline); });

  main.innerHTML = '<div class="row" style="justify-content:space-between"><h1>대시보드</h1>' +
    '<span><b style="color:' + (open ? '#1f7a4d' : '#b3261e') + '">● ' + (open ? '접수 중' : '접수 중지') + '</b> <a class="muted" href="form.html">지원서 설정</a></span></div>' +
    (failed ? '<div class="msg err">메일 발송 실패 ' + failed + '건이 있습니다. <a href="mail-logs.html?status=failed">메일 발송 로그 확인</a></div>' : '') +

    '<div class="stats" style="margin-bottom:16px">' +
    '<div class="stat">전체 접수 (취소 제외)<b>' + active.length + '</b><span class="muted">오늘 ' + inDays(1) + ' · 7일 ' + inDays(7) + '</span></div>' +
    ['submitted', 'reviewing', 'supplement_requested', 'resubmit_allowed', 'withdrawn'].map(function (st) {
      return '<a class="stat" style="text-decoration:none;color:inherit" href="submissions.html?status=' + st + '">' + D.STATUS[st][0] + '<b style="color:' + D.STATUS[st][1] + '">' + count(st) + '</b></a>';
    }).join('') +
    '<a class="stat" style="text-decoration:none;color:inherit" href="submissions.html?revised=1">수정·보완 제출된 건<b>' + active.filter(function (s) { return s.current_version > 1; }).length + '</b></a></div>' +

    '<div class="split" style="grid-template-columns:1fr 1fr">' +
    '<div class="card"><h2>처리 대기 — 수정요청 ' + pending.length + '건</h2>' + (pending.length ? '<table class="tbl"><tbody>' + pending.map(function (p) {
      return '<tr><td>' + link(p.submissions) + '</td><td>' + esc(p.submissions && p.submissions.research_title) + '<br><span class="muted">' + esc(p.reason).slice(0, 60) + '</span></td><td class="muted">' + D.fmt(p.created_at) + '</td></tr>';
    }).join('') + '</tbody></table><p><a href="edit-requests.html">수정요청 처리하기 →</a></p>' : '<p class="muted">대기 중인 수정요청이 없습니다.</p>') + '</div>' +

    '<div class="card"><h2>보완·수정 대기 — 연구자 제출 기다리는 중 ' + waitingSup.length + '건</h2>' + (waitingSup.length ? '<table class="tbl"><tbody>' + waitingSup.map(function (s) {
      var dl = s.supplement_deadline || s.resubmit_deadline, late = Date.parse(dl) < now;
      return '<tr><td>' + link(s) + '</td><td>' + esc(s.research_title) + '<br>' + D.badge(s.status) + '</td><td style="white-space:nowrap;color:' + (late ? '#b3261e' : '') + '">기한 ' + D.fmt(dl) + (late ? ' (지남)' : '') + '</td></tr>';
    }).join('') + '</tbody></table>' : '<p class="muted">없습니다.</p>') + '</div></div>' +

    '<div class="split" style="grid-template-columns:1fr 1fr">' +
    '<div class="card"><h2>최근 수정·보완 제출</h2>' + (edits.length ? '<table class="tbl"><tbody>' + edits.map(function (e) {
      return '<tr><td>' + link(e.submissions) + '</td><td>' + esc(e.submissions && e.submissions.research_title) + '<br><span class="muted">' + (KIND[e.data && e.data.kind] || '수정') + ' · v' + esc(e.data && e.data.version) + '</span></td><td class="muted" style="white-space:nowrap">' + D.fmt(e.created_at) + '</td></tr>';
    }).join('') + '</tbody></table>' : '<p class="muted">아직 없습니다.</p>') + '</div>' +

    '<div class="card"><h2>최근 제출</h2>' + (subs.length ? '<table class="tbl"><tbody>' + subs.slice(0, 10).map(function (s) {
      return '<tr><td>' + link(s) + '</td><td>' + esc(s.research_title) + '<br><span class="muted">' + esc(s.researcher_name) + '</span></td><td>' + D.badge(s.status) + '</td><td class="muted" style="white-space:nowrap">' + D.fmt(s.submitted_at) + '</td></tr>';
    }).join('') + '</tbody></table><p><a href="submissions.html">전체 제출내역 →</a></p>' : '<p class="muted">아직 제출이 없습니다.</p>') + '</div></div>';
});
