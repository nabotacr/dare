/* audit.html — 감사 로그 (최고관리자 전용, 수정·삭제 불가) */
DA.page('audit', async function (main) {
  var D = DA, esc = D.esc;
  var action = D.param('action') || '';
  var query = D.sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
  if (action) query = query.eq('action', action);
  var rows = await D.q(query);
  var actions = ['admin_login', 'view_submission', 'download_file', 'export_csv', 'start_review', 'request_supplement',
                 'decide_edit_request', 'extend_deadline', 'set_result', 'correct_result'];

  main.innerHTML = '<h1>감사 로그</h1><div class="card row"><span class="muted">작업으로 거르기:</span> <a href="audit.html">전체</a>' +
    actions.map(function (a) { return ' · <a href="audit.html?action=' + a + '"' + (a === action ? ' style="font-weight:700"' : '') + '>' + a + '</a>'; }).join('') + '</div>' +
    '<div class="card scroll"><p class="muted">최근 ' + rows.length + '건</p><table class="tbl"><thead><tr><th>일시</th><th>관리자</th><th>작업</th><th>대상</th><th>IP</th><th>상세</th></tr></thead><tbody>' +
    rows.map(function (r) {
      return '<tr><td style="white-space:nowrap">' + D.fmt(r.created_at) + '</td><td>' + esc(r.actor_email || 'system') + '</td><td>' + esc(r.action) +
        '</td><td>' + esc((r.target_type || '') + ' ' + (r.target_id || '')) + '</td><td>' + esc(r.ip || '') +
        '</td><td><code style="font-size:11px;word-break:break-all">' + esc(JSON.stringify(r.detail).slice(0, 300)) + '</code></td></tr>';
    }).join('') + '</tbody></table></div>';
});
