-- Kids: what a child has done (finished picture stories, learned verses, coloured pictures).
-- Kept on the phone while they play, and saved here at most once a day when something
-- changed: one row per person, written in one go.

create table if not exists kids_progress (
  user_id    uuid primary key default auth.uid() references profiles(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb check (pg_column_size(data) < 200000),
  updated_at timestamptz not null default now()
);
alter table kids_progress enable row level security;
drop policy if exists "kids progress: your own" on kids_progress;
create policy "kids progress: your own" on kids_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on kids_progress to authenticated;
