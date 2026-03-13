'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  User,
  CheckCircle,
  Loader2,
  AlertCircle,
  Download,
} from 'lucide-react';

interface AppointmentType {
  id: string;
  name: string;
  duration_minutes: number;
  description?: string;
}

interface TimeSlot {
  time: string; // "09:00"
  display: string; // "9:00 AM"
}

interface BookingForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Mini Calendar component
function MiniCalendar({
  selectedDate,
  onSelect,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = formatDate(today);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button
          type="button"
          onClick={prevMonth}
          className="btn btn-ghost"
          style={{ padding: '6px 10px', fontSize: 13 }}
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="btn btn-ghost"
          style={{ padding: '6px 10px', fontSize: 13 }}
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
        {DAYS.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, padding: '4px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isPast = dateStr < todayStr;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isPast}
              onClick={() => !isPast && onSelect(dateStr)}
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: 8,
                border: isToday && !isSelected ? '1px solid rgba(0,122,255,0.5)' : '1px solid transparent',
                background: isSelected
                  ? '#007AFF'
                  : 'transparent',
                color: isPast
                  ? 'rgba(255,255,255,0.2)'
                  : isSelected
                  ? '#fff'
                  : 'rgba(255,255,255,0.85)',
                fontSize: 13,
                fontWeight: isSelected ? 600 : 400,
                cursor: isPast ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function generateIcs(
  date: string,
  time: string,
  firstName: string,
  lastName: string,
  typeName: string
): string {
  const dt = new Date(`${date}T${time}:00`);
  const dtEnd = new Date(dt.getTime() + 60 * 60 * 1000);

  function fmt(d: Date) {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OPN Renovation//Booking//EN',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(dt)}`,
    `DTEND:${fmt(dtEnd)}`,
    `SUMMARY:${typeName} - OPN Renovation`,
    `DESCRIPTION:Appointment for ${firstName} ${lastName}`,
    'LOCATION:Des Moines, Iowa',
    `UID:${Date.now()}@opnrenovation.com`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export default function BookPage() {
  const [step, setStep] = useState(1);

  // Step 1 - appointment types
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [selectedType, setSelectedType] = useState<AppointmentType | null>(null);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Step 2 - date
  const [selectedDate, setSelectedDate] = useState('');

  // Step 3 - time slots
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Step 4 - details
  const [form, setForm] = useState<BookingForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Step 5 - confirmed
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    fetch('/api/public/appointment-types')
      .then((r) => r.json())
      .then((data) => setTypes(data.appointment_types ?? data ?? []))
      .catch(() => setTypes([]))
      .finally(() => setLoadingTypes(false));
  }, []);

  useEffect(() => {
    if (!selectedDate || !selectedType) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetch(`/api/public/availability?date=${selectedDate}&type_id=${selectedType.id}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, selectedType]);

  async function handleSubmit() {
    if (!selectedType || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch('/api/public/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_type_id: selectedType.id,
          date: selectedDate,
          time: selectedSlot.time,
          ...form,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Booking failed. Please try again.');
      }

      setConfirmed(true);
      setStep(5);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Booking failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function downloadIcs() {
    if (!selectedType || !selectedDate || !selectedSlot) return;
    const ics = generateIcs(
      selectedDate,
      selectedSlot.time,
      form.first_name,
      form.last_name,
      selectedType.name
    );
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'opn-appointment.ics';
    a.click();
    URL.revokeObjectURL(url);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: 15,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff',
    outline: 'none',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0A0A0F',
        padding: '80px 24px 80px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0,122,255,0.1) 0%, transparent 60%), #0A0A0F',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto' }}>
        {/* Back to home */}
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'rgba(255,255,255,0.5)',
            textDecoration: 'none',
            fontSize: 14,
            marginBottom: 40,
          }}
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
          Back to home
        </Link>

        {/* Progress steps */}
        {!confirmed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40 }}>
            {[1, 2, 3, 4].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: s < 4 ? 1 : 'initial' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: step >= s ? '#007AFF' : 'rgba(255,255,255,0.08)',
                    border: step >= s ? 'none' : '1px solid rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    color: step >= s ? '#fff' : 'rgba(255,255,255,0.4)',
                    flexShrink: 0,
                    transition: 'all 0.3s',
                  }}
                >
                  {step > s ? <CheckCircle size={16} strokeWidth={1.5} /> : s}
                </div>
                {s < 4 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: step > s ? '#007AFF' : 'rgba(255,255,255,0.1)',
                      transition: 'background 0.3s',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="glass" style={{ padding: '40px' }}>
          {/* STEP 1: Select appointment type */}
          {step === 1 && (
            <div>
              <h1
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 32,
                  fontWeight: 600,
                  color: '#fff',
                  marginBottom: 8,
                }}
              >
                Book an Appointment
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 32 }}>
                What type of appointment would you like to schedule?
              </p>

              {loadingTypes ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <Loader2 size={28} strokeWidth={1.5} style={{ color: '#007AFF', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : types.length === 0 ? (
                <div
                  style={{
                    padding: '32px',
                    textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 14,
                  }}
                >
                  No appointment types available at this time. Please call us to schedule.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {types.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setSelectedType(t); setStep(2); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '18px 20px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        textAlign: 'left',
                      }}
                    >
                      <div>
                        <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                          {t.name}
                        </div>
                        {t.description && (
                          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{t.description}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: 13, flexShrink: 0, marginLeft: 16 }}>
                        <Clock size={14} strokeWidth={1.5} />
                        {t.duration_minutes} min
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Pick date */}
          {step === 2 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn btn-ghost"
                  style={{ padding: '6px 10px' }}
                >
                  <ChevronLeft size={16} strokeWidth={1.5} />
                </button>
                <div>
                  <h2 style={{ color: '#fff', fontWeight: 600, fontSize: 20 }}>Select a Date</h2>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{selectedType?.name}</p>
                </div>
              </div>

              <MiniCalendar selectedDate={selectedDate} onSelect={setSelectedDate} />

              <div style={{ marginTop: 28 }}>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!selectedDate}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', opacity: selectedDate ? 1 : 0.4 }}
                >
                  Continue
                  <ChevronRight size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Pick time slot */}
          {step === 3 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn btn-ghost"
                  style={{ padding: '6px 10px' }}
                >
                  <ChevronLeft size={16} strokeWidth={1.5} />
                </button>
                <div>
                  <h2 style={{ color: '#fff', fontWeight: 600, fontSize: 20 }}>Select a Time</h2>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                    {selectedDate ? formatDateDisplay(selectedDate) : ''}
                  </p>
                </div>
              </div>

              {loadingSlots ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <Loader2 size={28} strokeWidth={1.5} style={{ color: '#007AFF', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : slots.length === 0 ? (
                <div
                  style={{
                    padding: '32px',
                    textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 14,
                  }}
                >
                  No available times on this date. Please select a different date.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {slots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      style={{
                        padding: '12px 8px',
                        borderRadius: 10,
                        border: selectedSlot?.time === slot.time
                          ? '1px solid #007AFF'
                          : '1px solid rgba(255,255,255,0.1)',
                        background: selectedSlot?.time === slot.time
                          ? 'rgba(0,122,255,0.15)'
                          : 'rgba(255,255,255,0.04)',
                        color: selectedSlot?.time === slot.time ? '#007AFF' : 'rgba(255,255,255,0.8)',
                        fontSize: 14,
                        fontWeight: selectedSlot?.time === slot.time ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {slot.display}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 28 }}>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  disabled={!selectedSlot}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', opacity: selectedSlot ? 1 : 0.4 }}
                >
                  Continue
                  <ChevronRight size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Your details */}
          {step === 4 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn btn-ghost"
                  style={{ padding: '6px 10px' }}
                >
                  <ChevronLeft size={16} strokeWidth={1.5} />
                </button>
                <div>
                  <h2 style={{ color: '#fff', fontWeight: 600, fontSize: 20 }}>Your Details</h2>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                    {selectedDate ? formatDateDisplay(selectedDate) : ''} at {selectedSlot?.display}
                  </p>
                </div>
              </div>

              {submitError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    background: 'rgba(255,59,48,0.12)',
                    border: '1px solid rgba(255,59,48,0.3)',
                    borderRadius: 10,
                    marginBottom: 20,
                    color: '#FF3B30',
                    fontSize: 14,
                  }}
                >
                  <AlertCircle size={16} strokeWidth={1.5} />
                  {submitError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
                    First Name *
                  </label>
                  <input
                    value={form.first_name}
                    onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))}
                    required
                    placeholder="Alex"
                    style={inputStyle}
                    className="glass-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
                    Last Name *
                  </label>
                  <input
                    value={form.last_name}
                    onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))}
                    required
                    placeholder="Johnson"
                    style={inputStyle}
                    className="glass-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                    placeholder="alex@example.com"
                    style={inputStyle}
                    className="glass-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(515) 555-0000"
                    style={inputStyle}
                    className="glass-input"
                  />
                </div>
              </div>

              <div style={{ marginBottom: 28 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
                  Notes (optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Any details about your project..."
                  style={{ ...inputStyle, resize: 'vertical' }}
                  className="glass-input"
                />
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !form.first_name || !form.last_name || !form.email}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '14px' }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
                    Confirming...
                  </>
                ) : (
                  <>
                    <Calendar size={18} strokeWidth={1.5} />
                    Confirm Booking
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 5: Confirmed */}
          {step === 5 && confirmed && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'rgba(52,199,89,0.15)',
                  border: '1px solid rgba(52,199,89,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px',
                  color: '#34C759',
                }}
              >
                <CheckCircle size={36} strokeWidth={1.5} />
              </div>

              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 32,
                  fontWeight: 600,
                  color: '#fff',
                  marginBottom: 12,
                }}
              >
                Booking Confirmed
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginBottom: 32, lineHeight: 1.7 }}>
                Your appointment has been booked. You will receive a confirmation email shortly.
              </p>

              <div
                className="glass"
                style={{
                  padding: '20px 24px',
                  textAlign: 'left',
                  marginBottom: 28,
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Calendar size={16} strokeWidth={1.5} style={{ color: '#007AFF', flexShrink: 0 }} />
                    <span style={{ color: '#fff', fontSize: 14 }}>
                      {selectedDate ? formatDateDisplay(selectedDate) : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Clock size={16} strokeWidth={1.5} style={{ color: '#007AFF', flexShrink: 0 }} />
                    <span style={{ color: '#fff', fontSize: 14 }}>{selectedSlot?.display}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <User size={16} strokeWidth={1.5} style={{ color: '#007AFF', flexShrink: 0 }} />
                    <span style={{ color: '#fff', fontSize: 14 }}>
                      {form.first_name} {form.last_name}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  type="button"
                  onClick={downloadIcs}
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Download size={16} strokeWidth={1.5} />
                  Add to Calendar (.ics)
                </button>
                <Link href="/" className="btn btn-ghost" style={{ justifyContent: 'center' }}>
                  Back to Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}
