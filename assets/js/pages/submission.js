/* submission.html?id=... — 제출 상세
 * 입력값, 버전별 첨부(다운로드는 감사 로그 기록), 수정요청 처리, 검토 시작, 보완요청,
 * 개별 기한 연장, 결과 정정, 내부 메모, 처리 이력 */
DA.page('submissions', async function (main) {
  var D = DA, esc = D.esc, $ = D.$, sb = D.sb;
  var id = D.param('id');
  if (!D.isUuid(id)) { main.innerHTML = '<div class="msg err">잘못된 주소입니다.</div><a href="submissions.html">목록으로</a>'; return; }

  var versions = [], shownVer = null;
  var KIND = { initial: '최초 제출', edit: '수정 제출', supplement: '보완 제출', resubmit: '수정요청 승인 후 제출' };

  async function load() {
    var r = await Promise.all([
      D.q(sb.from('submissions').select('*, calls(*)').eq('id', id).single()),
      D.q(sb.from('submission_files').select('*').eq('submission_id', id).order('version_no', { ascending: false })),
      D.q(sb.from('submission_events').select('*').eq('submission_id', id).order('created_at', { ascending: false })),
      D.q(sb.from('submission_memos').select('*').eq('submission_id', id).order('created_at', { ascending: false })),
      D.q(sb.from('edit_requests').select('*').eq('submission_id', id).maybeSingle()),
      D.q(sb.from('submission_results').select('*').eq('submission_id', id).maybeSingle()),
      D.q(sb.from('submission_versions').select('*').eq('submission_id', id).order('version_no', { ascending: false }))
    ]);
    versions = r[6];
    render(r[0], r[1], r[2], r[3], r[4], r[5]);
  }

  function render(s, files, events, memos, req, result) {
    var call = s.calls || {};
    if (shownVer == null || !versions.some(function (v) { return v.version_no === shownVer; })) shownVer = s.current_version;
    var resultOpen = call.result_open_at && Date.parse(call.result_open_at) <= Date.now();

    main.innerHTML =
      '<p><a href="submissions.html">← 제출내역 목록</a></p>' +
      '<div class="row" style="justify-content:space-between"><h1 style="margin:0">' + esc(s.receipt_no) + ' · ' + esc(s.research_title) + '</h1>' + D.badge(s.status) + '</div>' +
      '<div class="split" style="margin-top:16px"><div>' +

      // 제출 상태 요약
      '<div class="card"><h2>접수 정보</h2><dl class="kv">' +
      '<dt>이메일</dt><dd>' + esc(s.email) + '</dd><dt>개인정보 동의</dt><dd>' + D.fmt(s.consent_at) + ' (' + esc(s.consent_version) + ')</dd>' +
      '<dt>최초 제출</dt><dd>' + D.fmt(s.submitted_at) + '</dd><dt>현재 버전</dt><dd>v' + s.current_version + ' · ' + D.fmt(s.last_submitted_at) + '</dd>' +
      (s.status === 'supplement_requested' ? '<dt>보완 사유</dt><dd>' + esc(s.supplement_reason) + '<br><span class="muted">기한 ' + D.fmt(s.supplement_deadline) + '</span></dd>' : '') +
      (s.status === 'resubmit_allowed' ? '<dt>수정 기한</dt><dd>' + D.fmt(s.resubmit_deadline) + '</dd>' : '') +
      (s.withdrawn_at ? '<dt>제출취소</dt><dd>' + D.fmt(s.withdrawn_at) + ' · ' + esc(s.withdraw_reason || '사유 없음') + '</dd>' : '') +
      '<dt>결과</dt><dd>' + (result ? D.RESULT_LABEL[result.result] : '미입력') + (resultOpen ? ' <span class="muted">(공개됨)</span>' : '') + '</dd></dl></div>' +

      // 버전별 제출 내용 (입력값 + 첨부파일)
      '<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">제출 내용</h2>' +
      '<div class="row">' + versions.map(function (v) {
        return '<button class="b sm ' + (v.version_no === shownVer ? '' : 'g') + '" data-ver="' + v.version_no + '" title="' + esc(KIND[v.kind] || v.kind) + ' · ' + D.fmt(v.created_at) + '">v' + v.version_no + (v.version_no === s.current_version ? ' 현재' : '') + '</button>';
      }).join('') + '</div></div>' + versionBody(s, files) + '</div>' +

      // 처리 이력
      '<div class="card"><h2>처리 이력</h2><ul class="time">' + events.map(function (ev) {
        return '<li><span class="muted">' + D.fmt(ev.created_at) + ' · ' + esc(ev.actor_role) + (ev.visible_to_researcher ? '' : ' · 연구자 비공개') + '</span><br>' +
          esc(ev.event_type) + (ev.message ? ' · ' + esc(ev.message) : '') + '</li>';
      }).join('') + '</ul></div>' +

      '</div><div>' +

      // 처리 (오른쪽)
      '<div class="card"><h2>처리</h2>' +
      (req ? '<h3>수정요청</h3><p style="white-space:pre-wrap">' + esc(req.reason) + '</p><p class="muted">' + D.fmt(req.created_at) + ' · ' +
        ({ pending: '대기', approved: '승인 (기한 ' + D.fmt(req.deadline) + ')', rejected: '반려: ' + esc(req.reject_reason) })[req.status] + '</p>' +
        (req.status === 'pending' ? '<div class="box"><label>승인 시 수정 기한</label><input type="datetime-local" id="dec-dl">' +
          '<button class="b" data-act="approve" style="margin-top:6px">승인</button>' +
          '<label>반려 사유 (연구자에게 공개)</label><input id="dec-reason"><button class="b r" data-act="reject" style="margin-top:6px">반려</button></div>' : '') : '') +

      (s.status === 'submitted' ? '<p><button class="b g" data-act="review">검토 시작</button> <span class="muted">시작하면 연구자 수정·취소가 잠깁니다.</span></p>' : '') +

      (['submitted', 'reviewing', 'supplement_requested'].indexOf(s.status) >= 0 ?
        '<details' + (s.status === 'supplement_requested' ? '' : ' open') + '><summary>보완요청</summary><label>사유 (연구자에게 메일로 안내)</label><textarea id="sup-reason"></textarea>' +
        '<label>보완 기한</label><input type="datetime-local" id="sup-dl"><button class="b" data-act="supplement" style="margin-top:8px">보완요청 보내기</button></details>' : '') +

      (s.status !== 'withdrawn' ?
        '<details><summary>개별 기한 연장</summary><label>수정기한 (제출완료 상태에서 적용)</label><input type="datetime-local" id="ext-edit" value="' + D.toLocal(s.edit_deadline_override) + '">' +
        (s.status === 'supplement_requested' ? '<label>보완 기한</label><input type="datetime-local" id="ext-sup" value="' + D.toLocal(s.supplement_deadline) + '">' : '') +
        (s.status === 'resubmit_allowed' ? '<label>수정 기한</label><input type="datetime-local" id="ext-res" value="' + D.toLocal(s.resubmit_deadline) + '">' : '') +
        '<label>사유</label><input id="ext-reason"><button class="b" data-act="extend" style="margin-top:8px">연장</button></details>' : '') +

      (result && resultOpen ?
        '<details><summary>결과 정정</summary><select id="cor-result"><option value="selected">선정</option><option value="not_selected">미선정</option></select>' +
        '<label>정정 사유</label><input id="cor-reason"><button class="b" data-act="correct" style="margin-top:8px">정정 (연구자에게 메일)</button></details>' : '') +
      '</div>' +

      // 메모
      '<div class="card"><h2>내부 메모 <span class="muted">(연구자 비공개)</span></h2><textarea id="memo"></textarea>' +
      '<button class="b g" data-act="memo" style="margin-top:6px">메모 추가</button>' +
      memos.map(function (m) { return '<p style="white-space:pre-wrap;margin:12px 0 0">' + esc(m.body) + '<br><span class="muted">' + D.fmt(m.created_at) + '</span></p>'; }).join('') +
      '</div></div></div>';

    main.onclick = async function (e) {
      var fb = e.target.closest('[data-file]'); if (fb) return download(Number(fb.dataset.file));
      var vb = e.target.closest('[data-ver]'); if (vb) { shownVer = Number(vb.dataset.ver); return render(s, files, events, memos, req, result); }
      var b = e.target.closest('[data-act]'); if (!b) return;
      b.disabled = true;
      try {
        switch (b.dataset.act) {
          case 'review': await D.rpc('admin_start_review', { p_ids: [id] }); break;
          case 'supplement': await D.rpc('admin_request_supplement', { p_id: id, p_reason: $('#sup-reason').value, p_deadline: D.fromLocal($('#sup-dl').value) }); break;
          case 'extend': await D.rpc('admin_extend_deadline', {
            p_id: id, p_reason: $('#ext-reason').value, p_edit: D.fromLocal($('#ext-edit').value),
            p_supplement: $('#ext-sup') ? D.fromLocal($('#ext-sup').value) : null,
            p_resubmit: $('#ext-res') ? D.fromLocal($('#ext-res').value) : null }); break;
          case 'correct': await D.rpc('admin_correct_result', { p_id: id, p_result: $('#cor-result').value, p_reason: $('#cor-reason').value }); break;
          case 'approve': await D.rpc('admin_decide_edit_request', { p_request_id: req.id, p_approve: true, p_deadline: D.fromLocal($('#dec-dl').value) }); break;
          case 'reject': await D.rpc('admin_decide_edit_request', { p_request_id: req.id, p_approve: false, p_reject_reason: $('#dec-reason').value }); break;
          case 'memo':
            var body = $('#memo').value.trim(); if (!body) throw new Error('메모를 입력해 주세요.');
            await D.q(sb.from('submission_memos').insert({ submission_id: id, body: body })); break;
        }
        D.toast('ok', '처리했습니다.');
        await load();
      } catch (err) { D.toast('err', D.errText(err)); b.disabled = false; }
    };
  }

  // 선택한 버전의 입력값·첨부를 표로 (항목 이름은 제출 당시 기준)
  function versionBody(s, files) {
    var v = versions.filter(function (x) { return x.version_no === shownVer; })[0];
    if (!v) return '<p class="muted">버전 기록이 없습니다.</p>';
    var snap = v.snapshot, labels = snap.labels && snap.labels.length ? snap.labels : [];
    var fileRow = function (key) { return files.filter(function (f) { return f.version_no === v.version_no && f.file_kind === key; })[0]; };
    return '<p class="muted" style="margin:8px 0 12px">' + esc(KIND[v.kind] || v.kind) + ' · ' + D.fmt(v.created_at) + (snap.form_version ? ' · 지원서 설정 v' + snap.form_version : '') + '</p>' +
      '<dl class="kv">' + labels.map(function (l) {
        var cell;
        if (l.type === 'file') {
          var f = fileRow(l.key);
          cell = !f ? '-' : f.purged_at ? '<span class="muted">보관기간 경과로 삭제됨</span>'
            : '<button class="l" data-file="' + f.id + '">' + esc(f.original_name || 'PDF') + '</button> <span class="muted">' + (f.size_bytes ? (f.size_bytes / 1048576).toFixed(1) + 'MB' : '') + '</span>';
        } else cell = esc(D.snapValue(snap, l));
        return '<dt>' + esc(l.label) + '</dt><dd style="white-space:pre-wrap">' + cell + '</dd>';
      }).join('') + '</dl><p class="muted">첨부 다운로드는 감사 로그에 기록되고, 링크는 2분 동안만 유효합니다.</p>';
  }

  // 첨부 다운로드: Edge Function(admin-file-url)이 권한 확인 + 감사 로그 후 2분짜리 링크 발급
  async function download(fileId) {
    var w = window.open('', '_blank');
    try {
      var token = (await sb.auth.getSession()).data.session.access_token;
      var res = await fetch(D.config.SUPABASE_URL + '/functions/v1/admin-file-url', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, apikey: D.config.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId })
      });
      var j = await res.json();
      if (!res.ok) throw new Error(j.error || '다운로드 권한이 없습니다.');
      w.location.href = j.url;
    } catch (e) { if (w) w.close(); D.toast('err', D.errText(e)); }
  }

  D.log('view_submission', 'submission', id);
  await load();
});
