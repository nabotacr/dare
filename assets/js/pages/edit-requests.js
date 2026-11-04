/* edit-requests.html — 연구자 수정요청 처리 (승인: 기한 지정 / 반려: 사유 필수, 연구자에게 메일) */
DA.page('edit-requests', async function (main) {
  var D = DA, esc = D.esc, $ = D.$;
  var only = D.param('all') ? '' : 'pending';

  async function load() {
    var query = D.sb.from('edit_requests')
      .select('*, submissions(id, receipt_no, research_title, researcher_name, status)')
      .order('created_at', { ascending: false });
    if (only) query = query.eq('status', only);
    var rows = await D.q(query);

    main.innerHTML = '<h1>수정요청</h1><p><a href="edit-requests.html">대기 중</a> · <a href="edit-requests.html?all=1">전체</a></p>' +
      '<div class="card scroll"><table class="tbl"><thead><tr><th>요청일</th><th>접수번호</th><th>연구제목 / 성명</th><th>사유</th><th>상태</th><th>처리</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var s = r.submissions || {};
        return '<tr><td>' + D.fmt(r.created_at) + '</td><td><a href="submission.html?id=' + s.id + '">' + esc(s.receipt_no) + '</a></td>' +
          '<td>' + esc(s.research_title) + '<br><span class="muted">' + esc(s.researcher_name) + '</span></td><td class="pre">' + esc(r.reason) + '</td><td>' +
          ({ pending: '<b>대기</b>', approved: '승인 · 기한 ' + D.fmt(r.deadline), rejected: '반려 · ' + esc(r.reject_reason) })[r.status] + '</td><td style="min-width:220px">' +
          (r.status === 'pending' ?
            '<label>수정 기한</label><input type="datetime-local" data-dl="' + r.id + '"><button class="b sm" data-ok="' + r.id + '" style="margin-top:4px">승인</button>' +
            '<label>반려 사유</label><input data-rr="' + r.id + '"><button class="b r sm" data-no="' + r.id + '" style="margin-top:4px">반려</button>' : '') +
          '</td></tr>';
      }).join('') + '</tbody></table>' + (rows.length ? '' : '<p class="muted">해당하는 수정요청이 없습니다.</p>') + '</div>';
  }

  main.addEventListener('click', async function (e) {
    var ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]');
    if (!ok && !no) return;
    var btn = ok || no; btn.disabled = true;
    try {
      if (ok) await D.rpc('admin_decide_edit_request', { p_request_id: ok.dataset.ok, p_approve: true, p_deadline: D.fromLocal($('[data-dl="' + ok.dataset.ok + '"]').value) });
      else await D.rpc('admin_decide_edit_request', { p_request_id: no.dataset.no, p_approve: false, p_reject_reason: $('[data-rr="' + no.dataset.no + '"]').value });
      D.toast('ok', '처리했습니다. 연구자에게 메일이 발송됩니다.');
      await load();
    } catch (err) { D.toast('err', D.errText(err)); btn.disabled = false; }
  });

  await load();
});
