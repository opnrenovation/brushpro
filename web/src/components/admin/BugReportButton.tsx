'use client';
import { useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bug, ImagePlus, CheckCircle2 } from 'lucide-react';
import { bugReportsApi } from '@/lib/api';
import { Modal, Field, inputStyle, errMsg } from './ui';
import { downscaleImage as downscale } from '@/lib/image';

const empty = { type: 'BUG', priority: 'NORMAL', title: '', description: '' };

export default function BugReportButton() {
  const pathname = usePathname();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState(empty);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = useMutation({
    mutationFn: () => bugReportsApi.create({
      ...form,
      screenshot: screenshot || undefined,
      page_url: typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname,
    }),
    onSuccess: () => {
      setSent(true);
      qc.invalidateQueries({ queryKey: ['bug-reports'] });
    },
    onError: (e) => setError(errMsg(e, 'Could not send the report. Please try again.')),
  });

  function close() {
    setOpen(false);
    setSent(false);
    setForm(empty);
    setScreenshot(null);
    setError('');
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setScreenshot(await downscale(file));
    } catch {
      setError('That file could not be read as an image.');
    }
  }

  function send() {
    if (!form.title.trim()) return setError('Add a short title.');
    if (!form.description.trim()) return setError('Describe what happened or what you would like changed.');
    setError('');
    submit.mutate();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bug-report-fab"
        aria-label="Report a bug or request a change"
        title="Report a bug or request a change"
      >
        <Bug size={18} strokeWidth={1.5} />
        <span>Report</span>
      </button>

      {open && (
        <Modal title={sent ? 'Thanks' : 'Report a bug or request a change'} onClose={close} maxWidth={500}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <CheckCircle2 size={40} strokeWidth={1.5} color="#34C759" style={{ marginBottom: 12 }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
                Your report was sent. You can follow its status under Bug Reports.
              </p>
              <button className="btn btn-primary" onClick={close}>Done</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 12 }}>
                <Field label="Type">
                  <select className="glass-input" style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="BUG">Something is broken</option>
                    <option value="FEATURE_REQUEST">Change or new feature</option>
                    <option value="QUESTION">Question</option>
                  </select>
                </Field>
                <Field label="How urgent?">
                  <select className="glass-input" style={inputStyle} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent: blocking work</option>
                  </select>
                </Field>
              </div>
              <Field label="Title">
                <input className="glass-input" style={inputStyle} value={form.title} maxLength={200}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Invoice total is wrong after adding a discount" />
              </Field>
              <Field label="Details">
                <textarea className="glass-input" style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What did you do, what did you expect, and what happened instead? For a change, describe what you want it to do." />
              </Field>
              <div style={{ marginBottom: 12 }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
                {screenshot ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={screenshot} alt="Screenshot preview" style={{ width: 96, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(0,0,0,0.1)' }} />
                    <button className="btn btn-ghost" onClick={() => setScreenshot(null)}>Remove</button>
                  </div>
                ) : (
                  <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                    <ImagePlus size={15} strokeWidth={1.5} /> Attach screenshot
                  </button>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                The page you are on ({pathname}) is included automatically.
              </p>
              {error && <p style={{ color: '#FF3B30', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={close}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={submit.isPending} onClick={send}>
                  {submit.isPending ? 'Sending...' : 'Send Report'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
