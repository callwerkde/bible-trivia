-- Community polish: reminders the evening before a task is due.
-- (queue_community_notifications is the 0026 version plus the task-deadline part.)

alter table notification_queue drop constraint if exists notification_queue_kind_check;
alter table notification_queue add constraint notification_queue_kind_check
  check (kind in ('daily_verse', 'daily_reminder', 'streak_rescue', 'daily_thought',
                  'friend_request', 'friend_accepted', 'friend_added',
                  'challenge_received', 'challenge_finished', 'timeline_reviewed',
                  'community_joined', 'reading_reminder', 'community_nudge', 'community_weekly', 'community_task', 'task_due'));

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
  queued := queued + n;

  -- Task deadlines: the evening before a task is due (their evening reminder time),
  -- to members who haven't finished it. Once per task.
  with people as (
    select np.user_id, (p_now at time zone np.time_zone)::date as local_day
    from notification_prefs np
    where np.daily_reminder
      and extract(hour from (p_now at time zone np.time_zone)) = np.reminder_hour
      and extract(minute from (p_now at time zone np.time_zone)) < 30
      and exists (select 1 from push_subscriptions ps where ps.user_id = np.user_id)
  ),
  due as (
    select pe.user_id, pe.local_day, 'taskdue:' || t.id as log_kind,
           jsonb_build_object('task', t.id, 'title', t.title, 'kind', t.kind, 'community', c.id, 'community_name', c.name) as payload
    from people pe
    join community_members m on m.user_id = pe.user_id and m.status = 'active'
    join communities c on c.id = m.community_id
    join community_tasks t on t.community_id = c.id
    where t.due_on = pe.local_day + 1
      and not exists (select 1 from community_task_done d where d.task_id = t.id and d.user_id = pe.user_id and d.part = 0)
  ),
  logged as (
    insert into notification_log (user_id, kind, day)
    select user_id, log_kind, local_day from due
    on conflict do nothing
    returning user_id, kind
  )
  insert into notification_queue (user_id, kind, payload)
  select d.user_id, 'task_due', d.payload from due d join logged l on l.user_id = d.user_id and l.kind = d.log_kind;
  get diagnostics n = row_count;
  return queued + n;
end $$;
revoke all on function queue_community_notifications(timestamptz) from public, anon, authenticated;
grant execute on function queue_community_notifications(timestamptz) to service_role;
