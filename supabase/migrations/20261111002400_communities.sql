-- Communities: groups that read the Bible together.
--   Anyone signed in can create one (they become its owner) and join several.
--   Roles: owner (one), admin, member. Owner and admins invite, remove members,
--   make plans; members read and tick off their chapters. Everyone in a community
--   sees everyone's progress there.
--   Joining is by an 8-letter code (in the invite link /?join=CODE); a community can
--   ask for an admin's approval first.
-- Reading plans: books in order, N chapters a day from a start date (rest days
-- optional); the day-by-day schedule is worked out by the app. reading_log holds
-- who finished which day.

create table if not exists communities (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(btrim(name)) between 1 and 60),
  description      text not null default '' check (char_length(description) <= 300),
  color            text not null default 'teal' check (color in ('teal', 'blue', 'green', 'orange', 'red', 'purple', 'pink', 'brown')),
  invite_code      text not null unique,
  needs_approval   boolean not null default false,
  created_by       uuid not null default auth.uid() references profiles(id) on delete cascade,
  created_at       timestamptz not null default now()
);

create table if not exists community_members (
  community_id uuid not null references communities(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status       text not null default 'active' check (status in ('active', 'pending')),
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_members_user_idx on community_members (user_id);

-- Helpers (security definer so policies don't recurse through community_members).
create or replace function is_community_member(p_community uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from community_members
                 where community_id = p_community and user_id = auth.uid() and status = 'active');
$$;
create or replace function is_community_admin(p_community uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from community_members
                 where community_id = p_community and user_id = auth.uid() and status = 'active'
                   and role in ('owner', 'admin'))
      or is_admin();
$$;
revoke all on function is_community_member(uuid), is_community_admin(uuid) from public, anon;
grant execute on function is_community_member(uuid), is_community_admin(uuid) to authenticated;

alter table communities enable row level security;
drop policy if exists "communities: members read" on communities;
create policy "communities: members read" on communities for select to authenticated
  using (is_community_member(id) or is_admin());
drop policy if exists "communities: admins edit" on communities;
create policy "communities: admins edit" on communities for update to authenticated
  using (is_community_admin(id)) with check (is_community_admin(id));
drop policy if exists "communities: owner deletes" on communities;
create policy "communities: owner deletes" on communities for delete to authenticated
  using (exists (select 1 from community_members m where m.community_id = id and m.user_id = auth.uid() and m.role = 'owner') or is_admin());
grant select, update, delete on communities to authenticated;
-- Created through create_community() only (it also makes you the owner).

alter table community_members enable row level security;
drop policy if exists "community members: members read" on community_members;
create policy "community members: members read" on community_members for select to authenticated
  using (is_community_member(community_id) or user_id = auth.uid() or is_admin());
grant select on community_members to authenticated;
-- Joining, leaving, roles and removals go through the functions below.

-- The invite code: 8 letters/digits without look-alikes (no 0/O, 1/I/L).
create or replace function new_community_code() returns text
language plpgsql as $$
declare chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text;
begin
  loop
    c := '';
    for i in 1..8 loop c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from communities where invite_code = c);
  end loop;
  return c;
end $$;

create or replace function create_community(p_name text, p_description text default '', p_color text default 'teal')
returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'signed out'; end if;
  if (select count(*) from communities where created_by = me and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too many communities today' using errcode = 'P0001';
  end if;
  insert into communities (name, description, color, invite_code, created_by)
  values (btrim(p_name), coalesce(btrim(p_description), ''), coalesce(p_color, 'teal'), new_community_code(), me)
  returning id into cid;
  insert into community_members (community_id, user_id, role, status) values (cid, me, 'owner', 'active');
  return cid;
end $$;

-- What an invite link points at, before joining (name and size only).
create or replace function community_preview(p_code text)
returns table (id uuid, name text, description text, color text, members bigint, needs_approval boolean, already text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.description, c.color,
         (select count(*) from community_members m where m.community_id = c.id and m.status = 'active'),
         c.needs_approval,
         (select m.status from community_members m where m.community_id = c.id and m.user_id = auth.uid())
  from communities c where c.invite_code = upper(btrim(p_code)) and auth.uid() is not null;
$$;

-- Join with a code: 'joined', 'pending' (waiting for an admin), 'already', or 'not_found'.
create or replace function join_community(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c communities; existing community_members;
begin
  if me is null then return jsonb_build_object('status', 'signed_out'); end if;
  select * into c from communities where invite_code = upper(btrim(p_code));
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  select * into existing from community_members where community_id = c.id and user_id = me;
  if found then return jsonb_build_object('status', case when existing.status = 'pending' then 'pending' else 'already' end, 'id', c.id); end if;
  insert into community_members (community_id, user_id, role, status)
  values (c.id, me, 'member', case when c.needs_approval then 'pending' else 'active' end);
  -- Tell the admins.
  insert into notification_queue (user_id, kind, payload)
  select m.user_id, 'community_joined',
         jsonb_build_object('community', c.id, 'community_name', c.name, 'name', p.display_name, 'pending', c.needs_approval)
  from community_members m, profiles p
  where m.community_id = c.id and m.role in ('owner', 'admin') and m.status = 'active' and p.id = me;
  return jsonb_build_object('status', case when c.needs_approval then 'pending' else 'joined' end, 'id', c.id);
end $$;

create or replace function reset_community_code(p_community uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_community_admin(p_community) then raise exception 'not allowed'; end if;
  c := new_community_code();
  update communities set invite_code = c where id = p_community;
  return c;
end $$;

-- Admins: approve, make admin / member, remove. The owner can't be changed or removed.
create or replace function manage_member(p_community uuid, p_user uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare target community_members;
begin
  if not is_community_admin(p_community) then raise exception 'not allowed'; end if;
  select * into target from community_members where community_id = p_community and user_id = p_user;
  if not found then return; end if;
  if target.role = 'owner' then raise exception 'the owner cannot be changed'; end if;
  if p_action = 'approve' then update community_members set status = 'active' where community_id = p_community and user_id = p_user;
  elsif p_action = 'make_admin' then update community_members set role = 'admin' where community_id = p_community and user_id = p_user;
  elsif p_action = 'make_member' then update community_members set role = 'member' where community_id = p_community and user_id = p_user;
  elsif p_action = 'remove' then delete from community_members where community_id = p_community and user_id = p_user;
  else raise exception 'unknown action %', p_action;
  end if;
end $$;

-- Leave a community. The owner has to hand it over first (or delete it).
create or replace function leave_community(p_community uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from community_members where community_id = p_community and user_id = auth.uid() and role = 'owner') then
    raise exception 'owner cannot leave';
  end if;
  delete from community_members where community_id = p_community and user_id = auth.uid();
end $$;

-- ---------- Reading plans ----------
create table if not exists reading_plans (
  id               uuid primary key default gen_random_uuid(),
  community_id     uuid not null references communities(id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 1 and 80),
  books            text[] not null check (cardinality(books) between 1 and 66),
  chapters_per_day smallint not null check (chapters_per_day between 1 and 20),
  start_date       date not null,
  rest_days        smallint[] not null default '{}',   -- 0 = Sunday … 6 = Saturday
  status           text not null default 'active' check (status in ('active', 'paused', 'done')),
  created_by       uuid not null default auth.uid() references profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists reading_plans_community_idx on reading_plans (community_id, created_at desc);
alter table reading_plans enable row level security;
drop policy if exists "reading plans: members read" on reading_plans;
create policy "reading plans: members read" on reading_plans for select to authenticated
  using (is_community_member(community_id) or is_admin());
drop policy if exists "reading plans: admins write" on reading_plans;
create policy "reading plans: admins write" on reading_plans for all to authenticated
  using (is_community_admin(community_id)) with check (is_community_admin(community_id));
grant select, insert, update, delete on reading_plans to authenticated;

create table if not exists reading_log (
  plan_id  uuid not null references reading_plans(id) on delete cascade,
  user_id  uuid not null default auth.uid() references profiles(id) on delete cascade,
  day      smallint not null check (day >= 1),
  done_at  timestamptz not null default now(),
  primary key (plan_id, user_id, day)
);
create index if not exists reading_log_user_idx on reading_log (user_id, done_at desc);
alter table reading_log enable row level security;
drop policy if exists "reading log: community reads" on reading_log;
create policy "reading log: community reads" on reading_log for select to authenticated
  using (exists (select 1 from reading_plans r where r.id = plan_id and (is_community_member(r.community_id) or is_admin())));
drop policy if exists "reading log: tick your own" on reading_log;
create policy "reading log: tick your own" on reading_log for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from reading_plans r where r.id = plan_id and is_community_member(r.community_id)));
drop policy if exists "reading log: untick your own" on reading_log;
create policy "reading log: untick your own" on reading_log for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on reading_log to authenticated;

-- Members with names, roles and (for the active plan) how many days they've read.
create or replace function community_members_for(p_community uuid)
returns table (user_id uuid, display_name text, avatar text, role text, status text, joined_at timestamptz,
               streak integer, days_read bigint, read_today boolean, last_read timestamptz)
language sql stable security definer set search_path = public as $$
  with plan as (
    select id from reading_plans where community_id = p_community and status = 'active'
    order by created_at desc limit 1
  )
  select m.user_id, p.display_name, p.avatar::text, m.role, m.status, m.joined_at, p.streak,
         (select count(*) from reading_log l where l.plan_id = (select id from plan) and l.user_id = m.user_id),
         exists (select 1 from reading_log l where l.plan_id = (select id from plan) and l.user_id = m.user_id
                 and l.done_at >= date_trunc('day', now())),
         (select max(l.done_at) from reading_log l where l.plan_id = (select id from plan) and l.user_id = m.user_id)
  from community_members m join profiles p on p.id = m.user_id
  where m.community_id = p_community
    and (is_community_member(p_community) or is_admin())
    and (m.status = 'active' or is_community_admin(p_community))
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, p.display_name;
$$;

revoke all on function create_community(text, text, text), community_preview(text), join_community(text),
  reset_community_code(uuid), community_members_for(uuid), manage_member(uuid, uuid, text), leave_community(uuid),
  new_community_code() from public, anon;
grant execute on function create_community(text, text, text), community_preview(text), join_community(text),
  reset_community_code(uuid), community_members_for(uuid), manage_member(uuid, uuid, text), leave_community(uuid)
  to authenticated;

-- Notifications for communities (the push function words them).
alter table notification_queue drop constraint if exists notification_queue_kind_check;
alter table notification_queue add constraint notification_queue_kind_check
  check (kind in ('daily_verse', 'daily_reminder', 'streak_rescue', 'daily_thought',
                  'friend_request', 'friend_accepted', 'friend_added',
                  'challenge_received', 'challenge_finished', 'timeline_reviewed',
                  'community_joined', 'reading_reminder', 'community_nudge'));
