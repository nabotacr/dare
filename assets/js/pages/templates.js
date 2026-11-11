/* templates.html — 메일 양식: 연구자 메일은 국문/영문 탭으로 각각 편집 (국적 대한민국 = 국문, 그 외 = 영문 발송) */
DA.page('templates', async function (main) {
  var D = DA, esc = D.esc, $ = D.$;
  var rows = await D.q(D.sb.from('mail_templates').select('*').order('audience', { ascending: false }).order('key'));

  main.innerHTML = '<h1>메일 양식</h1>' +
    '<div class="card"><p style="margin-top:0"><b>발송 언어</b> · 연구자 국적이 대한민국이면 <b>국문</b>, 그 외 국가는 <b>영문</b> 양식으로 발송됩니다. 영문 양식이 비어 있으면 국문으로 보냅니다.</p>' +
    '<p class="muted" style="line-height:2;margin:0">기본: <code>{{name}}</code> <code>{{research_title}}</code> <code>{{receipt_no}}</code> <code>{{email}}</code> · ' +
    '날짜: <code>{{submitted_at}}</code> <code>{{last_submitted_at}}</code> <code>{{deadline}}</code> <code>{{edit_deadline}}</code> <code>{{withdrawn_at}}</code> (메일 언어 형식으로 표시) · ' +
    '보완·수정: <code>{{details}}</code> <code>{{documents_ko}}</code> <code>{{documents_en}}</code> <code>{{method_ko}}</code> <code>{{method_en}}</code> <code>{{attachment_note_ko}}</code> <code>{{attachment_note_en}}</code> · ' +
    '결과: <code>{{result_ko}}</code> <code>{{result_en}}</code> <code>{{reason}}</code> · 블록: <code>{{button}}</code> <code>{{info_box}}</code></p></div>' +
    rows.map(function (t) {
      var bi = t.audience === 'researcher' && t.key !== 'otp_code';
      return '<div class="card" data-key="' + esc(t.key) + '"><div class="row" style="justify-content:space-between"><h2 style="margin:0">' + esc(t.description) +
        ' <span class="muted">' + esc(t.key) + ' · ' + (t.audience === 'admin' ? '관리자에게 (국문)' : '연구자에게') + '</span></h2>' +
        (bi ? '<div class="seg" style="margin:0"><button data-lang="ko" class="on">국문</button><button data-lang="en">영문 English</button></div>' : '') + '</div>' +
        '<div data-pane="ko"><label>제목</label><input data-f="subject" value="' + esc(t.subject) + '"><label>본문 (HTML)</label><textarea class="code" data-f="body_html">' + esc(t.body_html) + '</textarea></div>' +
        (bi ? '<div data-pane="en" hidden><label>Subject</label><input data-f="subject_en" value="' + esc(t.subject_en || '') + '"><label>Body (HTML)</label><textarea class="code" data-f="body_en">' + esc(t.body_en || '') + '</textarea></div>' : '') +
        '<div class="row" style="margin-top:8px"><button class="b" data-save>저장</button><span class="muted">최근 수정 ' + D.fmt(t.updated_at) + '</span></div></div>';
    }).join('');

  main.addEventListener('click', async function (e) {
    var lb = e.target.closest('[data-lang]');
    if (lb) {
      var c = lb.closest('[data-key]');
      D.$$('[data-lang]', c).forEach(function (x) { x.classList.toggle('on', x === lb); });
      D.$$('[data-pane]', c).forEach(function (p) { p.hidden = p.dataset.pane !== lb.dataset.lang; });
      return;
    }
    var b = e.target.closest('[data-save]'); if (!b) return;
    var card = b.closest('[data-key]'), v = {};
    D.$$('[data-f]', card).forEach(function (el) { v[el.dataset.f] = el.value; });
    if (!String(v.subject || '').trim() || !String(v.body_html || '').trim()) return D.toast('err', '국문 제목과 본문은 비울 수 없습니다.');
    b.disabled = true;
    try { await D.q(D.sb.from('mail_templates').update(v).eq('key', card.dataset.key)); D.toast('ok', '저장했습니다.'); }
    catch (err) { D.toast('err', D.errText(err)); }
    b.disabled = false;
  });
});
