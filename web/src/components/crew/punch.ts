'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { crewApi } from '@/lib/crewApi';

// Punching, as in the Infinite Resources "My Time" app: the phone's location
// is attached when the browser allows it, and a punch made with no signal is
// kept on the phone and sent the moment there is a connection, carrying the
// time it really happened.

export interface QueuedPunch {
  type: 'in' | 'out';
  occurred_at: string;
  job_id?: string;
  break_minutes?: number;
  latitude?: number;
  longitude?: number;
  accuracy_m?: number;
}

const KEY = 'brushpro-crew-queue';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): QueuedPunch[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function write(q: QueuedPunch[]) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* storage full or blocked */ }
  cached = null;
  emit();
}

let cached: QueuedPunch[] | null = null;
const EMPTY: QueuedPunch[] = [];
function snapshot() {
  if (typeof window === 'undefined') return EMPTY;
  if (!cached) cached = read();
  return cached;
}

export function useQueue(): QueuedPunch[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    snapshot,
    () => EMPTY,
  );
}

export function enqueue(p: QueuedPunch) {
  write([...read(), p]);
}

export function clearQueue() {
  write([]);
}

const sendOne = (p: QueuedPunch) => {
  const body = { ...p, queued: true };
  return p.type === 'in' ? crewApi.clockIn(body) : crewApi.clockOut(body);
};

let flushing = false;
// Sends what is waiting, oldest first. A punch the server refuses (already
// clocked in, and so on) is dropped; only a missing connection keeps it.
export async function flushQueue(): Promise<number> {
  if (flushing || typeof navigator === 'undefined' || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    const q = read();
    const left: QueuedPunch[] = [];
    for (let i = 0; i < q.length; i++) {
      try {
        await sendOne(q[i]);
        sent++;
      } catch (e) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (!status) { left.push(...q.slice(i)); break; }
      }
    }
    write(left);
  } finally {
    flushing = false;
  }
  return sent;
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

// Where the phone is, if it will say within four seconds. Never blocks a punch.
export function position(): Promise<{ latitude: number; longitude: number; accuracy_m: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: { latitude: number; longitude: number; accuracy_m: number } | null) => {
      if (!settled) { settled = true; resolve(v); }
    };
    setTimeout(() => done(null), 4000);
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => done({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy_m: Math.round(p.coords.accuracy) }),
        () => done(null),
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 30_000 },
      );
    } catch { done(null); }
  });
}

// Was this a network failure (keep the punch) rather than a refusal?
export const isNetworkError = (e: unknown) => !(e as { response?: unknown })?.response;
