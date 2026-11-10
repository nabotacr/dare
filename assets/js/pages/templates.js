/* templates.html — 자동 메일 양식 편집 (제목·본문). 변수는 발송 시 자동 치환되고 값은 HTML 이스케이프됩니다. */
DA.page('templates', async function (main) {
  var D = DA, esc = D.esc, $ = D.$;
  var rows = await D.q(D.sb.from('mail_templates').select('*').order('audience', { ascending: false }).order('key'));

  main.innerHTML = '<h1>메일 양식</h1>' +
    '<div class="card"><p><b>사용 가능한 변수</b></p><p class="muted" style="line-height:2">' +
    '기본: <code>{{name}}</code> 연구자 이름 · <code>{{research_title}}</code> 연구제목 · <code>{{receipt_no}}</code> 접수번호 · <code>{{email}}</code> 연구자 이메일<br>' +
    '날짜 (뒤에 |ko 또는 |en): <code>{{submitted_at|ko}}</code> 접수 일시 · <code>{{last_submitted_at|en}}</code> 재제출 일시 · <code>{{deadline|ko}}</code> 기한 · <code>{{edit_deadline|ko}}</code> 7일 수정 기한 · <code>{{withdrawn_at|ko}}</code> 취소 일시<br>' +
    '보완·수정 권한: <code>{{details}}</code> 요청 사항 · <code>{{documents_ko}}</code> <code>{{documents_en}}</code> 서류 · <code>{{method_ko}}</code> <code>{{method_en}}</code> 제출 방법 · <code>{{attachment_note_ko}}</code> 첨부 안내<br>' +
    '결과: <code>{{result_ko}}</code> <code>{{result_en}}</code> 검토 결과 · <code>{{reason}}</code> 사유 / 블록: <code>{{button}}</code> My Submissions 버튼 · <code>{{info_box}}</code> 접수 정보 상자 · <code>{{code_box}}</code> 인증코드</p>' +
    '<p class="muted">본문은 HTML 로 작성합니다 (&lt;p&gt;, &lt;ul&gt;&lt;li&gt;, &lt;b&gt;, &lt;hr&gt; 사용). 메일 상단 띠와 하단 문의처는 자동으로 붙습니다.</p></div>' +
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
