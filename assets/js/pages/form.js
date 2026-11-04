/* form.html — 지원서 설정
 *  - 기본 항목 9개 + 추가 항목 (유형 선택해서 추가)
 *  - 모든 항목: 이름(국문/영문), 설명, 필수 여부, 순서(끌어서 이동 또는 화살표) 변경
 *  - 저장할 때마다 새 버전으로 쌓임 → 변경 이력에서 비교·불러오기
 *  - 접수 열기/닫기
 */
DA.page('form', async function (main) {
  var D = DA, esc = D.esc, $ = D.$;

  var ADD_TYPES = [
    ['text', '단답형', '한 줄 글'], ['textarea', '장문형', '여러 줄 글'], ['yesno', '예/아니오', '둘 중 선택'],
    ['radio', '단일선택', '보기 중 하나'], ['select', '드롭다운', '목록에서 하나'], ['checkbox', '다중선택', '보기 중 여러 개'],
    ['email', '이메일', '이메일 형식'], ['number', '숫자', '숫자만'], ['date', '날짜', '날짜 선택'], ['url', '링크(URL)', 'http 주소'],
    ['file', '파일(PDF)', 'PDF 첨부'], ['consent', '동의', '약관 + 동의 체크']
  ];
  var LOCK_REQUIRED = ['research_title', 'researcher_name', 'email', 'consent'];
  var CHOICE = ['radio', 'select', 'checkbox', 'country'];

  var versions = [], fields = [], dirty = false, call = null, openIdx = {};

  async function load() {
    var r = await Promise.all([
      D.q(D.sb.from('form_versions').select('*').order('version_no', { ascending: false })),
      D.q(D.sb.from('calls').select('*').order('apply_start_at', { ascending: false }).limit(1))
    ]);
    versions = r[0]; call = r[1][0] || null;
    fields = JSON.parse(JSON.stringify(versions[0] ? versions[0].fields : []));
    dirty = false; openIdx = {};
    render();
  }

  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------------- 화면 ---------------- */
  function render() {
    var v0 = versions[0];
    main.innerHTML =
      '<div class="row" style="justify-content:space-between;align-items:flex-end"><div><p class="muted" style="margin:0">공고 게시</p><h1 style="margin:2px 0 6px">지원서 설정</h1>' +
      '<p class="muted" style="margin:0 0 16px">연구자가 제출할 항목을 설정합니다. 저장하면 새 버전으로 기록되고, 이미 제출된 내역은 제출 당시 항목 그대로 보관됩니다.</p></div>' +
      '<div class="muted">현재 v' + (v0 ? v0.version_no : '-') + ' · ' + (v0 ? D.fmt(v0.created_at) : '') + '</div></div>' +

      '<div class="split" style="grid-template-columns:minmax(0,1fr) 300px">' +
      '<div><div class="card" id="field-list"></div>' +
      '<div class="card" id="savebar" style="position:sticky;bottom:12px;box-shadow:0 4px 18px rgba(0,0,0,.08)">' +
      '<div class="row"><input id="note" class="grow" placeholder="변경 메모 (예: 연락처 항목 추가, 동의 문구 수정)">' +
      '<button class="b" id="save">저장 (새 버전)</button><button class="b g" id="revert">되돌리기</button></div>' +
      '<p class="muted" id="dirty" style="margin:6px 0 0"></p></div>' +
      '<div class="card"><h2>변경 이력</h2><div id="history"></div></div></div>' +

      '<div><div class="card"><h2>접수 상태</h2><div id="callbox"></div></div>' +
      '<div class="card"><h2>항목 추가</h2><p class="muted" style="margin-top:0">누르면 맨 아래에 추가됩니다.</p>' +
      ADD_TYPES.map(function (t) {
        return '<button class="b g" data-add="' + t[0] + '" style="display:flex;justify-content:space-between;width:100%;margin-bottom:6px;font-weight:500">' +
               '<span>' + t[1] + '</span><span class="muted">' + t[2] + '</span></button>';
      }).join('') + '</div></div></div>';

    renderFields(); renderCall(); renderHistory(); markDirty(dirty);

    main.querySelectorAll('[data-add]').forEach(function (b) { b.onclick = function () { addField(b.dataset.add); }; });
    $('#save').onclick = save;
    $('#revert').onclick = function () { if (!dirty || confirm('저장하지 않은 변경을 모두 버릴까요?')) load(); };
  }

  function markDirty(on) {
    dirty = on;
    $('#dirty').textContent = on ? '저장하지 않은 변경이 있습니다.' : '변경 사항 없음';
    $('#dirty').style.color = on ? '#b3261e' : '';
    $('#save').disabled = !on;
  }

  /* ---------------- 항목 카드 ---------------- */
  function renderFields() {
    var box = $('#field-list');
    box.innerHTML = fields.map(function (f, i) { return card(f, i); }).join('');
    bindCards(box);
  }

  function preview(f) {
    var p = { text: '<input disabled placeholder="답변 입력">', textarea: '<textarea disabled style="min-height:50px" placeholder="여러 줄 답변"></textarea>',
              email: '<input disabled placeholder="name@example.com">', number: '<input disabled placeholder="0">', date: '<input disabled placeholder="YYYY-MM-DD">',
              url: '<input disabled placeholder="https://">', yesno: '<span class="muted">( ) 예 &nbsp; ( ) 아니오</span>',
              file: '<span class="b g sm" style="cursor:default">파일 올리기</span> <span class="muted">PDF, 최대 ' + (f.max_mb || 20) + 'MB</span>',
              consent: '<span class="muted">[동의 전문] + [ ] ' + esc(f.agree_label || '동의합니다.') + '</span>' };
    if (CHOICE.indexOf(f.type) >= 0) return '<span class="muted">' + esc((f.options || []).slice(0, 4).join(' / ')) + ((f.options || []).length > 4 ? ' 외 ' + ((f.options || []).length - 4) + '개' : '') +
      (f.type === 'country' && f.allow_other !== false ? ' / 기타(직접 입력)' : '') + '</span>';
    return p[f.type] || '';
  }

  function card(f, i) {
    var locked = LOCK_REQUIRED.indexOf(f.key) >= 0, open = !!openIdx[f.key];
    var h = '<div class="fcard" data-i="' + i + '" draggable="true" style="border:1px solid var(--line);border-radius:6px;padding:12px 14px;margin-bottom:10px;background:#fff">' +
      '<div class="row" style="justify-content:space-between;flex-wrap:nowrap">' +
      '<div class="row" style="flex-wrap:nowrap;min-width:0"><span class="muted" title="끌어서 순서 변경" style="cursor:grab;font-size:16px">⠿</span>' +
      '<b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(f.label) + '</b>' + (f.required ? '<span style="color:#1f7a4d">*</span>' : '') +
      '<span class="badge" style="background:#eef0f5;color:#5a6383">' + esc(D.TYPE_LABEL[f.type] || f.type) + '</span>' +
      (f.base ? '<span class="badge" style="background:#eaf0fc;color:#2b5fd9">기본</span>' : '<span class="badge" style="background:#f1ecfb;color:#6a3fb5">추가</span>') + '</div>' +
      '<div class="row" style="flex-wrap:nowrap">' +
      '<label class="inline" title="' + (locked ? '접수·메일에 꼭 필요해 필수로 고정된 항목입니다' : '') + '"><input type="checkbox" data-f="required"' + (f.required ? ' checked' : '') + (locked ? ' disabled' : '') + '>필수</label>' +
      '<button class="b g sm" data-mv="-1" title="위로"' + (i === 0 ? ' disabled' : '') + '>▲</button><button class="b g sm" data-mv="1" title="아래로"' + (i === fields.length - 1 ? ' disabled' : '') + '>▼</button>' +
      '<button class="b g sm" data-toggle>' + (open ? '접기' : '편집') + '</button>' +
      (f.base ? '' : '<button class="b r sm" data-del>삭제</button>') + '</div></div>';

    if (!open) return h + '<div style="margin:8px 0 0 24px">' + preview(f) + (f.description ? '<div class="muted" style="margin-top:4px">' + esc(f.description) + '</div>' : '') + '</div></div>';

    h += '<div style="margin:10px 0 0 24px"><div class="grid" style="grid-template-columns:1fr 1fr">' +
      '<div><label>항목 이름</label><input data-f="label" value="' + esc(f.label) + '" maxlength="200"></div>' +
      '<div><label>영문 이름 (선택)</label><input data-f="label_en" value="' + esc(f.label_en || '') + '" maxlength="200"></div></div>' +
      '<label>설명 (입력칸 위에 안내문으로 표시)</label><textarea data-f="description" style="min-height:60px" maxlength="2000">' + esc(f.description || '') + '</textarea>';

    if (CHOICE.indexOf(f.type) >= 0) {
      h += '<label>선택지 (한 줄에 하나)</label><textarea data-f="options" style="min-height:' + (f.type === 'country' ? 160 : 90) + 'px">' + esc((f.options || []).join('\n')) + '</textarea>';
      if (f.type === 'country') h += '<label class="inline"><input type="checkbox" data-f="allow_other"' + (f.allow_other !== false ? ' checked' : '') + '>목록 끝에 "기타 (직접 입력)" 표시</label>';
    }
    if (f.type === 'text' || f.type === 'textarea') h += '<label>최대 글자 수</label><input type="number" data-f="max_length" min="1" max="' + (f.type === 'text' ? 300 : 20000) + '" value="' + (f.max_length || (f.type === 'text' ? 300 : 5000)) + '" style="width:160px">';
    if (f.type === 'file') h += '<label>최대 용량 (MB, 1~50)</label><input type="number" data-f="max_mb" min="1" max="50" value="' + (f.max_mb || 20) + '" style="width:160px">';
    if (f.type === 'consent') h += '<label>동의 전문</label><textarea data-f="content" style="min-height:220px">' + esc(f.content || '') + '</textarea>' +
                                   '<label>체크박스 문구</label><input data-f="agree_label" value="' + esc(f.agree_label || '') + '">';
    h += '<p class="muted" style="margin:10px 0 0">항목 키: <code>' + esc(f.key) + '</code>' + (f.base ? ' · 기본 항목은 삭제하거나 유형을 바꿀 수 없습니다.' : '') + '</p></div></div>';
    return h;
  }

  function bindCards(box) {
    box.querySelectorAll('.fcard').forEach(function (el) {
      var i = Number(el.dataset.i), f = fields[i];
      el.querySelectorAll('[data-f]').forEach(function (inp) {
        var ev = inp.type === 'checkbox' ? 'change' : 'input';
        inp.addEventListener(ev, function () {
          var k = inp.dataset.f, v;
          if (inp.type === 'checkbox') v = inp.checked;
          else if (inp.type === 'number') v = Number(inp.value) || null;
          else if (k === 'options') v = inp.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
          else v = inp.value;
          f[k] = v; markDirty(true);
          if (k === 'label') el.querySelector('b').textContent = v || '(이름 없음)';
          if (k === 'required') renderFields();
        });
      });
      el.querySelector('[data-toggle]').onclick = function () { openIdx[f.key] = !openIdx[f.key]; renderFields(); };
      el.querySelectorAll('[data-mv]').forEach(function (b) { b.onclick = function () { move(i, i + Number(b.dataset.mv)); }; });
      var del = el.querySelector('[data-del]');
      if (del) del.onclick = function () { if (confirm('"' + f.label + '" 항목을 삭제할까요? (저장해야 반영됩니다)')) { fields.splice(i, 1); markDirty(true); renderFields(); } };

      // 끌어서 순서 바꾸기
      el.addEventListener('dragstart', function (e) { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return e.preventDefault(); e.dataTransfer.setData('text/plain', String(i)); el.style.opacity = '.4'; });
      el.addEventListener('dragend', function () { el.style.opacity = ''; });
      el.addEventListener('dragover', function (e) { e.preventDefault(); el.style.borderColor = '#2b5fd9'; });
      el.addEventListener('dragleave', function () { el.style.borderColor = ''; });
      el.addEventListener('drop', function (e) { e.preventDefault(); el.style.borderColor = ''; var from = Number(e.dataTransfer.getData('text/plain')); if (!isNaN(from)) move(from, i); });
    });
  }

  function move(from, to) {
    if (to < 0 || to >= fields.length || from === to) return;
    var item = fields.splice(from, 1)[0]; fields.splice(to, 0, item);
    markDirty(true); renderFields();
  }

  function addField(type) {
    var name = (ADD_TYPES.filter(function (t) { return t[0] === type; })[0] || [type, type])[1];
    var key;
    do { key = 'q_' + Math.random().toString(36).slice(2, 8); } while (fields.some(function (f) { return f.key === key; }));
    var f = { key: key, type: type, label: '새 ' + name + ' 항목', label_en: '', description: '', required: false, base: false };
    if (CHOICE.indexOf(type) >= 0) f.options = ['보기 1', '보기 2'];
    if (type === 'file') f.max_mb = 20;
    if (type === 'consent') { f.content = '동의 내용을 입력해 주세요.'; f.agree_label = '위 내용에 동의합니다.'; }
    fields.push(f); openIdx[key] = true; markDirty(true); renderFields();
    var last = main.querySelector('.fcard:last-child'); if (last) { last.scrollIntoView({ behavior: 'smooth', block: 'center' }); last.querySelector('[data-f=label]').select(); }
  }

  /* ---------------- 저장 ---------------- */
  async function save() {
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (!String(f.label || '').trim()) return D.toast('err', (i + 1) + '번째 항목의 이름을 입력해 주세요.');
      if (CHOICE.indexOf(f.type) >= 0 && !(f.options || []).length) return D.toast('err', '"' + f.label + '" 항목에 선택지를 1개 이상 입력해 주세요.');
    }
    var note = $('#note').value.trim();
    if (!note && !confirm('변경 메모 없이 저장할까요? 메모를 남기면 이력에서 찾기 쉽습니다.')) return;
    $('#save').disabled = true;
    try {
      var clean = fields.map(function (f) { var c = {}; Object.keys(f).forEach(function (k) { if (f[k] !== '' && f[k] != null) c[k] = f[k]; }); c.required = !!f.required; return c; });
      var ver = await D.rpc('admin_save_form', { p_fields: clean, p_note: note || null });
      dirty = false; D.toast('ok', 'v' + ver + ' 로 저장했습니다. 지금부터 제출 폼에 반영됩니다.');
      await load();
    } catch (e) { D.toast('err', D.errText(e)); $('#save').disabled = false; }
  }

  /* ---------------- 접수 상태 ---------------- */
  function renderCall() {
    var box = $('#callbox');
    if (!call) { box.innerHTML = '<p class="muted">접수 정보가 없습니다. 02_v3_upgrade.sql 을 실행했는지 확인해 주세요.</p>'; return; }
    var open = call.is_published && Date.parse(call.apply_start_at) <= Date.now() && (!call.apply_end_at || Date.parse(call.apply_end_at) >= Date.now());
    box.innerHTML = '<p style="margin:0 0 10px;font-size:15px"><b style="color:' + (open ? '#1f7a4d' : '#b3261e') + '">' + (open ? '● 접수 중' : '● 접수 중지') + '</b></p>' +
      '<p class="muted" style="margin:0 0 12px">접수번호: ' + esc(call.code) + '-0001 형식 · 상시 접수</p>' +
      '<button class="b ' + (call.is_published ? 'r' : '') + '" id="toggle">' + (call.is_published ? '접수 중지하기' : '접수 시작하기') + '</button>' +
      '<p class="muted">중지하면 아임웹 제출 페이지에 "현재 접수 중이 아닙니다"가 표시됩니다. 제출내역 조회·수정은 계속 가능합니다.</p>';
    $('#toggle').onclick = async function () {
      if (!confirm(call.is_published ? '접수를 중지할까요?' : '접수를 시작할까요?')) return;
      try {
        await D.q(D.sb.from('calls').update({ is_published: !call.is_published, apply_end_at: null }).eq('id', call.id));
        call.is_published = !call.is_published; call.apply_end_at = null; renderCall(); D.toast('ok', '변경했습니다.');
      } catch (e) { D.toast('err', D.errText(e)); }
    };
  }

  /* ---------------- 변경 이력 ---------------- */
  function diff(prev, next) {
    var out = [], pm = {}, nm = {};
    (prev || []).forEach(function (f, i) { pm[f.key] = { f: f, i: i }; });
    next.forEach(function (f, i) { nm[f.key] = { f: f, i: i }; });
    next.forEach(function (f) { if (!pm[f.key]) out.push('➕ 추가: ' + f.label + ' (' + (D.TYPE_LABEL[f.type] || f.type) + ')'); });
    (prev || []).forEach(function (f) { if (!nm[f.key]) out.push('➖ 삭제: ' + f.label); });
    var names = { label: '이름', label_en: '영문 이름', description: '설명', required: '필수 여부', options: '선택지', allow_other: '기타 입력', max_length: '최대 글자', max_mb: '최대 용량', content: '동의 전문', agree_label: '동의 문구' };
    next.forEach(function (f) {
      var p = pm[f.key]; if (!p) return;
      var ch = Object.keys(names).filter(function (k) { return JSON.stringify(p.f[k] == null ? '' : p.f[k]) !== JSON.stringify(f[k] == null ? '' : f[k]); });
      if (ch.indexOf('required') >= 0) { ch.splice(ch.indexOf('required'), 1); out.push('✎ ' + f.label + ': ' + (f.required ? '필수로 변경' : '선택으로 변경')); }
      if (ch.length) out.push('✎ ' + f.label + ': ' + ch.map(function (k) { return names[k]; }).join(', ') + ' 수정');
    });
    var moved = next.filter(function (f) { return pm[f.key]; }).map(function (f) { return f.key; }).join() !== (prev || []).filter(function (f) { return nm[f.key]; }).map(function (f) { return f.key; }).join();
    if (moved) out.push('↕ 항목 순서 변경');
    return out.length ? out : ['변경 없음'];
  }

  function renderHistory() {
    $('#history').innerHTML = '<table class="tbl"><thead><tr><th>버전</th><th>저장 일시</th><th>저장한 사람</th><th>메모</th><th>항목</th><th></th></tr></thead><tbody>' +
      versions.map(function (v, i) {
        return '<tr><td><b>v' + v.version_no + '</b>' + (i === 0 ? ' <span class="badge" style="background:#e8f4ee;color:#1f7a4d">현재</span>' : '') + '</td><td>' + D.fmt(v.created_at) +
          '</td><td>' + esc(v.created_by_email || '-') + '</td><td>' + esc(v.note || '') + '</td><td>' + v.fields.length + '개</td>' +
          '<td style="white-space:nowrap"><button class="b g sm" data-diff="' + i + '">변경 내용</button>' + (i > 0 ? ' <button class="b g sm" data-restore="' + i + '">불러오기</button>' : '') + '</td></tr>' +
          '<tr data-diffrow="' + i + '" hidden><td colspan="6" class="pre" style="background:var(--field)"></td></tr>';
      }).join('') + '</tbody></table>';
    $('#history').onclick = function (e) {
      var d = e.target.closest('[data-diff]'), r = e.target.closest('[data-restore]');
      if (d) {
        var i = Number(d.dataset.diff), row = $('[data-diffrow="' + i + '"]');
        row.hidden = !row.hidden;
        row.querySelector('td').textContent = versions[i + 1] ? diff(versions[i + 1].fields, versions[i].fields).join('\n') : '최초 버전 (기본 항목 ' + versions[i].fields.length + '개)';
      }
      if (r) {
        var j = Number(r.dataset.restore);
        if (dirty && !confirm('저장하지 않은 변경이 사라집니다. 불러올까요?')) return;
        fields = JSON.parse(JSON.stringify(versions[j].fields)); openIdx = {};
        renderFields(); markDirty(true);
        $('#note').value = 'v' + versions[j].version_no + ' 내용으로 되돌림';
        D.toast('info', 'v' + versions[j].version_no + ' 을 불러왔습니다. 저장하면 새 버전으로 반영됩니다.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
  }

  await load();
});
