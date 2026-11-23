-- Several reading plans at once in a group, and plans made of Tent of Testimony lessons.
--   reading_plans.tot_items: a plan that goes through tot.org.in messages or lessons
--     instead of Bible chapters (chapters_per_day is then "items a day").
--   community_plan_progress(): every member's progress in every current plan.
--   community_members_for(): read today / this week now count any current plan.
-- A day of a Tent of Testimony plan and its items in the library stay in step both ways.

alter table reading_plans add column if not exists tot_items integer[] not null default '{}';
alter table reading_plans drop constraint if exists reading_plans_books_check;
alter table reading_plans add constraint reading_plans_books_check
  check (cardinality(books) <= 66 and (cardinality(books) >= 1 or cardinality(tot_items) >= 1));
alter table reading_plans drop constraint if exists reading_plans_tot_items_check;
alter table reading_plans add constraint reading_plans_tot_items_check check (cardinality(tot_items) <= 1000);

-- How many reading days a plan has.
create or replace function plan_total_days(p reading_plans) returns integer
language sql stable set search_path = public as $$
  with n as (select coalesce(sum(chapters), 0)::int as chapters from bible_book_chapters where code = any(p.books))
  select greatest(1, case
    when cardinality(p.tot_items) > 0 then ceil(cardinality(p.tot_items)::numeric / greatest(1, coalesce(p.chapters_per_day, 1)))::int
    when p.days_total is not null then least(p.days_total, (select chapters from n))
    else ceil((select chapters from n)::numeric / greatest(1, p.chapters_per_day))::int end);
$$;

-- Chapters (or lessons) on one day of a plan.
create or replace function plan_day_chapters(p reading_plans, p_day integer) returns integer
language sql stable set search_path = public as $$
  with n as (select coalesce(sum(chapters), 0)::int as total from bible_book_chapters where code = any(p.books))
  select case
    when cardinality(p.tot_items) > 0 then cardinality(p.tot_items[(p_day - 1) * greatest(1, coalesce(p.chapters_per_day, 1)) + 1 : p_day * greatest(1, coalesce(p.chapters_per_day, 1))])
    when p.days_total is not null then
      floor(p_day::numeric * (select total from n) / plan_total_days(p))::int
      - floor((p_day - 1)::numeric * (select total from n) / plan_total_days(p))::int
    else greatest(0, least(p.chapters_per_day, (select total from n) - (p_day - 1) * p.chapters_per_day))
  end;
$$;

-- The lessons of one day of a Tent of Testimony plan.
create or replace function plan_day_items(p reading_plans, p_day integer) returns integer[]
language sql stable set search_path = public as $$
  select coalesce(p.tot_items[(p_day - 1) * greatest(1, coalesce(p.chapters_per_day, 1)) + 1 : p_day * greatest(1, coalesce(p.chapters_per_day, 1))], '{}');
$$;

-- Every member's progress in every current (not ended) plan of a group.
create or replace function community_plan_progress(p_community uuid)
returns table (plan_id uuid, user_id uuid, days_read bigint, units_read bigint, next_day integer, behind integer, read_today boolean, last_read timestamptz)
language sql stable security definer set search_path = public as $$
  with plans as (
    select r.id, r as rp, plan_total_days(r) as total, plan_days_due(r, (now() at time zone 'utc')::date) as due
    from reading_plans r where r.community_id = p_community and r.status <> 'done'
  ),
  people as (
    select m.user_id from community_members m where m.community_id = p_community and m.status = 'active'
  )
  select pl.id, pe.user_id,
         (select count(*) from reading_log l where l.plan_id = pl.id and l.user_id = pe.user_id),
         coalesce((select sum(plan_day_chapters(pl.rp, l.day)) from reading_log l where l.plan_id = pl.id and l.user_id = pe.user_id), 0)::bigint,
         (select min(d) from generate_series(1, pl.total) d
          where not exists (select 1 from reading_log l where l.plan_id = pl.id and l.user_id = pe.user_id and l.day = d)),
         (pl.due - (select count(*) from reading_log l where l.plan_id = pl.id and l.user_id = pe.user_id and l.day <= pl.due))::int,
         exists (select 1 from reading_log l where l.plan_id = pl.id and l.user_id = pe.user_id and l.done_at >= date_trunc('day', now())),
         (select max(l.done_at) from reading_log l where l.plan_id = pl.id and l.user_id = pe.user_id)
  from plans pl cross join people pe
  where is_community_member(p_community) or is_admin();
$$;
revoke all on function community_plan_progress(uuid) from public, anon;
grant execute on function community_plan_progress(uuid) to authenticated;

-- Members, with "read today / this week" across all current plans (the other columns
-- stay as before: the newest plan).
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
  ),
  anylog as (
    select l.user_id, l.done_at from reading_log l join reading_plans r on r.id = l.plan_id
    where r.community_id = p_community and r.status <> 'done'
  )
  select m.user_id, p.display_name, p.avatar::text, m.role, m.status, m.joined_at, p.streak,
         (select count(*) from logs l where l.user_id = m.user_id),
         exists (select 1 from anylog l where l.user_id = m.user_id and l.done_at >= date_trunc('day', now())),
         (select max(l.done_at) from anylog l where l.user_id = m.user_id),
         coalesce((select sum(plan_day_chapters((select rp from plan), l.day)) from logs l where l.user_id = m.user_id), 0)::bigint,
         (select min(d) from generate_series(1, coalesce((select total from plan), 0)) d
          where not exists (select 1 from logs l where l.user_id = m.user_id and l.day = d)),
         coalesce((select (select due from plan) - count(*) from logs l where l.user_id = m.user_id and l.day <= (select due from plan)), 0)::int,
         exists (select 1 from anylog l where l.user_id = m.user_id and l.done_at > now() - interval '7 days')
  from community_members m join profiles p on p.id = m.user_id
  where m.community_id = p_community
    and (is_community_member(p_community) or is_admin())
    and (m.status = 'active' or is_community_admin(p_community))
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, p.display_name;
$$;
revoke all on function community_members_for(uuid) from public, anon;
grant execute on function community_members_for(uuid) to authenticated;

-- A day ticked in a Tent of Testimony plan → its lessons finished in your library.
create or replace function plan_tick_marks_tot() returns trigger
language plpgsql security definer set search_path = public as $$
declare r reading_plans;
begin
  select * into r from reading_plans where id = new.plan_id;
  if r.id is null or cardinality(r.tot_items) = 0 then return new; end if;
  insert into tot_progress (user_id, item_id)
  select new.user_id, i from unnest(plan_day_items(r, new.day)) as i
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists reading_log_tot on reading_log;
create trigger reading_log_tot after insert on reading_log for each row execute function plan_tick_marks_tot();

-- A lesson finished in the library → that day ticked in your groups' Tent of Testimony
-- plans, once all of the day's lessons are finished (and not more than 2 days ahead).
create or replace function tot_done_ticks_plans() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r reading_plans;
  d integer;
  k integer;
begin
  for r in
    select rp.* from reading_plans rp
    join community_members m on m.community_id = rp.community_id and m.user_id = new.user_id and m.status = 'active'
    where rp.status <> 'done' and new.item_id = any(rp.tot_items)
  loop
    k := greatest(1, coalesce(r.chapters_per_day, 1));
    d := (array_position(r.tot_items, new.item_id) - 1) / k + 1;
    if d <= plan_days_due(r, (now() at time zone 'utc')::date + 1) + 2
       and not exists (select 1 from unnest(plan_day_items(r, d)) i
                       where not exists (select 1 from tot_progress t where t.user_id = new.user_id and t.item_id = i)) then
      insert into reading_log (plan_id, user_id, day) values (r.id, new.user_id, d) on conflict do nothing;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists tot_progress_plans on tot_progress;
create trigger tot_progress_plans after insert on tot_progress for each row execute function tot_done_ticks_plans();
