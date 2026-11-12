/* audit.html — 감사 로그 (최고관리자 전용, 수정·삭제 불가)
 * 거르기: 작업 종류(분류별), 관리자, 기간, 검색어 / 요약 카드 클릭으로 분류 선택 / 상세는 펼쳐보기 */
DA.page('audit', async function (main) {
  var D = DA, esc = D.esc, $ = D.$;
  var GROUPS = [
    ['접속·열람', '#2b5fd9', '#eaf0fc', { admin_login: '관리자 로그인', view_submission: '제출 상세 열람', download_file: '첨부 다운로드', export_csv: 'CSV 내려받기' }],
    ['처리', '#9a5b00', '#fdf3e2', { start_review: '검토 시작', request_supplement: '보완 요청', grant_revision: '수정 권한 부여', decide_edit_request: '수정요청 반려', extend_deadline: '기한 연장' }],
    ['검토 결과', '#1f7a4d', '#e8f4ee', { set_result: '결과 입력', publish_result: '결과 안내 발송', correct_result: '결과 정정', clear_result: '결과 지움' }],
    ['설정·메일', '#6a3fb5', '#f1ecfb', { save_form: '지원서 설정 저장', resend_mail: '메일 재발송' }]
  ];
  var LABEL = {}, GROUP_OF = {};
  GROUPS.forEach(function (g, i) { Object.keys(g[3]).forEach(function (k) { LABEL[k] = g[3][k]; GROUP_OF[k] = i; }); });
  var f = { action: D.param('action') || '', group: D.param('group') || '', actor: D.param('actor') || '',
            from: D.param('from') || '', to: D.param('to') || '', q: D.param('q') || '' };

  var st = document.createElement('style');
  st.textContent =
    '.af{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr 1.4fr auto;gap:12px;align-items:end}.af label{margin:0 0 6px}' +
    '.af .btns{display:flex;gap:6px}.agrp{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:0 0 16px}' +
    '.agrp button{text-align:left;border:1px solid var(--line);background:#fff;border-radius:10px;padding:12px 14px;cursor:pointer;font:inherit}' +
    '.agrp button b{display:block;font-size:24px;margin-top:2px}.agrp button.on{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}' +
    '.adet summary{cursor:pointer;color:var(--info);font-size:13px}.adet pre{white-space:pre-wrap;word-break:break-all;font-size:12px;background:var(--field);padding:8px;border-radius:6px;margin:6px 0 0}' +
    '.akv{font-size:13px;color:#4a5170}.akv span{display:inline-block;margin-right:10px}' +
    '@media(max-width:1100px){.af{grid-template-columns:1fr 1fr}.agrp{grid-template-columns:1fr 1fr}}';
  document.head.appendChild(st);

  /* 데이터 (작업·관리자·기간은 서버에서, 검색어는 화면에서 거름) */
  var query = D.sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(1000);
  if (f.action) query = query.eq('action', f.action);
  else if (f.group !== '') query = query.in('action', Object.keys(GROUPS[Number(f.group)][3]));
  if (f.actor) query = query.eq('actor_email', f.actor);
  if (f.from) query = query.gte('created_at', new Date(f.from + 'T00:00:00').toISOString());
  if (f.to) query = query.lte('created_at', new Date(f.to + 'T23:59:59').toISOString());
  var rows = await D.q(query);
  var admins = await D.q(D.sb.from('admins').select('email, name').order('email'));
  if (f.q) { var kw = f.q.toLowerCase(); rows = rows.filter(function (r) { return JSON.stringify([r.target_id, r.detail, r.actor_email]).toLowerCase().indexOf(kw) >= 0; }); }

  /* 분류별 건수 (현재 기간·관리자 기준) */
  var cntQ = D.sb.from('audit_logs').select('action').limit(5000);
  if (f.actor) cntQ = cntQ.eq('actor_email', f.actor);
  if (f.from) cntQ = cntQ.gte('created_at', new Date(f.from + 'T00:00:00').toISOString());
  if (f.to) cntQ = cntQ.lte('created_at', new Date(f.to + 'T23:59:59').toISOString());
  var forCount = await D.q(cntQ);
  var gcount = GROUPS.map(function (g) { return forCount.filter(function (x) { return x.action in g[3]; }).length; });

  function badge(a) {
    var g = GROUPS[GROUP_OF[a]] || ['', '#555', '#eee'];
    return '<span class="badge" style="color:' + g[1] + ';background:' + g[2] + '">' + esc(LABEL[a] || a) + '</span>';
  }
  function target(r) {
    if (r.target_type === 'submission' && r.target_id) return '<a href="submission.html?id=' + esc(r.target_id) + '">제출 건 보기 →</a>';
    if (r.target_type === 'form') return '지원서 v' + esc(r.target_id);
    if (r.target_type === 'mail_outbox') return '메일 #' + esc(r.target_id);
    if (r.target_type === 'edit_request') return '수정요청';
    if (r.target_type === 'submission_file') return '파일 #' + esc(r.target_id);
    return esc(r.target_id || '-');
  }
  var KEY = { reason: '사유', deadline: '기한', files: '서류', result: '결과', from: '이전', to: '변경', note: '메모', count: '건수', ids: '대상 수', fields: '항목 수', approve: '승인', reject_reason: '반려 사유', new_id: '새 메일', attachment: '첨부' };
  function summary(d) {
    if (!d || typeof d !== 'object') return '';
    return '<div class="akv">' + Object.keys(d).slice(0, 4).map(function (k) {
      var v = d[k];
      if (Array.isArray(v)) v = k === 'ids' ? v.length + '건' : v.join(', ');
      else if (v && typeof v === 'object') v = v.name || JSON.stringify(v);
      else if (typeof v === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(v)) v = D.fmt(v);
      if (v === null || v === undefined || v === '') return '';
      return '<span><b>' + esc(KEY[k] || k) + '</b> ' + esc(String(v).slice(0, 60)) + '</span>';
    }).join('') + '</div>';
  }

  main.innerHTML = '<h1>감사 로그</h1>' +
    '<div class="agrp"><button data-g=""' + (f.group === '' && !f.action ? ' class="on"' : '') + '>전체<b>' + forCount.length + '</b></button>' +
    GROUPS.map(function (g, i) { return '<button data-g="' + i + '"' + (String(i) === f.group && !f.action ? ' class="on"' : '') + '><span style="color:' + g[1] + '">●</span> ' + g[0] + '<b>' + gcount[i] + '</b></button>'; }).join('') + '</div>' +

    '<div class="card"><div class="af">' +
    '<div><label>작업 종류</label><select id="f-action"><option value="">전체 작업</option>' + GROUPS.map(function (g) {
      return '<optgroup label="' + g[0] + '">' + Object.keys(g[3]).map(function (k) { return '<option value="' + k + '"' + (f.action === k ? ' selected' : '') + '>' + g[3][k] + '</option>'; }).join('') + '</optgroup>';
    }).join('') + '</select></div>' +
    '<div><label>관리자</label><select id="f-actor"><option value="">전체 관리자</option>' + admins.map(function (a) {
      return '<option value="' + esc(a.email) + '"' + (f.actor === a.email ? ' selected' : '') + '>' + esc(a.name || a.email) + '</option>'; }).join('') + '</select></div>' +
    '<div><label>시작일</label><input type="date" id="f-from" value="' + esc(f.from) + '"></div>' +
    '<div><label>종료일</label><input type="date" id="f-to" value="' + esc(f.to) + '"></div>' +
    '<div><label>검색어 (사유, 대상 등)</label><input id="f-q" value="' + esc(f.q) + '" placeholder="예: 보완, DARE-0003"></div>' +
    '<div class="btns"><button class="b" id="go">검색</button><button class="b g" id="reset">초기화</button></div></div>' +
    '<div class="row" style="margin-top:12px"><span class="muted">빠른 기간:</span>' +
    [['오늘', 0], ['최근 7일', 7], ['최근 30일', 30], ['최근 90일', 90]].map(function (p) { return '<button class="b g sm" data-days="' + p[1] + '">' + p[0] + '</button>'; }).join('') + '</div></div>' +

    '<div class="card scroll"><p class="muted" style="margin-top:0">' + rows.length + '건' + (rows.length >= 1000 ? ' (최근 1000건까지 표시, 기간을 좁혀 보세요)' : '') + ' · 감사 로그는 수정하거나 지울 수 없습니다.</p>' +
    (rows.length ? '<table class="tbl"><thead><tr><th style="width:150px">일시</th><th style="width:170px">관리자</th><th style="width:150px">작업</th><th style="width:130px">대상</th><th>내용</th><th style="width:110px">IP</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td style="white-space:nowrap">' + D.fmt(r.created_at) + '</td><td>' + esc(r.actor_email || 'system') + '</td><td>' + badge(r.action) + '</td>' +
          '<td>' + target(r) + '</td><td>' + summary(r.detail) +
          (r.detail && Object.keys(r.detail).length ? '<details class="adet"><summary>전체 보기</summary><pre>' + esc(JSON.stringify(r.detail, null, 2)) + '</pre></details>' : '') +
          '</td><td class="muted">' + esc(r.ip || '') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="muted" style="text-align:center;padding:30px 0">조건에 맞는 기록이 없습니다.</p>') + '</div>';

  function go(over) {
    var v = Object.assign({ action: $('#f-action').value, group: '', actor: $('#f-actor').value, from: $('#f-from').value, to: $('#f-to').value, q: $('#f-q').value.trim() }, over || {});
    var p = new URLSearchParams(); Object.keys(v).forEach(function (k) { if (v[k] !== '' && v[k] != null) p.set(k, v[k]); });
    location.search = p.toString();
  }
  $('#go').onclick = function () { go(); };
  $('#f-q').onkeydown = function (e) { if (e.key === 'Enter') go(); };
  $('#reset').onclick = function () { location.search = ''; };
  D.$$('[data-g]', main).forEach(function (b) { b.onclick = function () { go({ action: '', group: b.dataset.g }); }; });
  D.$$('[data-days]', main).forEach(function (b) {
    b.onclick = function () {
      var d = new Date(), from = new Date(Date.now() - Number(b.dataset.days) * 864e5), iso = function (x) { return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
      go({ from: iso(from), to: iso(d) });
    };
  });
});
