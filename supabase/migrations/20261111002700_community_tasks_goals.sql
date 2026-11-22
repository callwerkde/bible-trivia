-- Community tasks, goals, reactions and the activity feed.
--   Tasks: an admin asks the group to do something, in the app or outside it
--          ("Read Psalm 23 before Sunday", "Listen to messages 1 and 2 at this link"):
--          kind (read / listen / watch / do), a preface, an optional link, verse, parts
--          and due date. Members tick off each part themselves (the app can't see
--          reading done elsewhere); the task is done when every part is (part 0 = whole).
--          Members discuss each task in its comments.
--   Goals: 'chapters' = read N chapters together by a date (any plan in the group);
--          'finish'   = everyone finishes the current plan by a date.
--          Progress is worked out by the app from the reading log.
--   Reactions: 🙏 ❤️ 👏 on someone's reading day or finished task.
--   community_feed(): the latest readings, finished tasks and joins, with reactions.

create table if not exists community_tasks (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  note         text not null default '' check (char_length(note) <= 500),
  ref          jsonb,
  kind         text not null default 'read' check (kind in ('read', 'listen', 'watch', 'do')),
  link         text check (link is null or (link ~* '^https?://' and char_length(link) <= 500)),
  parts        text[] not null default '{}' check (cardinality(parts) <= 10),
  due_on       date,
  created_by   uuid not null default auth.uid() references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists community_tasks_idx on community_tasks (community_id, created_at desc);
alter table community_tasks enable row level security;
drop policy if exists "tasks: members read" on community_tasks;
create policy "tasks: members read" on community_tasks for select to authenticated using (is_community_member(community_id) or is_admin());
drop policy if exists "tasks: admins write" on community_tasks;
create policy "tasks: admins write" on community_tasks for all to authenticated
  using (is_community_admin(community_id)) with check (is_community_admin(community_id));
grant select, insert, update, delete on community_tasks to authenticated;

create table if not exists community_task_done (
  task_id  uuid not null references community_tasks(id) on delete cascade,
  user_id  uuid not null default auth.uid() references profiles(id) on delete cascade,
  part     smallint not null default 0 check (part between 0 and 10),   -- 0 = the whole task
  done_at  timestamptz not null default now(),
  primary key (task_id, user_id, part)
);
alter table community_task_done enable row level security;
drop policy if exists "task done: members read" on community_task_done;
create policy "task done: members read" on community_task_done for select to authenticated
  using (exists (select 1 from community_tasks t where t.id = task_id and (is_community_member(t.community_id) or is_admin())));
drop policy if exists "task done: tick your own" on community_task_done;
create policy "task done: tick your own" on community_task_done for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from community_tasks t where t.id = task_id and is_community_member(t.community_id)));
drop policy if exists "task done: untick your own" on community_task_done;
create policy "task done: untick your own" on community_task_done for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on community_task_done to authenticated;

create table if not exists community_goals (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  kind         text not null check (kind in ('chapters', 'finish')),
  target       integer check (target is null or target between 1 and 100000),
  due_on       date not null,
  created_by   uuid not null default auth.uid() references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists community_goals_idx on community_goals (community_id, created_at desc);
alter table community_goals enable row level security;
drop policy if exists "goals: members read" on community_goals;
create policy "goals: members read" on community_goals for select to authenticated using (is_community_member(community_id) or is_admin());
drop policy if exists "goals: admins write" on community_goals;
create policy "goals: admins write" on community_goals for all to authenticated
  using (is_community_admin(community_id)) with check (is_community_admin(community_id));
grant select, insert, update, delete on community_goals to authenticated;

-- Reactions on a feed item: a reading day (kind 'read', key = plan:day) or a task (kind 'task', key = task id).
create table if not exists community_reactions (
  community_id uuid not null references communities(id) on delete cascade,
  target_user  uuid not null references profiles(id) on delete cascade,
  item         text not null check (char_length(item) <= 80),
  from_user    uuid not null default auth.uid() references profiles(id) on delete cascade,
  emoji        text not null check (emoji in ('pray', 'heart', 'clap')),
  created_at   timestamptz not null default now(),
  primary key (community_id, target_user, item, from_user, emoji)
);
alter table community_reactions enable row level security;
drop policy if exists "reactions: members read" on community_reactions;
create policy "reactions: members read" on community_reactions for select to authenticated using (is_community_member(community_id) or is_admin());
drop policy if exists "reactions: react as yourself" on community_reactions;
create policy "reactions: react as yourself" on community_reactions for insert to authenticated
  with check (from_user = auth.uid() and is_community_member(community_id)
              and exists (select 1 from community_members m where m.community_id = community_reactions.community_id and m.user_id = target_user and m.status = 'active'));
drop policy if exists "reactions: take back your own" on community_reactions;
create policy "reactions: take back your own" on community_reactions for delete to authenticated using (from_user = auth.uid());
grant select, insert, delete on community_reactions to authenticated;

-- The activity feed: newest first. Each row has who, what, when and its reactions.
create or replace function community_feed(p_community uuid, p_limit integer default 40)
returns table (kind text, user_id uuid, display_name text, avatar text, at timestamptz, item text,
               plan_title text, day integer, task_title text, reactions jsonb)
language sql stable security definer set search_path = public as $$
  with events as (
    select 'read'::text as kind, l.user_id, l.done_at as at, (l.plan_id || ':' || l.day) as item,
           rp.title as plan_title, l.day::int as day, null::text as task_title
    from reading_log l join reading_plans rp on rp.id = l.plan_id
    where rp.community_id = p_community
    union all
    select 'task', d.user_id, d.done_at, d.task_id::text, null, null, t.title
    from community_task_done d join community_tasks t on t.id = d.task_id
    where t.community_id = p_community and d.part = 0
    union all
    select 'joined', m.user_id, m.joined_at, 'joined', null, null, null
    from community_members m where m.community_id = p_community and m.status = 'active'
  )
  select e.kind, e.user_id, p.display_name, p.avatar::text, e.at, e.item, e.plan_title, e.day, e.task_title,
         coalesce((select jsonb_agg(jsonb_build_object('emoji', r.emoji, 'mine', r.from_user = auth.uid(), 'name', fp.display_name))
                   from community_reactions r join profiles fp on fp.id = r.from_user
                   where r.community_id = p_community and r.target_user = e.user_id and r.item = e.item), '[]'::jsonb)
  from events e join profiles p on p.id = e.user_id
  where is_community_member(p_community) or is_admin()
  order by e.at desc
  limit least(greatest(p_limit, 1), 100);
$$;
revoke all on function community_feed(uuid, integer) from public, anon;
grant execute on function community_feed(uuid, integer) to authenticated;

-- ---------- task comments ----------
create table if not exists community_task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references community_tasks(id) on delete cascade,
  user_id    uuid not null default auth.uid() references profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists community_task_comments_idx on community_task_comments (task_id, created_at);
alter table community_task_comments enable row level security;
drop policy if exists "task comments: members read" on community_task_comments;
create policy "task comments: members read" on community_task_comments for select to authenticated
  using (exists (select 1 from community_tasks t where t.id = task_id and (is_community_member(t.community_id) or is_admin())));
drop policy if exists "task comments: write as yourself" on community_task_comments;
create policy "task comments: write as yourself" on community_task_comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from community_tasks t where t.id = task_id and is_community_member(t.community_id)));
drop policy if exists "task comments: delete own or group admin" on community_task_comments;
create policy "task comments: delete own or group admin" on community_task_comments for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from community_tasks t where t.id = task_id and is_community_admin(t.community_id)));
grant select, insert, delete on community_task_comments to authenticated;

-- At most 10 comments a minute per person.
create or replace function limit_task_comments() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from community_task_comments where user_id = new.user_id and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'too many comments, wait a minute' using errcode = 'P0001';
  end if;
  new.body := btrim(new.body);
  return new;
end $$;
drop trigger if exists community_task_comments_limit on community_task_comments;
create trigger community_task_comments_limit before insert on community_task_comments
  for each row execute function limit_task_comments();

create or replace function task_comments_for(p_task uuid)
returns table (id uuid, body text, created_at timestamptz, user_id uuid, display_name text, avatar text, mine boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.body, c.created_at, c.user_id, p.display_name, p.avatar::text, c.user_id = auth.uid()
  from community_task_comments c join profiles p on p.id = c.user_id
  join community_tasks t on t.id = c.task_id
  where c.task_id = p_task and (is_community_member(t.community_id) or is_admin())
  order by c.created_at;
$$;
revoke all on function task_comments_for(uuid) from public, anon;
grant execute on function task_comments_for(uuid) to authenticated;

-- Tell the group about a new task (members with reminders on, not the person who added it).
alter table notification_queue drop constraint if exists notification_queue_kind_check;
alter table notification_queue add constraint notification_queue_kind_check
  check (kind in ('daily_verse', 'daily_reminder', 'streak_rescue', 'daily_thought',
                  'friend_request', 'friend_accepted', 'friend_added',
                  'challenge_received', 'challenge_finished', 'timeline_reviewed',
                  'community_joined', 'reading_reminder', 'community_nudge', 'community_weekly', 'community_task'));
create or replace function queue_task_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notification_queue (user_id, kind, payload)
  select m.user_id, 'community_task',
         jsonb_build_object('community', new.community_id, 'community_name', c.name, 'title', new.title,
                            'kind', new.kind, 'due_on', new.due_on, 'task', new.id)
  from community_members m join communities c on c.id = m.community_id
  left join notification_prefs np on np.user_id = m.user_id
  where m.community_id = new.community_id and m.status = 'active' and m.user_id <> new.created_by
    and coalesce(np.daily_reminder, true);
  return new;
end $$;
drop trigger if exists community_tasks_push on community_tasks;
create trigger community_tasks_push after insert on community_tasks for each row execute function queue_task_push();

-- The Report button works on task comments too.
alter table question_reports drop constraint if exists question_reports_kind_check;
alter table question_reports add constraint question_reports_kind_check
  check (kind in ('question', 'recall', 'verse', 'faq', 'gospel', 'post', 'comment', 'timeline', 'task_comment'));
