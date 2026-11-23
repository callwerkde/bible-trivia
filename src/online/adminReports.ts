import { supabase } from './supabase';
import type { ReportCategory, ReportKind } from './reports';

/** A report as an admin sees it (table question_reports; admins only). */
export interface AdminReport {
  id: number;
  question_id: string;
  kind: ReportKind;
  category: ReportCategory;
  lang: 'en' | 'ta';
  reason: string | null;
  contact: string | null;
  snapshot: Record<string, string> | null;
  app_version: string | null;
  status: 'new' | 'fixed' | 'dismissed';
  created_at: string;
  handled_at: string | null;
}

const need = () => {
  if (!supabase) throw new Error('offline');
  return supabase;
};

/** Open reports (newest first), or the latest closed ones. */
export async function listReports(open: boolean): Promise<AdminReport[]> {
  const q = need().from('question_reports').select('id, question_id, kind, category, lang, reason, contact, snapshot, app_version, status, created_at, handled_at');
  const { data, error } = open
    ? await q.eq('status', 'new').order('created_at', { ascending: false }).limit(200)
    : await q.neq('status', 'new').order('handled_at', { ascending: false, nullsFirst: false }).limit(100);
  if (error) throw error;
  return data as AdminReport[];
}

/** How many reports are waiting (for the Admin menu badge). */
export async function openReportCount(): Promise<number> {
  const { count, error } = await need().from('question_reports').select('id', { count: 'exact', head: true }).eq('status', 'new');
  if (error) throw error;
  return count ?? 0;
}

export async function closeReport(id: number, status: AdminReport['status']) {
  const { error } = await need()
    .from('question_reports')
    .update({ status, handled_at: status === 'new' ? null : new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
