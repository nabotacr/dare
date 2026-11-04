/* calls.html — 공고 등록·수정, 접수기간·수정기간·수정요청 마감·결과 공개 일시 관리
 * 수정기간을 설정하면 그 기간에만 연구자 마이페이지의 "수정" 버튼이 켜집니다. */
DA.page('calls', async function (main) {
  var D = DA, esc = D.esc, $ = D.$;
  var calls = await D.loadCalls();

  main.innerHTML = '<h1>공고·수정기간</h1><div class="split"><div class="card scroll"><table class="tbl"><thead><tr>' +
    '<th>코드</th><th>공고명</th><th>접수기간</th><th>수정기간</th><th>공개</th></tr></thead><tbody>' +
    calls.map(function (c) {
      return '<tr class="click" data-id="' + c.id + '"><td>' + esc(c.code) + '</td><td>' + esc(c.title) + '</td><td>' + D.period(c) +
        '</td><td>' + (c.edit_start_at ? D.fmt(c.edit_start_at) + ' ~ ' + D.fmt(c.edit_end_at) : '<span class="muted">설정 안 함</span>') +
        '</td><td>' + (c.is_published ? '공개' : '비공개') + '</td></tr>';
    }).join('') + '</tbody></table><button class="b g" id="new" style="margin-top:12px">새 공고</button></div>' +
    '<div class="card" id="form"><p class="muted">왼쪽에서 공고를 선택하거나 새로 만드세요.</p></div></div>';

  main.querySelector('tbody').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-id]'); if (tr) form(calls.filter(function (c) { return c.id === tr.dataset.id; })[0]);
  });
  $('#new').addEventListener('click', function () { form(null); });
  var pre = D.param('id'); if (pre) form(calls.filter(function (c) { return c.id === pre; })[0]);

  function dt(id, label, v, hint) {
    return '<label for="' + id + '">' + label + '</label><input type="datetime-local" id="' + id + '" value="' + D.toLocal(v) + '">' + (hint ? '<p class="muted">' + hint + '</p>' : '');
  }

  function form(c) {
    c = c || { max_file_mb: 20, retention_months: 12, is_published: false, apply_start_at: new Date().toISOString() };
    $('#form').innerHTML = '<h2>' + (c.id ? '공고 수정' : '새 공고') + '</h2>' +
      '<label for="c-code">공고 코드 (접수번호 앞머리)</label>' +
      '<input id="c-code" maxlength="20" placeholder="예: DARE" value="' + esc(c.code || '') + '"' + (c.id ? ' readonly' : '') + '>' +
      '<p class="muted" id="c-code-hint">영문 대문자·숫자·하이픈(-)만, 2~20자. 접수번호가 <b>' + esc(c.code || 'DARE') + '-0001</b> 형식으로 만들어집니다. 한글 이름은 아래 공고명에 쓰세요.' +
      (c.id ? ' 이미 만든 공고의 코드는 바꿀 수 없습니다.' : '') + '</p>' +
      '<label for="c-title">공고명</label><input id="c-title" value="' + esc(c.title || '') + '">' +
      dt('c-as', '접수 시작', c.apply_start_at) + dt('c-ae', '접수 마감', c.apply_end_at, '비워 두면 상시 접수입니다. 접수를 멈추려면 마감을 넣거나 "연구자 화면에 공개"를 끄세요.') +
      '<h3>수정기간</h3><p class="muted">비워 두면 직접 수정은 불가하고 수정요청만 받습니다.</p>' +
      dt('c-es', '수정 시작', c.edit_start_at) + dt('c-ee', '수정 마감', c.edit_end_at) +
      dt('c-re', '수정요청 마감', c.edit_request_end_at, '비우면 결과 공개 전까지 요청할 수 있습니다.') +
      '<h3>결과</h3>' + dt('c-ro', '결과 공개 일시', c.result_open_at, '이 시각 이후 연구자 화면에 결과가 보이고 안내 메일이 나갑니다.') +
      '<div class="grid"><div><label for="c-mb">파일당 최대 용량(MB)</label><input type="number" id="c-mb" min="1" max="50" value="' + c.max_file_mb + '"></div>' +
      '<div><label for="c-ret">첨부 보관 기간(개월)</label><input type="number" id="c-ret" min="1" max="120" value="' + c.retention_months + '"></div></div>' +
      '<label class="inline" style="margin-top:14px"><input type="checkbox" id="c-pub"' + (c.is_published ? ' checked' : '') + '> 연구자 화면에 공개</label>' +
      '<div><button class="b" id="c-save" style="margin-top:14px">저장</button></div>';

    $('#c-save').addEventListener('click', async function () {
      var v = {
        code: $('#c-code').value.trim().toUpperCase(), title: $('#c-title').value.trim(),
        apply_start_at: D.fromLocal($('#c-as').value), apply_end_at: D.fromLocal($('#c-ae').value),
        edit_start_at: D.fromLocal($('#c-es').value), edit_end_at: D.fromLocal($('#c-ee').value),
        edit_request_end_at: D.fromLocal($('#c-re').value), result_open_at: D.fromLocal($('#c-ro').value),
        max_file_mb: Number($('#c-mb').value), retention_months: Number($('#c-ret').value), is_published: $('#c-pub').checked
      };
      if (!v.code || !v.title || !v.apply_start_at) return D.toast('err', '코드·공고명·접수 시작은 필수입니다.');
      if (!c.id && !CODE_RE.test(v.code)) return D.toast('err', '공고 코드는 영문 대문자·숫자·하이픈(-)만, 2~20자로 입력해 주세요. 예: DARE, DARE-OPEN');
      if (v.apply_end_at && v.apply_end_at <= v.apply_start_at) return D.toast('err', '접수 마감은 접수 시작보다 뒤여야 합니다.');
      if (v.edit_start_at && v.edit_end_at && v.edit_end_at <= v.edit_start_at) return D.toast('err', '수정 마감은 수정 시작보다 뒤여야 합니다.');
      if (!(v.max_file_mb >= 1 && v.max_file_mb <= 50)) return D.toast('err', '파일당 최대 용량은 1~50MB 사이로 입력해 주세요.');
      if (!(v.retention_months >= 1 && v.retention_months <= 120)) return D.toast('err', '보관 기간은 1~120개월 사이로 입력해 주세요.');
      if (!!v.edit_start_at !== !!v.edit_end_at) return D.toast('err', '수정 시작과 마감은 함께 입력하거나 둘 다 비워 주세요.');
      try {
        if (c.id) { delete v.code; await D.q(D.sb.from('calls').update(v).eq('id', c.id)); }
        else await D.q(D.sb.from('calls').insert(v));
        D.toast('ok', '저장했습니다.');
        setTimeout(function () { location.reload(); }, 600);
      } catch (e) { D.toast('err', dbError(e)); }
    });

    // 코드 입력: 소문자→대문자, 공백·밑줄→하이픈, 그 밖의 글자는 지움
    var codeEl = $('#c-code');
    if (!c.id) codeEl.addEventListener('input', function () {
      var cleaned = codeEl.value.toUpperCase().replace(/[\s_]+/g, '-').replace(/[^A-Z0-9-]/g, '').replace(/^-+/, '').replace(/-{2,}/g, '-');
      if (cleaned !== codeEl.value) codeEl.value = cleaned;
      $('#c-code-hint b').textContent = (cleaned || 'DARE') + '-0001';
    });
  }

  var CODE_RE = /^[A-Z0-9-]{2,20}$/;

  // DB 제약 위반 메시지를 사람이 읽을 수 있게
  function dbError(e) {
    var m = D.errText(e);
    if (/calls_code_check/.test(m)) return '공고 코드는 영문 대문자·숫자·하이픈(-)만, 2~20자로 입력해 주세요.';
    if (/calls_code_key|duplicate key/.test(m)) return '이미 같은 공고 코드가 있습니다. 다른 코드를 써 주세요.';
    if (/calls_check1/.test(m)) return '수정 마감은 수정 시작보다 뒤여야 합니다.';
    if (/calls_check/.test(m)) return '접수 마감은 접수 시작보다 뒤여야 합니다.';
    if (/max_file_mb/.test(m)) return '파일당 최대 용량은 1~50MB 사이여야 합니다.';
    if (/retention_months/.test(m)) return '보관 기간은 1~120개월 사이여야 합니다.';
    return m;
  }
});
