/* =====================================================================
 * DARE 관리자 공통 모듈 (모든 페이지가 사용)
 *  - Supabase 클라이언트 1개
 *  - 페이지 진입 시 권한 확인: 로그인 + admins 등록
 *    → 통과 못 하면 로그인 화면(index.html)으로 이동
 *  - 상단 메뉴, 자동 로그아웃, 공통 유틸
 *
 * 각 페이지 JS 는 이렇게 시작합니다:
 *   DA.page('submissions', async function (main, ctx) { ... });
 * ===================================================================== */
(function () {
  'use strict';

  // 다른 사이트가 이 페이지를 iframe 으로 감싸는 것(클릭재킹) 차단 — 헤더를 못 쓰는 호스팅 대비
  if (window.top !== window.self) { document.documentElement.innerHTML = ''; throw new Error('framed'); }

  var CFG = window.DARE_ADMIN_CONFIG || {};

  // 설정 점검: config.js 에 예시값이 남아 있으면 로그인 시도 전에 원인을 안내
  var configProblem =
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(CFG.SUPABASE_URL || '') || /your-project-ref/i.test(CFG.SUPABASE_URL || '')
      ? 'assets/js/config.js 의 SUPABASE_URL 이 예시값이거나 형식이 맞지 않습니다.\n예) https://abcdefghijklmnop.supabase.co (맨 끝에 / 없이)'
    : !CFG.SUPABASE_ANON_KEY || /YOUR-/i.test(CFG.SUPABASE_ANON_KEY)
      ? 'assets/js/config.js 의 SUPABASE_ANON_KEY 가 예시값입니다.\nSupabase → Project Settings → API Keys 의 anon(public) 또는 publishable 키를 넣어 주세요.'
    : /service_role|sb_secret_/i.test(atobSafe(CFG.SUPABASE_ANON_KEY) + CFG.SUPABASE_ANON_KEY)
      ? '⚠ config.js 에 service_role(secret) 키가 들어 있습니다. 즉시 지우고 Supabase 에서 이 키를 재발급(rotate)하세요.\n관리자 페이지에는 anon(public) 키만 넣어야 합니다.'
    : null;
  function atobSafe(k) { try { return atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')); } catch (e) { return ''; } }
  if (configProblem) {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.classList.remove('guarding');
      document.getElementById('main').innerHTML = '<div class="card login"><h1>설정이 필요합니다</h1><div class="msg err"></div></div>';
      document.querySelector('#main .msg').textContent = configProblem;
    });
    throw new Error('[DARE] ' + configProblem);
  }

  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dare-admin', detectSessionInUrl: false }
  });

  /* ---------------- 메뉴 (파일 = 메뉴 1개) ---------------- */
  var MENU = [
    { id: 'dashboard',     href: 'dashboard.html',     label: '대시보드' },
    { id: 'submissions',   href: 'submissions.html',   label: '제출내역' },
    { id: 'edit-requests', href: 'edit-requests.html', label: '수정요청' },
    { id: 'form',          href: 'form.html',          label: '지원서 설정' },
    { id: 'mail-logs',     href: 'mail-logs.html',     label: '메일 발송 로그' },
    { id: 'templates',     href: 'templates.html',     label: '메일 양식' },
    { id: 'recipients',    href: 'recipients.html',    label: '메일 수신자' },
    { id: 'audit',         href: 'audit.html',         label: '감사 로그', superOnly: true }
  ];

  /* ---------------- 유틸 ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmt(iso) { return iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '-'; }
  // <input type="datetime-local"> ↔ ISO(UTC)
  function toLocal(iso) { if (!iso) return ''; var d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
  function fromLocal(v) { return v ? new Date(v).toISOString() : null; }
  // 로그인 오류를 원인별 안내로 바꿈
  function loginError(e) {
    var m = (e && e.message) || '';
    if (/fetch|network|load failed/i.test(m)) return 'Supabase 에 접속하지 못했습니다. config.js 의 SUPABASE_URL 이 맞는지, 인터넷 연결을 확인해 주세요.';
    if (/invalid api key|no api key/i.test(m)) return 'config.js 의 SUPABASE_ANON_KEY 가 이 프로젝트의 키가 아닙니다.';
    if (/email not confirmed/i.test(m)) return '이메일 확인이 안 된 계정입니다. Supabase → Authentication → Users 에서 이 사용자를 확인(Confirm) 처리하거나, Add user 때 "Auto Confirm User"를 체크해 다시 만드세요.';
    if (/invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않습니다.';
    if (/rate|too many/i.test(m)) return '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    return m || '알 수 없는 오류가 발생했습니다.';
  }
  function errText(e) { return ((e && e.message) || String(e)).replace(/^.*?ERROR:\s*/, ''); }
  function toast(type, text) {
    var box = $('#toast'); if (!box) return;
    var d = document.createElement('div'); d.className = 'msg ' + type; d.textContent = text;
    box.appendChild(d); setTimeout(function () { d.remove(); }, type === 'err' ? 7000 : 3500);
  }
  async function rpc(name, args) { var r = await sb.rpc(name, args || {}); if (r.error) throw r.error; return r.data; }
  async function q(p) { var r = await p; if (r.error) throw r.error; return r.data; }
  function param(name) { return new URLSearchParams(location.search).get(name); }
  function isUuid(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || ''); }
  function log(action, targetType, targetId, detail) {
    rpc('admin_log', { p_action: action, p_target_type: targetType || null, p_target_id: targetId || null, p_detail: detail || {} }).catch(function () {});
  }

  var STATUS = {
    submitted:            ['제출완료', '#2b5fd9', '#eaf0fc'],
    reviewing:            ['검토중', '#9a5b00', '#fdf3e2'],
    supplement_requested: ['보완요청', '#b3261e', '#fbeaea'],
    resubmit_allowed:     ['수정 가능', '#6a3fb5', '#f1ecfb'],
    withdrawn:            ['제출취소', '#5f6577', '#eef0f4']
  };
  function badge(st, reviewed) {
    var s = reviewed && st !== 'withdrawn' ? ['검토완료', '#1f7a4d', '#e8f4ee'] : (STATUS[st] || [st, '#333', '#eee']);
    return '<span class="badge" style="color:' + s[1] + ';background:' + s[2] + '">' + esc(s[0]) + '</span>';
  }
  var TYPE_LABEL = { text: '단답형', textarea: '장문형', email: '이메일', number: '숫자', date: '날짜', url: '링크(URL)', yesno: '예/아니오',
                     radio: '단일선택', select: '드롭다운', checkbox: '다중선택', country: '국가 선택', file: '파일(PDF)', consent: '동의' };
  var BASE_COLS = ['research_title', 'researcher_name', 'nationality', 'affiliation', 'email'];
  function snapValue(snap, l) {
    var v = BASE_COLS.indexOf(l.key) >= 0 ? snap[l.key] : (snap.answers || {})[l.key];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '-';
    if (l.type === 'yesno') return v === 'yes' ? '예' : '아니오';
    if (l.type === 'consent') return v === true ? '동의함' : '-';
    return Array.isArray(v) ? v.join(', ') : String(v);
  }
  var FILE_LABEL = { proposal: 'Research Proposal', budget: 'Research Budget Plan', cv: 'CV' };
  var RESULT_LABEL = { approved: '지원 결정', revise: '보완 후 재검토', not_approved: '지원하지 않음' };
  var RESULT_COLOR = { approved: ['#1f7a4d', '#e8f4ee'], revise: ['#9a5b00', '#fdf3e2'], not_approved: ['#5f6577', '#eef0f4'] };

  // 접수기간 문구 (마감이 비어 있으면 상시 접수)
  function period(c) { return c.apply_end_at ? fmt(c.apply_start_at) + ' ~ ' + fmt(c.apply_end_at) : fmt(c.apply_start_at) + ' ~ 상시 접수'; }

  async function loadCalls() { return q(sb.from('calls').select('*').order('apply_start_at', { ascending: false })); }
  function callOptions(calls, selected, withAll) {
    return (withAll ? '<option value="">전체 공고</option>' : '') + calls.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === selected ? ' selected' : '') + '>' + esc(c.code + ' · ' + c.title) + '</option>';
    }).join('');
  }

  /* ---------------- 권한 확인 ---------------- */
  async function currentAdmin() {
    var s = (await sb.auth.getSession()).data.session;
    if (!s) return null;
    try { return await rpc('admin_me'); } catch (e) { return null; }
  }

  async function logout() { await sb.auth.signOut(); location.replace('index.html'); }

  var idleTimer;
  function resetIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(logout, (CFG.IDLE_MINUTES || 30) * 60000); }

  var ICON = {"dashboard": "<path d=\"M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z\"/>", "submissions": "<path d=\"M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8\"/>", "edit-requests": "<path d=\"M4 20h4L19 9l-4-4L4 16zM14 6l4 4\"/>", "form": "<path d=\"M4 5h16M4 12h16M4 19h10\"/>", "mail-logs": "<path d=\"M3 5h18v14H3zM3 6l9 7 9-7\"/>", "templates": "<path d=\"M4 4h16v16H4zM8 9h8M8 13h8M8 17h5\"/>", "recipients": "<path d=\"M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1a3 3 0 0 0-2-2.8M17 5.2a3 3 0 0 1 0 5.6\"/>", "audit": "<path d=\"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z\"/>"};
  function renderLayout(pageId, me) {
    $('#layout').innerHTML =
      '<header class="topbar"><b>DARE 관리자</b><span class="me">' + esc(me.name) + ' (' + (me.role === 'super' ? '최고관리자' : '담당자') + ')</span>' +
      '<button class="b g sm" id="logout">로그아웃</button></header>' +
      '<div class="tabbar"><nav>' +
      MENU.filter(function (m) { return !m.superOnly || me.role === 'super'; }).map(function (m) {
        return '<a href="' + m.href + '"' + (m.id === pageId ? ' class="on"' : '') + ' data-menu="' + m.id + '">' +
          '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICON[m.id] || '') + '</svg>' +
          m.label + '</a>';
      }).join('') + '</nav></div>';
    $('#logout').addEventListener('click', logout);
    /* 처리 대기 수정요청 수를 탭에 표시 */
    sb.from('edit_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').then(function (r) {
      if (r.count) { var a = document.querySelector('[data-menu="edit-requests"]'); if (a) a.insertAdjacentHTML('beforeend', '<span class="cnt">' + r.count + '</span>'); }
    });
  }

  /* 각 페이지 진입점 */
  function page(pageId, render) {
    document.body.classList.add('guarding');
    document.addEventListener('DOMContentLoaded', async function () {
      var me = await currentAdmin();
      if (!me) return location.replace('index.html');
      var item = MENU.filter(function (m) { return m.id === pageId; })[0];
      if (item && item.superOnly && me.role !== 'super') return location.replace('dashboard.html');

      renderLayout(pageId, me);
      ['click', 'keydown', 'mousemove', 'scroll'].forEach(function (ev) { document.addEventListener(ev, resetIdle, { passive: true }); });
      resetIdle();
      document.body.classList.remove('guarding');

      var main = $('#main');
      main.innerHTML = '<p class="muted">불러오는 중…</p>';
      try { await render(main, { me: me }); }
      catch (e) { main.innerHTML = '<div class="msg err">' + esc(errText(e)) + '</div>'; }
    });
  }

  window.DA = {
    sb: sb, config: CFG, $: $, $$: $$, esc: esc, fmt: fmt, toLocal: toLocal, fromLocal: fromLocal,
    errText: errText, loginError: loginError, toast: toast, rpc: rpc, q: q, param: param, isUuid: isUuid, log: log,
    STATUS: STATUS, badge: badge, FILE_LABEL: FILE_LABEL, TYPE_LABEL: TYPE_LABEL, BASE_COLS: BASE_COLS, snapValue: snapValue, RESULT_LABEL: RESULT_LABEL, RESULT_COLOR: RESULT_COLOR,
    loadCalls: loadCalls, period: period, callOptions: callOptions, currentAdmin: currentAdmin, logout: logout, page: page
  };
})();
