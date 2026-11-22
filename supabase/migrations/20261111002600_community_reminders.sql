-- Community reminders:
--   * Reading reminder: at the same times as the streak reminders (morning / afternoon /
--     evening, the "Daily reminder" setting). On a reading day, if a member hasn't read
--     today and a day is waiting, that reminder is about the reading instead (reading also
--     keeps the streak). It takes the streak reminder's slot in notification_log, so the
--     two never both arrive. One per slot, however many groups.
--   * Encourage: an admin nudges a member who is behind (once a day per member and group).
--   * Weekly summary: Sunday 6 pm to owners and admins, how the group read this week.
-- queue_community_notifications() runs with the other scheduled ones (the push function calls both).


alter table notification_queue drop constraint if exists notification_queue_kind_check;
alter table notification_queue add constraint notification_queue_kind_check
  check (kind in ('daily_verse', 'daily_reminder', 'streak_rescue', 'daily_thought',
                  'friend_request', 'friend_accepted', 'friend_added',
                  'challenge_received', 'challenge_finished', 'timeline_reviewed',
                  'community_joined', 'reading_reminder', 'community_nudge', 'community_weekly'));

-- Chapters in each book, so a plan's length can be worked out here too.
create table if not exists bible_book_chapters (code text primary key, chapters smallint not null);
insert into bible_book_chapters (code, chapters) values
  ('GEN', 50),
  ('EXO', 40),
  ('LEV', 27),
  ('NUM', 36),
  ('DEU', 34),
  ('JOS', 24),
  ('JDG', 21),
  ('RUT', 4),
  ('1SA', 31),
  ('2SA', 24),
  ('1KI', 22),
  ('2KI', 25),
  ('1CH', 29),
  ('2CH', 36),
  ('EZR', 10),
  ('NEH', 13),
  ('EST', 10),
  ('JOB', 42),
  ('PSA', 150),
  ('PRO', 31),
  ('ECC', 12),
  ('SNG', 8),
  ('ISA', 66),
  ('JER', 52),
  ('LAM', 5),
  ('EZK', 48),
  ('DAN', 12),
  ('HOS', 14),
  ('JOL', 3),
  ('AMO', 9),
  ('OBA', 1),
  ('JON', 4),
  ('MIC', 7),
  ('NAM', 3),
  ('HAB', 3),
  ('ZEP', 3),
  ('HAG', 2),
  ('ZEC', 14),
  ('MAL', 4),
  ('MAT', 28),
  ('MRK', 16),
  ('LUK', 24),
  ('JHN', 21),
  ('ACT', 28),
  ('ROM', 16),
  ('1CO', 16),
  ('2CO', 13),
  ('GAL', 6),
  ('EPH', 6),
  ('PHP', 4),
  ('COL', 4),
  ('1TH', 5),
  ('2TH', 3),
  ('1TI', 6),
  ('2TI', 4),
  ('TIT', 3),
  ('PHM', 1),
  ('HEB', 13),
  ('JAS', 5),
  ('1PE', 5),
  ('2PE', 3),
  ('1JN', 5),
  ('2JN', 1),
  ('3JN', 1),
  ('JUD', 1),
  ('REV', 22)
on conflict (code) do update set chapters = excluded.chapters;
alter table bible_book_chapters enable row level security;
drop policy if exists "bible books: read" on bible_book_chapters;
create policy "bible books: read" on bible_book_chapters for select using (true);
grant select on bible_book_chapters to anon, authenticated;

-- How many reading days a plan has.
create or replace function plan_total_days(p reading_plans) returns integer
language sql stable set search_path = public as $$
  with n as (select coalesce(sum(chapters), 0)::int as chapters from bible_book_chapters where code = any(p.books))
  select greatest(1, case when p.days_total is not null then least(p.days_total, (select chapters from n))
                          else ceil((select chapters from n)::numeric / greatest(1, p.chapters_per_day))::int end);
$$;

-- Reading days that have come round by a date (capped at the plan's length).
create or replace function plan_days_due(p reading_plans, p_on date) returns integer
language sql stable set search_path = public as $$
  select case when p_on < p.start_date then 0 else least(plan_total_days(p), (
    select count(*)::int from generate_series(p.start_date, p_on, interval '1 day') d
    where not (extract(dow from d)::smallint = any(p.rest_days)))) end;
$$;

create or replace function queue_community_notifications(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = public as $$
declare queued integer := 0; n integer;
begin
  -- Reading reminders.
  with people as (
    select np.user_id, s.slot, (p_now at time zone np.time_zone) as local_now,
           (p_now at time zone np.time_zone)::date as local_day
    from notification_prefs np
    cross join lateral (values ('am', np.morning_hour), ('noon', np.afternoon_hour), ('pm', np.reminder_hour)) as s(slot, hour)
    where np.daily_reminder
      and extract(hour from (p_now at time zone np.time_zone)) = s.hour
      and extract(minute from (p_now at time zone np.time_zone)) < 30
      and exists (select 1 from push_subscriptions ps where ps.user_id = np.user_id)
  ),
  waiting as (
    -- each active plan in each of their groups, with what's due and what they've read
    select pe.user_id, pe.slot, pe.local_day, rp.id as plan_id, rp.title, c.name as community_name,
           plan_days_due(rp, pe.local_day) as due,
           (select count(*) from reading_log l where l.plan_id = rp.id and l.user_id = pe.user_id and l.day <= plan_days_due(rp, pe.local_day)) as done_due,
           exists (select 1 from reading_log l where l.plan_id = rp.id and l.user_id = pe.user_id
                   and (l.done_at at time zone (select time_zone from notification_prefs where user_id = pe.user_id))::date = pe.local_day) as read_today,
           extract(dow from pe.local_day)::smallint = any(rp.rest_days) as rest_today
    from people pe
    join community_members m on m.user_id = pe.user_id and m.status = 'active'
    join communities c on c.id = m.community_id
    join reading_plans rp on rp.community_id = c.id and rp.status = 'active'
  ),
  due as (
    select distinct on (w.user_id) w.user_id, w.local_day, 'reminder_' || w.slot as log_kind,
           jsonb_build_object('slot', w.slot, 'streak', (select streak from profiles where id = w.user_id), 'plan', w.plan_id, 'title', w.title, 'community_name', w.community_name,
                              'behind', w.due - w.done_due, 'day', w.done_due + 1) as payload
    from waiting w
    where w.due > w.done_due and not w.read_today and not w.rest_today
    order by w.user_id, (w.due - w.done_due) desc
  ),
  logged as (
    -- the streak reminder's own slot: whichever is queued first wins, so only one arrives
    insert into notification_log (user_id, kind, day)
    select user_id, log_kind, local_day from due
    on conflict do nothing
    returning user_id
  )
  insert into notification_queue (user_id, kind, payload)
  select d.user_id, 'reading_reminder', d.payload from due d join logged l on l.user_id = d.user_id;
  get diagnostics n = row_count;
  queued := queued + n;

  -- Weekly summary for owners and admins: Sunday, 6 pm their time.
  with admins as (
    select m.user_id, m.community_id, c.name, (p_now at time zone np.time_zone) as local_now,
           (p_now at time zone np.time_zone)::date as local_day
    from community_members m
    join communities c on c.id = m.community_id
    join notification_prefs np on np.user_id = m.user_id
    where m.role in ('owner', 'admin') and m.status = 'active' and np.daily_reminder
      and exists (select 1 from push_subscriptions s where s.user_id = m.user_id)
  ),
  due as (
    select a.user_id, a.local_day, 'weekly:' || a.community_id as log_kind,
           jsonb_build_object('community', a.community_id, 'community_name', a.name,
             'members', (select count(*) from community_members x where x.community_id = a.community_id and x.status = 'active'),
             'readers', (select count(distinct l.user_id) from reading_log l join reading_plans rp on rp.id = l.plan_id
                         where rp.community_id = a.community_id and l.done_at > p_now - interval '7 days'),
             'steady', (select count(*) from (select l.user_id from reading_log l join reading_plans rp on rp.id = l.plan_id
                         where rp.community_id = a.community_id and l.done_at > p_now - interval '7 days'
                         group by l.user_id having count(*) >= 5) s)) as payload
    from admins a
    where extract(dow from a.local_now) = 0 and extract(hour from a.local_now) = 18 and extract(minute from a.local_now) < 30
      and exists (select 1 from reading_plans rp where rp.community_id = a.community_id and rp.status = 'active')
  ),
  logged as (
    insert into notification_log (user_id, kind, day)
    select user_id, log_kind, local_day from due
    on conflict do nothing
    returning user_id, kind
  )
  insert into notification_queue (user_id, kind, payload)
  select d.user_id, 'community_weekly', d.payload from due d join logged l on l.user_id = d.user_id and l.kind = d.log_kind;
  get diagnostics n = row_count;
  return queued + n;
end $$;
revoke all on function queue_community_notifications(timestamptz) from public, anon, authenticated;
grant execute on function queue_community_notifications(timestamptz) to service_role;

-- Encourage a member who is behind: 'sent', or 'already' (once a day per member and group).
create or replace function nudge_member(p_community uuid, p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c_name text; my_name text;
begin
  if not is_community_admin(p_community) then raise exception 'not allowed'; end if;
  if p_user = me or not exists (select 1 from community_members where community_id = p_community and user_id = p_user and status = 'active') then
    return 'not_member';
  end if;
  insert into notification_log (user_id, kind, day) values (p_user, 'nudge:' || p_community, current_date)
  on conflict do nothing;
  if not found then return 'already'; end if;
  select name into c_name from communities where id = p_community;
  select display_name into my_name from profiles where id = me;
  insert into notification_queue (user_id, kind, payload)
  values (p_user, 'community_nudge', jsonb_build_object('community', p_community, 'community_name', c_name, 'name', my_name));
  return 'sent';
end $$;
revoke all on function nudge_member(uuid, uuid) from public, anon;
grant execute on function nudge_member(uuid, uuid) to authenticated;
