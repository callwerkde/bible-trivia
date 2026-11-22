import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Check, ChevronLeft, ChevronRight, Copy, Crown, Link2, LogOut, Pause, Play, Plus, RefreshCw, Settings2, Share2, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import QRCode from 'qrcode';
import { useApp, useT } from '../store';
import { spring } from '../motion/springs';
import { cue } from '../feedback';
import { Pressable } from '../components/Pressable';
import { STROKE } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { useAccount } from '../online/account';
import { pushProgress } from '../online/account';
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
  type Chapter,
  type PlanSpec,
} from '../engine/readingPlan';
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
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [failed, setFailed] = useState(false);
  const current = useApp((s) => s.communityId);
  const setApp = useApp((s) => s.set);
  const [sheet, setSheet] = useState<null | 'create' | 'join'>(null);

  const reload = useCallback(async () => {
    const g = await myCommunities();
    if (!g) return setFailed(true);
    setFailed(false);
    setGroups(g);
    if (g.length && !g.some((x) => x.id === current)) setApp({ communityId: g[0].id });
  }, [current, setApp]);
  useEffect(() => {
    void reload();
  }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // An invite link opens the join sheet.
  useEffect(() => {
    if (joinCode && signedIn) {
      setSection('groups');
      setSheet('join');
    }
  }, [joinCode, signedIn]);

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
  const [list, setList] = useState<Member[] | null>(null);
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [sheet, setSheet] = useState<null | 'invite' | 'plan' | 'settings' | { member: Member } | { read: number }>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, ps] = await Promise.all([loadMembers(group.id), loadPlans(group.id)]);
      setList(m);
      const active = ps.find((p) => p.status !== 'done') ?? null;
      setPlan(active);
      setDone(active ? await myDays(active.id) : new Set());
    } catch {
      setMsg(t.cmFailed);
    }
  }, [group.id, t.cmFailed]);
  useEffect(() => {
    void load();
  }, [load]);

  const active = list?.filter((m) => m.status === 'active') ?? [];
  const pending = list?.filter((m) => m.status === 'pending') ?? [];

  async function tick(day: number, on: boolean) {
    if (!plan) return;
    const next = new Set(done);
    if (on) next.add(day);
    else next.delete(day);
    setDone(next);
    try {
      await markDay(plan.id, day, on);
      if (on) {
        cue('correct');
        useApp.getState().markReadingDay();
        void pushProgress().catch(() => {});
      }
      setList(await loadMembers(group.id));
    } catch {
      setDone(done);
      setMsg(t.cmFailed);
    }
  }

  return (
    <div className="cm-group" style={{ ['--g' as string]: `var(--cm-${group.color})` }}>
      <div className="cm-card glass cm-hero">
        <div className="grow">
          <h2 className="title">{group.name}</h2>
          {group.description && <p className="caption">{group.description}</p>}
          <p className="caption">
            {t.cmMembersN(active.length)} · {t.cmRole[group.role]}
          </p>
        </div>
        <div className="cm-hero-actions">
          <Pressable className="btn btn-primary small" onClick={() => setSheet('invite')}>
            <UserPlus size={16} strokeWidth={STROKE} /> {t.cmInvite}
          </Pressable>
          <button className="icon-btn" onClick={() => setSheet('settings')} aria-label={t.cmEdit} title={t.cmEdit}>
            <Settings2 size={18} strokeWidth={STROKE} />
          </button>
        </div>
      </div>

      {plan === undefined ? null : plan ? (
        <TodayCard plan={plan} done={done} isAdmin={isAdmin} onRead={(day) => setSheet({ read: day })} onTick={tick} onChanged={load} />
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

      {isAdmin && pending.length > 0 && (
        <section className="cm-card glass">
          <h3 className="eyebrow">{t.cmWaiting}</h3>
          {pending.map((m) => (
            <div key={m.user_id} className="cm-member">
              <Avatar horse={m.avatar as Friend['avatar']} size={34} />
              <strong className="grow">{m.display_name}</strong>
              <Pressable
                className="btn btn-primary small"
                onClick={async () => {
                  await manageMember(group.id, m.user_id, 'approve').catch(() => setMsg(t.cmFailed));
                  void load();
                }}
              >
                <Check size={15} strokeWidth={STROKE} /> {t.cmApprove}
              </Pressable>
            </div>
          ))}
        </section>
      )}

      <section className="cm-card glass">
        <h3 className="eyebrow">{t.cmMembers}</h3>
        {active.map((m) => (
          <button key={m.user_id} className="cm-member" onClick={() => isAdmin && m.user_id !== myId && m.role !== 'owner' && setSheet({ member: m })} disabled={!isAdmin || m.user_id === myId || m.role === 'owner'}>
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
              {plan && <span className="caption">{t.cmDaysRead(m.days_read)}</span>}
            </span>
            {plan && m.read_today && (
              <span className="cm-today" title={t.cmReadToday}>
                <Check size={14} strokeWidth={2.6} />
              </span>
            )}
            {m.streak > 0 && <span className="cm-streak">🔥 {m.streak}</span>}
          </button>
        ))}
      </section>

      {isAdmin && plan && (
        <button className="link cm-newplan" onClick={() => setSheet('plan')}>
          <Plus size={15} strokeWidth={STROKE} /> {t.cmNewPlan}
        </button>
      )}
      {msg && <p className="caption form-msg is-error">{msg}</p>}

      <Sheet open={sheet !== null} onClose={() => setSheet(null)} label={group.name}>
        {sheet === 'invite' && <InviteSheet group={group} isAdmin={isAdmin} onChanged={onChanged} />}
        {sheet === 'plan' && (
          <PlanBuilder
            hasPlan={Boolean(plan)}
            onSave={async (p) => {
              await createPlan(group.id, p);
              setSheet(null);
              void load();
            }}
          />
        )}
        {sheet === 'settings' && <GroupSettings group={group} isAdmin={isAdmin} onChanged={() => { setSheet(null); onChanged(); }} />}
        {sheet && typeof sheet === 'object' && 'member' in sheet && (
          <MemberSheet
            group={group}
            m={sheet.member}
            onDone={() => {
              setSheet(null);
              void load();
            }}
          />
        )}
        {sheet && typeof sheet === 'object' && 'read' in sheet && plan && (
          <ReadSheet
            chapters={chaptersFor(plan, sheet.read)}
            lang={uiLang}
            done={done.has(sheet.read)}
            onDone={() => {
              void tick(sheet.read, true);
              setSheet(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function TodayCard({ plan, done, isAdmin, onRead, onTick, onChanged }: { plan: Plan; done: Set<number>; isAdmin: boolean; onRead: (day: number) => void; onTick: (day: number, on: boolean) => void; onChanged: () => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const st = planStatus(plan, done);
  const fmt = (d: Date) => d.toLocaleDateString(uiLang === 'ta' ? 'ta-IN' : undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const day = st.next ?? st.total;
  const chapters = chaptersFor(plan, day);
  const pct = Math.round((st.done / st.total) * 100);
  return (
    <section className="cm-card glass cm-today-card">
      <div className="cm-today-head">
        <span className="eyebrow">{plan.title}</span>
        {plan.status === 'paused' && <span className="cm-paused">⏸</span>}
      </div>
      {st.finished ? (
        <h2 className="title">{t.cmFinished}</h2>
      ) : (
        <>
          <p className="caption">{t.cmDayOf(day, st.total)}</p>
          <h2 className="title cm-chapters">{chaptersLabel(chapters, uiLang)}</h2>
          <p className={`caption cm-status ${st.behind > 1 ? 'is-behind' : ''}`}>
            {!st.started ? t.cmStartsOn(fmt(dateOfDay(plan, 1))) : st.behind > 0 ? t.cmBehind(st.behind) : st.todayIsRest ? t.cmRestDay : t.cmCaughtUp}
          </p>
          <div className="cm-today-actions">
            <Pressable className="btn btn-primary" onClick={() => onRead(day)}>
              <BookOpen size={18} strokeWidth={STROKE} /> {t.cmRead}
            </Pressable>
            <Pressable className="btn glass" onClick={() => onTick(day, true)}>
              <Check size={18} strokeWidth={STROKE} /> {t.cmIRead}
            </Pressable>
          </div>
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
      {isAdmin && (
        <div className="cm-plan-admin">
          <button
            className="link"
            onClick={async () => {
              await setPlanStatus(plan.id, plan.status === 'paused' ? 'active' : 'paused');
              onChanged();
            }}
          >
            {plan.status === 'paused' ? <Play size={14} strokeWidth={STROKE} /> : <Pause size={14} strokeWidth={STROKE} />} {plan.status === 'paused' ? t.cmResumePlan : t.cmPausePlan}
          </button>
          <button
            className="link"
            onClick={async () => {
              await setPlanStatus(plan.id, 'done');
              onChanged();
            }}
          >
            {t.cmEndPlan}
          </button>
        </div>
      )}
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
  const ch = chapters[i];
  useEffect(() => {
    setText(null);
    void chapterText(ch.b, ch.c).then((x) => x && setText(x));
  }, [ch.b, ch.c]);
  const langs: ('en' | 'ta')[] = qLang === 'both' ? [uiLang, uiLang === 'en' ? 'ta' : 'en'] : [qLang];
  const last = i === chapters.length - 1;
  return (
    <div className="tl-panel tl-reader">
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

function MemberSheet({ group, m, onDone }: { group: Group; m: Member; onDone: () => void }) {
  const t = useT();
  const act = async (a: 'make_admin' | 'make_member' | 'remove') => {
    if (a === 'remove' && !confirm(t.cmRemoveConfirm(m.display_name))) return;
    await manageMember(group.id, m.user_id, a).catch(() => {});
    onDone();
  };
  return (
    <div className="tl-panel">
      <div className="cm-member is-big">
        <Avatar horse={m.avatar as Friend['avatar']} size={44} />
        <div className="grow">
          <h2 className="title">{m.display_name}</h2>
          <p className="caption">{t.cmRole[m.role]}</p>
        </div>
      </div>
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
    </div>
  );
}

function GroupSettings({ group, isAdmin, onChanged }: { group: Group; isAdmin: boolean; onChanged: () => void }) {
  const t = useT();
  const [name, setName] = useState(group.name);
  const [about, setAbout] = useState(group.description);
  const [color, setColor] = useState(group.color);
  const owner = group.role === 'owner';
  return (
    <div className="tl-panel">
      <h2 className="title">{isAdmin ? t.cmEdit : group.name}</h2>
      {isAdmin && (
        <>
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

function PlanBuilder({ hasPlan, onSave }: { hasPlan: boolean; onSave: (p: PlanSpec & { title: string }) => Promise<void> }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
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
  const spec: PlanSpec = { books, chapters_per_day: pace === 'chapters' ? per : null, days_total: targetDays, reading_order: hasBoth ? order : 'canonical', start_date: start, rest_days: rest };
  const chapterCount = books.length ? chapterList(books).length : 0;
  const days = books.length ? totalDays(spec) : 0;
  const capped = targetDays != null && targetDays > chapterCount;
  const fmt = (d: Date) => d.toLocaleDateString(uiLang === 'ta' ? 'ta-IN' : undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const name = title.trim() || t.cmPreset[preset];
  const [lo, hi] = books.length ? dailyRange(spec) : [0, 0];

  return (
    <div className="tl-panel cm-builder">
      <h2 className="title">{t.cmNewPlan}</h2>

      <div className="tl-formfield">
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
      </div>

      {hasBoth && (
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

      <div className="tl-formfield">
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
      </div>

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
      </div>

      <label className="tl-formfield">
        <span className="caption">{t.cmPlanTitle}</span>
        <input className="field" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.cmPreset[preset]} />
      </label>

      {books.length > 0 && (
        <div className="cm-preview-box glass">
          <strong>{t.cmPreview(days, fmt(finishDate(spec)))}</strong>
          <span>{t.cmPerDayRange(lo, hi)}</span>
          <span className="caption">{t.cmDay1(chaptersLabel(chaptersFor(spec, 1), uiLang))}</span>
          {capped && <span className="caption">{t.cmCapped(days)}</span>}
        </div>
      )}
      {hasPlan && <p className="caption">{t.cmPlanReplaces}</p>}
      {msg && <p className="caption form-msg is-error">{msg}</p>}
      <Pressable
        className="btn btn-primary"
        disabled={!books.length || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave({ ...spec, days_total: capped ? chapterCount : spec.days_total, title: name });
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
