/* dashboard.html — 공고별 상태 집계, 처리 대기 */
DA.page('dashboard', async function (main) {
  var D = DA, esc = D.esc;
  var r = await Promise.all([
    D.loadCalls(),
    D.q(D.sb.from('submissions').select('call_id, status')),
    D.q(D.sb.from('edit_requests').select('id').eq('status', 'pending')),
    D.q(D.sb.from('mail_outbox').select('id').eq('status', 'failed'))
  ]);
  var calls = r[0], subs = r[1], pending = r[2].length, failed = r[3].length;
  var order = ['submitted', 'reviewing', 'supplement_requested', 'resubmit_allowed', 'withdrawn'];

  var html = '<h1>대시보드</h1>' +
    '<div class="card"><h2>처리 대기</h2><p>수정요청 대기 <b>' + pending + '</b>건 · <a href="edit-requests.html">수정요청으로</a></p>' +
    (failed ? '<p class="msg err">메일 발송 실패 ' + failed + '건이 있습니다. Supabase → Edge Functions → send-mail 로그를 확인하세요.</p>' : '') + '</div>';

  if (!calls.length) html += '<div class="card"><p>등록된 공고가 없습니다. <a href="calls.html">공고·수정기간</a>에서 만들어 주세요.</p></div>';
  calls.forEach(function (c) {
    var mine = subs.filter(function (s) { return s.call_id === c.id; });
    var count = function (st) { return mine.filter(function (s) { return s.status === st; }).length; };
    html += '<div class="card"><h2>' + esc(c.code + ' · ' + c.title) + (c.is_published ? '' : ' <span class="muted">(비공개)</span>') + '</h2>' +
      '<p class="muted">접수 ' + D.period(c) + ' · 수정기간 ' +
      (c.edit_start_at ? D.fmt(c.edit_start_at) + ' ~ ' + D.fmt(c.edit_end_at) : '설정 안 함') + ' · 결과 공개 ' + D.fmt(c.result_open_at) + '</p>' +
      '<div class="stats">' + order.map(function (st) {
        return '<a class="stat" style="text-decoration:none;color:inherit" href="submissions.html?call=' + c.id + '&status=' + st + '">' + D.STATUS[st][0] + '<b>' + count(st) + '</b></a>';
      }).join('') +
      '<div class="stat">전체(취소 제외)<b>' + mine.filter(function (s) { return s.status !== 'withdrawn'; }).length + '</b></div></div></div>';
  });
  main.innerHTML = html;
});
