/* =====================================================================
 * DARE 관리자 공통 모듈 (모든 페이지가 사용)
 *  - Supabase 클라이언트 1개
 *  - 페이지 진입 시 권한 확인: 로그인 + 2단계 인증(aal2) + admins 등록
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

  var CFG = window.DARE_ADMIN_CONFIG;
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dare-admin', detectSessionInUrl: false }
  });

  /* ---------------- 메뉴 (파일 = 메뉴 1개) ---------------- */
  var MENU = [
    { id: 'dashboard',     href: 'dashboard.html',     label: '대시보드' },
    { id: 'submissions',   href: 'submissions.html',   label: '제출내역' },
    { id: 'edit-requests', href: 'edit-requests.html', label: '수정요청' },
    { id: 'calls',         href: 'calls.html',         label: '공고·수정기간' },
    { id: 'recipients',    href: 'recipients.html',    label: '메일 수신자' },
    { id: 'templates',     href: 'templates.html',     label: '메일 양식' },
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
    resubmit_allowed:     ['수정 가능(요청 승인)', '#6a3fb5', '#f1ecfb'],
    withdrawn:            ['제출취소', '#5f6577', '#eef0f4']
  };
  function badge(st) { var s = STATUS[st] || [st, '#333', '#eee']; return '<span class="badge" style="color:' + s[1] + ';background:' + s[2] + '">' + esc(s[0]) + '</span>'; }
  var FILE_LABEL = { proposal: 'Research Proposal', budget: 'Research Budget Plan', cv: 'CV' };
  var RESULT_LABEL = { selected: '선정', not_selected: '미선정' };

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
    var aal = (await sb.auth.mfa.getAuthenticatorAssuranceLevel()).data;
    if (!aal || aal.currentLevel !== 'aal2') return null;
    try { return await rpc('admin_me'); } catch (e) { return null; }
  }

  async function logout() { await sb.auth.signOut(); location.replace('index.html'); }

  var idleTimer;
  function resetIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(logout, (CFG.IDLE_MINUTES || 30) * 60000); }

  function renderLayout(pageId, me) {
    $('#layout').innerHTML =
      '<header class="topbar"><b>DARE 관리자</b><nav>' +
      MENU.filter(function (m) { return !m.superOnly || me.role === 'super'; }).map(function (m) {
        return '<a href="' + m.href + '"' + (m.id === pageId ? ' class="on"' : '') + '>' + m.label + '</a>';
      }).join('') +
      '</nav><span class="me">' + esc(me.name) + ' (' + (me.role === 'super' ? '최고관리자' : '담당자') + ')</span>' +
      '<button class="b g sm" id="logout">로그아웃</button></header>';
    $('#logout').addEventListener('click', logout);
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
    errText: errText, toast: toast, rpc: rpc, q: q, param: param, isUuid: isUuid, log: log,
    STATUS: STATUS, badge: badge, FILE_LABEL: FILE_LABEL, RESULT_LABEL: RESULT_LABEL,
    loadCalls: loadCalls, period: period, callOptions: callOptions, currentAdmin: currentAdmin, logout: logout, page: page
  };
})();
