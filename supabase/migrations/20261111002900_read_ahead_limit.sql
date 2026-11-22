-- Reading plans: read at most 2 days past today's reading, so a group stays together.
-- (The app shows the same limit; this keeps older copies of the app in step too.)
-- "Today" is taken one day later than the server's date to allow for time zones ahead of UTC.
drop policy if exists "reading log: tick your own" on reading_log;
create policy "reading log: tick your own" on reading_log for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from reading_plans r
      where r.id = plan_id
        and is_community_member(r.community_id)
        and day <= plan_days_due(r, (now() at time zone 'utc')::date + 1) + 2
    )
  );
