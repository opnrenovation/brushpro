'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MapPin, CalendarDays, ChevronRight } from 'lucide-react';
import { crewApi } from '@/lib/crewApi';
import { dayLabel, hrs } from '@/components/crew/format';

interface Job {
  id: string;
  name: string;
  address: string;
  municipality: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  my_hours: number;
}

const STATUS_LABEL: Record<string, string> = {
  ESTIMATING: 'Upcoming', ACTIVE: 'In progress', INVOICED: 'Wrapping up', COMPLETE: 'Done', CANCELLED: 'Cancelled',
};

export default function CrewJobsPage() {
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['crew', 'jobs', showAll], queryFn: () => crewApi.jobs(showAll) });
  const jobs: Job[] = data?.data?.data || [];

  return (
    <div>
      <div className="crew-row" style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Your Jobs</h1>
        <button className="crew-link-btn" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Current only' : 'Show finished'}</button>
      </div>
      {isLoading && <p className="crew-muted">Loading...</p>}
      {!isLoading && jobs.length === 0 && (
        <div className="crew-card" style={{ textAlign: 'center', padding: 28 }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>No jobs assigned</p>
          <p className="crew-muted">When the office puts you on a job it shows up here.</p>
        </div>
      )}
      {jobs.map((j) => (
        <Link key={j.id} href={`/crew/jobs/${j.id}`} className="crew-card" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="crew-row">
              <span style={{ fontWeight: 700, fontSize: 16 }}>{j.name}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: j.status === 'ACTIVE' ? '#1f8a3b' : 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{STATUS_LABEL[j.status] || j.status}</span>
            </div>
            <div className="crew-muted" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <MapPin size={13} strokeWidth={1.5} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.address}</span>
            </div>
            <div className="crew-muted" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <CalendarDays size={13} strokeWidth={1.5} />
              {j.start_date ? `${dayLabel(j.start_date, { month: 'short', day: 'numeric' })}${j.end_date ? ` – ${dayLabel(j.end_date, { month: 'short', day: 'numeric' })}` : ''}` : 'Dates not set'}
              {j.my_hours > 0 && <span> · you: {hrs(j.my_hours)}</span>}
            </div>
          </div>
          <ChevronRight size={18} strokeWidth={1.5} color="var(--text-tertiary)" />
        </Link>
      ))}
    </div>
  );
}
