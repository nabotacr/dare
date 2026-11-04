/* templates.html — 자동 메일 양식 편집 (제목·본문). 변수는 발송 시 자동 치환되고 값은 HTML 이스케이프됩니다. */
DA.page('templates', async function (main) {
  var D = DA, esc = D.esc, $ = D.$;
  var rows = await D.q(D.sb.from('mail_templates').select('*').order('audience', { ascending: false }).order('key'));

  main.innerHTML = '<h1>메일 양식</h1>' +
    '<div class="card"><p>사용 가능한 변수: <code>{{name}}</code> <code>{{research_title}}</code> <code>{{receipt_no}}</code> <code>{{call_title}}</code> ' +
    '<code>{{deadline}}</code> <code>{{reason}}</code> <code>{{decision}}</code> <code>{{mypage_url}}</code></p>' +
    '<p class="muted">본문은 HTML로 작성합니다. 링크는 &lt;a href="{{mypage_url}}"&gt;제출내역&lt;/a&gt; 처럼 씁니다. 날짜 변수는 한국시간으로 표시됩니다.</p></div>' +
    rows.map(function (t) {
      return '<div class="card" data-key="' + esc(t.key) + '"><h2>' + esc(t.description) +
        ' <span class="muted">' + esc(t.key) + ' · ' + (t.audience === 'admin' ? '관리자에게' : '연구자에게') + '</span></h2>' +
        '<label>제목</label><input data-f="subject" value="' + esc(t.subject) + '">' +
        '<label>본문 (HTML)</label><textarea class="code" data-f="body">' + esc(t.body_html) + '</textarea>' +
        '<div class="row" style="margin-top:8px"><button class="b" data-save>저장</button><span class="muted">최근 수정 ' + D.fmt(t.updated_at) + '</span></div></div>';
    }).join('');

  main.addEventListener('click', async function (e) {
    var b = e.target.closest('[data-save]'); if (!b) return;
    var card = b.closest('[data-key]');
    var subject = $('[data-f=subject]', card).value.trim(), body = $('[data-f=body]', card).value.trim();
    if (!subject || !body) return D.toast('err', '제목과 본문을 입력해 주세요.');
    b.disabled = true;
    try { await D.q(D.sb.from('mail_templates').update({ subject: subject, body_html: body }).eq('key', card.dataset.key)); D.toast('ok', '저장했습니다.'); }
    catch (err) { D.toast('err', D.errText(err)); }
    b.disabled = false;
  });
});
