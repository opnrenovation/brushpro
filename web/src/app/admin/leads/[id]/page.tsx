'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Phone, Mail, Calendar, FileText, Clock, ChevronRight } from 'lucide-react';
import { leadsApi } from '@/lib/api';

const STAGES = ['NEW', 'CONTACTED', 'APPOINTMENT', 'ESTIMATE_SENT', 'NEGOTIATING', 'WON', 'LOST'];
const STAGE_COLORS: Record<string, string> = {
  NEW: '#007AFF', CONTACTED: '#FF9500', APPOINTMENT: '#5856D6',
  ESTIMATE_SENT: '#007AFF', NEGOTIATING: '#FF9500', WON: '#34C759', LOST: '#FF3B30',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [lostReason, setLostReason] = useState('');
  const [showLostModal, setShowLostModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', id],
    queryFn: () => leadsApi.get(id),
  });

  const stageMutation = useMutation({
    mutationFn: (body: { stage: string; lost_reason?: string }) => leadsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });

  if (isLoading) return <div style={{ padding: 40, color: 'rgba(255,255,255,0.4)' }}>Loading...</div>;
  const lead = data?.data?.data || data?.data;
  if (!lead) return <div style={{ padding: 40, color: '#FF3B30' }}>Lead not found</div>;

  const handleStage = (stage: string) => {
    if (stage === 'LOST') { setShowLostModal(true); return; }
    stageMutation.mutate({ stage });
  };
  const confirmLost = () => {
    if (!lostReason.trim()) return;
    stageMutation.mutate({ stage: 'LOST', lost_reason: lostReason });
    setShowLostModal(false);
  };

  return (
    <div>
      <button onClick={() => router.back()} className="btn btn-ghost" style={{ marginBottom: 20, padding: '7px 14px', fontSize: 13 }}>
        <ArrowLeft size={15} strokeWidth={1.5} /> Back
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Left column */}
        <div>
          {/* Header */}
          <div className="glass" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                  {lead.contact.first_name} {lead.contact.last_name}
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{lead.service_needed || 'General Inquiry'}</p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: STAGE_COLORS[lead.stage], background: STAGE_COLORS[lead.stage] + '20', padding: '5px 12px', borderRadius: 20, border: `1px solid ${STAGE_COLORS[lead.stage]}40` }}>
                {lead.stage.replace(/_/g, ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <a href={`tel:${lead.contact.phone}`} className="btn btn-ghost" style={{ fontSize: 13, padding: '8px 14px', textDecoration: 'none' }}>
                <Phone size={15} strokeWidth={1.5} color="#007AFF" /> {lead.contact.phone || 'No phone'}
              </a>
              <a href={`mailto:${lead.contact.email}`} className="btn btn-ghost" style={{ fontSize: 13, padding: '8px 14px', textDecoration: 'none' }}>
                <Mail size={15} strokeWidth={1.5} color="#007AFF" /> Email
              </a>
            </div>
          </div>

          {/* Stage Pipeline */}
          <div className="glass" style={{ padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
              Pipeline Stage
            </h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STAGES.map((s) => {
                const active = lead.stage === s;
                const color = STAGE_COLORS[s];
                return (
                  <button key={s} onClick={() => handleStage(s)}
                    style={{
                      padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${color}40`,
                      background: active ? color + '20' : 'rgba(255,255,255,0.05)',
                      color: active ? color : 'rgba(255,255,255,0.5)',
                      transition: 'all 0.15s',
                    }}>
                    {s.replace(/_/g, ' ')}
                    {active && <ChevronRight size={12} style={{ marginLeft: 4, display: 'inline' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity Timeline */}
          {lead.activities?.length > 0 && (
            <div className="glass" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>Activity</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lead.activities.map((a: { id: string; type: string; description: string; created_at: string; user?: { name: string } }) => (
                  <div key={a.id} style={{ display: 'flex', gap: 12 }}>
                    <Clock size={14} color="rgba(255,255,255,0.3)" strokeWidth={1.5} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 14, color: '#fff' }}>{a.description}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                        {a.user?.name && `${a.user.name} · `}
                        {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div>
          {/* Details */}
          <div className="glass" style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Details</h3>
            {[
              { label: 'Source', value: lead.source?.replace(/_/g, ' ') },
              { label: 'Address', value: lead.project_address },
              { label: 'Heard From', value: lead.heard_from },
            ].filter((r) => r.value).map(({ label, value }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, color: '#fff' }}>{value}</div>
              </div>
            ))}
            {lead.message && (
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>Message</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{lead.message}</div>
              </div>
            )}
          </div>

          {/* Estimate */}
          {lead.estimate && (
            <div className="glass" style={{ padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Estimate</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText size={16} color="#007AFF" strokeWidth={1.5} />
                <span style={{ fontWeight: 600, color: '#fff' }}>{lead.estimate.estimate_number}</span>
                <span className="pill pill-blue" style={{ marginLeft: 'auto' }}>{lead.estimate.status}</span>
              </div>
            </div>
          )}

          {/* Appointment */}
          {lead.appointment && (
            <div className="glass" style={{ padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Appointment</h3>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Calendar size={16} color="#FF9500" strokeWidth={1.5} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', marginBottom: 2 }}>
                    {new Date(lead.appointment.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                    {new Date(lead.appointment.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {lead.stage === 'WON' && !lead.job_id && (
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Convert to Job
            </button>
          )}
        </div>
      </div>

      {/* Lost reason modal */}
      {showLostModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="glass" style={{ width: 400, padding: 28 }}>
            <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 6 }}>Mark as Lost</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 16 }}>Please provide a reason for losing this lead.</p>
            <textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Price too high, chose competitor..."
              className="glass-input"
              style={{ width: '100%', padding: '10px 14px', fontSize: 14, minHeight: 80, resize: 'vertical', display: 'block', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setShowLostModal(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmLost} disabled={!lostReason.trim()} style={{ flex: 1, justifyContent: 'center' }}>Confirm Lost</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
