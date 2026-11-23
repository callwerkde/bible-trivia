import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, ChartNoAxesColumn, Check, ExternalLink, Flame, ListChecks, Square, Tent, HandHeart, Lock, ChevronLeft, ChevronRight, Copy, Crown, Link2, LogOut, Pause, Play, Plus, RefreshCw, Settings2, Share2, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import QRCode from 'qrcode';
import { useApp, useT } from '../store';
import { spring } from '../motion/springs';
import { cue } from '../feedback';
import { Pressable } from '../components/Pressable';
import { STROKE } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { useAccount } from '../online/account';
import { pushProgress } from '../online/account';
import { bibleFirst } from '../online/stock';
import { chapterText } from '../engine/bible';
import { BOOKS, BOOK_BY_CODE } from '../i18n/books';
import {
  PRESETS,
  WEEK_PATTERNS,
  chapterList,
  dailyRange,
  readingDaysBetween,
  chaptersFor,
  chaptersLabel,
  dateOfDay,
  finishDate,
  isoDay,
  planStatus,
  totalDays,
  isTotPlan,
  totDayItems,
  type Chapter,
  type PlanSpec,
} from '../engine/readingPlan';
import { loadTot, openUrl, totIndex, type TotCatalog, type TotItem, type TotPlace, type TotSeries } from '../engine/tot';
import { useTot } from '../online/tot';
import {
  createCommunity,
  createPlan,
  deleteCommunity,
  inviteLink,
  joinCommunity,
  leaveCommunity,
  manageMember,
  markDay,
  members as loadMembers,
  memberDays,
  planProgress,
  type PlanProgress,
  cached,
  remember,
  watchGroup,
  nudgeMember,
  myCommunities,
  myDays,
  plans as loadPlans,
  previewCommunity,
  resetCode,
  setPlanStatus,
  updateCommunity,
  type Community as Group,
  type Member,
  type Plan,
  type Preview,
} from '../online/community';
import { Avatar, Friends } from './Friends';
import { GroupExtras } from './CommunityExtras';
import type { Challenge, Friend } from '../online/account';
import type { ModeId } from '../engine/modes';

const COLORS = ['teal', 'blue', 'green', 'orange', 'red', 'purple', 'pink', 'brown'] as const;

/** The Community tab: reading groups first, friends and challenges alongside. */
export function Community({
  onStartChallenge,
  onPlayChallenge,
  joinCode,
  onJoinHandled,
}: {
  onStartChallenge: (mode: ModeId, friendIds: string[]) => void;
  onPlayChallenge: (c: Challenge) => void;
  /** From an invite link (?join=CODE). */
  joinCode?: string | null;
  onJoinHandled?: () => void;
}) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const signedIn = useAccount((s) => Boolean(s.session));
  const [section, setSection] = useState<'groups' | 'friends'>('groups');
  const [groups, setGroups] = useState<Group[] | null>(() => cached<Group[]>('groups'));
  const [failed, setFailed] = useState(false);
  const current = useApp((s) => s.communityId);
  const setApp = useApp((s) => s.set);
  const [sheet, setSheet] = useState<null | 'create' | 'join'>(null);

  const reload = useCallback(async () => {
    const g = await myCommunities();
    if (!g) {
      setFailed(true);
      return null;
    }
    setFailed(false);
    setGroups(g);
    remember('groups', g);
    if (g.length && !g.some((x) => x.id === useApp.getState().communityId)) setApp({ communityId: g[0].id });
    return g;
  }, [setApp]);
  const [banner, setBanner] = useState<{ text: string; ok: boolean } | null>(null);
  const joining = useRef<string | null>(null);
  useEffect(() => {
    void reload();
  }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // An invite link joins straight away (after signing in, if needed) and opens that group.
  useEffect(() => {
    if (!joinCode || !signedIn || joining.current === joinCode) return;
    joining.current = joinCode;
    setSection('groups');
    void (async () => {
      try {
        const r = await joinCommunity(joinCode);
        if (r.status === 'joined' || r.status === 'already') {
          if (r.id) setApp({ communityId: r.id });
          const g = await reload();
          const name = g?.find((x) => x.id === r.id)?.name ?? '';
          setBanner({ text: r.status === 'joined' ? t.cmJoinedNamed(name) : t.cmAlready, ok: true });
          if (r.status === 'joined') cue('complete');
          onJoinHandled?.();
        } else if (r.status === 'pending') {
          setBanner({ text: t.cmPending, ok: true });
          onJoinHandled?.();
        } else {
          // Unknown or reset code: let them check it.
          setSheet('join');
        }
      } catch {
        setSheet('join');
      }
    })();
  }, [joinCode, signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const group = groups?.find((g) => g.id === current) ?? groups?.[0] ?? null;

  return (
    <div className="screen community" lang={uiLang}>
      <div className="cm-head">
        <h1 className="display">{t.cmTitle}</h1>
        {section === 'groups' && signedIn && (
          <button className="icon-btn glass cm-add" onClick={() => setSheet('create')} aria-label={t.cmCreate} title={t.cmCreate}>
            <Plus size={20} strokeWidth={STROKE} />
          </button>
        )}
      </div>

      <div className="segmented" role="tablist">
        {(['groups', 'friends'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={section === v} className={section === v ? 'is-on' : ''} onClick={() => setSection(v)}>
            {section === v && <motion.span layoutId="seg-community" className="segmented-thumb" transition={spring.calm} />}
            <span>{v === 'groups' ? t.cmGroups : t.cmFriends}</span>
          </button>
        ))}
      </div>

      {banner && (
        <motion.button className={`cm-banner ${banner.ok ? 'is-ok' : ''}`} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={spring.calm} onClick={() => setBanner(null)}>
          <Check size={18} strokeWidth={STROKE} /> {banner.text}
        </motion.button>
      )}

      {section === 'friends' ? (
        <Friends onStartChallenge={onStartChallenge} onPlayChallenge={onPlayChallenge} embedded />
      ) : !signedIn ? (
        <p className="caption note">{t.cmSignIn}</p>
      ) : (
        <>
          {failed && <p className="caption note">{t.offlineNotLoaded}</p>}
          {groups && !groups.length && (
            <div className="cm-empty glass">
              <Users size={34} strokeWidth={STROKE} />
              <h2 className="title">{t.cmEmptyTitle}</h2>
              <p className="caption">{t.cmEmptyLead}</p>
              <Pressable className="btn btn-primary" onClick={() => setSheet('create')}>
                <Plus size={18} strokeWidth={STROKE} /> {t.cmCreate}
              </Pressable>
              <Pressable className="btn glass" onClick={() => setSheet('join')}>
                <Link2 size={18} strokeWidth={STROKE} /> {t.cmJoin}
              </Pressable>
            </div>
          )}
          {groups && groups.length > 0 && (
            <>
              <div className="cm-switch">
                {groups.map((g) => (
                  <button key={g.id} className={`cm-chip ${g.id === group?.id ? 'is-on' : ''}`} style={{ ['--g' as string]: `var(--cm-${g.color})` }} onClick={() => setApp({ communityId: g.id })}>
                    <i className="cm-dot" /> {g.name}
                  </button>
                ))}
                <button className="cm-chip is-join" onClick={() => setSheet('join')}>
                  <Link2 size={14} strokeWidth={STROKE} /> {t.cmJoin}
                </button>
              </div>
              {group && <GroupView key={group.id} group={group} onChanged={reload} />}
            </>
          )}
        </>
      )}

      <Sheet open={sheet === 'create'} onClose={() => setSheet(null)} label={t.cmCreate}>
        {sheet === 'create' && (
          <CreateGroup
            onDone={async (id) => {
              setSheet(null);
              setApp({ communityId: id });
              await reload();
            }}
          />
        )}
      </Sheet>
      <Sheet
        open={sheet === 'join'}
        onClose={() => {
          setSheet(null);
          onJoinHandled?.();
        }}
        label={t.cmJoin}
      >
        {sheet === 'join' && (
          <JoinGroup
            initial={joinCode ?? ''}
            onDone={async (id) => {
              setSheet(null);
              onJoinHandled?.();
              if (id) setApp({ communityId: id });
              await reload();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

// ---------- one group ----------

function GroupView({ group, onChanged }: { group: Group; onChanged: () => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const myId = useAccount((s) => s.session?.user.id);
  const isAdmin = group.role === 'owner' || group.role === 'admin';
  // The last copy seen on this phone shows at once; the fresh one replaces it quietly.
  const cacheKey = `group:${group.id}`;
  type Snap = { list: Member[]; plans: Plan[]; days?: Record<string, number[]>; progress?: PlanProgress[] };
  const [snap] = useState(() => cached<Snap>(cacheKey));
  const [list, setList] = useState<Member[] | null>(snap?.list ?? null);
  const [allPlans, setAllPlans] = useState<Plan[] | null>(snap?.plans ?? null);
  // Your days in each current plan, and everyone's progress in each.
  const [days, setDays] = useState<Record<string, number[]>>(snap?.days ?? {});
  const [progress, setProgress] = useState<PlanProgress[] | null>(snap?.progress ?? null);
  const [tasksTick, setTasksTick] = useState(0);
  const [sheet, setSheet] = useState<null | 'invite' | 'plan' | 'settings' | { member: Member } | { read: number; plan: Plan }>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Several plans can run at once (newest first); ended ones stay in the history.
  const plans = (allPlans ?? []).filter((p) => p.status !== 'done');

  const load = useCallback(async () => {
    try {
      const ps = await loadPlans(group.id);
      const cur = ps.filter((p) => p.status !== 'done');
      const m = await loadMembers(group.id, cur[0] ?? null);
      const people = m.filter((x) => x.status === 'active').map((x) => x.user_id);
      const [pr, mine] = await Promise.all([
        planProgress(group.id, cur, people).catch(() => null),
        Promise.all(cur.map((p) => myDays(p.id).then((d) => [p.id, [...d]] as [string, number[]]))),
      ]);
      const d = Object.fromEntries(mine);
      setAllPlans(ps);
      setList(m);
      setDays(d);
      setProgress(pr);
      remember(cacheKey, { list: m, plans: ps, days: d, progress: pr ?? undefined });
    } catch {
      if (!snap) setMsg(t.cmFailed);
    }
  }, [group.id, cacheKey, snap, t.cmFailed]);
  useEffect(() => {
    void load();
  }, [load]);
  // Save the books of each Bible plan's next week of readings for offline first.
  const planKey = plans.map((p) => `${p.id}:${planStatus(p, new Set(days[p.id] ?? [])).next ?? 0}`).join(',');
  useEffect(() => {
    const books = plans.flatMap((p) => {
      if (isTotPlan(p)) return [];
      const next = planStatus(p, new Set(days[p.id] ?? [])).next;
      if (next == null) return [];
      const total = totalDays(p);
      return Array.from({ length: 7 }, (_, i) => next + i)
        .filter((d) => d <= total)
        .flatMap((d) => chaptersFor(p, d).map((c) => c.b));
    });
    if (books.length) bibleFirst([...new Set(books)]);
  }, [planKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Live: when anyone ticks a day or a task, the screen updates by itself.
  const planIds = plans.map((p) => p.id).join(',');
  useEffect(() => watchGroup(group.id, planIds ? planIds.split(',') : [], (what) => (what === 'reading' ? void load() : setTasksTick((n) => n + 1))), [group.id, planIds, load]);
  // And when you come back to the app.
  useEffect(() => {
    const back = () => {
      if (document.visibilityState !== 'visible') return;
      void load();
      setTasksTick((n) => n + 1);
    };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [load]);

  const [nudged, setNudged] = useState<Record<string, boolean>>({});
  async function nudge(m: Member) {
    if (nudged[m.user_id]) return;
    try {
      const r = await nudgeMember(group.id, m.user_id);
      setNudged((n) => ({ ...n, [m.user_id]: true }));
      setMsg(r === 'already' ? t.cmEncouragedAlready : t.cmEncouraged);
      cue('tap');
    } catch {
      setMsg(t.cmFailed);
    }
  }
  const active = list?.filter((m) => m.status === 'active') ?? [];
  const pending = list?.filter((m) => m.status === 'pending') ?? [];

  // Members' progress, one plan at a time (a picker when there are several).
  const [pickedPlan, setPickedPlan] = useState<string | null>(null);
  const shownPlan = plans.find((p) => p.id === pickedPlan) ?? plans[0] ?? null;
  const planTotal = shownPlan ? totalDays(shownPlan) : 1;
  const rowsFor = (m: Member) => {
    const pr = shownPlan && progress?.find((x) => x.plan_id === shownPlan.id && x.user_id === m.user_id);
    if (pr) return { m, done: pr.days_read, units: pr.units_read, behind: pr.behind, next: pr.next_day, today: pr.read_today };
    // (Before the progress for every plan is on the server: the newest plan's numbers.)
    return { m, done: Number(m.days_read) || 0, units: Number(m.chapters_read) || 0, behind: m.behind ?? 0, next: m.next_day, today: m.read_today };
  };
  const progressRows = active
    .map(rowsFor)
    .sort((a, b) => (shownPlan ? b.behind - a.behind || a.done - b.done : 0) || a.m.display_name.localeCompare(b.m.display_name));
  const unitsLabel = (p: Plan | null, n: number) => (p && isTotPlan(p) ? t.cmLessonsN(n) : t.cmChaptersN(n));

  // Tasks first when there are any; otherwise members. (Members can't add tasks, so
  // they only see the Tasks tab when there's something in it.)
  const [taskCount, setTaskCount] = useState(0);
  const [picked, setTab] = useState<'tasks' | 'members' | null>(null);
  const showTasks = isAdmin || taskCount > 0;
  const tab = showTasks ? (picked ?? (taskCount > 0 ? 'tasks' : 'members')) : 'members';

  async function tick(plan: Plan, day: number, on: boolean) {
    const before = days[plan.id] ?? [];
    const next = on ? [...new Set([...before, day])] : before.filter((d) => d !== day);
    setDays({ ...days, [plan.id]: next });
    try {
      await markDay(plan.id, day, on);
      if (on) {
        cue('correct');
        useApp.getState().markReadingDay();
        void pushProgress().catch(() => {});
        // A Tent of Testimony day also marks its lessons done in the library (the database does it).
        if (isTotPlan(plan)) void useTot.getState().load();
      }
      void load();
    } catch {
      setDays({ ...days, [plan.id]: before });
      setMsg(t.cmFailed);
    }
  }

  return (
    <div className="cm-group" style={{ ['--g' as string]: `var(--cm-${group.color})` }}>
      <div className="cm-head">
        <span className="cm-head-badge" aria-hidden>
          {[...group.name.trim()][0]?.toUpperCase() ?? '•'}
        </span>
        <div className="grow cm-head-text">
          <h2 className="title">{group.name}</h2>
          <p className="caption">
            {t.cmMembersN(active.length)} · {t.cmRole[group.role]}
          </p>
        </div>
        <button className="cm-icon-btn" onClick={() => setSheet('invite')} aria-label={t.cmInvite} title={t.cmInvite}>
          <UserPlus size={19} strokeWidth={STROKE} />
        </button>
        <button
          className="cm-icon-btn"
          onClick={() => setSheet('settings')}
          aria-label={isAdmin && pending.length ? `${t.cmSettings} · ${t.cmWaitingBadge(pending.length)}` : t.cmSettings}
          title={t.cmSettings}
        >
          <Settings2 size={19} strokeWidth={STROKE} />
          {isAdmin && pending.length > 0 && <span className="cm-icon-badge">{pending.length}</span>}
        </button>
      </div>

      {allPlans === null ? null : plans.length ? (
        plans.map((p) => {
          const readers = new Set((progress ?? []).filter((x) => x.plan_id === p.id && x.read_today).map((x) => x.user_id));
          return (
            <TodayCard
              key={p.id}
              plan={p}
              done={new Set(days[p.id] ?? [])}
              members={active.map((m) => ({ ...m, read_today: progress ? readers.has(m.user_id) : m.read_today }))}
              onRead={(day) => setSheet({ read: day, plan: p })}
              onTick={(day, on) => tick(p, day, on)}
            />
          );
        })
      ) : (
        <div className="cm-card glass cm-noplan">
          <BookOpen size={22} strokeWidth={STROKE} />
          <p className="caption">{isAdmin ? t.cmNoPlanAdmin : t.cmNoPlan}</p>
          {isAdmin && (
            <Pressable className="btn btn-primary small" onClick={() => setSheet('plan')}>
              <Plus size={16} strokeWidth={STROKE} /> {t.cmNewPlan}
            </Pressable>
          )}
        </div>
      )}

      {list && plans.length > 0 && <WeekCard plans={plans} members={active} progress={progress} />}

      {/* Tasks and members, one at a time. */}
      <div className="cm-tabs" role="tablist">
        {showTasks && (
          <button role="tab" aria-selected={tab === 'tasks'} className={tab === 'tasks' ? 'is-on' : ''} onClick={() => setTab('tasks')}>
            <ListChecks size={17} strokeWidth={STROKE} /> {t.cmTasks}
            <em>{taskCount}</em>
          </button>
        )}
        <button role="tab" aria-selected={tab === 'members'} className={tab === 'members' ? 'is-on' : ''} onClick={() => setTab('members')}>
          <Users size={17} strokeWidth={STROKE} /> {t.cmMembers}
          <em>{active.length}</em>
        </button>
      </div>
      {list && (
        <div hidden={tab !== 'tasks'}>
          <GroupExtras group={group} isAdmin={isAdmin} members={list} refresh={tasksTick} onCount={setTaskCount} />
        </div>
      )}

      <div className="cm-members-wrap" hidden={tab !== 'members'}>
        {plans.length > 1 && (
          <div className="cm-plan-pick" role="tablist" aria-label={t.cmProgressTitle}>
            {plans.map((p) => (
              <button key={p.id} role="tab" aria-selected={shownPlan?.id === p.id} className={`tl-chip ${shownPlan?.id === p.id ? 'is-on' : ''}`} onClick={() => setPickedPlan(p.id)}>
                {isTotPlan(p) ? <Tent size={14} strokeWidth={STROKE} /> : <BookOpen size={14} strokeWidth={STROKE} />} {p.title}
              </button>
            ))}
          </div>
        )}
        <section className="cm-card glass is-solid cm-members" aria-label={shownPlan ? t.cmProgressTitle : t.cmMembers}>
          {progressRows.map(({ m, done: d, units, behind, next, today }) => (
            <button key={m.user_id} className="cm-member" onClick={() => setSheet({ member: m })}>
              <Avatar horse={m.avatar as Friend['avatar']} size={36} />
              <span className="grow cm-member-main">
                <strong>
                  {m.display_name}
                  {m.role !== 'member' && (
                    <span className={`cm-role is-${m.role}`}>
                      {m.role === 'owner' ? <Crown size={11} strokeWidth={2} /> : <Shield size={11} strokeWidth={2} />} {t.cmRole[m.role]}
                    </span>
                  )}
                </strong>
                {shownPlan && (
                  <>
                    <span className="caption">
                      {unitsLabel(shownPlan, units)} · {next ? t.cmOnDay(next) : t.cmFinishedShort}
                      {behind > 0 && <b className="cm-behind"> · {t.cmBehind(behind)}</b>}
                    </span>
                    <span className="cm-mini-bar" aria-hidden>
                      <i style={{ width: `${Math.round((d / planTotal) * 100)}%` }} />
                    </span>
                  </>
                )}
              </span>
              {shownPlan && today && (
                <span className="cm-today" title={t.cmReadToday}>
                  <Check size={14} strokeWidth={2.6} />
                </span>
              )}
              {shownPlan && isAdmin && !m.read_today && m.user_id !== myId && (
                <span
                  role="button"
                  tabIndex={0}
                  className={`cm-nudge ${nudged[m.user_id] ? 'is-done' : ''}`}
                  title={t.cmEncourage}
                  aria-label={`${t.cmEncourage}: ${m.display_name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void nudge(m);
                  }}
                >
                  <HandHeart size={15} strokeWidth={nudged[m.user_id] ? 2.4 : STROKE} />
                </span>
              )}
              {m.streak > 0 && (
                <span className="cm-streak">
                  <Flame size={14} strokeWidth={STROKE} /> {m.streak}
                </span>
              )}
            </button>
          ))}
        </section>
      </div>

      {msg && <p className={`caption form-msg ${msg === t.cmFailed ? 'is-error' : 'is-ok'}`}>{msg}</p>}

      <Sheet open={sheet !== null} onClose={() => setSheet(null)} label={group.name}>
        {sheet === 'invite' && <InviteSheet group={group} isAdmin={isAdmin} onChanged={onChanged} />}
        {sheet === 'plan' && (
          <PlanBuilder
            onSave={async (p) => {
              await createPlan(group.id, p);
              setSheet(null);
              void load();
            }}
          />
        )}
        {sheet === 'settings' && (
          <GroupSettings
            group={group}
            isAdmin={isAdmin}
            pending={pending}
            plans={plans}
            onApprove={async (m) => {
              await manageMember(group.id, m.user_id, 'approve').catch(() => setMsg(t.cmFailed));
              void load();
            }}
            onPlan={async (plan, status) => {
              await setPlanStatus(plan.id, status).catch(() => setMsg(t.cmFailed));
              void load();
            }}
            onNewPlan={() => setSheet('plan')}
            onChanged={() => {
              setSheet(null);
              onChanged();
            }}
          />
        )}
        {sheet && typeof sheet === 'object' && 'member' in sheet && (
          <MemberSheet
            group={group}
            m={sheet.member}
            canManage={isAdmin && sheet.member.user_id !== myId && sheet.member.role !== 'owner'}
            plans={plans}
            progress={progress}
            allPlans={allPlans ?? []}
            onDone={() => {
              setSheet(null);
              void load();
            }}
          />
        )}
        {sheet && typeof sheet === 'object' && 'read' in sheet && (
          <ReadSheet
            chapters={chaptersFor(sheet.plan, sheet.read)}
            lang={uiLang}
            done={(days[sheet.plan.id] ?? []).includes(sheet.read)}
            onDone={() => {
              void tick(sheet.plan, sheet.read, true);
              setSheet(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function TodayCard({ plan, done, members, onRead, onTick }: { plan: Plan; done: Set<number>; members: Member[]; onRead: (day: number) => void; onTick: (day: number, on: boolean) => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const st = planStatus(plan, done);
  const fmt = (d: Date) => d.toLocaleDateString(uiLang === 'ta' ? 'ta-IN' : undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const day = st.next ?? st.total;
  const chapters = chaptersFor(plan, day);
  const pct = Math.round((st.done / st.total) * 100);
  // A Tent of Testimony plan: the day's lessons, each opening on YouTube or tot.org.in.
  const tot = isTotPlan(plan);
  const [lib, setLib] = useState<Map<number, TotPlace> | null>(null);
  useEffect(() => {
    if (tot) void loadTot().then((c) => setLib(totIndex(c)), () => {});
  }, [tot]);
  const dayItems = tot ? totDayItems(plan, day).map((id) => lib?.get(id)?.item).filter((i): i is TotItem => Boolean(i)) : [];
  return (
    <section className={`cm-card glass cm-today-card ${tot ? 'is-tot' : ''}`}>
      <div className="cm-today-head">
        <span className="eyebrow">
          {tot ? <Tent size={13} strokeWidth={STROKE} /> : <BookOpen size={13} strokeWidth={STROKE} />}{' '}
          {plan.title}
          {!st.finished && ` · ${t.cmDayOf(day, st.total)}`}
        </span>
        {plan.status === 'paused' && <span className="cm-paused">⏸</span>}
      </div>
      {st.finished ? (
        <h2 className="title">{t.cmFinished}</h2>
      ) : (
        <>
          {tot ? (
            <div className="cm-tot-day" lang="ta">
              {dayItems.map((i) => (
                <a key={i.id} className="cm-tot-item" href={openUrl(i)} target="_blank" rel="noopener noreferrer">
                  <span className="cm-tot-icon">{i.yt ? <Play size={15} strokeWidth={STROKE} /> : <ExternalLink size={15} strokeWidth={STROKE} />}</span>
                  <strong className="grow">{i.n != null ? `${i.n} - ${i.ta}` : i.ta}</strong>
                </a>
              ))}
              {!lib && <span className="cm-skeleton" aria-hidden />}
            </div>
          ) : (
            <h2 className="title cm-chapters">{chaptersLabel(chapters, uiLang)}</h2>
          )}
          <p className={`caption cm-status ${st.behind > 1 ? 'is-behind' : ''}`}>
            {!st.started ? t.cmStartsOn(fmt(dateOfDay(plan, 1))) : st.behind > 0 ? `${t.cmBehind(st.behind)} · ${t.cmInOrder(day)}` : st.ahead > 0 ? t.cmAhead(st.ahead) : st.todayIsRest ? t.cmRestDay : t.cmCaughtUp}
          </p>
          {!st.canRead ? (
            <p className="cm-locked">
              <Lock size={16} strokeWidth={STROKE} /> {t.cmOpensOn(day, fmt(st.opensOn!))}
            </p>
          ) : (
          <div className="cm-today-actions">
            {tot ? (
              dayItems[0] && (
                <a className="btn btn-primary" href={openUrl(dayItems[0])} target="_blank" rel="noopener noreferrer">
                  {dayItems[0].yt ? <Play size={18} strokeWidth={STROKE} /> : <ExternalLink size={18} strokeWidth={STROKE} />} {dayItems[0].yt ? t.cmWatch : t.cmRead}
                </a>
              )
            ) : (
              <Pressable className="btn btn-primary" onClick={() => onRead(day)}>
                <BookOpen size={18} strokeWidth={STROKE} /> {t.cmRead}
              </Pressable>
            )}
            <Pressable className="btn glass" onClick={() => onTick(day, true)}>
              <Check size={18} strokeWidth={STROKE} /> {t.cmIRead}
            </Pressable>
          </div>
          )}
        </>
      )}
      <div className="cm-progress" aria-label={t.cmProgress(st.done, st.total)}>
        <motion.i initial={false} animate={{ width: `${pct}%` }} transition={spring.calm} />
      </div>
      <p className="caption cm-progress-text">
        {t.cmProgress(st.done, st.total)} · {t.cmFinishes(fmt(finishDate(plan)))}
      </p>
      {st.done > 0 && st.next !== 1 && (
        <button className="link cm-undo" onClick={() => onTick(Math.max(...done), false)}>
          {t.cmUndo}
        </button>
      )}
      {members.length > 1 && <ReadToday members={members} />}
    </section>
  );
}

/** Read the day's chapters in the app (KJV / Tamil), then mark them read. */
function ReadSheet({ chapters, lang, done, onDone }: { chapters: Chapter[]; lang: 'en' | 'ta'; done: boolean; onDone: () => void }) {
  const t = useT();
  const qLang = useApp((s) => s.qLang);
  const uiLang = useApp((s) => s.uiLang);
  const [i, setI] = useState(0);
  const [text, setText] = useState<{ en: string[]; ta: string[] } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const ch = chapters[i];
  useEffect(() => {
    setText(null);
    void chapterText(ch.b, ch.c).then((x) => x && setText(x));
    // A new chapter starts at its first verse.
    top.current?.closest('.sheet-body')?.scrollTo({ top: 0 });
  }, [ch.b, ch.c]);
  const langs: ('en' | 'ta')[] = qLang === 'both' ? [uiLang, uiLang === 'en' ? 'ta' : 'en'] : [qLang];
  const last = i === chapters.length - 1;
  return (
    <div className="tl-panel tl-reader" ref={top}>
      <p className="caption">{chaptersLabel(chapters, lang)}</p>
      <h2 className="title">
        {BOOK_BY_CODE[ch.b]?.[lang] ?? ch.b} {ch.c}
      </h2>
      <div className="tl-reader-body">
        {text?.en.map((_, v) => (
          <p key={v} className="tl-verse">
            <sup>{v + 1}</sup>
            {langs.map((l, j) => (
              <span key={l} className={`verse ${j ? 'tl-sec' : ''}`} lang={l}>
                {text[l][v]}{' '}
              </span>
            ))}
          </p>
        ))}
      </div>
      <div className="tl-reader-nav">
        <button className="btn glass small" disabled={i === 0} onClick={() => setI(i - 1)}>
          <ChevronLeft size={16} strokeWidth={STROKE} />
        </button>
        {last ? (
          <Pressable className="btn btn-primary" onClick={onDone} disabled={done}>
            <Check size={17} strokeWidth={STROKE} /> {done ? t.cmMarked : t.cmMarkRead}
          </Pressable>
        ) : (
          <Pressable className="btn btn-primary" onClick={() => setI(i + 1)}>
            {t.cmNextChapter} <ChevronRight size={16} strokeWidth={STROKE} />
          </Pressable>
        )}
      </div>
    </div>
  );
}

// ---------- sheets ----------

function CreateGroup({ onDone }: { onDone: (id: string) => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [color, setColor] = useState<string>('teal');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="tl-panel">
      <h2 className="title">{t.cmCreate}</h2>
      <label className="tl-formfield">
        <span className="caption">{t.cmName}</span>
        <input className="field" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.cmNameHint} />
      </label>
      <label className="tl-formfield">
        <span className="caption">{t.cmDescription}</span>
        <textarea className="field" rows={2} maxLength={300} value={about} onChange={(e) => setAbout(e.target.value)} />
      </label>
      <ColorPick value={color} onChange={setColor} />
      {msg && <p className="caption form-msg is-error">{msg}</p>}
      <Pressable
        className="btn btn-primary"
        disabled={!name.trim() || busy}
        onClick={async () => {
          setBusy(true);
          try {
            onDone(await createCommunity(name.trim(), about.trim(), color));
          } catch (e) {
            setMsg(/too many/.test((e as Error).message) ? t.cmTooMany : t.cmFailed);
            setBusy(false);
          }
        }}
      >
        <Plus size={17} strokeWidth={STROKE} /> {t.cmCreateBtn}
      </Pressable>
    </div>
  );
}

function ColorPick({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const t = useT();
  return (
    <div className="tl-formfield">
      <span className="caption">{t.cmColor}</span>
      <div className="cm-colors">
        {COLORS.map((c) => (
          <button key={c} className={`cm-color ${value === c ? 'is-on' : ''}`} style={{ background: `var(--cm-${c})` }} onClick={() => onChange(c)} aria-label={c} aria-pressed={value === c} />
        ))}
      </div>
    </div>
  );
}

function JoinGroup({ initial, onDone }: { initial: string; onDone: (id?: string) => void }) {
  const t = useT();
  const [code, setCode] = useState(initial.toUpperCase());
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setPreview(undefined);
    if (code.length !== 8) return;
    void previewCommunity(code)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [code]);
  return (
    <div className="tl-panel">
      <h2 className="title">{preview ? t.cmJoinTitle(preview.name) : t.cmJoin}</h2>
      <label className="tl-formfield">
        <span className="caption">{t.cmCode}</span>
        <input className="field cm-code-input" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder={t.cmCodeHint} autoCapitalize="characters" />
      </label>
      {preview && (
        <div className="cm-preview glass" style={{ ['--g' as string]: `var(--cm-${preview.color})` }}>
          <i className="cm-dot" />
          <div className="grow">
            <strong>{preview.name}</strong>
            {preview.description && <p className="caption">{preview.description}</p>}
            <p className="caption">{t.cmMembersN(preview.members)}</p>
          </div>
        </div>
      )}
      {preview?.needs_approval && <p className="caption">{t.cmNeedsApproval}</p>}
      {preview === null && code.length === 8 && <p className="caption form-msg is-error">{t.cmNotFound}</p>}
      {msg && <p className={`caption form-msg ${msg.ok ? 'is-ok' : 'is-error'}`}>{msg.text}</p>}
      <Pressable
        className="btn btn-primary"
        disabled={!preview || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await joinCommunity(code);
            if (r.status === 'joined' || r.status === 'already') {
              cue('complete');
              onDone(r.id);
            } else if (r.status === 'pending') setMsg({ text: t.cmPending, ok: true });
            else setMsg({ text: t.cmNotFound });
          } catch {
            setMsg({ text: t.cmFailed });
          } finally {
            setBusy(false);
          }
        }}
      >
        <UserPlus size={17} strokeWidth={STROKE} /> {t.cmJoinBtn}
      </Pressable>
    </div>
  );
}

function InviteSheet({ group, isAdmin, onChanged }: { group: Group; isAdmin: boolean; onChanged: () => void }) {
  const t = useT();
  const [code, setCode] = useState(group.invite_code);
  const [svg, setSvg] = useState('');
  const [copied, setCopied] = useState(false);
  const [approval, setApproval] = useState(group.needs_approval);
  const link = inviteLink(code);
  useEffect(() => {
    void QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1d2430', light: '#ffffff' } }).then(setSvg);
  }, [link]);
  async function share() {
    const text = `${t.cmShareText(group.name)}\n${link}`;
    try {
      if (typeof navigator.share === 'function') await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* cancelled */
    }
  }
  return (
    <div className="tl-panel cm-invite">
      <h2 className="title">{t.cmInviteTitle}</h2>
      <p className="caption">{t.cmInviteLead}</p>
      <div className="qr-box cm-qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="cm-code">{code}</div>
      <Pressable className="btn btn-primary" onClick={share}>
        {copied ? <Check size={17} strokeWidth={STROKE} /> : typeof navigator.share === 'function' ? <Share2 size={17} strokeWidth={STROKE} /> : <Copy size={17} strokeWidth={STROKE} />}
        {copied ? t.cmCopied : t.cmShareLink}
      </Pressable>
      {isAdmin && (
        <>
          <label className="tl-check">
            <input
              type="checkbox"
              checked={approval}
              onChange={async (e) => {
                setApproval(e.target.checked);
                await updateCommunity(group.id, { needs_approval: e.target.checked }).catch(() => setApproval(!e.target.checked));
                onChanged();
              }}
            />
            {t.cmApproval}
          </label>
          <button
            className="link cm-reset"
            onClick={async () => {
              if (!confirm(t.cmResetConfirm)) return;
              setCode(await resetCode(group.id));
              onChanged();
            }}
          >
            <RefreshCw size={14} strokeWidth={STROKE} /> {t.cmResetCode}
          </button>
        </>
      )}
    </div>
  );
}

function MemberSheet({ group, m, canManage, plans, progress, allPlans, onDone }: { group: Group; m: Member; canManage: boolean; plans: Plan[]; progress: PlanProgress[] | null; allPlans: Plan[]; onDone: () => void }) {
  const t = useT();
  const [note, setNote] = useState<string | null>(null);
  // Only this week's days are needed for the calendar: fetched when the sheet opens.
  const [log, setLog] = useState<{ done_at: string }[]>([]);
  const planIds = allPlans.map((p) => p.id).join(',');
  useEffect(() => {
    const now = new Date();
    const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    let live = true;
    memberDays(group.id, m.user_id, sunday, planIds.split(','))
      .then((rows) => live && setLog(rows))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [group.id, m.user_id, planIds]);
  const act = async (a: 'make_admin' | 'make_member' | 'remove') => {
    if (a === 'remove' && !confirm(t.cmRemoveConfirm(m.display_name))) return;
    await manageMember(group.id, m.user_id, a).catch(() => {});
    onDone();
  };
  // Their progress in each current plan.
  const mine = plans.map((p) => ({ p, pr: progress?.find((x) => x.plan_id === p.id && x.user_id === m.user_id) }));
  const chapters = progress ? mine.reduce((n, { p, pr }) => n + (pr && !isTotPlan(p) ? pr.units_read : 0), 0) : Number(m.chapters_read) || 0;
  const lessons = mine.reduce((n, { p, pr }) => n + (pr && isTotPlan(p) ? pr.units_read : 0), 0);
  return (
    <div className="tl-panel">
      <div className="cm-member is-big">
        <Avatar horse={m.avatar as Friend['avatar']} size={44} />
        <div className="grow">
          <h2 className="title">{m.display_name}</h2>
          <p className="caption">{t.cmRole[m.role]}</p>
        </div>
      </div>
      <div className="cm-stats is-small">
        <Stat value={chapters} label={t.cmStatChapters} />
        {lessons > 0 && <Stat value={lessons} label={t.cmStatLessons} />}
        <Stat value={`🔥 ${m.streak}`} label={t.cmStatStreak} />
      </div>
      {plans.length > 0 && (
        <div className="cm-member-plans">
          {mine.map(({ p, pr }) => {
            const d = pr ? pr.days_read : plans.length === 1 ? Number(m.days_read) || 0 : 0;
            return (
              <div key={p.id} className="cm-member-plan">
                <span className="caption">
                  {isTotPlan(p) ? <Tent size={13} strokeWidth={STROKE} /> : <BookOpen size={13} strokeWidth={STROKE} />} {p.title}
                </span>
                <strong>{Math.round((d / totalDays(p)) * 100)}%</strong>
                <span className="cm-mini-bar" aria-hidden>
                  <i style={{ width: `${Math.round((d / totalDays(p)) * 100)}%` }} />
                </span>
              </div>
            );
          })}
        </div>
      )}
      <h3 className="eyebrow">{t.cmCalendar}</h3>
      <ReadingCalendar log={log} />
      {canManage && (
        <>
          <Pressable
            className="btn btn-primary"
            onClick={async () => {
              const r = await nudgeMember(group.id, m.user_id).catch(() => null);
              setNote(r === 'already' ? t.cmEncouragedAlready : r ? t.cmEncouraged : t.cmFailed);
            }}
          >
            <HandHeart size={17} strokeWidth={STROKE} /> {t.cmEncourage}
          </Pressable>
          {note && <p className="caption form-msg is-ok">{note}</p>}
          {m.role === 'member' ? (
            <Pressable className="btn glass" onClick={() => act('make_admin')}>
              <Shield size={16} strokeWidth={STROKE} /> {t.cmMakeAdmin}
            </Pressable>
          ) : (
            <Pressable className="btn glass" onClick={() => act('make_member')}>
              <Users size={16} strokeWidth={STROKE} /> {t.cmMakeMember}
            </Pressable>
          )}
          <Pressable className="btn glass cm-danger" onClick={() => act('remove')}>
            <Trash2 size={16} strokeWidth={STROKE} /> {t.cmRemove}
          </Pressable>
        </>
      )}
    </div>
  );
}


function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="cm-stat">
      <strong>{value}</strong>
      <span className="caption">{label}</span>
    </div>
  );
}

/** Who has read today: everyone's picture, lit up once they've read. Readers come first. */
function ReadToday({ members }: { members: Member[] }) {
  const t = useT();
  const n = members.filter((m) => m.read_today).length;
  const shown = [...members].sort((a, b) => Number(b.read_today) - Number(a.read_today)).slice(0, 7);
  return (
    <div className="cm-readtoday">
      <div className="cm-faces" aria-hidden>
        {shown.map((m) => (
          <span key={m.user_id} className={`cm-face ${m.read_today ? 'is-read' : ''}`}>
            <Avatar horse={m.avatar as Friend['avatar']} size={30} />
            {m.read_today && (
              <i>
                <Check size={9} strokeWidth={3.4} />
              </i>
            )}
          </span>
        ))}
        {members.length > shown.length && <span className="cm-face is-more">+{members.length - shown.length}</span>}
      </div>
      <p className="caption">{t.cmReadTodayN(n, members.length)}</p>
    </div>
  );
}

/** The group this week: one shared bar (who has read in the last 7 days), and the
 *  chapters, plan progress and best streak in a line beneath it. */
function WeekCard({ plans, members, progress }: { plans: Plan[]; members: Member[]; progress: PlanProgress[] | null }) {
  const t = useT();
  const readers = members.filter((m) => m.read_week).length;
  const ids = new Set(members.map((m) => m.user_id));
  const rows = (progress ?? []).filter((x) => ids.has(x.user_id));
  const isTot = new Set(plans.filter(isTotPlan).map((p) => p.id));
  const chapters = progress ? rows.filter((x) => !isTot.has(x.plan_id)).reduce((n, x) => n + x.units_read, 0) : members.reduce((n, m) => n + (Number(m.chapters_read) || 0), 0);
  const lessons = rows.filter((x) => isTot.has(x.plan_id)).reduce((n, x) => n + x.units_read, 0);
  // All current plans together: days read out of every member's days.
  const totalAll = plans.reduce((n, p) => n + totalDays(p), 0) * Math.max(1, members.length);
  const readAll = progress ? rows.reduce((n, x) => n + x.days_read, 0) : members.reduce((n, m) => n + (Number(m.days_read) || 0), 0);
  const pct = totalAll ? Math.round((readAll / totalAll) * 100) : 0;
  const best = Math.max(0, ...members.map((m) => m.streak));
  return (
    <section className="cm-card glass cm-week-card">
      <div className="cm-week-top">
        <strong>{t.cmWeekTogether}</strong>
        <span className="caption">{t.cmReadWeekN(readers, members.length)}</span>
      </div>
      <div className="cm-progress" aria-hidden>
        <motion.i initial={false} animate={{ width: `${members.length ? Math.round((readers / members.length) * 100) : 0}%` }} transition={spring.calm} />
      </div>
      <div className="cm-week-facts caption">
        <span>
          <BookOpen size={15} strokeWidth={STROKE} /> <b>{chapters}</b> {t.cmStatChapters}
        </span>
        {lessons > 0 && (
          <span>
            <Tent size={15} strokeWidth={STROKE} /> <b>{lessons}</b> {t.cmStatLessons}
          </span>
        )}
        <span>
          <ChartNoAxesColumn size={15} strokeWidth={STROKE} /> <b>{pct}%</b> {plans.length > 1 ? t.cmStatPlans : t.cmStatGroupPlan}
        </span>
        <span>
          <Flame size={15} strokeWidth={STROKE} /> <b>{best}</b> {t.cmStatBestStreak}
        </span>
      </div>
    </section>
  );
}

/** This week (Sunday to Saturday): a mark on each day they read. */
function ReadingCalendar({ log }: { log: { done_at: string }[] }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const counts = new Map<string, number>();
  for (const l of log) {
    const k = isoDay(new Date(l.done_at));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const today = new Date();
  const sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const week = Array.from({ length: 7 }, (_, i) => new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i));
  const read = week.filter((d) => counts.has(isoDay(d))).length;
  return (
    <div className="cm-week" role="img" aria-label={t.cmWeekSummary(read)}>
      <div className="cm-week-days">
        {week.map((d, i) => {
          const n = counts.get(isoDay(d)) ?? 0;
          const future = d > today && isoDay(d) !== isoDay(today);
          return (
            <div key={i} className={`cm-wday ${n ? 'is-read' : ''} ${isoDay(d) === isoDay(today) ? 'is-today' : ''} ${future ? 'is-future' : ''}`}>
              <span className="cm-wday-name">{t.cmWeekdays[i]}</span>
              <span className="cm-wday-dot">{n ? <Check size={14} strokeWidth={3} /> : d.toLocaleDateString(uiLang === 'ta' ? 'ta-IN' : undefined, { day: 'numeric' })}</span>
            </div>
          );
        })}
      </div>
      <p className="caption">{t.cmWeekSummary(read)}</p>
    </div>
  );
}

/** The ⚙ sheet. Admins: people waiting to join, the reading plan, and the group's details.
 *  Everyone: what the group is about, and leaving it. */
function GroupSettings({
  group,
  isAdmin,
  pending,
  plans,
  onApprove,
  onPlan,
  onNewPlan,
  onChanged,
}: {
  group: Group;
  isAdmin: boolean;
  pending: Member[];
  plans: Plan[];
  onApprove: (m: Member) => Promise<void>;
  onPlan: (plan: Plan, status: Plan['status']) => Promise<void>;
  onNewPlan: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(group.name);
  const [about, setAbout] = useState(group.description);
  const [color, setColor] = useState(group.color);
  const owner = group.role === 'owner';
  return (
    <div className="tl-panel">
      <h2 className="title">{isAdmin ? t.cmSettings : group.name}</h2>
      {!isAdmin && group.description && <p className="caption">{group.description}</p>}
      {isAdmin && pending.length > 0 && (
        <section className="cm-set-section">
          <h3 className="eyebrow">
            {t.cmWaiting} · {pending.length}
          </h3>
          {pending.map((m) => (
            <div key={m.user_id} className="cm-member">
              <Avatar horse={m.avatar as Friend['avatar']} size={34} />
              <strong className="grow">{m.display_name}</strong>
              <Pressable className="btn btn-primary small" onClick={() => onApprove(m)}>
                <Check size={15} strokeWidth={STROKE} /> {t.cmApprove}
              </Pressable>
            </div>
          ))}
        </section>
      )}
      {isAdmin && (
        <section className="cm-set-section">
          <h3 className="eyebrow">{t.cmPlanSection}</h3>
          {plans.map((plan) => (
            <div key={plan.id} className="cm-set-plan">
              <span className="cm-set-plan-name">
                {isTotPlan(plan) ? <Tent size={16} strokeWidth={STROKE} /> : <BookOpen size={16} strokeWidth={STROKE} />}
                <strong className="grow">{plan.title}</strong>
                {plan.status === 'paused' && <span className="caption">{t.cmPausedTag}</span>}
              </span>
              <span className="cm-set-plan-actions">
                <button className="link" onClick={() => onPlan(plan, plan.status === 'paused' ? 'active' : 'paused')}>
                  {plan.status === 'paused' ? <Play size={14} strokeWidth={STROKE} /> : <Pause size={14} strokeWidth={STROKE} />} {plan.status === 'paused' ? t.cmResumePlan : t.cmPausePlan}
                </button>
                <button
                  className="link cm-danger-link"
                  onClick={() => {
                    if (confirm(t.cmEndPlanConfirm(plan.title))) void onPlan(plan, 'done');
                  }}
                >
                  <Square size={14} strokeWidth={STROKE} /> {t.cmEndPlan}
                </button>
              </span>
            </div>
          ))}
          <button className="cm-set-row is-accent" onClick={onNewPlan}>
            <Plus size={18} strokeWidth={STROKE} />
            <span className="grow">{t.cmNewPlan}</span>
            <ChevronRight size={16} strokeWidth={STROKE} />
          </button>
        </section>
      )}
      {isAdmin && (
        <>
          <h3 className="eyebrow">{t.cmGroupSection}</h3>
          <label className="tl-formfield">
            <span className="caption">{t.cmName}</span>
            <input className="field" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="tl-formfield">
            <span className="caption">{t.cmDescription}</span>
            <textarea className="field" rows={2} maxLength={300} value={about} onChange={(e) => setAbout(e.target.value)} />
          </label>
          <ColorPick value={color} onChange={setColor} />
          <Pressable
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={async () => {
              await updateCommunity(group.id, { name: name.trim(), description: about.trim(), color }).catch(() => {});
              onChanged();
            }}
          >
            {t.cmSave}
          </Pressable>
        </>
      )}
      {owner ? (
        <Pressable
          className="btn glass cm-danger"
          onClick={async () => {
            if (!confirm(t.cmDeleteConfirm)) return;
            await deleteCommunity(group.id).catch(() => {});
            onChanged();
          }}
        >
          <Trash2 size={16} strokeWidth={STROKE} /> {t.cmDelete}
        </Pressable>
      ) : (
        <Pressable
          className="btn glass cm-danger"
          onClick={async () => {
            if (!confirm(t.cmLeaveConfirm)) return;
            await leaveCommunity(group.id).catch(() => {});
            onChanged();
          }}
        >
          <LogOut size={16} strokeWidth={STROKE} /> {t.cmLeave}
        </Pressable>
      )}
    </div>
  );
}

/** Admin: a new reading plan, with a live preview of the schedule. */
type Pace = 'chapters' | 'in' | 'by';
type DayPattern = 'every' | 'weekdays' | 'weekends' | 'custom';
const DURATIONS: Record<string, (d: Date) => Date> = {
  y1: (d) => new Date(d.getFullYear() + 1, d.getMonth(), d.getDate() - 1),
  m6: (d) => new Date(d.getFullYear(), d.getMonth() + 6, d.getDate() - 1),
  m3: (d) => new Date(d.getFullYear(), d.getMonth() + 3, d.getDate() - 1),
  d90: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 89),
  d30: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 29),
};

function PlanBuilder({ onSave }: { onSave: (p: PlanSpec & { title: string }) => Promise<void> }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  // The Bible, or a series of Tent of Testimony lessons.
  const [source, setSource] = useState<'bible' | 'tot'>('bible');
  const [cat, setCat] = useState<TotCatalog | null>(null);
  const [seriesId, setSeriesId] = useState('');
  const [startAt, setStartAt] = useState(0);
  const [perTot, setPerTot] = useState(1);
  useEffect(() => {
    if (source === 'tot' && !cat) void loadTot().then(setCat, () => {});
  }, [source, cat]);
  const allSeries: { s: TotSeries; label: string }[] = cat
    ? cat.sections.flatMap((sec) => sec.series.map((x) => ({ s: x, label: sec.series.length > 1 ? `${uiLang === 'en' ? sec.en : sec.ta} › ${uiLang === 'en' ? x.en : x.ta}` : uiLang === 'en' ? sec.en : sec.ta })))
    : [];
  const series = allSeries.find((x) => x.s.id === seriesId) ?? null;
  const totItems = series ? series.s.items.slice(startAt).map((i) => i.id) : [];
  const fromTot = source === 'tot';
  const [preset, setPreset] = useState('bible');
  const [custom, setCustom] = useState<string[]>([]);
  const [order, setOrder] = useState<'canonical' | 'mixed'>('canonical');
  const [pace, setPace] = useState<Pace>('in');
  const [per, setPer] = useState(3);
  const [duration, setDuration] = useState('y1');
  const [daysCount, setDaysCount] = useState(365);
  const [start, setStart] = useState(isoDay(new Date()));
  const [end, setEnd] = useState(isoDay(DURATIONS.y1(new Date())));
  const [pattern, setPattern] = useState<DayPattern>('every');
  const [readOn, setReadOn] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const books = preset === 'custom' ? BOOKS.map((b) => b.code).filter((c) => custom.includes(c)) : PRESETS.find((p) => p.id === preset)!.books;
  const hasBoth = books.some((b) => BOOKS.findIndex((x) => x.code === b) < 39) && books.some((b) => BOOKS.findIndex((x) => x.code === b) >= 39);
  const rest = pattern === 'custom' ? [0, 1, 2, 3, 4, 5, 6].filter((d) => !readOn.includes(d)) : WEEK_PATTERNS[pattern];
  const startDate = new Date(start + 'T00:00');
  // "Finish in" counts calendar time from the start; "finish by" uses the chosen date.
  const endDate = pace === 'by' ? new Date(end + 'T00:00') : duration === 'custom' ? null : DURATIONS[duration](startDate);
  const targetDays =
    pace === 'chapters' ? null : pace === 'in' && duration === 'custom' ? Math.max(1, daysCount) : Math.max(1, readingDaysBetween({ start_date: start, rest_days: rest }, endDate!));
  const spec: PlanSpec = fromTot
    ? { books: [], chapters_per_day: perTot, days_total: null, reading_order: 'canonical', start_date: start, rest_days: rest, tot_items: totItems }
    : { books, chapters_per_day: pace === 'chapters' ? per : null, days_total: targetDays, reading_order: hasBoth ? order : 'canonical', start_date: start, rest_days: rest };
  const chapterCount = books.length ? chapterList(books).length : 0;
  const days = books.length ? totalDays(spec) : 0;
  const capped = targetDays != null && targetDays > chapterCount;
  const fmt = (d: Date) => d.toLocaleDateString(uiLang === 'ta' ? 'ta-IN' : undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const defaultName = fromTot ? (series ? (uiLang === 'en' ? series.s.en : series.s.ta) : t.cmSourceTot) : t.cmPreset[preset];
  const name = title.trim() || defaultName;
  const ready = fromTot ? totItems.length > 0 : books.length > 0;
  const [lo, hi] = !fromTot && books.length ? dailyRange(spec) : [0, 0];
  const totDays = fromTot && totItems.length ? totalDays(spec) : 0;

  return (
    <div className="tl-panel cm-builder">
      <h2 className="title">{t.cmNewPlan}</h2>
      <p className="caption">{t.cmPlanAlongside}</p>

      <div className="tl-formfield">
        <span className="caption">{t.cmPlanSource}</span>
        <div className="segmented small" role="tablist">
          {(['bible', 'tot'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={source === v} className={source === v ? 'is-on' : ''} onClick={() => setSource(v)}>
              {source === v && <motion.span layoutId="seg-source" className="segmented-thumb" transition={spring.calm} />}
              <span>
                {v === 'tot' ? <Tent size={14} strokeWidth={STROKE} /> : <BookOpen size={14} strokeWidth={STROKE} />} {v === 'bible' ? t.cmSourceBible : t.cmSourceTot}
              </span>
            </button>
          ))}
        </div>
      </div>

      {fromTot && (
        <>
          {!cat && <p className="caption">{t.totOffline}</p>}
          {cat && (
            <>
              <label className="tl-formfield">
                <span className="caption">{t.cmTotSeries}</span>
                <select
                  className="field"
                  value={seriesId}
                  onChange={(e) => {
                    setSeriesId(e.target.value);
                    setStartAt(0);
                  }}
                >
                  <option value="" disabled>
                    …
                  </option>
                  {allSeries.map(({ s: x, label }) => (
                    <option key={x.id} value={x.id}>
                      {label} ({x.items.length})
                    </option>
                  ))}
                </select>
              </label>
              {series && (
                <label className="tl-formfield">
                  <span className="caption">{t.cmTotStartAt}</span>
                  <select className="field" lang="ta" value={startAt} onChange={(e) => setStartAt(Number(e.target.value))}>
                    {series.s.items.map((i, k) => (
                      <option key={i.id} value={k}>
                        {i.n != null ? `${i.n} - ` : ''}
                        {i.ta.slice(0, 50)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="tl-formfield">
                <span className="caption">{t.cmLessonsPerDay}</span>
                <div className="cm-stepper">
                  <button className="icon-btn glass" onClick={() => setPerTot(Math.max(1, perTot - 1))} aria-label="-">
                    −
                  </button>
                  <strong>{perTot}</strong>
                  <button className="icon-btn glass" onClick={() => setPerTot(Math.min(5, perTot + 1))} aria-label="+">
                    +
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {!fromTot && <div className="tl-formfield">
        <span className="caption">{t.cmWhatToRead}</span>
        <div className="tl-pills">
          {[...PRESETS.map((p) => p.id), 'custom'].map((id) => (
            <button key={id} className={`tl-chip ${preset === id ? 'is-on' : ''}`} onClick={() => setPreset(id)}>
              {t.cmPreset[id]}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="cm-books">
            {BOOKS.map((b) => (
              <button key={b.code} className={`cm-book ${custom.includes(b.code) ? 'is-on' : ''}`} onClick={() => setCustom((c) => (c.includes(b.code) ? c.filter((x) => x !== b.code) : [...c, b.code]))} lang={uiLang}>
                {b[uiLang]}
              </button>
            ))}
          </div>
        )}
      </div>}

      {!fromTot && hasBoth && (
        <div className="tl-formfield">
          <span className="caption">{t.cmOrder}</span>
          <div className="tl-pills">
            {(['canonical', 'mixed'] as const).map((o) => (
              <button key={o} className={`tl-chip ${order === o ? 'is-on' : ''}`} onClick={() => setOrder(o)}>
                {o === 'canonical' ? t.cmOrderCanonical : t.cmOrderMixed}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="tl-formfield">
        <span className="caption">{t.cmStart}</span>
        <input className="field" type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
      </label>

      {!fromTot && <div className="tl-formfield">
        <span className="caption">{t.cmPace}</span>
        <div className="segmented small" role="tablist">
          {(['in', 'by', 'chapters'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={pace === v} className={pace === v ? 'is-on' : ''} onClick={() => setPace(v)}>
              {pace === v && <motion.span layoutId="seg-pace" className="segmented-thumb" transition={spring.calm} />}
              <span>{v === 'in' ? t.cmPaceIn : v === 'by' ? t.cmPaceBy : t.cmPaceChapters}</span>
            </button>
          ))}
        </div>
        {pace === 'chapters' && (
          <div className="cm-stepper">
            <button className="icon-btn glass" onClick={() => setPer(Math.max(1, per - 1))} aria-label="-">
              −
            </button>
            <strong>{per}</strong>
            <button className="icon-btn glass" onClick={() => setPer(Math.min(20, per + 1))} aria-label="+">
              +
            </button>
          </div>
        )}
        {pace === 'in' && (
          <>
            <div className="tl-pills">
              {Object.keys(t.cmDurations).map((k) => (
                <button key={k} className={`tl-chip ${duration === k ? 'is-on' : ''}`} onClick={() => setDuration(k)}>
                  {t.cmDurations[k]}
                </button>
              ))}
            </div>
            {duration === 'custom' && (
              <input className="field cm-days-input" type="number" inputMode="numeric" min={1} max={3650} value={daysCount} onChange={(e) => setDaysCount(Math.min(3650, Math.max(1, Number(e.target.value) || 1)))} aria-label={t.cmDaysCount} />
            )}
          </>
        )}
        {pace === 'by' && <input className="field" type="date" min={start} value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} aria-label={t.cmEndDate} />}
      </div>}

      <div className="tl-formfield">
        <span className="caption">{t.cmReadOn}</span>
        <div className="tl-pills">
          {(['every', 'weekdays', 'weekends', 'custom'] as const).map((v) => (
            <button key={v} className={`tl-chip ${pattern === v ? 'is-on' : ''}`} onClick={() => setPattern(v)}>
              {t.cmDayPatterns[v]}
            </button>
          ))}
        </div>
        {pattern === 'custom' && (
          <div className="cm-weekdays">
            {t.cmWeekdays.map((d, i) => (
              <button
                key={i}
                className={`cm-weekday ${readOn.includes(i) ? 'is-on' : ''}`}
                onClick={() => setReadOn((r) => (r.includes(i) ? (r.length > 1 ? r.filter((x) => x !== i) : r) : [...r, i]))}
                aria-pressed={readOn.includes(i)}
              >
                {d}
              </button>
            ))}
          </div>
        )}
        {fromTot && <span className="caption">{t.cmTotPlanHint}</span>}
      </div>

      <label className="tl-formfield">
        <span className="caption">{t.cmPlanTitle}</span>
        <input className="field" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultName} />
      </label>

      {fromTot && totItems.length > 0 && series && (
        <div className="cm-preview-box glass">
          <strong>{t.cmPreview(totDays, fmt(finishDate(spec)))}</strong>
          <span>{t.cmLessonsADay(perTot)}</span>
          <span className="caption" lang="ta">
            {t.cmTotDay1(series.s.items[startAt].ta)}
          </span>
        </div>
      )}
      {!fromTot && books.length > 0 && (
        <div className="cm-preview-box glass">
          <strong>{t.cmPreview(days, fmt(finishDate(spec)))}</strong>
          <span>{t.cmPerDayRange(lo, hi)}</span>
          <span className="caption">{t.cmDay1(chaptersLabel(chaptersFor(spec, 1), uiLang))}</span>
          {capped && <span className="caption">{t.cmCapped(days)}</span>}
        </div>
      )}
      {msg && <p className="caption form-msg is-error">{msg}</p>}
      <Pressable
        className="btn btn-primary"
        disabled={!ready || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave(fromTot ? { ...spec, title: name.slice(0, 80) } : { ...spec, days_total: capped ? chapterCount : spec.days_total, title: name });
          } catch {
            setMsg(t.cmFailed);
            setBusy(false);
          }
        }}
      >
        <Play size={17} strokeWidth={STROKE} /> {t.cmSavePlan}
      </Pressable>
    </div>
  );
}
