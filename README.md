# DARE 관리자 페이지

메뉴 1개 = HTML 1개 + JS 1개 구조입니다. 빌드 과정 없이 폴더 그대로 정적 호스팅에 올리면 됩니다.

```
dare-admin/
├─ index.html              로그인
├─ dashboard.html          대시보드
├─ submissions.html        제출내역 목록 (검색·CSV·일괄 처리)
├─ submission.html         제출 상세 (?id=)
├─ edit-requests.html      수정요청 처리
├─ form.html               지원서 설정 (항목 편집, 접수 열기/닫기, 변경 이력)
├─ mail-logs.html          메일 발송 로그 (실패 건 재발송)
├─ recipients.html         메일 수신자
├─ templates.html          메일 양식
├─ audit.html              감사 로그 (최고관리자)
├─ assets/
│  ├─ css/admin.css        공통 스타일
│  └─ js/
│     ├─ config.js         ★ Supabase 주소·anon 키 (여기만 수정)
│     ├─ core.js           공통: 권한 확인, 상단 메뉴, 자동 로그아웃, 유틸
│     └─ pages/            메뉴별 스크립트 (파일명 = HTML 이름)
├─ vendor/supabase.js      Supabase SDK 2.45.4 (외부 CDN 대신 저장소에 고정)
├─ _headers                보안 헤더 (Cloudflare Pages / Netlify)
├─ robots.txt              검색 노출 차단
└─ .gitignore
```

## 메뉴 추가하는 법
1. `새메뉴.html` 을 기존 HTML 하나 복사해서 만들고, 마지막 script 경로를 `assets/js/pages/새메뉴.js` 로 바꿉니다.
2. `assets/js/pages/새메뉴.js` 를 `DA.page('새메뉴', async function (main) { ... });` 로 작성합니다.
3. `core.js` 의 `MENU` 배열에 한 줄 추가합니다.

## 보안 원칙
- 스크립트는 모두 이 저장소 안의 파일만 씁니다. 인라인 스크립트가 없어 CSP 를 `script-src 'self'` 로 잠글 수 있습니다.
- `config.js` 의 anon 키는 공개되어도 되는 키입니다. service_role 키, Resend 키는 절대 커밋하지 않습니다.
- 모든 페이지는 열릴 때 로그인 + 관리자 등록 여부를 확인하고, 아니면 로그인 화면으로 보냅니다.
  실제 데이터 접근은 DB 권한(RLS)이 막으므로, 이 화면 코드를 누가 보더라도 데이터는 볼 수 없습니다.

## 파일을 고친 뒤 화면이 안 바뀔 때
GitHub Pages 와 브라우저가 JS·CSS 를 잠시 저장(캐시)해 둡니다. 파일을 고치면 모든 HTML 의 `?v=20261104c` 숫자를
새 날짜로 바꿔 주세요 (GitHub 웹에서 저장소 전체 찾기·바꾸기, 또는 VS Code 의 전체 바꾸기). 브라우저가 새 파일을 받아옵니다.
급하게 확인할 때는 시크릿 창으로 열면 됩니다.
