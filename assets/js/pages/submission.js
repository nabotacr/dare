/* submission.html?id=... — 제출 상세 (v4)
 *  - 제출 내용: 버전(v1, v2...)별 입력값을 항목 유형에 맞게 정리해서 표시
 *  - 첨부파일: 체크해서 선택 다운로드 (여러 개면 ZIP 하나로), 다운로드는 감사 로그에 기록
 *  - 결과: 미입력 / 선정 / 미선정 변경 (공개 후에는 사유를 받아 정정)
 *  - 처리: 검토 시작, 보완요청, 수정요청 처리, 기한 연장 / 내부 메모 / 처리 이력
 */
DA.page('submissions', async function (main) {
  var D = DA, esc = D.esc, $ = D.$, sb = D.sb;
  var id = D.param('id');
  if (!D.isUuid(id)) { main.innerHTML = '<div class="msg err">잘못된 주소입니다.</div><a href="submissions.html">목록으로</a>'; return; }

  var S = {}, shownVer = null, FORM = null;
  var KIND = { initial: '최초 제출', edit: '수정 제출', supplement: '보완 제출', resubmit: '수정요청 승인 후 제출' };
  var EVENT = { submitted: '제출', edited: '수정 제출', review_started: '검토 시작', supplement_requested: '보완요청', edit_requested: '수정요청',
                edit_request_approved: '수정요청 승인', edit_request_rejected: '수정요청 반려', deadline_extended: '기한 연장', withdrawn: '제출취소',
                result_published: '결과 공개', result_corrected: '결과 정정' };
  var LONG = ['textarea', 'checkbox', 'consent'];

  // 이 페이지 전용 스타일
  var st = document.createElement('style');
  st.textContent =
    '.sd-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:16px}' +
    '.sd-head h1{margin:6px 0 8px;font-size:22px}.sd-meta{display:flex;gap:18px;flex-wrap:wrap;color:var(--soft);font-size:13px}' +
    '.sd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px}' +
    '.sd-item{padding:12px 0;border-bottom:1px solid var(--line)}.sd-item.full{grid-column:1/-1}' +
    '.sd-item .k{font-size:12px;color:var(--soft);margin-bottom:4px}.sd-item .v{font-size:15px;white-space:pre-wrap;word-break:break-word}' +
    '.sd-item .v.empty{color:#b8bdcc}.sd-tags span{display:inline-block;background:#eef2fb;color:#2b5fd9;border-radius:999px;padding:2px 10px;margin:0 6px 4px 0;font-size:13px}' +
    '.sd-files{border:1px solid var(--line);border-radius:6px;overflow:hidden}.sd-file{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line)}' +
    '.sd-file:last-child{border-bottom:0}.sd-file:hover{background:#f7f9ff}.sd-file .ico{width:34px;height:40px;border-radius:4px;background:#fbeaea;color:#b3261e;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none}' +
    '.sd-file .nm{flex:1;min-width:0}.sd-file .nm b{display:block;font-size:12px;color:var(--soft);font-weight:500}.sd-file .nm span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.sd-tabs{display:flex;gap:6px;flex-wrap:wrap}.sd-res{display:flex;gap:6px}' +
    '.sd-res label{flex:1;margin:0;border:1px solid var(--line);border-radius:4px;padding:10px;text-align:center;cursor:pointer;color:var(--ink);font-size:14px;font-weight:600}' +
    '.sd-res input{display:none}.sd-res label.on{background:var(--ink);border-color:var(--ink);color:#fff}' +
    '@media(max-width:700px){.sd-grid{grid-template-columns:1fr}}';
  document.head.appendChild(st);

  async function load() {
    var r = await Promise.all([
      D.q(sb.from('submissions').select('*, calls(*)').eq('id', id).single()),
      D.q(sb.from('submission_files').select('*').eq('submission_id', id).order('version_no', { ascending: false })),
      D.q(sb.from('submission_events').select('*').eq('submission_id', id).order('created_at', { ascending: false })),
      D.q(sb.from('submission_memos').select('*').eq('submission_id', id).order('created_at', { ascending: false })),
      D.q(sb.from('edit_requests').select('*').eq('submission_id', id).order('created_at', { ascending: false }).limit(1)),
      D.q(sb.from('submission_results').select('*').eq('submission_id', id).maybeSingle()),
      D.q(sb.from('submission_versions').select('*').eq('submission_id', id).order('version_no', { ascending: false }))
    ]);
    if (!FORM) FORM = await D.rpc('get_current_form');
    S = { s: r[0], files: r[1], events: r[2], memos: r[3], req: r[4][0] || null, result: r[5], versions: r[6] };
    if (shownVer == null || !S.versions.some(function (v) { return v.version_no === shownVer; })) shownVer = S.s.current_version;
    render();
  }

  function resultOpen() { return !!(S.result && S.result.published_at); }
  function fileFields() { return ((FORM && FORM.fields) || []).filter(function (f) { return f.type === 'file'; }); }
  function docBoxes(name) { return '<div>' + fileFields().map(function (f) { return '<label class="inline"><input type="checkbox" name="' + name + '" value="' + esc(f.key) + '">' + esc(f.label) + '</label>'; }).join('') + '</div><p class="muted" style="margin:2px 0 0">아무것도 고르지 않으면 전체 서류</p>'; }
  function picked(name) { return D.$$('input[name="' + name + '"]:checked', main).map(function (c) { return c.value; }); }

  /* ---------------- 화면 ---------------- */
  function render() {
    var s = S.s, req = S.req, result = S.result, open = resultOpen();

    main.innerHTML =
      '<p style="margin:0 0 8px"><a href="submissions.html">← 제출내역 목록</a></p>' +
      '<div class="card sd-head"><div><div class="row">' + D.badge(s.status) +
      (result ? '<span class="badge" style="color:' + D.RESULT_COLOR[result.result][0] + ';background:' + D.RESULT_COLOR[result.result][1] + '">' + D.RESULT_LABEL[result.result] + (result.published_at ? ' · 안내됨' : ' · 미안내') + '</span>' : '') +
      '<span class="muted">' + esc(s.receipt_no) + '</span></div><h1>' + esc(s.research_title) + '</h1>' +
      '<div class="sd-meta"><span>연구자 <b style="color:var(--ink)">' + esc(s.researcher_name) + '</b></span><span>' + esc(s.email) + '</span>' +
      '<span>최초 제출 ' + D.fmt(s.submitted_at) + '</span>' + (s.current_version > 1 ? '<span>최근 수정 ' + D.fmt(s.last_submitted_at) + ' (v' + s.current_version + ')</span>' : '') + '</div></div></div>' +

      (s.status === 'supplement_requested' ? '<div class="msg err">보완요청 중 · 기한 ' + D.fmt(s.supplement_deadline) + '\n' + esc(s.supplement_reason) + '</div>' : '') +
      (s.status === 'resubmit_allowed' ? '<div class="msg info">수정요청 승인됨 · 연구자 수정 기한 ' + D.fmt(s.resubmit_deadline) + '</div>' : '') +
      (s.withdrawn_at ? '<div class="msg info">제출취소 ' + D.fmt(s.withdrawn_at) + ' · ' + esc(s.withdraw_reason || '사유 없음') + '</div>' : '') +

      '<div class="split" style="grid-template-columns:minmax(0,1fr) 340px"><div>' +
      '<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2 style="margin:0">제출 내용</h2><div class="sd-tabs">' +
      S.versions.map(function (v) {
        return '<button class="b sm ' + (v.version_no === shownVer ? '' : 'g') + '" data-ver="' + v.version_no + '">v' + v.version_no + ' ' + esc(KIND[v.kind] || v.kind) + '</button>';
      }).join('') + '</div></div>' + versionBody() + '</div>' +

      '<div class="card"><h2>처리 이력</h2><ul class="time">' + S.events.map(function (ev) {
        return '<li><span class="muted">' + D.fmt(ev.created_at) + ' · ' + ({ researcher: '연구자', admin: '관리자', system: '시스템' })[ev.actor_role] + (ev.visible_to_researcher ? '' : ' · 연구자 비공개') + '</span><br>' +
          esc(EVENT[ev.event_type] || ev.event_type) + (ev.message && ['submitted', 'edited', 'review_started'].indexOf(ev.event_type) < 0 ? ' · ' + esc(ev.message) : '') + '</li>';
      }).join('') + '</ul></div></div>' +

      '<div>' +
      '<div class="card"><h2>검토 결과</h2><div class="sd-res" style="flex-wrap:wrap">' +
      [['', '미입력'], ['approved', '지원 결정'], ['revise', '보완 후 재검토'], ['not_approved', '지원하지 않음']].map(function (o) {
        var on = (result ? result.result : '') === o[0];
        return '<label class="' + (on ? 'on' : '') + '" style="flex:1 1 40%"><input type="radio" name="res" value="' + o[0] + '"' + (on ? ' checked' : '') + '>' + o[1] + '</label>';
      }).join('') + '</div>' +
      (open ? '<p class="muted">' + D.fmt(result.published_at) + ' 연구자에게 안내됨. 바꾸면 정정 메일이 갑니다.</p><label>정정 사유 (필수)</label><input id="res-reason">'
            : '<p class="muted">저장해도 연구자에게는 보이지 않습니다. "결과 안내 발송"을 눌러야 공개되고 메일이 갑니다.</p>') +
      '<button class="b" data-act="result" style="margin-top:10px;width:100%">결과 저장</button>' +
      (result && !open ? '<button class="b g" data-act="publish" style="margin-top:8px;width:100%">결과 안내 발송 (연구자에게 메일)</button>' : '') +
      '</div>' +

      '<div class="card"><h2>처리</h2>' +
      (req && req.status === 'pending' ? '<div class="box" style="margin:0 0 12px"><b>수정요청 대기</b> · ' + D.fmt(req.created_at) +
        '<p style="white-space:pre-wrap;margin:6px 0">' + esc(req.reason) + '</p><p class="muted">승인은 아래 "수정 권한 부여"로 서류와 기한을 정해 처리합니다.</p>' +
        '<label>반려 사유 (연구자에게 메일)</label><input id="dec-reason"><button class="b r sm" data-act="reject" style="margin-top:6px">반려</button></div>' : '') +
      (s.status === 'submitted' ? '<p><button class="b g" data-act="review" style="width:100%">검토 시작</button></p><p class="muted">시작하면 7일 이내라도 연구자의 수정·삭제가 잠깁니다.</p>' : '') +
      (s.status !== 'withdrawn' ?
        '<details' + (req && req.status === 'pending' ? ' open' : '') + '><summary>수정 권한 부여</summary><p class="muted">7일이 지난 뒤 연구자 요청이 있을 때, 지정한 서류만 기한까지 교체할 수 있게 합니다.</p>' +
        '<label>수정 가능 서류</label>' + docBoxes('gr-doc') +
        '<label>수정 기한</label><input type="datetime-local" id="gr-dl">' +
        '<button class="b" data-act="grant" style="margin-top:10px">수정 권한 부여 (연구자에게 메일)</button></details>' +
        '<details><summary>보완 요청</summary>' +
        '<label>보완 요청 사항</label><textarea id="sup-reason" placeholder="필요한 추가 정보·보완 내용"></textarea>' +
        '<label>보완 필요 서류</label>' + docBoxes('sup-doc') +
        '<label>제출 기한</label><input type="datetime-local" id="sup-dl">' +
        '<label>제출 방법</label><label class="inline"><input type="radio" name="sup-m" value="website" checked>홈페이지 재제출</label><label class="inline"><input type="radio" name="sup-m" value="email">담당자 이메일 회신</label>' +
        '<label>검토 의견서 PDF 첨부 (선택, 20MB 이하)</label><input type="file" id="sup-file" accept="application/pdf,.pdf">' +
        '<button class="b" data-act="supplement" style="margin-top:10px">보완 요청 보내기</button></details>' : '') +
      (['supplement_requested', 'resubmit_allowed'].indexOf(s.status) >= 0 ?
        '<details><summary>기한 연장</summary>' + (s.status === 'supplement_requested'
          ? '<label>보완 기한</label><input type="datetime-local" id="ext-sup" value="' + D.toLocal(s.supplement_deadline) + '">'
          : '<label>수정 기한</label><input type="datetime-local" id="ext-res" value="' + D.toLocal(s.resubmit_deadline) + '">') +
        '<label>사유</label><input id="ext-reason"><button class="b" data-act="extend" style="margin-top:8px">연장</button></details>' : '') +
      (s.revision_files && s.revision_files.length ? '<p class="muted">현재 교체 허용 서류: ' + esc(s.revision_files.join(', ')) + '</p>' : '') +
      (s.status === 'withdrawn' ? '<p class="muted">제출취소된 건입니다.</p>' : '') +
      '</div>' +

      '<div class="card"><h2>내부 메모 <span class="muted">(연구자 비공개)</span></h2><textarea id="memo"></textarea>' +
      '<button class="b g sm" data-act="memo" style="margin-top:6px">메모 추가</button>' +
      S.memos.map(function (m) { return '<p style="white-space:pre-wrap;margin:12px 0 0">' + esc(m.body) + '<br><span class="muted">' + D.fmt(m.created_at) + '</span></p>'; }).join('') +
      '</div></div></div>';
  }

  /* 선택한 버전의 입력값 + 첨부 */
  function versionBody() {
    var v = S.versions.filter(function (x) { return x.version_no === shownVer; })[0];
    if (!v) return '<p class="muted">버전 기록이 없습니다.</p>';
    var snap = v.snapshot, labels = (snap.labels || []).filter(function (l) { return l.key !== 'email'; });
    var fields = labels.filter(function (l) { return l.type !== 'file'; });
    var files = labels.filter(function (l) { return l.type === 'file'; }).map(function (l) {
      return { label: l.label, row: S.files.filter(function (f) { return f.version_no === v.version_no && f.file_kind === l.key; })[0] };
    }).filter(function (x) { return x.row; });

    var html = '<p class="muted" style="margin:0 0 6px">' + esc(KIND[v.kind] || v.kind) + ' · ' + D.fmt(v.created_at) + (snap.form_version ? ' · 지원서 설정 v' + snap.form_version : '') + '</p>' +
      '<div class="sd-grid">' + fields.map(function (l) {
        var raw = D.BASE_COLS.indexOf(l.key) >= 0 ? snap[l.key] : (snap.answers || {})[l.key];
        var val = D.snapValue(snap, l), cell;
        if (val === '-') cell = '<div class="v empty">미입력</div>';
        else if (l.type === 'checkbox' && Array.isArray(raw)) cell = '<div class="v sd-tags">' + raw.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>';
        else if (l.type === 'url' && /^https?:\/\//i.test(raw)) cell = '<div class="v"><a href="' + esc(raw) + '" target="_blank" rel="noopener noreferrer">' + esc(raw) + '</a></div>';
        else cell = '<div class="v">' + esc(val) + '</div>';
        return '<div class="sd-item' + (LONG.indexOf(l.type) >= 0 || String(val).length > 60 ? ' full' : '') + '"><div class="k">' + esc(l.label) + '</div>' + cell + '</div>';
      }).join('') + '</div>';

    html += '<div class="row" style="justify-content:space-between;margin:22px 0 10px"><h3 style="margin:0">첨부파일 ' + files.length + '개</h3>' +
      (files.length ? '<div class="row"><label class="inline" style="margin:0"><input type="checkbox" id="f-all">전체 선택</label>' +
        '<button class="b sm" data-act="download">선택 다운로드</button></div>' : '') + '</div>';
    html += files.length ? '<div class="sd-files">' + files.map(function (x) {
      var f = x.row;
      return '<label class="sd-file" style="margin:0;font-weight:400;color:var(--ink);cursor:pointer"><input type="checkbox" class="f-chk" value="' + f.id + '"' + (f.purged_at ? ' disabled' : '') + '>' +
        '<span class="ico">PDF</span><span class="nm"><b>' + esc(x.label) + '</b><span>' + esc(f.original_name || 'file.pdf') + '</span></span>' +
        '<span class="muted">' + (f.purged_at ? '보관기간 경과로 삭제됨' : (f.size_bytes ? (f.size_bytes / 1048576).toFixed(1) + 'MB' : '')) + '</span></label>';
    }).join('') + '</div><p class="muted">여러 개를 고르면 ZIP 하나로 받습니다. 다운로드 기록은 감사 로그에 남습니다.</p>' : '<p class="muted">첨부파일이 없습니다.</p>';
    return html;
  }

  /* ---------------- 첨부 다운로드 (함수 없이 바로) ---------------- */
  function safeName(n) { return String(n || 'file').replace(/[\\/:*?"<>|]+/g, '_').trim(); }
  function save(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  async function fetchFile(fileId) {
    var path = await D.rpc('admin_file_path', { p_file_id: fileId });          // 관리자 확인 + 감사 로그
    var r = await sb.storage.from('submission-files').download(path);
    if (r.error) throw new Error('파일을 받지 못했습니다. (' + (r.error.message || 'storage') + ')');
    return r.data;
  }
  function fileLabel(f) {
    var labels = ((S.versions.filter(function (v) { return v.version_no === f.version_no; })[0] || {}).snapshot || {}).labels || [];
    var m = labels.filter(function (x) { return x.key === f.file_kind; })[0];
    return (m ? m.label : f.file_kind).replace(/[(]PDF[)]/i, '').trim();
  }
  async function download(btn) {
    var ids = D.$$('.f-chk:checked').map(function (c) { return Number(c.value); });
    if (!ids.length) return D.toast('info', '받을 파일을 선택해 주세요.');
    var rows = ids.map(function (i) { return S.files.filter(function (f) { return f.id === i; })[0]; });
    var old = btn.textContent; btn.disabled = true;
    try {
      if (rows.length === 1) {
        btn.textContent = '받는 중...';
        save(await fetchFile(rows[0].id), safeName(rows[0].original_name || 'file.pdf'));
      } else {
        var zip = new window.JSZip(), used = {};
        for (var i = 0; i < rows.length; i++) {
          btn.textContent = '받는 중 ' + (i + 1) + '/' + rows.length;
          var name = safeName(fileLabel(rows[i]) + ' - ' + (rows[i].original_name || 'file.pdf'));
          used[name] = (used[name] || 0) + 1;
          if (used[name] > 1) name = name.replace(/([.]pdf)?$/i, ' (' + used[name] + ')$1');
          zip.file(name, await fetchFile(rows[i].id));
        }
        btn.textContent = '압축 중...';
        save(await zip.generateAsync({ type: 'blob' }), safeName(S.s.receipt_no + '_v' + shownVer + '_첨부파일.zip'));
      }
      D.toast('ok', rows.length + '개 파일을 받았습니다.');
    } catch (e) { D.toast('err', D.errText(e)); }
    btn.disabled = false; btn.textContent = old;
  }

  /* ---------------- 이벤트 ---------------- */
  main.addEventListener('change', function (e) {
    if (e.target.id === 'f-all') D.$$('.f-chk:not(:disabled)').forEach(function (c) { c.checked = e.target.checked; });
    if (e.target.name === 'res') D.$$('.sd-res label').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); });
  });
  main.addEventListener('click', async function (e) {
    var vb = e.target.closest('[data-ver]'); if (vb) { shownVer = Number(vb.dataset.ver); return render(); }
    var b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'download') return download(b);
    var s = S.s, req = S.req;
    b.disabled = true;
    try {
      switch (b.dataset.act) {
        case 'result':
          var v = (main.querySelector('input[name=res]:checked') || {}).value || '', cur = S.result ? S.result.result : '';
          if (v === cur) throw new Error('바뀐 내용이 없습니다.');
          if (resultOpen()) {
            if (!v) throw new Error('안내한 결과는 미입력으로 되돌릴 수 없습니다.');
            await D.rpc('admin_correct_result', { p_id: id, p_result: v, p_reason: $('#res-reason').value });
          } else if (!v) await D.rpc('admin_clear_result', { p_id: id });
          else await D.rpc('admin_set_results', { p_ids: [id], p_result: v });
          break;
        case 'publish':
          if (!confirm('검토 결과 "' + D.RESULT_LABEL[S.result.result] + '" 를 연구자에게 안내할까요? 메일이 발송되고 연구자 화면에 공개됩니다.')) { b.disabled = false; return; }
          await D.rpc('admin_publish_results', { p_ids: [id] }); break;
        case 'review': await D.rpc('admin_start_review', { p_ids: [id] }); break;
        case 'grant':
          await D.rpc('admin_grant_revision', { p_id: id, p_deadline: D.fromLocal($('#gr-dl').value), p_files: picked('gr-doc'), p_note: null }); break;
        case 'reject': await D.rpc('admin_decide_edit_request', { p_request_id: req.id, p_approve: false, p_reject_reason: $('#dec-reason').value }); break;
        case 'supplement':
          var att = null, file = $('#sup-file').files[0];
          if (file) {
            if (!/[.]pdf$/i.test(file.name) || file.size > 20 * 1048576) throw new Error('첨부는 20MB 이하 PDF만 가능합니다.');
            var path = 'supplement/' + id + '/' + Date.now() + '.pdf';
            var up = await sb.storage.from('admin-attachments').upload(path, file, { contentType: 'application/pdf', upsert: false });
            if (up.error) throw new Error('첨부 업로드 실패: ' + up.error.message);
            att = { path: path, name: file.name };
          }
          await D.rpc('admin_request_supplement', { p_id: id, p_details: $('#sup-reason').value, p_deadline: D.fromLocal($('#sup-dl').value),
            p_files: picked('sup-doc'), p_method: (main.querySelector('input[name=sup-m]:checked') || {}).value, p_attachment: att });
          break;
        case 'extend': await D.rpc('admin_extend_deadline', { p_id: id, p_reason: $('#ext-reason').value,
          p_supplement: $('#ext-sup') ? D.fromLocal($('#ext-sup').value) : null, p_resubmit: $('#ext-res') ? D.fromLocal($('#ext-res').value) : null }); break;
        case 'memo':
          var body = $('#memo').value.trim(); if (!body) throw new Error('메모를 입력해 주세요.');
          await D.q(sb.from('submission_memos').insert({ submission_id: id, body: body })); break;
      }
      D.toast('ok', '저장했습니다.');
      await load();
    } catch (err) { D.toast('err', D.errText(err)); b.disabled = false; }
  });

  D.log('view_submission', 'submission', id);
  await load();
});
