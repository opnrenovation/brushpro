'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { crewApi } from '@/lib/crewApi';
import { clockTime, dayLabel, hrs, hhmm, STATUS_STYLE } from '@/components/crew/format';
import { useT, errorText } from '@/components/crew/i18n';

interface Entry {
  id: string;
  job_id: string | null;
  work_date: string;
  hours: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  source: 'OWNER' | 'CREW';
  review_note: string | null;
  notes: string | null;
  job: { id: string; name: string } | null;
}

function shift(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const emptyForm = { id: '', work_date: '', start_time: '07:00', end_time: '15:30', break_minutes: '30', job_id: '', notes: '' };

export default function CrewTimecardPage() {
  const qc = useQueryClient();
  const [week, setWeek] = useState<string | undefined>(undefined);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [error, setError] = useState('');
  const { t, locale } = useT();

  const { data, isLoading } = useQuery({ queryKey: ['crew', 'timecard', week], queryFn: () => crewApi.timecard(week) });
  const { data: jobsData } = useQuery({ queryKey: ['crew', 'jobs'], queryFn: () => crewApi.jobs() });
  const card = data?.data?.data;
  const jobs: Array<{ id: string; name: string }> = jobsData?.data?.data || [];
  const entries: Entry[] = card?.entries || [];

  const done = () => {
    qc.invalidateQueries({ queryKey: ['crew'] });
    setForm(null);
    setError('');
  };
  const save = useMutation({
    mutationFn: (f: typeof emptyForm) => {
      const payload = { ...f, break_minutes: Number(f.break_minutes) || 0, job_id: f.job_id || undefined };
      return f.id ? crewApi.updateTime(f.id, payload) : crewApi.addTime(payload);
    },
    onSuccess: done,
    onError: (e) => setError(errorText(t, e, locale)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => crewApi.deleteTime(id),
    onSuccess: done,
    onError: (e) => setError(errorText(t, e, locale)),
  });

  if (isLoading || !card) return <p className="crew-muted">{t.loading}</p>;

  const days = Array.from({ length: 7 }, (_, i) => shift(card.week_start, i));
  const isCurrentWeek = card.today >= card.week_start && card.today <= card.week_end;

  function openEdit(e: Entry) {
    if (e.status === 'APPROVED' || (e.clock_in && !e.clock_out)) return;
    setError('');
    setForm({
      id: e.id, work_date: e.work_date.slice(0, 10), start_time: hhmm(e.clock_in) || '07:00',
      end_time: hhmm(e.clock_out) || '15:30', break_minutes: String(e.break_minutes), job_id: e.job_id || '', notes: e.notes || '',
    });
  }

  return (
    <div>
      <div className="crew-row" style={{ marginBottom: 12 }}>
        <button aria-label="Previous week" className="crew-link-btn" onClick={() => setWeek(shift(card.week_start, -7))}><ChevronLeft size={24} strokeWidth={1.5} /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{isCurrentWeek ? t.myWeek : t.weekOf}</div>
          <div className="crew-muted">{dayLabel(card.week_start, { month: 'short', day: 'numeric' }, locale)} – {dayLabel(card.week_end, { month: 'short', day: 'numeric' }, locale)}</div>
        </div>
        <button aria-label="Next week" className="crew-link-btn" disabled={isCurrentWeek} style={{ opacity: isCurrentWeek ? 0.3 : 1 }}
          onClick={() => setWeek(shift(card.week_start, 7))}><ChevronRight size={24} strokeWidth={1.5} /></button>
      </div>

      <div className="crew-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center' }}>
        <div><div className="crew-muted">{t.total}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{hrs(card.total_hours)}</div></div>
        <div><div className="crew-muted">{t.regular}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{hrs(card.regular_hours)}</div></div>
        <div><div className="crew-muted">{t.overtime}</div><div style={{ fontSize: 20, fontWeight: 700, color: Number(card.overtime_hours) > 0 ? '#b35f00' : undefined }}>{hrs(card.overtime_hours)}</div></div>
      </div>
      {card.pending > 0 && (
        <p className="crew-muted" style={{ marginBottom: 12 }}>{t.waitingApproval(card.pending)}</p>
      )}

      {days.map((d) => {
        const list = entries.filter((e) => e.work_date.slice(0, 10) === d);
        const total = list.filter((e) => e.status !== 'REJECTED').reduce((t, e) => t + Number(e.hours), 0);
        const future = d > card.today;
        return (
          <div key={d} className="crew-card" style={{ padding: 14, opacity: future ? 0.5 : 1 }}>
            <div className="crew-row">
              <span style={{ fontWeight: 600 }}>{dayLabel(d, undefined, locale)}{d === card.today ? ` · ${t.today}` : ''}</span>
              <span style={{ fontWeight: 600 }}>{list.length ? hrs(total) : ''}</span>
            </div>
            {list.map((e) => {
              const st = STATUS_STYLE[e.status];
              const live = e.clock_in && !e.clock_out;
              return (
                <button key={e.id} onClick={() => openEdit(e)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--bg)', border: 'none', borderRadius: 10, padding: 10, marginTop: 8, cursor: e.status === 'APPROVED' || live ? 'default' : 'pointer', color: 'inherit' }}>
                  <div className="crew-row">
                    <span style={{ fontSize: 14 }}>
                      {e.clock_in ? `${clockTime(e.clock_in, locale)} – ${live ? t.now : clockTime(e.clock_out, locale)}` : t.enteredByOffice}
                      {e.break_minutes > 0 && <span className="crew-muted"> · {t.breakShort(e.break_minutes)}</span>}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{live ? t.onTheClock : hrs(e.hours)}</span>
                  </div>
                  <div className="crew-row" style={{ marginTop: 4 }}>
                    <span className="crew-muted">{e.job?.name || t.noJobShort}</span>
                    {!live && <span style={{ fontSize: 11, fontWeight: 600, background: st.bg, color: st.fg, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{e.status === 'APPROVED' ? t.stApprovedTime : e.status === 'REJECTED' ? t.stRejectedTime : t.stPendingTime}</span>}
                  </div>
                  {e.status === 'REJECTED' && e.review_note && <div style={{ fontSize: 13, color: '#d70015', marginTop: 4 }}>{t.officeSays} {e.review_note}</div>}
                </button>
              );
            })}
          </div>
        );
      })}

      <button className="crew-big-btn" style={{ background: '#1e40af', fontSize: 16, padding: 16 }}
        onClick={() => { setError(''); setForm({ ...emptyForm, work_date: card.today <= card.week_end ? card.today : card.week_end }); }}>
        <Plus size={18} strokeWidth={1.5} /> {t.addMissed}
      </button>
      <p className="crew-muted" style={{ marginTop: 8, textAlign: 'center' }}>{t.addMissedHelp}</p>

      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
          <div className="crew-card" style={{ width: '100%', maxWidth: 560, margin: 0, borderRadius: '20px 20px 0 0', padding: '20px 16px calc(20px + env(safe-area-inset-bottom))', maxHeight: '90dvh', overflowY: 'auto' }}>
            <div className="crew-row" style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{form.id ? t.fixShift : t.addMissed}</h2>
              <button aria-label="Close" onClick={() => setForm(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', padding: 4 }}><X size={22} strokeWidth={1.5} /></button>
            </div>
            <label className="crew-label">{t.date}</label>
            <input className="crew-input" type="date" max={card.today} value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} style={{ marginBottom: 12 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label className="crew-label">{t.start}</label><input className="crew-input" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
              <div><label className="crew-label">{t.end}</label><input className="crew-input" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
            </div>
            <label className="crew-label" style={{ marginTop: 12 }}>{t.breakMinutes}</label>
            <input className="crew-input" type="number" inputMode="numeric" min="0" max="240" step="5" value={form.break_minutes} onChange={(e) => setForm({ ...form, break_minutes: e.target.value })} style={{ marginBottom: 12 }} />
            <label className="crew-label">{t.job}</label>
            <select className="crew-input" value={form.job_id} onChange={(e) => setForm({ ...form, job_id: e.target.value })} style={{ marginBottom: 12 }}>
              <option value="">{t.noJobShort}</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
            <label className="crew-label">{t.noteForOffice}</label>
            <input className="crew-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t.noteExample} style={{ marginBottom: 14 }} />
            {error && <p style={{ color: '#FF3B30', fontSize: 14, marginBottom: 12 }}>{error}</p>}
            <button className="crew-big-btn" style={{ background: '#1e40af', fontSize: 16, padding: 16 }} disabled={save.isPending} onClick={() => save.mutate(form)}>
              {save.isPending ? t.saving : t.sendForApproval}
            </button>
            {form.id && (
              <button className="crew-link-btn" style={{ width: '100%', color: '#FF3B30', marginTop: 6 }}
                onClick={() => { if (confirm(t.deleteShiftQ)) remove.mutate(form.id); }}>
                {t.deleteShift}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
