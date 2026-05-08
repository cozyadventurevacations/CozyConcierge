# Cozy Concierge Project Status

## Last stable point

- App builds successfully with `npm run build`
- Tester admin account works
- Admin dashboard access confirmed
- Client/admin messaging workflow tested
- Client can send message
- Admin can view and reply
- Client can view admin reply
- No current 404 errors reported
- No current RLS errors reported
- No current Supabase relationship errors reported

## Current focus

Messaging system is stable enough to pause.

## Next recommended development steps

1. Add unread message indicators.
2. Add message notification badges in admin navigation.
3. Add trip-specific message filtering if needed.
4. Add admin-side message queue/inbox.
5. Add email or SMS notification later.
6. Re-test RLS policies before launch.

## Important reminders

- Run `npm run build` before every commit.
- Test as both client and admin after changing messaging.
- Watch for Supabase ambiguous relationship errors.
- Watch for RLS insert/select errors.
- Keep admin users in `user_profiles`.
- Client users need both `user_profiles` and `client_accounts`.

## Last known good commands

```bash
npm run build
git status
git add .
git commit -m "Stabilize messaging system"
git push
