/* index.html — 관리자 로그인 + 2단계 인증(인증 앱 6자리)
 * 처음 로그인하는 관리자는 QR 을 스캔해 인증 앱을 등록합니다. */
(function () {
  'use strict';
  var D = window.DA, sb = D.sb, $ = D.$, esc = D.esc;
  var factorId = null, enrolling = false;

  document.addEventListener('DOMContentLoaded', async function () {
    $('#main').innerHTML =
      '<section class="card login"><h1>DARE 관리자 로그인</h1>' +
      '<div id="step-pw"><label for="l-email">이메일</label><input id="l-email" type="email" autocomplete="username">' +
      '<label for="l-pw">비밀번호</label><input id="l-pw" type="password" autocomplete="current-password">' +
      '<button class="b" id="l-go" style="width:100%;margin-top:16px">다음</button></div>' +
      '<div id="step-mfa" hidden><div id="mfa-enroll" hidden>' +
      '<p>처음 로그인입니다. 인증 앱(Google Authenticator, Microsoft Authenticator 등)으로 QR을 스캔하세요.</p>' +
      '<img class="qr" id="mfa-qr" alt="2단계 인증 QR"><p class="muted">QR을 쓸 수 없으면 키 직접 입력: <code id="mfa-secret"></code></p></div>' +
      '<label for="l-code">인증 앱 6자리 코드</label><input id="l-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code">' +
      '<button class="b" id="l-verify" style="width:100%;margin-top:16px">확인</button>' +
      '<button class="l" id="l-back" style="margin-top:12px">다른 계정으로 로그인</button></div>' +
      '<div id="l-msg"></div></section>';

    $('#l-go').addEventListener('click', signIn);
    $('#l-pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') signIn(); });
    $('#l-verify').addEventListener('click', verify);
    $('#l-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') verify(); });
    $('#l-back').addEventListener('click', async function () { await sb.auth.signOut(); step('pw'); });

    // 이미 로그인된 상태 처리
    if (await D.currentAdmin()) return location.replace('dashboard.html');
    var s = (await sb.auth.getSession()).data.session;
    if (s) prepareMfa(); else step('pw');
  });

  function step(n) { $('#step-pw').hidden = n !== 'pw'; $('#step-mfa').hidden = n !== 'mfa'; }
  function msg(type, t) { $('#l-msg').innerHTML = t ? '<div class="msg ' + type + '">' + esc(t) + '</div>' : ''; }

  async function signIn() {
    msg();
    var r = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pw').value });
    $('#l-pw').value = '';
    if (r.error) return msg('err', '이메일 또는 비밀번호가 맞지 않습니다.');
    prepareMfa();
  }

  async function prepareMfa() {
    step('mfa');
    var f = (await sb.auth.mfa.listFactors()).data || { all: [], totp: [] };
    var verified = (f.totp || []).filter(function (x) { return x.status === 'verified'; })[0];
    if (verified) { factorId = verified.id; enrolling = false; $('#mfa-enroll').hidden = true; }
    else {
      // 끝내지 못한 등록이 있으면 지우고 새로 등록
      for (var i = 0; i < (f.all || []).length; i++) {
        if (f.all[i].status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.all[i].id });
      }
      var en = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'DARE admin ' + Date.now() });
      if (en.error) return msg('err', D.errText(en.error));
      factorId = en.data.id; enrolling = true;
      $('#mfa-qr').src = en.data.totp.qr_code;
      $('#mfa-secret').textContent = en.data.totp.secret;
      $('#mfa-enroll').hidden = false;
    }
    $('#l-code').focus();
  }

  async function verify() {
    msg();
    var r = await sb.auth.mfa.challengeAndVerify({ factorId: factorId, code: $('#l-code').value.trim() });
    $('#l-code').value = '';
    if (r.error) return msg('err', '코드가 맞지 않습니다. 인증 앱의 현재 코드를 입력해 주세요.');
    var me = await D.currentAdmin();
    if (!me) { await sb.auth.signOut(); step('pw'); return msg('err', '관리자로 등록되지 않은 계정입니다.'); }
    D.log('admin_login', null, null, { enrolled: enrolling });
    location.replace('dashboard.html');
  }
})();
