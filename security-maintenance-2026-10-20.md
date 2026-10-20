# Security maintenance — October 20, 2026

New registrations now receive a Resend email confirmation link. Signup creates an unconfirmed Auth user; client records are created or linked only after a successful OTP/PKCE exchange. Existing linked accounts keep their profile links. No legacy account is automatically linked merely because its email matches. Admin role lookup and client account lookup use auth UID/profile links.

Administrators must enroll a TOTP authenticator at /auth/mfa, then verify a six-digit code to open admin pages and APIs. The database also denies admin data access at AAL1, including older inline-role policies and Storage. Own user_profiles reads remain available for enrollment. After losing an authenticator, an account owner with independent Supabase dashboard access must verify the administrator's identity and remove the lost factor through Supabase's user MFA controls. There is no public recovery bypass. Do not clear real factors during testing.

Apply scripts/harden-auth-and-access.sql before deploying this code. Apply scripts/require-admin-mfa.sql only after the deployed /auth/mfa page is verified. The maintenance applied through Supabase migrations is recorded in the live migration history. scripts/setup-trip-reminders.sql now includes its intended admin-only policy.

Shared database limits are atomic, service-only, and fail closed. Keys are SHA-256 hashes; raw IPs and emails are not stored in the limit table. Default limits:
- Registration/reset: 5 attempts per IP per 15 minutes and 3 per email per hour.
- Client search: 20 per user per minute.
- All Places routes together: 60 per user per minute, 1,000 per day, and 10,000 globally per day.
- Ask Cozy and rewrite together: 20 per user per minute, 100 per day, and 1,000 globally per day.

Expired quota rows are removed in bounded batches during requests. These are request ceilings, not dollar-denominated provider budgets.

Document buckets remain private. Client/private buckets cap files at 15 MiB; trip storage caps at 25 MiB to leave room for encrypted payloads. Supported document MIME types are explicit; trip storage additionally accepts encrypted bytes and generated HTML waivers. Server upload handlers check content signatures and reject mismatched MIME types and files over 15 MiB. Signature checks are not malware scanning.

Booking-window checks run daily at 14:15 UTC. Middleware exempts only the exact cron endpoint; the route still validates CRON_SECRET. No production email cron was manually executed.

Supabase SSR/client and csv-parse were upgraded to pinned compatible versions. Supplier phone-row filters now narrow nulls correctly under the updated types. Archived tmp files are excluded from TypeScript checks.

Validation:
- npm run build (includes lint/types)
- npm run test:security (9 regression tests)
- Live SQL assertions: forged email claim cannot resolve/read a client; linked UID retains exactly its own account; browser roles cannot call maintenance/quota RPCs.
- scripts/check-security-live.mjs: opt-in disposable account test for email verification, account linking, isolation, concurrent quotas, authenticator enrollment, session refresh/logout and optional real browser MFA flow. Set RUN_LIVE_SECURITY_CHECK=1; optionally SECURITY_TEST_BASE_URL and SECURITY_PLAYWRIGHT_PATH (file URL to an installed Playwright module). It never sends email and removes its disposable account/profile/client.
- npm audit --omit=dev: zero findings.
- Supabase security advisors after phase 1: no warnings/errors; informational default-deny notes and quota tables only after reminder policy repair.

Five high npm findings remain in the development-only Next ESLint -> fast-glob -> micromatch -> braces chain. No patched compatible braces release was available at verification; npm's suggested forced downgrade is not an appropriate runtime fix. No production dependency vulnerabilities remain.

Provider email delivery is not exercised by sending a test email. Production Resend, app URL, Turnstile and Supabase configuration is reused. Existing notes table remains default-deny because no application consumer was found.
