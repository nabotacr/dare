/* index.html — 관리자 로그인 (이메일 + 비밀번호)
 * 로그인 후 admins 테이블에 등록된 계정인지 확인하고 대시보드로 이동합니다. */
(function () {
  'use strict';
  var D = window.DA, sb = D.sb, $ = D.$, esc = D.esc;

  document.addEventListener('DOMContentLoaded', async function () {
    $('#main').innerHTML =
      '<section class="card login"><h1>DARE 관리자 로그인</h1>' +
      '<label for="l-email">이메일</label><input id="l-email" type="email" autocomplete="username">' +
      '<label for="l-pw">비밀번호</label><input id="l-pw" type="password" autocomplete="current-password">' +
      '<button class="b" id="l-go" style="width:100%;margin-top:16px">로그인</button>' +
      '<div id="l-msg"></div></section>';

    $('#l-go').addEventListener('click', signIn);
    $('#l-email').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#l-pw').focus(); });
    $('#l-pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') signIn(); });

    // 이미 로그인된 관리자면 바로 대시보드로
    if (await D.currentAdmin()) return location.replace('dashboard.html');
    $('#l-email').focus();
  });

  function msg(type, t) { $('#l-msg').innerHTML = t ? '<div class="msg ' + type + '">' + esc(t) + '</div>' : ''; }

  async function signIn() {
    msg();
    var btn = $('#l-go'); btn.disabled = true;
    var r = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pw').value });
    $('#l-pw').value = '';
    if (r.error) { btn.disabled = false; return msg('err', D.loginError(r.error)); }

    var me = await D.currentAdmin();
    if (!me) {
      await sb.auth.signOut(); btn.disabled = false;
      return msg('err', '로그인은 됐지만 관리자 권한이 확인되지 않습니다.\n① SQL Editor 에서 admins 테이블에 이 계정이 등록됐는지\n② 01c_patch_관리자_2단계인증_해제.sql 을 실행했는지 확인해 주세요.');
    }
    D.log('admin_login');
    location.replace('dashboard.html');
  }
})();
