import { supabase } from './supabase';
import { useAccount, sendPendingPushes } from './account';
import { chaptersFor, daysDue, totalDays, type PlanSpec } from '../engine/readingPlan';

/*
 * Communities and their reading plans (tables communities, community_members,
 * reading_plans, reading_log). Everything needs a signed-in member; the database
 * decides who may do what (see supabase/migrations/…_communities.sql).
 */

export type Role = 'owner' | 'admin' | 'member';
export interface Community {
  id: string;
  name: string;
  description: string;
  color: string;
  invite_code: string;
  needs_approval: boolean;
  created_by: string;
  /** Your role here. */
  role: Role;
}
export interface Member {
  user_id: string;
  display_name: string;
  avatar: string;
  role: Role;
  status: 'active' | 'pending';
  joined_at: string;
  streak: number;
  days_read: number;
  read_today: boolean;
  last_read: string | null;
  /** Their progress in the current plan, worked out by the database. */
  chapters_read: number;
  /** Their first unread day (null when finished). */
  next_day: number | null;
  /** Reading days that have come round but aren't read. */
  behind: number;
  /** Read anything in the last 7 days. */
  read_week: boolean;
}
export interface Plan extends PlanSpec {
  id: string;
  community_id: string;
  title: string;
  status: 'active' | 'paused' | 'done';
  created_at: string;
}

const me = () => useAccount.getState().session?.user.id;
const need = () => {
  if (!supabase || !me()) throw new Error('signed out');
  return supabase;
};

/** The communities you belong to (active), with your role, newest first. */
export async function myCommunities(): Promise<Community[] | null> {
  if (!supabase || !me()) return null;
  const { data, error } = await supabase
    .from('community_members')
    .select('role, status, communities(id, name, description, color, invite_code, needs_approval, created_by)')
    .eq('user_id', me()!)
    .eq('status', 'active')
    .order('joined_at', { ascending: false });
  if (error) return null;
  return (data as unknown as { role: Role; communities: Omit<Community, 'role'> }[])
    .filter((r) => r.communities)
    .map((r) => ({ ...r.communities, role: r.role }));
}

export async function createCommunity(name: string, description: string, color: string): Promise<string> {
  const { data, error } = await need().rpc('create_community', { p_name: name, p_description: description, p_color: color });
  if (error) throw error;
  return data as string;
}

export async function updateCommunity(id: string, patch: Partial<Pick<Community, 'name' | 'description' | 'color' | 'needs_approval'>>) {
  const { error } = await need().from('communities').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteCommunity(id: string) {
  const { error } = await need().from('communities').delete().eq('id', id);
  if (error) throw error;
}

export interface Preview {
  id: string;
  name: string;
  description: string;
  color: string;
  members: number;
  needs_approval: boolean;
  already: 'active' | 'pending' | null;
}
export async function previewCommunity(code: string): Promise<Preview | null> {
  const { data, error } = await need().rpc('community_preview', { p_code: code });
  if (error) throw error;
  return ((data as Preview[]) ?? [])[0] ?? null;
}

export type JoinResult = { status: 'joined' | 'pending' | 'already' | 'not_found' | 'signed_out'; id?: string };
export async function joinCommunity(code: string): Promise<JoinResult> {
  const { data, error } = await need().rpc('join_community', { p_code: code });
  if (error) throw error;
  sendPendingPushes();
  return data as JoinResult;
}

export async function resetCode(id: string): Promise<string> {
  const { data, error } = await need().rpc('reset_community_code', { p_community: id });
  if (error) throw error;
  return data as string;
}

/** The members with their progress in the current plan. The database works the progress
 *  out; before that update is on the server, the app works it out from the reading log. */
export async function members(id: string, current?: Plan | null | Promise<Plan | null>): Promise<Member[]> {
  const { data, error } = await need().rpc('community_members_for', { p_community: id });
  if (error) throw error;
  const list = data as Member[];
  if (!list.length || 'chapters_read' in list[0]) return list;
  const plan = await current;
  const log = plan ? await groupLog([plan.id]) : [];
  const due = plan ? daysDue(plan) : 0;
  const total = plan ? totalDays(plan) : 0;
  const weekAgo = Date.now() - 7 * 86_400_000;
  return list.map((m) => {
    const mine = log.filter((l) => l.user_id === m.user_id);
    const days = new Set(mine.map((l) => l.day));
    let next: number | null = null;
    for (let d = 1; d <= total; d++)
      if (!days.has(d)) {
        next = d;
        break;
      }
    let behind = 0;
    for (let d = 1; d <= due; d++) if (!days.has(d)) behind++;
    return {
      ...m,
      chapters_read: plan ? [...days].reduce((n, d) => n + chaptersFor(plan, d).length, 0) : 0,
      next_day: plan ? next : null,
      behind,
      read_week: mine.some((l) => new Date(l.done_at).getTime() > weekAgo),
    };
  });
}

/** When one member read since a date (for the calendar in their sheet). */
export async function memberDays(community: string, user: string, since: Date, planIds: string[]): Promise<{ done_at: string; day: number; plan_id: string }[]> {
  const db = need();
  const r = await db.rpc('member_reading_days', { p_community: community, p_user: user, p_since: since.toISOString() });
  if (!r.error) return r.data as { done_at: string; day: number; plan_id: string }[];
  if (!planIds.length) return [];
  const { data, error } = await db.from('reading_log').select('done_at, day, plan_id').eq('user_id', user).in('plan_id', planIds).gte('done_at', since.toISOString());
  if (error) throw error;
  return data as { done_at: string; day: number; plan_id: string }[];
}

// ---------- shown at once, then refreshed ----------

/** The last copy of something seen on this phone (null if none or unreadable). */
export function cached<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(`bt-cm:${me() ?? ''}:${key}`);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
export function remember(key: string, value: unknown) {
  try {
    localStorage.setItem(`bt-cm:${me() ?? ''}:${key}`, JSON.stringify(value));
  } catch {
    /* storage full or blocked: it only makes the next open slower */
  }
}

/** Calls back (at most every ~1.5 s) when anyone in the group ticks a reading day or a task.
 *  The database only sends changes the person may see. Returns a function to stop. */
export function watchGroup(community: string, planId: string | null, onChange: (what: 'reading' | 'tasks') => void): () => void {
  if (!supabase || !me()) return () => {};
  const db = supabase;
  const timers: Partial<Record<'reading' | 'tasks', ReturnType<typeof setTimeout>>> = {};
  const fire = (what: 'reading' | 'tasks') => {
    clearTimeout(timers[what]);
    timers[what] = setTimeout(() => onChange(what), 1500);
  };
  let ch = db.channel(`cm-${community}-${Math.random().toString(36).slice(2, 8)}`);
  if (planId) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'reading_log', filter: `plan_id=eq.${planId}` }, () => fire('reading'));
  ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'community_task_done' }, () => fire('tasks'));
  ch.subscribe();
  return () => {
    clearTimeout(timers.reading);
    clearTimeout(timers.tasks);
    void db.removeChannel(ch);
  };
}

export async function manageMember(community: string, user: string, action: 'approve' | 'make_admin' | 'make_member' | 'remove') {
  const { error } = await need().rpc('manage_member', { p_community: community, p_user: user, p_action: action });
  if (error) throw error;
}

export async function leaveCommunity(id: string) {
  const { error } = await need().rpc('leave_community', { p_community: id });
  if (error) throw error;
}

/** The link that opens the app on this community's join screen. */
export const inviteLink = (code: string) => `${location.origin}/?join=${code}`;

/** A join code in a scanned QR or an opened link (or typed on its own). */
export function joinCodeFrom(text: string): string | null {
  try {
    const u = new URL(text, location.origin);
    const c = u.searchParams.get('join');
    if (c) return c.toUpperCase();
  } catch {
    /* not a link */
  }
  const t = text.trim().toUpperCase();
  return /^[A-Z0-9]{8}$/.test(t) ? t : null;
}

// ---------- reading plans ----------

export async function plans(community: string): Promise<Plan[]> {
  const { data, error } = await need().from('reading_plans').select('*').eq('community_id', community).order('created_at', { ascending: false });
  if (error) throw error;
  return data as Plan[];
}

export async function createPlan(community: string, p: PlanSpec & { title: string }): Promise<void> {
  const db = need();
  // One active plan at a time: the newest one.
  await db.from('reading_plans').update({ status: 'done' }).eq('community_id', community).eq('status', 'active');
  const { error } = await db.from('reading_plans').insert({ community_id: community, ...p });
  if (error) throw error;
}

export async function setPlanStatus(id: string, status: Plan['status']) {
  const { error } = await need().from('reading_plans').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deletePlan(id: string) {
  const { error } = await need().from('reading_plans').delete().eq('id', id);
  if (error) throw error;
}

/** The days you've read in a plan. */
export async function myDays(plan: string): Promise<Set<number>> {
  const { data, error } = await need().from('reading_log').select('day').eq('plan_id', plan).eq('user_id', me()!);
  if (error) throw error;
  return new Set((data as { day: number }[]).map((r) => r.day));
}

export async function markDay(plan: string, day: number, done: boolean) {
  const db = need();
  const { error } = done
    ? await db.from('reading_log').upsert({ plan_id: plan, user_id: me()!, day }, { onConflict: 'plan_id,user_id,day', ignoreDuplicates: true })
    : await db.from('reading_log').delete().eq('plan_id', plan).eq('user_id', me()!).eq('day', day);
  if (error) throw error;
}

/** Admin: a friendly nudge to someone who hasn't read ('sent', or 'already' today). */
export async function nudgeMember(community: string, user: string): Promise<'sent' | 'already' | 'not_member'> {
  const { data, error } = await need().rpc('nudge_member', { p_community: community, p_user: user });
  if (error) throw error;
  sendPendingPushes();
  return data as 'sent' | 'already' | 'not_member';
}

// ---------- tasks, goals, feed ----------

export interface Task {
  id: string;
  community_id: string;
  title: string;
  note: string;
  ref: { b: string; c: number; v?: number; v2?: number } | null;
  kind: 'read' | 'listen' | 'watch' | 'do';
  /** An outside page, sermon or recording. */
  link: string | null;
  /** Steps ticked off one by one ("Message 1", "Message 2"); empty = one tick. */
  parts: string[];
  due_on: string | null;
  created_at: string;
  /** Tent of Testimony library items, one per part (or one for a task without parts). */
  tot_items?: number[];
}
export type TaskInput = Pick<Task, 'title' | 'note' | 'ref' | 'due_on' | 'kind' | 'link' | 'parts'> & { tot_items?: number[] };
/** Sends tot_items only when there are some (so ordinary tasks work on any database). */
const taskRow = ({ tot_items, ...t }: TaskInput) => (tot_items?.length ? { ...t, tot_items } : t);
/** Who ticked which parts: done[taskId][userId] = part numbers (0 = the whole task). */
export type TaskDone = Record<string, Record<string, number[]>>;
export const isTaskDone = (d: TaskDone, task: string, user: string) => Boolean(d[task]?.[user]?.includes(0));
export interface Goal {
  id: string;
  community_id: string;
  title: string;
  kind: 'chapters' | 'finish';
  target: number | null;
  due_on: string;
  created_at: string;
}
export interface FeedItem {
  kind: 'read' | 'task' | 'joined';
  user_id: string;
  display_name: string;
  avatar: string;
  at: string;
  item: string;
  plan_title: string | null;
  day: number | null;
  task_title: string | null;
  reactions: { emoji: Emoji; mine: boolean; name: string }[];
}
export type Emoji = 'pray' | 'heart' | 'clap';

export async function tasks(community: string): Promise<{ list: Task[]; done: TaskDone }> {
  const db = need();
  const { data, error } = await db.from('community_tasks').select('*').eq('community_id', community).order('created_at', { ascending: false });
  if (error) throw error;
  const list = data as Task[];
  const done: TaskDone = {};
  if (list.length) {
    const r = await db.from('community_task_done').select('task_id, user_id, part').in('task_id', list.map((t) => t.id));
    if (r.error) throw r.error;
    for (const d of r.data as { task_id: string; user_id: string; part: number }[]) ((done[d.task_id] ??= {})[d.user_id] ??= []).push(d.part);
  }
  return { list, done };
}

export async function createTask(community: string, t: TaskInput) {
  const { error } = await need().from('community_tasks').insert({ community_id: community, ...taskRow(t) });
  if (error) throw error;
}
export async function deleteTask(id: string) {
  const { error } = await need().from('community_tasks').delete().eq('id', id);
  if (error) throw error;
}
/** Tick or untick a part (0 = the whole task). `whole` also ticks / unticks the whole task. */
export async function setTaskPart(task: string, part: number, done: boolean, whole: boolean) {
  const db = need();
  const rows = [part, ...(whole && part !== 0 ? [0] : [])].map((p) => ({ task_id: task, user_id: me()!, part: p }));
  const { error } = done
    ? await db.from('community_task_done').upsert(rows, { onConflict: 'task_id,user_id,part', ignoreDuplicates: true })
    : await db.from('community_task_done').delete().eq('task_id', task).eq('user_id', me()!).in('part', rows.map((r) => r.part));
  if (error) throw error;
}

export interface TaskComment {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  display_name: string;
  avatar: string;
  mine: boolean;
}
export async function taskComments(task: string): Promise<TaskComment[]> {
  const { data, error } = await need().rpc('task_comments_for', { p_task: task });
  if (error) throw error;
  return data as TaskComment[];
}
export async function addTaskComment(task: string, body: string) {
  const { error } = await need().from('community_task_comments').insert({ task_id: task, user_id: me()!, body: body.trim() });
  if (error) throw error;
}
export async function deleteTaskComment(id: string) {
  const { error } = await need().from('community_task_comments').delete().eq('id', id);
  if (error) throw error;
}

export async function goals(community: string): Promise<Goal[]> {
  const { data, error } = await need().from('community_goals').select('*').eq('community_id', community).order('due_on');
  if (error) throw error;
  return data as Goal[];
}
export async function createGoal(community: string, g: Pick<Goal, 'title' | 'kind' | 'target' | 'due_on'>) {
  const { error } = await need().from('community_goals').insert({ community_id: community, ...g });
  if (error) throw error;
}
export async function deleteGoal(id: string) {
  const { error } = await need().from('community_goals').delete().eq('id', id);
  if (error) throw error;
}

/** Everyone's reading log for some plans (for goal progress). */
export async function groupLog(planIds: string[]): Promise<{ plan_id: string; user_id: string; day: number; done_at: string }[]> {
  if (!planIds.length) return [];
  // The server returns at most 1,000 rows at a time: a group reading for a year has more.
  const rows: { plan_id: string; user_id: string; day: number; done_at: string }[] = [];
  for (let from = 0; from < 100_000; from += 1000) {
    const { data, error } = await need()
      .from('reading_log')
      .select('plan_id, user_id, day, done_at')
      .in('plan_id', planIds)
      .order('done_at')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as typeof rows));
    if (data.length < 1000) break;
  }
  return rows;
}

export async function feed(community: string): Promise<FeedItem[]> {
  const { data, error } = await need().rpc('community_feed', { p_community: community, p_limit: 40 });
  if (error) throw error;
  return data as FeedItem[];
}

export async function react(community: string, target: string, item: string, emoji: Emoji, on: boolean) {
  const db = need();
  const { error } = on
    ? await db.from('community_reactions').upsert({ community_id: community, target_user: target, item, from_user: me()!, emoji }, { ignoreDuplicates: true })
    : await db.from('community_reactions').delete().eq('community_id', community).eq('target_user', target).eq('item', item).eq('from_user', me()!).eq('emoji', emoji);
  if (error) throw error;
}

export async function updateTask(id: string, t: TaskInput) {
  const { error } = await need().from('community_tasks').update(taskRow(t)).eq('id', id);
  if (error) throw error;
}

// ---------- an invite link waiting to be used ----------
// Kept on the phone (not just this tab) for 7 days, so it survives signing in, even when
// the sign-in link from the email opens in a new tab.
const PENDING = 'bt-join';
export function savePendingJoin(code: string) {
  try {
    localStorage.setItem(PENDING, JSON.stringify({ code: code.toUpperCase(), at: Date.now() }));
  } catch {
    /* storage blocked */
  }
}
export function readPendingJoin(): string | null {
  try {
    const raw = localStorage.getItem(PENDING);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code: string; at: number };
    if (Date.now() - at > 7 * 86_400_000) {
      localStorage.removeItem(PENDING);
      return null;
    }
    return /^[A-Z0-9]{8}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}
export function clearPendingJoin() {
  try {
    localStorage.removeItem(PENDING);
    sessionStorage.removeItem(PENDING);
  } catch {
    /* ignore */
  }
}
