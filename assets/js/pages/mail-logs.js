/* mail-logs.html — 메일 발송 로그: 상태·양식·받는 사람으로 거르기, 실패 건 재발송 */
DA.page('mail-logs', async function (main) {
  var D = DA, esc = D.esc, $ = D.$;
  var f = { status: D.param('status') || '', tpl: D.param('tpl') || '', q: D.param('q') || '' };
  var STATE = { queued: ['대기', '#9a5b00', '#fdf3e2'], sent: ['발송 완료', '#1f7a4d', '#e8f4ee'], failed: ['실패', '#b3261e', '#fbeaea'] };
  var tpls = await D.q(D.sb.from('mail_templates').select('key, description, audience').order('audience', { ascending: false }));
  var tplName = {}; tpls.forEach(function (t) { tplName[t.key] = t.description; });

  main.innerHTML = '<h1>메일 발송 로그</h1>' +
    '<div class="card"><div class="row">' +
    '<select id="f-status"><option value="">전체 상태</option>' + Object.keys(STATE).map(function (k) { return '<option value="' + k + '"' + (f.status === k ? ' selected' : '') + '>' + STATE[k][0] + '</option>'; }).join('') + '</select>' +
    '<select id="f-tpl"><option value="">전체 메일 종류</option>' + tpls.map(function (t) { return '<option value="' + esc(t.key) + '"' + (f.tpl === t.key ? ' selected' : '') + '>' + esc(t.description) + '</option>'; }).join('') + '</select>' +
    '<input id="f-q" class="grow" placeholder="받는 사람 이메일" value="' + esc(f.q) + '"><button class="b" id="go">검색</button></div>' +
    '<p class="muted" style="margin:10px 0 0">대기 상태가 몇 분 넘게 계속되면 Database Webhook(mail_outbox → send-mail) 설정을, 실패가 있으면 오류 내용과 Resend 설정을 확인하세요.</p></div>' +
    '<div class="stats" id="stats" style="margin-bottom:16px"></div><div class="card scroll" id="list"></div>';

  $('#go').onclick = function () {
    var p = new URLSearchParams();
    if ($('#f-status').value) p.set('status', $('#f-status').value);
    if ($('#f-tpl').value) p.set('tpl', $('#f-tpl').value);
    if ($('#f-q').value.trim()) p.set('q', $('#f-q').value.trim());
    location.search = p.toString();
  };
  $('#f-q').onkeydown = function (e) { if (e.key === 'Enter') $('#go').click(); };

  async function load() {
    var query = D.sb.from('mail_outbox').select('*, submissions(id, receipt_no)').order('created_at', { ascending: false }).limit(500);
    if (f.status) query = query.eq('status', f.status);
    if (f.tpl) query = query.eq('template_key', f.tpl);
    if (f.q) query = query.ilike('to_email', '%' + f.q.replace(/[%,()*]/g, '') + '%');
    var rows = await D.q(query);

    var since = new Date(Date.now() - 7 * 864e5).toISOString();
    var week = await D.q(D.sb.from('mail_outbox').select('status').gte('created_at', since));
    var cnt = function (s) { return week.filter(function (x) { return x.status === s; }).length; };
    $('#stats').innerHTML = '<div class="stat">최근 7일 전체<b>' + week.length + '</b></div>' +
      Object.keys(STATE).map(function (k) { return '<a class="stat" style="text-decoration:none;color:inherit" href="mail-logs.html?status=' + k + '">' + STATE[k][0] + '<b style="color:' + STATE[k][1] + '">' + cnt(k) + '</b></a>'; }).join('');

    $('#list').innerHTML = '<p class="muted">' + rows.length + '건 (최근 500건까지)</p><table class="tbl"><thead><tr><th>생성 일시</th><th>메일 종류</th><th>받는 사람</th><th>접수번호</th><th>상태</th><th>시도</th><th>발송 일시</th><th>오류</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        var st = STATE[r.status] || [r.status, '#333', '#eee'], sub = r.submissions;
        return '<tr><td style="white-space:nowrap">' + D.fmt(r.created_at) + '</td><td>' + esc(tplName[r.template_key] || r.template_key) + '</td><td>' + esc(r.to_email) +
          '</td><td>' + (sub ? '<a href="submission.html?id=' + sub.id + '">' + esc(sub.receipt_no) + '</a>' : '-') +
          '</td><td><span class="badge" style="color:' + st[1] + ';background:' + st[2] + '">' + st[0] + '</span></td><td>' + r.attempts +
          '</td><td style="white-space:nowrap">' + D.fmt(r.sent_at) + '</td><td class="pre" style="max-width:260px;font-size:12px">' + esc(r.last_error || '') + '</td>' +
          '<td>' + (r.status !== 'sent' ? '<button class="b g sm" data-resend="' + r.id + '">재발송</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>' + (rows.length ? '' : '<p class="muted">해당하는 메일이 없습니다.</p>');
  }

  $('#list').addEventListener('click', async function (e) {
    var b = e.target.closest('[data-resend]'); if (!b) return;
    if (!confirm('이 메일을 같은 내용으로 다시 보낼까요?')) return;
    b.disabled = true;
    try { await D.rpc('admin_resend_mail', { p_id: Number(b.dataset.resend) }); D.toast('ok', '재발송 요청했습니다. 잠시 후 새로고침해 확인하세요.'); setTimeout(load, 2500); }
    catch (err) { D.toast('err', D.errText(err)); b.disabled = false; }
  });

  await load();
});
