-- Members' progress worked out in the database (one short row per member), so the app
-- doesn't download the whole reading log, and live updates for groups.
--   chapters_read: chapters in the days they've read (current plan)
--   next_day:      their first unread day (null when finished)
--   behind:        reading days that have come round but aren't read
--   read_week:     read anything in the last 7 days

-- Chapters on one day of a plan (the same split the app uses).
create or replace function plan_day_chapters(p reading_plans, p_day integer) returns integer
language sql stable set search_path = public as $$
  with n as (select coalesce(sum(chapters), 0)::int as total from bible_book_chapters where code = any(p.books))
  select case
    when p.days_total is not null then
      floor(p_day::numeric * (select total from n) / plan_total_days(p))::int
      - floor((p_day - 1)::numeric * (select total from n) / plan_total_days(p))::int
    else greatest(0, least(p.chapters_per_day, (select total from n) - (p_day - 1) * p.chapters_per_day))
  end;
$$;

drop function if exists community_members_for(uuid);
create function community_members_for(p_community uuid)
returns table (user_id uuid, display_name text, avatar text, role text, status text, joined_at timestamptz,
               streak integer, days_read bigint, read_today boolean, last_read timestamptz,
               chapters_read bigint, next_day integer, behind integer, read_week boolean)
language sql stable security definer set search_path = public as $$
  with plan as (
    select r.id, r as rp, plan_total_days(r) as total, plan_days_due(r, (now() at time zone 'utc')::date) as due
    from reading_plans r
    where r.community_id = p_community and r.status <> 'done'
    order by r.created_at desc limit 1
  ),
  logs as (
    select l.user_id, l.day, l.done_at from reading_log l where l.plan_id = (select id from plan)
  )
  select m.user_id, p.display_name, p.avatar::text, m.role, m.status, m.joined_at, p.streak,
         (select count(*) from logs l where l.user_id = m.user_id),
         exists (select 1 from logs l where l.user_id = m.user_id and l.done_at >= date_trunc('day', now())),
         (select max(l.done_at) from logs l where l.user_id = m.user_id),
         coalesce((select sum(plan_day_chapters((select rp from plan), l.day)) from logs l where l.user_id = m.user_id), 0)::bigint,
         (select min(d) from generate_series(1, coalesce((select total from plan), 0)) d
          where not exists (select 1 from logs l where l.user_id = m.user_id and l.day = d)),
         coalesce((select (select due from plan) - count(*) from logs l where l.user_id = m.user_id and l.day <= (select due from plan)), 0)::int,
         exists (select 1 from logs l where l.user_id = m.user_id and l.done_at > now() - interval '7 days')
  from community_members m join profiles p on p.id = m.user_id
  where m.community_id = p_community
    and (is_community_member(p_community) or is_admin())
    and (m.status = 'active' or is_community_admin(p_community))
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, p.display_name;
$$;
revoke all on function community_members_for(uuid) from public, anon;
grant execute on function community_members_for(uuid) to authenticated;

-- One member's reading days, for the calendar in their sheet (small, on demand).
create or replace function member_reading_days(p_community uuid, p_user uuid, p_since timestamptz)
returns table (done_at timestamptz, day integer, plan_id uuid)
language sql stable security definer set search_path = public as $$
  select l.done_at, l.day::int, l.plan_id
  from reading_log l join reading_plans r on r.id = l.plan_id
  where r.community_id = p_community and l.user_id = p_user and l.done_at >= p_since
    and (is_community_member(p_community) or is_admin());
$$;
revoke all on function member_reading_days(uuid, uuid, timestamptz) from public, anon;
grant execute on function member_reading_days(uuid, uuid, timestamptz) to authenticated;

-- Live updates: the app listens for ticks and finished tasks in the groups it shows
-- (row-level security still decides who hears what).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'reading_log') then
      alter publication supabase_realtime add table reading_log;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'community_task_done') then
      alter publication supabase_realtime add table community_task_done;
    end if;
  end if;
end $$;
