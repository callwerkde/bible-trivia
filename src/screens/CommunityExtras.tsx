import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Check, CheckSquare, ExternalLink, Pencil, Headphones, Plus, Send, Tent, Trash2, Tv, X } from 'lucide-react';
import { useApp, useT } from '../store';
import { cue } from '../feedback';
import { Pressable } from '../components/Pressable';
import { STROKE } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { VersePicker, type VersePick } from '../components/VersePicker';
import { verseWords } from '../engine/bible';
import { isoDay } from '../engine/readingPlan';
import { refLabel } from '../engine/timeline';
import { useAccount } from '../online/account';
import { useTot } from '../online/tot';
import { loadTot, totIndex, openUrl, type TotCatalog, type TotSeries } from '../engine/tot';
import {
  createTask,
  updateTask,
  deleteTask,
  setTaskPart,
  isTaskDone,
  taskComments,
  addTaskComment,
  deleteTaskComment,
  tasks as loadTasks,
  cached,
  remember,
  type TaskDone,
  type TaskComment,
  type Community,
  type Member,
  type Task,
  type TaskInput,
} from '../online/community';
import { bibleFirst } from '../online/stock';
import { Avatar } from './Friends';
import { ReportButton } from '../components/Report';
import { taskCommentTarget } from '../online/reports';
import type { Friend } from '../online/account';

const KIND_ICON = { read: BookOpen, listen: Headphones, watch: Tv, do: CheckSquare } as const;
const fmtDate = (iso: string, lang: 'en' | 'ta') => new Date(iso + (iso.length === 10 ? 'T00:00' : '')).toLocaleDateString(lang === 'ta' ? 'ta-IN' : undefined, { day: 'numeric', month: 'short' });
const daysUntil = (iso: string) => Math.round((new Date(iso + 'T00:00').getTime() - new Date(isoDay(new Date()) + 'T00:00').getTime()) / 86_400_000);

/** The group's tasks (in the app or outside it). */
export function GroupExtras({ group, isAdmin, members, refresh = 0, onCount }: { group: Community; isAdmin: boolean; members: Member[]; refresh?: number; onCount?: (n: number) => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const myId = useAccount((s) => s.session?.user.id);
  const [taskList, setTaskList] = useState<{ list: Task[]; done: TaskDone } | null>(() => cached(`tasks:${group.id}`));
  const [sheet, setSheet] = useState<null | 'task' | { task: Task } | { edit: Task }>(null);
  // One row of task cards (2 on a phone, 3 on wider screens); the rest behind "View all".
  const [showAll, setShowAll] = useState(false);
  const perRow = typeof window !== 'undefined' && window.innerWidth >= 700 ? 3 : 2;

  const load = useCallback(async () => {
    try {
      const fresh = await loadTasks(group.id);
      setTaskList(fresh);
      remember(`tasks:${group.id}`, fresh);
    } catch {
      setTaskList((cur) => cur ?? { list: [], done: {} });
    }
  }, [group.id]);
  // Again when someone ticks a task (refresh goes up) or you come back to the app.
  useEffect(() => {
    void load();
  }, [load, refresh]);

  const active = members.filter((m) => m.status === 'active');
  const count = taskList?.list.length ?? 0;
  // The books the tasks point to are saved for offline first.
  const taskBooks = [...new Set((taskList?.list ?? []).map((x) => x.ref?.b).filter((b): b is string => Boolean(b)))].join(',');
  useEffect(() => {
    if (taskBooks) bibleFirst(taskBooks.split(','));
  }, [taskBooks]);
  useEffect(() => {
    onCount?.(count);
  }, [count, onCount]);
  /** Tick a part (or the whole task, part 0). Ticking the last part finishes the task. */
  async function togglePart(task: Task, part: number, on: boolean) {
    if (!myId || !taskList) return;
    const mineNow = taskList.done[task.id]?.[myId] ?? [];
    let next = on ? [...new Set([...mineNow, part])] : mineNow.filter((p) => p !== part);
    const allParts = task.parts.length ? task.parts.every((_, i) => next.includes(i + 1)) : next.includes(0);
    const whole = task.parts.length > 0 && (on ? allParts : mineNow.includes(0));
    if (task.parts.length) next = allParts ? [...new Set([...next, 0])] : next.filter((p) => p !== 0);
    setTaskList({ ...taskList, done: { ...taskList.done, [task.id]: { ...(taskList.done[task.id] ?? {}), [myId]: next } } });
    if (on && (part === 0 || allParts)) cue('correct');
    await setTaskPart(task.id, part, on, whole).catch(() => load());
    // Ticks in a library task also mark the message done in your library (the database does it).
    if (task.tot_items?.length) void useTot.getState().load();
  }

  return (
    <>
      {(isAdmin || count > 0) && (
        <section className="cm-tasks" aria-label={t.cmCommunityTasks}>
          {taskList && count === 0 && <p className="caption cm-tasks-empty">{isAdmin ? t.cmNoTasksAdmin : t.cmNoTasks}</p>}
          <div className="cm-task-grid">
            {taskList?.list.slice(0, showAll ? undefined : perRow * 2).map((task) => {
              const doneUsers = Object.keys(taskList.done[task.id] ?? {}).filter((u) => isTaskDone(taskList.done, task.id, u));
              const mine = Boolean(myId && isTaskDone(taskList.done, task.id, myId));
              const myParts = (myId && taskList.done[task.id]?.[myId]?.filter((p) => p > 0).length) || 0;
              const left = task.due_on ? daysUntil(task.due_on) : null;
              const Icon = KIND_ICON[task.kind] ?? BookOpen;
              const soon = left != null && left <= 1 && left >= 0 && !mine;
              return (
                <div key={task.id} className={`cm-tile glass is-solid ${mine ? 'is-done' : ''}`}>
                  <button className="cm-tile-main" onClick={() => setSheet({ task })}>
                    <span className="cm-tile-kind">
                      <Icon size={15} strokeWidth={STROKE} /> {t.cmTaskKinds[task.kind]}
                    </span>
                    <strong className="cm-tile-title">{task.title}</strong>
                    <span className={`caption ${soon ? 'cm-soon' : ''}`}>
                      {task.due_on ? (left != null && left < 0 ? t.cmEnded : t.cmDueOn(fmtDate(task.due_on, uiLang))) : task.ref ? refLabel(task.ref, uiLang) : ''}
                    </span>
                    <span className="cm-mini-bar" aria-hidden>
                      <i style={{ width: `${active.length ? Math.round((doneUsers.length / active.length) * 100) : 0}%` }} />
                    </span>
                    <span className="caption">{t.cmDoneBy(doneUsers.length, active.length)}</span>
                  </button>
                  {task.parts.length ? (
                    <button className="cm-check is-parts cm-tile-check" onClick={() => setSheet({ task })} aria-label={task.title}>
                      {mine ? <Check size={15} strokeWidth={2.8} /> : <span>{t.cmPartsMine(myParts, task.parts.length)}</span>}
                    </button>
                  ) : (
                    <button className="cm-check cm-tile-check" aria-pressed={mine} aria-label={task.title} onClick={() => void togglePart(task, 0, !mine)}>
                      {mine && <Check size={15} strokeWidth={2.8} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="cm-tasks-foot">
            {isAdmin && (
              <button className="link cm-head-btn" onClick={() => setSheet('task')}>
                <Plus size={15} strokeWidth={STROKE} /> {t.cmAddTask}
              </button>
            )}
            {count > perRow * 2 && (
              <button className="link cm-more" onClick={() => setShowAll(!showAll)}>
                {showAll ? t.cmShowLess : t.cmViewAll(count)}
              </button>
            )}
          </div>
        </section>
      )}

      <Sheet open={sheet !== null} onClose={() => setSheet(null)} label={group.name}>
        {sheet && typeof sheet === 'object' && 'edit' in sheet && (
          <TaskBuilder
            initial={sheet.edit}
            onSave={async (task) => {
              await updateTask(sheet.edit.id, task);
              setSheet(null);
              void load();
            }}
          />
        )}
        {sheet === 'task' && (
          <TaskBuilder
            onSave={async (task) => {
              await createTask(group.id, task);
              setSheet(null);
              void load();
            }}
          />
        )}
        {sheet && typeof sheet === 'object' && 'task' in sheet && (
          <TaskSheet
            task={sheet.task}
            members={active}
            done={taskList?.done ?? {}}
            onPart={(part, on) => void togglePart(sheet.task, part, on)}
            isAdmin={isAdmin}
            onEdit={() => setSheet({ edit: sheet.task })}
            onDelete={async () => {
              if (!confirm(t.cmDeleteTaskConfirm)) return;
              await deleteTask(sheet.task.id).catch(() => {});
              setSheet(null);
              void load();
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function TaskSheet({ task, members, done, onPart, isAdmin, onEdit, onDelete }: { task: Task; members: Member[]; done: TaskDone; onPart: (part: number, on: boolean) => void; isAdmin: boolean; onEdit: () => void; onDelete: () => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const myId = useAccount((s) => s.session?.user.id);
  const [words, setWords] = useState<{ en: string; ta: string } | null>(null);
  useEffect(() => {
    if (task.ref) void verseWords(task.ref.b, task.ref.c, task.ref.v ?? 1, task.ref.v2 ?? (task.ref.v ? undefined : 5)).then(setWords);
  }, [task.ref]);
  // A task made from the Tent of Testimony library: each part opens its own message.
  const [totItems, setTotItems] = useState<ReturnType<typeof totIndex> | null>(null);
  useEffect(() => {
    if (task.tot_items?.length) void loadTot().then((c) => setTotItems(totIndex(c)), () => {});
  }, [task.tot_items]);
  const mine = (myId && done[task.id]?.[myId]) || [];
  const doneBy = Object.keys(done[task.id] ?? {}).filter((u) => isTaskDone(done, task.id, u));
  const Icon = KIND_ICON[task.kind] ?? BookOpen;
  return (
    <div className="tl-panel cm-task-sheet">
      <span className="caption cm-task-kind">
        <Icon size={14} strokeWidth={STROKE} /> {t.cmTaskKinds[task.kind]}
        {task.due_on && ` · ${t.cmDueOn(fmtDate(task.due_on, uiLang))}`}
      </span>
      <h2 className="title">{task.title}</h2>
      {task.note && <p className="cm-task-note">{task.note}</p>}
      {task.link && (
        <a className="btn glass cm-link" href={task.link} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} strokeWidth={STROKE} /> {t.cmOpenLink} <span className="cm-link-host">{hostOf(task.link)}</span>
        </a>
      )}
      {task.ref && (
        <figure className="gen-verse glass cm-task-verse">
          <figcaption className="caption">
            <BookOpen size={14} strokeWidth={STROKE} /> {refLabel(task.ref, uiLang)}
          </figcaption>
          {words && <p className="verse" lang={uiLang}>{words[uiLang]}</p>}
        </figure>
      )}
      {task.parts.length > 0 ? (
        <div className="cm-parts">
          <span className="caption">{t.cmSelfTracked}</span>
          {task.parts.map((p, i) => {
            const on = mine.includes(i + 1);
            const item = totItems?.get(task.tot_items?.[i] ?? 0)?.item;
            return (
              <div key={i} className="cm-part-row">
                <button className={`cm-part ${on ? 'is-done' : ''}`} onClick={() => onPart(i + 1, !on)} aria-pressed={on}>
                  <span className="cm-check">{on && <Check size={14} strokeWidth={2.8} />}</span>
                  <span lang={item ? 'ta' : undefined}>{p}</span>
                </button>
                {item && (
                  <a className="cm-part-open" href={openUrl(item)} target="_blank" rel="noopener noreferrer" aria-label={item.yt ? t.totWatch : t.totOpenRead} title={item.yt ? t.totWatch : t.totOpenRead}>
                    {item.yt ? <Tv size={16} strokeWidth={STROKE} /> : item.audio?.length ? <Headphones size={16} strokeWidth={STROKE} /> : <ExternalLink size={16} strokeWidth={STROKE} />}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Pressable className={`btn ${mine.includes(0) ? 'glass' : 'btn-primary'}`} onClick={() => onPart(0, !mine.includes(0))}>
          <Check size={17} strokeWidth={STROKE} /> {mine.includes(0) ? t.cmDoneMine : t.cmMarkDone}
        </Pressable>
      )}
      <h3 className="eyebrow">{t.cmDoneBy(doneBy.length, members.length)}</h3>
      <div className="cm-done-list">
        {members.map((m) => (
          <span key={m.user_id} className={`cm-done-chip ${doneBy.includes(m.user_id) ? 'is-done' : ''}`}>
            {doneBy.includes(m.user_id) && <Check size={12} strokeWidth={2.8} />} {m.display_name}
          </span>
        ))}
      </div>
      <TaskComments task={task} isAdmin={isAdmin} />
      {isAdmin && (
        <Pressable className="btn glass" onClick={onEdit}>
          <Pencil size={16} strokeWidth={STROKE} /> {t.cmEditTask}
        </Pressable>
      )}
      {isAdmin && (
        <Pressable className="btn glass cm-danger" onClick={onDelete}>
          <Trash2 size={16} strokeWidth={STROKE} /> {t.cmDeleteTaskConfirm.replace('?', '')}
        </Pressable>
      )}
    </div>
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** The discussion under a task. */
function TaskComments({ task, isAdmin }: { task: Task; isAdmin: boolean }) {
  const t = useT();
  const [list, setList] = useState<TaskComment[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => void taskComments(task.id).then(setList).catch(() => setList([]));
  useEffect(load, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="cm-comments">
      <h3 className="eyebrow">{t.cmComments}</h3>
      {list && !list.length && <p className="caption">{t.cmNoComments}</p>}
      {list?.map((c) => (
        <div key={c.id} className="comment glass">
          <Avatar horse={c.avatar as Friend['avatar']} size={30} />
          <div className="grow">
            <div className="comment-head">
              <strong>{c.display_name}</strong>
            </div>
            <p className="comment-body">{c.body}</p>
          </div>
          <div className="comment-actions">
            {(c.mine || isAdmin) && (
              <button
                className="icon-btn"
                aria-label={t.cmDeleteComment}
                onClick={async () => {
                  if (!confirm(t.cmDeleteComment)) return;
                  await deleteTaskComment(c.id).catch(() => {});
                  load();
                }}
              >
                <X size={15} strokeWidth={STROKE} />
              </button>
            )}
            {!c.mine && <ReportButton target={taskCommentTarget(c)} compact />}
          </div>
        </div>
      ))}
      <div className="cm-comment-new">
        <textarea className="field" rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.cmCommentHint} aria-label={t.cmCommentHint} />
        <Pressable
          className="btn btn-primary small"
          disabled={!text.trim() || busy}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              await addTaskComment(task.id, text);
              setText('');
              load();
            } catch (e) {
              setMsg(/too many/.test((e as Error).message) ? t.commentTooMany : t.cmFailed);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send size={15} strokeWidth={STROKE} /> {t.cmSend}
        </Pressable>
      </div>
      {msg && <p className="caption form-msg is-error">{msg}</p>}
    </section>
  );
}

function TaskBuilder({ initial, onSave }: { initial?: Task; onSave: (t: TaskInput) => Promise<void> }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  // From a link (anything), or from the Tent of Testimony library (a series and a range).
  const [source, setSource] = useState<'link' | 'tot'>(initial?.tot_items?.length ? 'tot' : 'link');
  const [cat, setCat] = useState<TotCatalog | null>(null);
  const [seriesId, setSeriesId] = useState('');
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [totIds, setTotIds] = useState<number[]>(initial?.tot_items ?? []);
  useEffect(() => {
    if (source === 'tot' && !cat) void loadTot().then(setCat, () => {});
  }, [source, cat]);
  const allSeries: { s: TotSeries; label: string }[] = cat ? cat.sections.flatMap((sec) => sec.series.map((s) => ({ s, label: sec.series.length > 1 ? `${uiLang === 'en' ? sec.en : sec.ta} › ${uiLang === 'en' ? s.en : s.ta}` : uiLang === 'en' ? sec.en : sec.ta }))) : [];
  const series = allSeries.find((x) => x.s.id === seriesId)?.s ?? null;
  /** Fill the task from a series and a range (at most 10 items). */
  function chooseTot(sid: string, from: number, to: number) {
    const sr = allSeries.find((x) => x.s.id === sid)?.s;
    if (!sr) return;
    const a = Math.max(0, Math.min(from, sr.items.length - 1));
    const b = Math.max(a, Math.min(to, a + 9, sr.items.length - 1));
    setSeriesId(sid);
    setRange([a, b]);
    const items = sr.items.slice(a, b + 1);
    const label = (i: (typeof items)[number]) => (i.n != null ? `${String(i.n).padStart(2, '0')} - ${i.ta}` : i.ta);
    setTotIds(items.map((i) => i.id));
    setKind(items.some((i) => i.yt) ? 'watch' : items.some((i) => i.audio?.length) ? 'listen' : 'read');
    if (items.length === 1) {
      setTitle(items[0].ta.slice(0, 120));
      setParts([]);
      setLink(openUrl(items[0]));
    } else {
      const ends = [items[0], items[items.length - 1]].map((i) => (i.n != null ? i.n : sr.items.indexOf(i) + 1));
      setTitle(`${sr.ta} ${ends[0]}–${ends[1]}`.slice(0, 120));
      setParts(items.map((i) => label(i).slice(0, 120)));
      setLink(sr.url);
    }
  }
  const [kind, setKind] = useState<Task['kind']>(initial?.kind ?? 'read');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [link, setLink] = useState(initial?.link ?? '');
  const [parts, setParts] = useState<string[]>(initial?.parts ?? []);
  const [withVerse, setWithVerse] = useState(Boolean(initial?.ref));
  const [pick, setPick] = useState<VersePick>(initial?.ref ? { book: initial.ref.b, chapter: initial.ref.c, from: initial.ref.v ?? 1, to: initial.ref.v2 ?? 0 } : { book: 'PSA', chapter: 23, from: 1, to: 0 });
  const [due, setDue] = useState(initial?.due_on ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const linkOk = !link.trim() || /^https?:\/\/\S+\.\S+/i.test(link.trim());
  const fromTot = source === 'tot';
  return (
    <div className="tl-panel">
      <h2 className="title">{initial ? t.cmEditTask : t.cmNewTask}</h2>
      {!initial && (
        <div className="tl-formfield">
          <div className="tl-pills">
            <button className={`tl-chip ${!fromTot ? 'is-on' : ''}`} onClick={() => setSource('link')}>
              <ExternalLink size={14} strokeWidth={STROKE} /> {t.cmFromLink}
            </button>
            <button
              className={`tl-chip ${fromTot ? 'is-on' : ''}`}
              onClick={() => {
                setSource('tot');
              }}
            >
              <Tent size={14} strokeWidth={STROKE} /> {t.cmFromTot}
            </button>
          </div>
        </div>
      )}
      {fromTot && !initial && (
        <>
          {!cat && <p className="caption">{t.totOffline}</p>}
          {cat && (
            <>
              <label className="tl-formfield">
                <span className="caption">{t.cmTotSeries}</span>
                <select className="field" value={seriesId} onChange={(e) => chooseTot(e.target.value, 0, 0)}>
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
                <div className="cm-tot-range">
                  {([0, 1] as const).map((end) => (
                    <label key={end} className="tl-formfield">
                      <span className="caption">{end ? t.cmTotTo : t.cmTotFrom}</span>
                      <select
                        className="field"
                        lang="ta"
                        value={range[end]}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (end) chooseTot(series.id, Math.min(range[0], v), v);
                          else chooseTot(series.id, v, Math.max(v, range[1]));
                        }}
                      >
                        {series.items.map((i, k) =>
                          end && (k < range[0] || k > range[0] + 9) ? null : (
                            <option key={i.id} value={k}>
                              {i.n != null ? `${i.n} - ` : ''}
                              {i.ta.slice(0, 40)}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  ))}
                  <span className="caption">{t.cmTotMax}</span>
                </div>
              )}
            </>
          )}
        </>
      )}
      <div className="tl-formfield">
        <span className="caption">{t.cmTaskKind}</span>
        <div className="tl-pills">
          {(['read', 'listen', 'watch', 'do'] as const).map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <button key={k} className={`tl-chip ${kind === k ? 'is-on' : ''}`} onClick={() => setKind(k)}>
                <Icon size={14} strokeWidth={STROKE} /> {t.cmTaskKinds[k]}
              </button>
            );
          })}
        </div>
      </div>
      <label className="tl-formfield">
        <span className="caption">{t.cmTaskTitle}</span>
        <input className="field" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.cmTaskTitleHint} />
      </label>
      <label className="tl-formfield">
        <span className="caption">{t.cmPreface}</span>
        <textarea className="field" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.cmPrefaceHint} />
      </label>
      {!fromTot && <label className="tl-formfield">
        <span className="caption">{t.cmLink}</span>
        <input className="field" type="url" inputMode="url" maxLength={500} value={link} onChange={(e) => setLink(e.target.value)} placeholder={t.cmLinkHint} />
        {!linkOk && <span className="caption form-msg is-error">{t.cmLinkBad}</span>}
      </label>}
      {fromTot && parts.length > 0 && (
        <div className="tl-formfield">
          <span className="caption">{t.cmParts}</span>
          <ol className="cm-tot-preview" lang="ta">
            {parts.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </div>
      )}
      {!fromTot && <div className="tl-formfield">
        <span className="caption">{t.cmParts}</span>
        {parts.map((p, i) => (
          <div key={i} className="cm-part-edit">
            <input className="field" maxLength={120} value={p} onChange={(e) => setParts(parts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={t.cmPartHint(i + 1)} />
            <button className="icon-btn" onClick={() => setParts(parts.filter((_, j) => j !== i))} aria-label="×">
              <X size={16} strokeWidth={STROKE} />
            </button>
          </div>
        ))}
        {parts.length < 10 && (
          <button className="btn glass small cm-add-part" onClick={() => setParts([...parts, ''])}>
            <Plus size={15} strokeWidth={STROKE} /> {t.cmAddPart}
          </button>
        )}
      </div>}
      <label className="tl-check">
        <input type="checkbox" checked={withVerse} onChange={(e) => setWithVerse(e.target.checked)} /> {t.cmTaskVerse}
      </label>
      {withVerse && <VersePicker value={pick} onChange={setPick} offlineNote={t.offlineNotLoaded} />}
      <label className="tl-formfield">
        <span className="caption">{t.cmDue}</span>
        <input className="field" type="date" min={initial ? undefined : isoDay(new Date())} value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      {msg && <p className="caption form-msg is-error">{msg}</p>}
      <Pressable
        className="btn btn-primary"
        disabled={!title.trim() || !linkOk || busy || (fromTot && !totIds.length)}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave({
              kind,
              title: title.trim(),
              note: note.trim(),
              link: link.trim() || null,
              parts: parts.map((p, i) => p.trim() || t.cmPartHint(i + 1).split(',')[0]),
              ref: withVerse ? { b: pick.book, c: pick.chapter, v: pick.from, ...(pick.to > pick.from ? { v2: pick.to } : {}) } : null,
              due_on: due || null,
              ...(fromTot ? { tot_items: totIds } : {}),
            });
          } catch {
            setMsg(t.cmFailed);
            setBusy(false);
          }
        }}
      >
        {initial ? <Check size={17} strokeWidth={STROKE} /> : <Plus size={17} strokeWidth={STROKE} />} {initial ? t.cmSaveTask : t.cmAddTask}
      </Pressable>
    </div>
  );
}
