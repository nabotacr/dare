/* edit-requests.html — 수정요청: 왼쪽 목록에서 고르면 오른쪽에 상세 (요청 내용, 제출 건 요약, 이전 요청 이력, 승인·반려) */
DA.page('edit-requests', async function (main) {
  var D = DA, esc = D.esc, $ = D.$;
  var only = D.param('all') ? '' : 'pending', rows = [], form = await D.rpc('get_current_form');
  var STATE = { pending: ['대기', '#9a5b00', '#fdf3e2'], approved: ['승인', '#1f7a4d', '#e8f4ee'], rejected: ['반려', '#b3261e', '#fbeaea'] };
  var sbadge = function (s) { var x = STATE[s] || [s, '#333', '#eee']; return '<span class="badge" style="color:' + x[1] + ';background:' + x[2] + '">' + x[0] + '</span>'; };

  main.innerHTML = '<h1>수정요청</h1><div class="seg"><button data-f="pending">대기 중</button><button data-f="all">전체</button></div>' +
    '<div class="split" style="grid-template-columns:minmax(0,1fr) 460px"><div class="card scroll" id="list"></div><div id="detail"><div class="card"><p class="muted">왼쪽 목록에서 수정요청을 선택하세요.</p></div></div></div>';
  D.$$('.seg button', main).forEach(function (b) {
    b.classList.toggle('on', (b.dataset.f === 'all') === !only);
    b.onclick = function () { location.search = b.dataset.f === 'all' ? '?all=1' : ''; };
  });

  async function load(selectId) {
    var q = D.sb.from('edit_requests').select('*, submissions(id, receipt_no, research_title, researcher_name, email, status, submitted_at, last_submitted_at, current_version)').order('created_at', { ascending: false });
    if (only) q = q.eq('status', only);
    rows = await D.q(q);
    $('#list').innerHTML = rows.length ? '<table class="tbl"><thead><tr><th>요청일</th><th>접수번호</th><th>연구제목 / 연구자</th><th>상태</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var s = r.submissions || {};
        return '<tr class="click" data-id="' + r.id + '"><td style="white-space:nowrap">' + D.fmt(r.created_at) + '</td><td>' + esc(s.receipt_no) + '</td>' +
          '<td>' + esc(s.research_title) + '<br><span class="muted">' + esc(s.researcher_name) + '</span></td><td>' + sbadge(r.status) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="muted">해당하는 수정요청이 없습니다.</p>';
    $('#list tbody') && ($('#list tbody').onclick = function (e) { var tr = e.target.closest('tr[data-id]'); if (tr) detail(tr.dataset.id); });
    if (selectId) detail(selectId); else if (rows[0]) detail(rows[0].id);
  }

  async function detail(id) {
    D.$$('#list tr[data-id]').forEach(function (tr) { tr.style.background = tr.dataset.id === id ? '#eef3fd' : ''; });
    var r = rows.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var s = r.submissions || {};
    var hist = await D.q(D.sb.from('edit_requests').select('*').eq('submission_id', r.submission_id).order('created_at', { ascending: false }));
    var files = ((form && form.fields) || []).filter(function (f) { return f.type === 'file'; });
    $('#detail').innerHTML = '<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">수정요청 상세</h2>' + sbadge(r.status) + '</div>' +
      '<dl class="kv" style="margin-top:14px"><dt>요청일</dt><dd>' + D.fmt(r.created_at) + '</dd><dt>접수번호</dt><dd><a href="submission.html?id=' + s.id + '">' + esc(s.receipt_no) + ' →</a></dd>' +
      '<dt>연구제목</dt><dd>' + esc(s.research_title) + '</dd><dt>연구자</dt><dd>' + esc(s.researcher_name) + ' · ' + esc(s.email) + '</dd>' +
      '<dt>제출 상태</dt><dd>' + D.badge(s.status) + '</dd><dt>최초 제출</dt><dd>' + D.fmt(s.submitted_at) + ' (7일 기한 ' + D.fmt(new Date(Date.parse(s.submitted_at) + 7 * 864e5).toISOString()) + ')</dd>' +
      '<dt>현재 버전</dt><dd>v' + s.current_version + ' · ' + D.fmt(s.last_submitted_at) + '</dd></dl>' +
      '<h3>요청 사유</h3><div class="box" style="white-space:pre-wrap">' + esc(r.reason) + '</div>' +
      (r.status === 'approved' ? '<p class="muted">승인 ' + D.fmt(r.decided_at) + ' · 수정 기한 ' + D.fmt(r.deadline) + '</p>' : '') +
      (r.status === 'rejected' ? '<p class="muted">반려 ' + D.fmt(r.decided_at) + ' · 사유: ' + esc(r.reject_reason) + '</p>' : '') +
      (r.status === 'pending' ?
        '<h3>승인 (수정 권한 부여)</h3><label>수정 가능 서류</label><div>' + files.map(function (f) {
          return '<label class="inline"><input type="checkbox" name="gdoc" value="' + esc(f.key) + '">' + esc(f.label) + '</label>'; }).join('') +
        '</div><p class="muted" style="margin:2px 0 0">아무것도 고르지 않으면 전체 서류</p><label>수정 기한</label><input type="datetime-local" id="g-dl">' +
        '<button class="b" id="g-ok" style="margin-top:10px;width:100%">승인하고 메일 보내기</button>' +
        '<h3>반려</h3><label>반려 사유 (연구자에게 메일)</label><textarea id="g-rr" style="min-height:70px"></textarea><button class="b r" id="g-no" style="margin-top:8px;width:100%">반려하고 메일 보내기</button>' : '') +
      (hist.length > 1 ? '<h3>이 제출 건의 수정요청 이력 (' + hist.length + '건)</h3><ul class="time">' + hist.map(function (h) {
        return '<li><span class="muted">' + D.fmt(h.created_at) + '</span> ' + sbadge(h.status) + '<br>' + esc(String(h.reason).slice(0, 80)) + '</li>'; }).join('') + '</ul>' : '') +
      '</div>';
    if (r.status !== 'pending') return;
    $('#g-ok').onclick = async function () {
      this.disabled = true;
      try {
        var picked = D.$$('input[name=gdoc]:checked').map(function (c) { return c.value; });
        await D.rpc('admin_grant_revision', { p_id: r.submission_id, p_deadline: D.fromLocal($('#g-dl').value), p_files: picked, p_note: null });
        D.toast('ok', '승인했습니다. 연구자에게 메일이 발송됩니다.'); await load(id);
      } catch (e) { D.toast('err', D.errText(e)); this.disabled = false; }
    };
    $('#g-no').onclick = async function () {
      this.disabled = true;
      try { await D.rpc('admin_decide_edit_request', { p_request_id: r.id, p_approve: false, p_reject_reason: $('#g-rr').value });
            D.toast('ok', '반려했습니다. 연구자에게 메일이 발송됩니다.'); await load(id); }
      catch (e) { D.toast('err', D.errText(e)); this.disabled = false; }
    };
  }

  var pre = D.param('id');
  await load(pre);
});
