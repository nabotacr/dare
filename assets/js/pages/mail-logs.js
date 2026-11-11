/* mail-logs.html — 메일 발송 로그: 상태·양식·받는 사람으로 거르기, 실패 건 재발송 */
DA.page('mail-logs', async function (main) {
  var D = DA, esc = D.esc, $ = D.$;
  var f = { status: D.param('status') || '', tpl: D.param('tpl') || '', q: D.param('q') || '' };
  var STATE = { queued: ['대기', '#9a5b00', '#fdf3e2'], sending: ['발송 중', '#2b5fd9', '#eaf0fc'], sent: ['발송 완료', '#1f7a4d', '#e8f4ee'], failed: ['실패', '#b3261e', '#fbeaea'] };
  var tpls = await D.q(D.sb.from('mail_templates').select('key, description, audience').order('audience', { ascending: false }));
  var tplName = {}; tpls.forEach(function (t) { tplName[t.key] = t.description; });

  main.innerHTML = '<h1>메일 발송 로그</h1><div class="seg"><button class="on" data-tab="out">안내 메일 (send-mail)</button><button data-tab="otp">인증코드 메일 (Supabase)</button></div>' +
    '<div data-pane="otp" hidden></div><div data-pane="out">' +
    '<div class="card"><div class="row">' +
    '<select id="f-status"><option value="">전체 상태</option>' + Object.keys(STATE).map(function (k) { return '<option value="' + k + '"' + (f.status === k ? ' selected' : '') + '>' + STATE[k][0] + '</option>'; }).join('') + '</select>' +
    '<select id="f-tpl"><option value="">전체 메일 종류</option>' + tpls.map(function (t) { return '<option value="' + esc(t.key) + '"' + (f.tpl === t.key ? ' selected' : '') + '>' + esc(t.description) + '</option>'; }).join('') + '</select>' +
    '<input id="f-q" class="grow" placeholder="받는 사람 이메일" value="' + esc(f.q) + '"><button class="b" id="go">검색</button></div>' +
    '<div class="row" style="margin-top:10px"><button class="b g" id="check">발송 설정 점검</button><button class="b g" id="drain">대기·실패 메일 지금 보내기</button>' +
    '<span class="muted">대기 메일은 1분마다 자동으로 다시 보냅니다. 계속 대기·실패면 점검을 눌러 원인을 확인하세요.</span></div><div id="checkout"></div></div>' +
    '<div class="stats" id="stats" style="margin-bottom:16px"></div><div class="card scroll" id="list"></div></div>';

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
          '<td>' + (r.status !== 'sent' && r.template_key !== 'otp_code' ? '<button class="b g sm" data-resend="' + r.id + '">재발송</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>' + (rows.length ? '' : '<p class="muted">해당하는 메일이 없습니다.</p>');
  }

  $('#list').addEventListener('click', async function (e) {
    var b = e.target.closest('[data-resend]'); if (!b) return;
    if (!confirm('이 메일을 같은 내용으로 다시 보낼까요?')) return;
    b.disabled = true;
    try { await D.rpc('admin_resend_mail', { p_id: Number(b.dataset.resend) }); D.toast('ok', '재발송 요청했습니다. 잠시 후 새로고침해 확인하세요.'); setTimeout(load, 2500); }
    catch (err) { D.toast('err', D.errText(err)); b.disabled = false; }
  });

  /* 발송 함수 호출 (관리자 토큰) */
  async function callFn(action) {
    var token = (await D.sb.auth.getSession()).data.session.access_token;
    var res = await fetch(D.config.SUPABASE_URL + '/functions/v1/send-mail', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, apikey: D.config.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action })
    }).catch(function () { return null; });
    if (!res) throw new Error('send-mail 함수에 연결하지 못했습니다. 함수가 배포됐는지, 이름이 send-mail 인지 확인해 주세요.');
    if (res.status === 404) throw new Error('send-mail 함수가 없습니다. Edge Functions 에 배포해 주세요.');
    var j = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(j.error || j.msg || ('오류 ' + res.status + (res.status === 401 ? ' - 함수 배포 시 --no-verify-jwt 옵션을 확인해 주세요.' : '')));
    return j;
  }
  $('#drain').onclick = async function () {
    this.disabled = true;
    try { var j = await callFn('drain'); D.toast('ok', '보냄 ' + j.sent + ' · 실패 ' + j.failed); setTimeout(load, 800); }
    catch (e) { D.toast('err', D.errText(e)); }
    this.disabled = false;
  };
  $('#check').onclick = async function () {
    var out = $('#checkout'); out.innerHTML = '<p class="muted">점검 중...</p>';
    try {
      var c = await callFn('check'), items = [];
      var ok = function (cond, good, bad) { items.push('<li style="color:' + (cond ? '#1f7a4d' : '#b3261e') + '">' + (cond ? '✔ ' + good : '✘ ' + bad) + '</li>'); };
      if (c.PROVIDER === 'smtp') {
        items.push('<li><b>발송 방법: SMTP</b> (' + esc(c.SMTP_HOST) + ':' + esc(c.SMTP_PORT) + ')</li>');
        ok(String(c.SMTP_PORT) === '465', 'SMTP_PORT 465', 'SMTP_PORT 를 465 로 바꿔 주세요 (Edge Function 은 587 을 쓸 수 없음)');
        ok(c.SMTP_USER && c.SMTP_PASS, 'SMTP 계정 설정됨: ' + esc(c.SMTP_USER), 'SMTP_USER 또는 SMTP_PASS 가 없습니다');
        ok(c.smtp_ok, 'SMTP 서버 접속·로그인 성공', 'SMTP 접속 실패: ' + esc(c.smtp_error || '') + ' (계정, 비밀번호, 외부 메일 프로그램 허용 여부 확인)');
      } else if (c.PROVIDER === 'resend') {
        items.push('<li><b>발송 방법: Resend API</b></li>');
        if (Array.isArray(c.resend_domains)) ok(c.from_domain_verified, 'Resend 도메인 인증 완료', '보내는 주소의 도메인이 Resend 에서 인증되지 않았습니다');
      } else ok(false, '', '발송 방법이 없습니다. SMTP_HOST·SMTP_USER·SMTP_PASS (또는 RESEND_API_KEY) 를 Secrets 에 넣어 주세요');
      ok(c.MAIL_FROM, '보내는 주소: ' + esc(c.MAIL_FROM), 'MAIL_FROM 이 없습니다');
      ok(c.WEBHOOK_SECRET, 'WEBHOOK_SECRET 설정됨 (SQL set_mail_config 의 두 번째 값과 같아야 함)', 'WEBHOOK_SECRET 이 없습니다');
      ok(c.MYPAGE_URL, '메일 버튼 주소: ' + esc(c.MYPAGE_URL), 'MYPAGE_URL 이 없습니다 (메일 버튼이 빠짐)');
      items.push('<li class="muted">인증코드 메일: ' + (c.SEND_EMAIL_HOOK_SECRET ? '이 함수로 발송 (Hook 사용)' : 'Supabase 가 직접 발송 (Hook 미사용, 정상)') + '</li>');
      items.push('<li class="muted">대기열 현황: ' + esc(JSON.stringify(c.queue || {})) + '</li>');
      out.innerHTML = '<ul style="margin:12px 0 0;padding-left:18px;line-height:1.9">' + items.join('') + '</ul>';
    } catch (e) { out.innerHTML = '<div class="msg err">' + esc(D.errText(e)) + '</div>'; }
  };

  /* 인증코드 메일: Supabase 인증 기록(요청 시각·이메일·종류) */
  var ACT = { user_confirmation_requested: '인증코드 (처음 쓰는 이메일)', user_recovery_requested: '인증코드 (등록된 이메일)', user_reauthenticate_requested: '재인증 코드' };
  async function loadOtp() {
    var box = main.querySelector('[data-pane=otp]');
    box.innerHTML = '<div class="card"><p class="muted">불러오는 중...</p></div>';
    try {
      var rows = await D.rpc('admin_auth_email_logs', { p_limit: 500 });
      box.innerHTML = '<div class="card"><p class="muted" style="margin-top:0">Supabase 가 직접 보내는 인증코드 메일의 <b>요청 기록</b>입니다 (최근 500건). 실제 수신 여부는 Supabase > Logs > Auth 에서 확인할 수 있습니다.</p>' +
        '<div class="scroll"><table class="tbl"><thead><tr><th>요청 일시</th><th>받는 사람</th><th>종류</th><th>IP</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td style="white-space:nowrap">' + D.fmt(r.created_at) + '</td><td>' + esc(r.email) + '</td><td>' + esc(ACT[r.action] || r.action) + '</td><td>' + esc(r.ip || '') + '</td></tr>'; }).join('') +
        '</tbody></table></div>' + (rows.length ? '' : '<p class="muted">기록이 없습니다. Supabase > Authentication > Settings 에서 감사 로그(Audit logs) 저장이 꺼져 있으면 기록되지 않습니다.</p>') + '</div>';
    } catch (e) { box.innerHTML = '<div class="msg err">' + esc(D.errText(e)) + '</div>'; }
  }
  D.$$('[data-tab]', main).forEach(function (b) {
    b.onclick = function () {
      D.$$('[data-tab]', main).forEach(function (x) { x.classList.toggle('on', x === b); });
      main.querySelector('[data-pane=out]').hidden = b.dataset.tab !== 'out';
      main.querySelector('[data-pane=otp]').hidden = b.dataset.tab !== 'otp';
      if (b.dataset.tab === 'otp') loadOtp();
    };
  });

  await load();
});
