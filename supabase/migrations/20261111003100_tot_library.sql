-- The Tent of Testimony (tot.org.in) library: which messages and lessons each person
-- has finished, and group tasks made from the library.
--   tot_progress: one row per finished item (item = the number in its tot.org.in link).
--   community_tasks.tot_items: the library items a task is made of, in the order of its
--     parts (a task with one item and no parts uses part 0).
-- Ticks stay in step both ways: ticking a part of such a task marks that item finished
-- in your library, and finishing an item in the library ticks it in your groups' tasks.

create table if not exists tot_progress (
  user_id  uuid not null default auth.uid() references profiles(id) on delete cascade,
  item_id  integer not null check (item_id > 0),
  done_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table tot_progress enable row level security;
drop policy if exists "tot progress: your own" on tot_progress;
create policy "tot progress: your own" on tot_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on tot_progress to authenticated;

alter table community_tasks add column if not exists tot_items integer[] not null default '{}';
alter table community_tasks drop constraint if exists community_tasks_tot_items_check;
alter table community_tasks add constraint community_tasks_tot_items_check check (cardinality(tot_items) <= 10);

-- Finished in the library → ticked in your groups' tasks that include it.
create or replace function tot_done_ticks_tasks() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t record;
  p integer;
begin
  for t in
    select ct.id, ct.parts, ct.tot_items from community_tasks ct
    join community_members m on m.community_id = ct.community_id and m.user_id = new.user_id and m.status = 'active'
    where new.item_id = any(ct.tot_items)
  loop
    p := case when cardinality(t.parts) = 0 then 0 else array_position(t.tot_items, new.item_id) end;
    insert into community_task_done (task_id, user_id, part) values (t.id, new.user_id, p) on conflict do nothing;
    -- Every part ticked: the whole task is done.
    if cardinality(t.parts) > 0 and (select count(distinct d.part) from community_task_done d
        where d.task_id = t.id and d.user_id = new.user_id and d.part between 1 and cardinality(t.parts)) = cardinality(t.parts) then
      insert into community_task_done (task_id, user_id, part) values (t.id, new.user_id, 0) on conflict do nothing;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists tot_progress_ticks on tot_progress;
create trigger tot_progress_ticks after insert on tot_progress for each row execute function tot_done_ticks_tasks();

-- Ticked in a task → finished in your library.
create or replace function task_tick_marks_tot() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t record;
  item integer;
begin
  select ct.parts, ct.tot_items into t from community_tasks ct where ct.id = new.task_id;
  if t is null or cardinality(t.tot_items) = 0 then return new; end if;
  item := case
    when new.part > 0 then t.tot_items[new.part]
    when cardinality(t.parts) = 0 then t.tot_items[1]
  end;
  if item is not null then
    insert into tot_progress (user_id, item_id) values (new.user_id, item) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists community_task_done_tot on community_task_done;
create trigger community_task_done_tot after insert on community_task_done for each row execute function task_tick_marks_tot();
