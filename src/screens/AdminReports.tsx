import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronLeft, RotateCcw, X } from 'lucide-react';
import { useApp, useT } from '../store';
import { spring } from '../motion/springs';
import { Pressable } from '../components/Pressable';
import { STROKE } from '../components/icons';
import { closeReport, listReports, type AdminReport } from '../online/adminReports';

/** Snapshot fields in a readable order, with friendly names. */
const FIELD_ORDER = ['reference', 'type', 'question_en', 'options_en', 'answer_en', 'question_ta', 'options_ta', 'answer_ta', 'question', 'answer', 'kjv', 'tamil_ov', 'title_en', 'text_en', 'title_ta', 'text_ta', 'name', 'text', 'date'];

/**
 * Admin → Reports: what players reported (wrong answer, typo, Tamil, confusing…), with
 * exactly what they saw. Mark each one fixed or dismissed; closed ones can be reopened.
 */
export function AdminReports({ onExit }: { onExit: () => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const [open, setOpen] = useState(true);
  const [list, setList] = useState<AdminReport[] | null>(null);
  const [failed, setFailed] = useState(false);

  async function load(which = open) {
    setFailed(false);
    try {
      setList(await listReports(which));
    } catch {
      setFailed(true);
    }
  }
  useEffect(() => {
    setList(null);
    void load(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function close(r: AdminReport, status: AdminReport['status']) {
    setList((l) => l?.filter((x) => x.id !== r.id) ?? null);
    try {
      await closeReport(r.id, status);
    } catch {
      setFailed(true);
      void load();
    }
  }
  const when = (iso: string) => new Date(iso).toLocaleString(uiLang === 'ta' ? 'ta-IN' : undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="screen recall" lang={uiLang}>
      <header className="recall-head">
        <Pressable className="chip glass" onClick={onExit} aria-label={t.back}>
          <ChevronLeft size={20} strokeWidth={STROKE} />
        </Pressable>
        <h1 className="title grow">{t.adminReports}</h1>
      </header>
      <div className="segmented small" role="tablist">
        {[true, false].map((v) => (
          <button key={String(v)} role="tab" aria-selected={open === v} className={open === v ? 'is-on' : ''} onClick={() => setOpen(v)}>
            {open === v && <motion.span layoutId="seg-reports" className="segmented-thumb" transition={spring.calm} />}
            <span>{v ? t.rpOpen : t.rpClosed}</span>
          </button>
        ))}
      </div>
      {failed && <p className="caption form-msg is-error">{t.cmFailed}</p>}
      {list && !list.length && <p className="caption note">{open ? t.rpNone : t.rpNoneClosed}</p>}
      <div className="rp-list">
        <AnimatePresence initial={false}>
          {list?.map((r) => {
            const fields = Object.entries(r.snapshot ?? {}).sort(([a], [b]) => (FIELD_ORDER.indexOf(a) + 99) % 99 - ((FIELD_ORDER.indexOf(b) + 99) % 99));
            return (
              <motion.article key={r.id} className="rp-card glass is-solid" layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} transition={spring.calm}>
                <div className="rp-head">
                  <span className={`rp-cat is-${r.category}`}>{t.reportCategory[r.category]}</span>
                  <span className="caption">
                    {t.rpKind[r.kind] ?? r.kind} · {r.lang === 'ta' ? 'தமிழ்' : 'EN'} · {when(r.created_at)}
                  </span>
                </div>
                {r.reason && <p className="rp-reason">“{r.reason}”</p>}
                <dl className="rp-fields">
                  {fields.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k.replace(/_/g, ' ')}</dt>
                      <dd lang={k.endsWith('_ta') || k === 'tamil_ov' ? 'ta' : undefined}>{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="caption rp-meta">
                  {r.question_id}
                  {r.app_version ? ` · v${r.app_version}` : ''}
                  {r.contact ? ` · ${t.rpContact}: ${r.contact}` : ''}
                  {!open && r.handled_at ? ` · ${r.status === 'fixed' ? t.rpFixed : t.rpDismissed} ${when(r.handled_at)}` : ''}
                </p>
                <div className="rp-actions">
                  {open ? (
                    <>
                      <button className="btn btn-primary small" onClick={() => void close(r, 'fixed')}>
                        <Check size={15} strokeWidth={STROKE} /> {t.rpFix}
                      </button>
                      <button className="btn glass small" onClick={() => void close(r, 'dismissed')}>
                        <X size={15} strokeWidth={STROKE} /> {t.rpDismiss}
                      </button>
                    </>
                  ) : (
                    <button className="btn glass small" onClick={() => void close(r, 'new')}>
                      <RotateCcw size={15} strokeWidth={STROKE} /> {t.rpReopen}
                    </button>
                  )}
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
