# 인증 공급자 설정 (Supabase Dashboard 1회 작업)

`web/`의 로그인·회원가입 코드는 모두 준비되어 있으나, 다음 항목은 **코드로 바꿀 수 없고 Supabase Dashboard(프로젝트 `fjznkonbjoierxvopiko`)에서 직접 설정**해야 실제로 동작합니다. `supabase/config.toml`에 동일한 의도를 선언해 두었으므로, CLI를 쓰는 경우 `supabase config push`로도 일부 반영됩니다.

## 1. Google 로그인 (`provider is not enabled` 오류 해결)

`AuthModal`의 "Google로 계속하기" 클릭 시 나던 `provider is not enabled` 오류의 원인은 **Google 공급자 비활성화** 하나뿐입니다.

1. Google Cloud Console → **API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션)** 생성
   - 승인된 리디렉션 URI: `https://fjznkonbjoierxvopiko.supabase.co/auth/v1/callback`
   - 승인된 JavaScript 원본: `https://www.theunitas.global`
2. Supabase Dashboard → **Authentication → Providers → Google**
   - **Enabled** 토글 ON
   - `Client ID` / `Client Secret` 입력 → 저장
3. Supabase Dashboard → **Authentication → URL Configuration**
   - Site URL: `https://www.theunitas.global`
   - Redirect URLs에 `https://www.theunitas.global/**`, `http://localhost:3000/**` 추가

> CLI 사용 시: `SUPABASE_AUTH_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_GOOGLE_SECRET` 환경변수를 설정한 뒤 `supabase config push`.

## 2. 이메일 OTP (보안 코드)

- **Authentication → Providers → Email**: `Confirm email` ON
- **Authentication → Emails → OTP**: 코드 길이 6, 매직 링크 대신 6자리 코드 템플릿 사용
- 무료 SMTP는 발송량 제한이 있으므로 프로덕션에서는 커스텀 SMTP 연결 권장

## 3. 전화번호 OTP (SMS)

- **Authentication → Providers → Phone**: Enable Phone Signup ON
- SMS 공급자(Twilio / MessageBird / Vonage 등) 자격 증명 입력
- 미설정 시 앱은 "이 환경에서는 아직 SMS 발송이 설정되어 있지 않습니다" 문구로 안전하게 처리됨 (이메일 가입/로그인은 정상 동작)

## 4. 비밀번호 정책

- **Authentication → Policies → Password**: 최소 길이 10, "Require lowercase / uppercase / digits / symbols" 모두 ON
- 클라이언트(`web/lib/passwordPolicy.ts`)가 동일 규칙을 미리 검사하므로 사용자는 요청 전에 미충족 항목을 봅니다.

## 5. 마이그레이션 적용

`supabase/migrations/` 파일은 전부 "NOT YET APPLIED" 상태입니다. 실 프로젝트 스키마와 대조 후:

```bash
supabase db pull          # 실제 스키마와 드리프트 확인
supabase db push          # 순서대로 적용 (20260901_profile_cognitive_extension 포함)
```

`20260901000000_profile_cognitive_extension.sql`이 `profiles.iq` / `profiles.eq` 컬럼과 실명 잠금 트리거(`protect_profile_realname`)를 추가합니다.

## 6. 게스트 모드

게스트는 **Supabase 익명 로그인을 쓰지 않습니다.** `web/lib/guestIdentity.ts`가 브라우저 `localStorage`에만 저장하는 로컬 임시 신원(가상 번호 `GUEST-######`)이며, 정식 세션이 생기면 자동 폐기됩니다. 별도 Dashboard 설정이 필요 없습니다.
