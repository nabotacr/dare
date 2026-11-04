/* =====================================================================
 * DARE 관리자 설정 — 이 파일의 두 값만 프로젝트에 맞게 바꿉니다.
 * anon(또는 publishable) 키는 공개되어도 되는 키입니다. 보안은 DB 권한(RLS)과 2단계 인증이 담당합니다.
 * service_role / secret 키, Resend 키는 절대 이 저장소에 넣지 마세요.
 * ===================================================================== */
window.DARE_ADMIN_CONFIG = {
  SUPABASE_URL: 'https://uwqissgdanqxxmwftcvi.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_RqC6RmySBVbjVAv7Zu2CYg_isS7bEn4',
  IDLE_MINUTES: 30          // 조작이 없으면 자동 로그아웃 (분)
};
