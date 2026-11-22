-- Reading plans: a pace by target length as well as chapters a day.
--   days_total: finish in this many reading days (the app spreads the chapters evenly);
--               when null, chapters_per_day sets the pace.
--   reading_order: 'canonical' (Bible order) or 'mixed' (Old and New Testament side by side).
alter table reading_plans add column if not exists days_total smallint check (days_total is null or days_total between 1 and 3650);
alter table reading_plans add column if not exists reading_order text not null default 'canonical' check (reading_order in ('canonical', 'mixed'));
alter table reading_plans alter column chapters_per_day drop not null;
alter table reading_plans drop constraint if exists reading_plans_pace_check;
alter table reading_plans add constraint reading_plans_pace_check check (chapters_per_day is not null or days_total is not null);
-- At least one reading day a week.
alter table reading_plans drop constraint if exists reading_plans_rest_days_check;
alter table reading_plans add constraint reading_plans_rest_days_check check (cardinality(rest_days) <= 6);
