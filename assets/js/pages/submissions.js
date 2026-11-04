/* submissions.html — 제출내역 목록: 검색·필터, 일괄 검토 시작, 일괄 결과 입력, CSV 다운로드
 * 필터는 주소(?call=&status=&q=)에 남아서 새로고침·공유해도 유지됩니다. 행을 누르면 submission.html 로 이동 */
DA.page('submissions', async function (main) {
  var D = DA, esc = D.esc, $ = D.$;
  var calls = await D.loadCalls();
  var f = { call: D.param('call') || '', status: D.param('status') || '', text: D.param('q') || '' };
  var rows = [];

  main.innerHTML =
    '<h1>제출내역</h1><div class="card"><div class="row">' +
    '<select id="f-call">' + D.callOptions(calls, f.call, true) + '</select>' +
    '<select id="f-status"><option value="">전체 상태</option>' + Object.keys(D.STATUS).map(function (k) {
      return '<option value="' + k + '"' + (f.status === k ? ' selected' : '') + '>' + D.STATUS[k][0] + '</option>';
    }).join('') + '</select>' +
    '<input id="f-text" class="grow" placeholder="접수번호·제목·성명·이메일·소속" value="' + esc(f.text) + '">' +
    '<button class="b" id="f-go">검색</button><button class="b g" id="f-csv">엑셀(CSV)</button></div>' +
    '<div class="row" style="margin-top:10px"><span class="muted">선택한 항목:</span>' +
    '<button class="b g" id="bulk-review">검토 시작</button>' +
    '<button class="b g" data-result="selected">결과: 선정</button><button class="b g" data-result="not_selected">결과: 미선정</button></div></div>' +
    '<div class="card scroll" id="list"></div>';

  $('#f-go').addEventListener('click', function () {
    var p = new URLSearchParams();
    if ($('#f-call').value) p.set('call', $('#f-call').value);
    if ($('#f-status').value) p.set('status', $('#f-status').value);
    if ($('#f-text').value.trim()) p.set('q', $('#f-text').value.trim());
    location.search = p.toString();
  });
  $('#f-text').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#f-go').click(); });
  $('#f-csv').addEventListener('click', exportCsv);

  $('#bulk-review').addEventListener('click', async function () {
    var ids = checked(); if (!ids.length) return D.toast('info', '항목을 선택해 주세요.');
    try { var n = await D.rpc('admin_start_review', { p_ids: ids }); D.toast('ok', n + '건 검토를 시작했습니다. (제출완료 상태만 적용)'); load(); }
    catch (e) { D.toast('err', D.errText(e)); }
  });
  D.$$('[data-result]', main).forEach(function (b) {
    b.addEventListener('click', async function () {
      var ids = checked(); if (!ids.length) return D.toast('info', '항목을 선택해 주세요.');
      if (!confirm(ids.length + '건의 결과를 "' + D.RESULT_LABEL[b.dataset.result] + '"(으)로 입력할까요?')) return;
      try { var n = await D.rpc('admin_set_results', { p_ids: ids, p_result: b.dataset.result }); D.toast('ok', n + '건 결과를 입력했습니다.'); load(); }
      catch (e) { D.toast('err', D.errText(e)); }
    });
  });

  function checked() { return D.$$('.chk:checked').map(function (c) { return c.value; }); }

  async function load() {
    var query = D.sb.from('submissions').select('*, submission_results(result)').order('submitted_at', { ascending: false }).limit(1000);
    if (f.call) query = query.eq('call_id', f.call);
    if (f.status) query = query.eq('status', f.status);
    if (f.text) {
      var t = f.text.replace(/[%,()*]/g, ' ');   // 검색어 안의 특수문자 제거 (필터 구문 깨짐 방지)
      query = query.or(['receipt_no', 'research_title', 'researcher_name', 'email', 'affiliation'].map(function (c) { return c + '.ilike.%' + t + '%'; }).join(','));
    }
    rows = await D.q(query);
    $('#list').innerHTML = '<p class="muted">' + rows.length + '건</p><table class="tbl"><thead><tr>' +
      '<th><input type="checkbox" id="chk-all" aria-label="전체 선택"></th><th>접수번호</th><th>연구제목</th><th>성명</th><th>국적</th><th>소속</th><th>상태</th><th>결과</th><th>제출</th><th>최근 수정</th></tr></thead><tbody>' +
      rows.map(function (s) {
        var res = s.submission_results && (s.submission_results.result || (s.submission_results[0] && s.submission_results[0].result));
        return '<tr class="click" data-id="' + s.id + '"><td><input type="checkbox" class="chk" value="' + s.id + '"></td><td>' + esc(s.receipt_no) +
          '</td><td>' + esc(s.research_title) + '</td><td>' + esc(s.researcher_name) + '</td><td>' + esc(s.nationality) + '</td><td>' + esc(s.affiliation || '') +
          '</td><td>' + D.badge(s.status) + '</td><td>' + (res ? D.RESULT_LABEL[res] : '') + '</td><td>' + D.fmt(s.submitted_at) +
          '</td><td>' + (s.current_version > 1 ? D.fmt(s.last_submitted_at) + ' (v' + s.current_version + ')' : '-') + '</td></tr>';
      }).join('') + '</tbody></table>';
    $('#chk-all').addEventListener('change', function (e) { D.$$('.chk').forEach(function (c) { c.checked = e.target.checked; }); });
    $('#list tbody').addEventListener('click', function (e) {
      if (e.target.closest('input')) return;
      var tr = e.target.closest('tr[data-id]'); if (tr) location.href = 'submission.html?id=' + tr.dataset.id;
    });
  }

  function exportCsv() {
    if (!rows.length) return D.toast('info', '내보낼 데이터가 없습니다.');
    var head = ['접수번호', '연구제목', '연구자 성명', '국적', '소속기관', '이메일', '상태', '제출일시', '최근 수정', '버전'];
    // 셀 값이 = + - @ 로 시작하면 엑셀이 수식으로 실행하므로 앞에 ' 를 붙여 막음
    var cell = function (v) { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var csv = '\ufeff' + [head].concat(rows.map(function (s) {
      return [s.receipt_no, s.research_title, s.researcher_name, s.nationality, s.affiliation, s.email, D.STATUS[s.status][0], D.fmt(s.submitted_at), D.fmt(s.last_submitted_at), s.current_version];
    })).map(function (r) { return r.map(cell).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'DARE_submissions_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    D.log('export_csv', null, null, { count: rows.length, filter: f });
  }

  await load();
});
