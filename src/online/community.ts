import { supabase } from './supabase';
import { useAccount, sendPendingPushes } from './account';
import type { PlanSpec } from '../engine/readingPlan';

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

export async function members(id: string): Promise<Member[]> {
  const { data, error } = await need().rpc('community_members_for', { p_community: id });
  if (error) throw error;
  return data as Member[];
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
