-- ============================================================
-- Migration 0026: Harden audit_logs INSERT policy
-- Restrict INSERT to authenticated users only (not anon)
-- ============================================================
-- DB Triggers (tg_audit_order_changes, tg_audit_profile_balance_changes)
-- run as SECURITY DEFINER and bypass RLS entirely — they are unaffected.
-- SePay webhook events are captured via DB triggers, not direct API calls.
-- ============================================================

set search_path = public, auth;

-- Drop the overly permissive "anyone insert" policy (allowed anon spam)
drop policy if exists "anyone insert audit_logs" on public.audit_logs;

-- Replace with authenticated-only INSERT (anon users cannot write fake audit logs)
create policy "authenticated insert audit_logs"
  on public.audit_logs
  for insert
  to authenticated
  with check (true);

-- Summary of final RLS policies on audit_logs:
-- SELECT: is_admin() → only Admin reads logs
-- INSERT: to authenticated → logged-in users/system only (DB triggers bypass RLS via SECURITY DEFINER)
-- UPDATE: no policy → blocked for everyone (append-only)
-- DELETE: no policy → blocked for everyone (immutable)
