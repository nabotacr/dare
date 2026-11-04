/* recipients.html — 관리자 알림 메일 수신자 관리 (수신자별로 받을 알림 선택) */
DA.page('recipients', async function (main) {
  var D = DA, esc = D.esc, $ = D.$;
  var r = await Promise.all([
    D.q(D.sb.from('mail_recipients').select('*').order('id')),
    D.q(D.sb.from('mail_templates').select('key, description').eq('audience', 'admin').order('key'))
  ]);
  var rows = r[0], keys = r[1];

  function boxes(selected, group) {
    return keys.map(function (k) {
      return '<label class="inline"><input type="checkbox" data-k="' + group + '" value="' + esc(k.key) + '"' +
        (selected.indexOf(k.key) >= 0 ? ' checked' : '') + '>' + esc(k.description) + '</label>';
    }).join('');
  }
  function picked(group) { return D.$$('[data-k="' + group + '"]:checked', main).map(function (c) { return c.value; }); }

  main.innerHTML = '<h1>메일 수신자</h1><p class="muted">새 제출·수정 제출·수정요청·제출취소가 생기면 아래 수신자에게 관리자 알림이 갑니다.</p>' +
    '<div class="card scroll"><table class="tbl"><thead><tr><th>이메일</th><th>이름</th><th>받을 알림</th><th>사용</th><th></th></tr></thead><tbody>' +
    rows.map(function (x) {
      return '<tr data-id="' + x.id + '"><td>' + esc(x.email) + '</td><td><input value="' + esc(x.name || '') + '" data-f="name"></td><td>' + boxes(x.template_keys, 'r' + x.id) +
        '</td><td><input type="checkbox" data-f="active"' + (x.active ? ' checked' : '') + ' aria-label="사용"></td>' +
        '<td style="white-space:nowrap"><button class="b g sm" data-save>저장</button> <button class="b r sm" data-del>삭제</button></td></tr>';
    }).join('') + '</tbody></table>' + (rows.length ? '' : '<p class="muted">등록된 수신자가 없습니다. 아래에서 추가하세요.</p>') + '</div>' +
    '<div class="card"><h2>수신자 추가</h2><div class="grid"><div><label for="n-email">이메일</label><input id="n-email" type="email"></div>' +
    '<div><label for="n-name">이름</label><input id="n-name"></div></div><label>받을 알림</label><div>' +
    boxes(keys.map(function (k) { return k.key; }), 'new') + '</div><button class="b" id="n-add" style="margin-top:12px">추가</button></div>';

  main.addEventListener('click', async function (e) {
    try {
      if (e.target.id === 'n-add') {
        var em = $('#n-email').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return D.toast('err', '이메일 주소를 확인해 주세요.');
        await D.q(D.sb.from('mail_recipients').insert({ email: em, name: $('#n-name').value.trim() || null, template_keys: picked('new') }));
        D.toast('ok', '추가했습니다.'); return setTimeout(function () { location.reload(); }, 500);
      }
      var tr = e.target.closest('tr[data-id]'); if (!tr) return;
      var id = Number(tr.dataset.id);
      if (e.target.closest('[data-save]')) {
        await D.q(D.sb.from('mail_recipients').update({
          name: $('[data-f=name]', tr).value.trim() || null, active: $('[data-f=active]', tr).checked, template_keys: picked('r' + id)
        }).eq('id', id));
        D.toast('ok', '저장했습니다.');
      }
      if (e.target.closest('[data-del]') && confirm('이 수신자를 삭제할까요?')) {
        await D.q(D.sb.from('mail_recipients').delete().eq('id', id)); tr.remove(); D.toast('ok', '삭제했습니다.');
      }
    } catch (err) {
      D.toast('err', /duplicate|unique/i.test(D.errText(err)) ? '이미 등록된 이메일입니다.' : D.errText(err));
    }
  });
});
