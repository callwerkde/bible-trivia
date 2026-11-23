-- Admins read and close reports in the app (Admin → Reports), until reports are emailed.
drop policy if exists "reports: admins read" on question_reports;
create policy "reports: admins read" on question_reports for select to authenticated using (is_admin());
drop policy if exists "reports: admins close" on question_reports;
create policy "reports: admins close" on question_reports for update to authenticated
  using (is_admin()) with check (is_admin());
grant select on question_reports to authenticated;
grant update (status, handled_at) on question_reports to authenticated;
