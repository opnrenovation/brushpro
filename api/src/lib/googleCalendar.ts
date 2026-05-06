/**
 * Google Calendar integration — service account auth.
 *
 * Setup (one-time):
 *  1. Create a Google Cloud project → enable Calendar API.
 *  2. Create a Service Account → download the JSON key.
 *  3. Set env vars:
 *       GOOGLE_SERVICE_ACCOUNT_KEY = <entire JSON key file as a single-line string>
 *       GOOGLE_CALENDAR_ID         = owner's calendar email (e.g. alex@gmail.com)
 *  4. Share the owner's Google Calendar with the service account email
 *     (give it "Make changes to events" permission).
 *
 * All functions are no-ops when env vars are missing so the app still works
 * without the integration configured.
 */

import { google, calendar_v3 } from 'googleapis';

// ── Internal helpers ──────────────────────────────────────────────────────────

function getCalendarId(): string | null {
  return process.env.GOOGLE_CALENDAR_ID || null;
}

let _calendar: calendar_v3.Calendar | null = null;

function getCalendar(): calendar_v3.Calendar | null {
  if (_calendar) return _calendar;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  try {
    const key = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    _calendar = google.calendar({ version: 'v3', auth });
    return _calendar;
  } catch (err) {
    console.error('[GCal] Failed to init Google Calendar client:', err);
    return null;
  }
}

function toRfc3339(date: Date): string {
  return date.toISOString();
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface GCalAppointment {
  id: string;               // appointment DB id (used as extendedProperty)
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  notes?: string;
  appointment_type_name: string;
  scheduled_at: Date;
  duration_minutes: number;
  address?: string;         // job address for the quote location
}

/**
 * Create a Google Calendar event and return its event ID.
 * Returns null if Google Calendar is not configured or if creation fails.
 */
export async function createCalendarEvent(appt: GCalAppointment): Promise<string | null> {
  const cal = getCalendar();
  const calendarId = getCalendarId();
  if (!cal || !calendarId) return null;

  const start = new Date(appt.scheduled_at);
  const end = new Date(start.getTime() + appt.duration_minutes * 60 * 1000);

  const location = appt.address || 'Des Moines, Iowa';
  const clientName = `${appt.first_name} ${appt.last_name}`;
  const description = [
    `Client: ${clientName}`,
    `Email: ${appt.email}`,
    appt.phone ? `Phone: ${appt.phone}` : null,
    appt.notes ? `Notes: ${appt.notes}` : null,
    `Booking ID: ${appt.id}`,
  ].filter(Boolean).join('\n');

  try {
    const res = await cal.events.insert({
      calendarId,
      requestBody: {
        summary: `${appt.appointment_type_name} — ${clientName}`,
        description,
        location,
        start: { dateTime: toRfc3339(start), timeZone: 'America/Chicago' },
        end: { dateTime: toRfc3339(end), timeZone: 'America/Chicago' },
        extendedProperties: {
          private: { brushpro_appointment_id: appt.id },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'email', minutes: 1440 }, // 24 h before
          ],
        },
      },
    });

    console.log(`[GCal] Created event ${res.data.id} for appointment ${appt.id}`);
    return res.data.id ?? null;
  } catch (err) {
    console.error('[GCal] Failed to create event:', err);
    return null;
  }
}

/**
 * Update an existing Google Calendar event (reschedule or edit details).
 */
export async function updateCalendarEvent(
  googleEventId: string,
  appt: GCalAppointment,
): Promise<void> {
  const cal = getCalendar();
  const calendarId = getCalendarId();
  if (!cal || !calendarId || !googleEventId) return;

  const start = new Date(appt.scheduled_at);
  const end = new Date(start.getTime() + appt.duration_minutes * 60 * 1000);
  const clientName = `${appt.first_name} ${appt.last_name}`;
  const location = appt.address || 'Des Moines, Iowa';
  const description = [
    `Client: ${clientName}`,
    `Email: ${appt.email}`,
    appt.phone ? `Phone: ${appt.phone}` : null,
    appt.notes ? `Notes: ${appt.notes}` : null,
    `Booking ID: ${appt.id}`,
  ].filter(Boolean).join('\n');

  try {
    await cal.events.update({
      calendarId,
      eventId: googleEventId,
      requestBody: {
        summary: `${appt.appointment_type_name} — ${clientName}`,
        description,
        location,
        start: { dateTime: toRfc3339(start), timeZone: 'America/Chicago' },
        end: { dateTime: toRfc3339(end), timeZone: 'America/Chicago' },
        extendedProperties: {
          private: { brushpro_appointment_id: appt.id },
        },
      },
    });
    console.log(`[GCal] Updated event ${googleEventId}`);
  } catch (err) {
    console.error('[GCal] Failed to update event:', err);
  }
}

/**
 * Delete a Google Calendar event (e.g. on cancellation).
 */
export async function deleteCalendarEvent(googleEventId: string): Promise<void> {
  const cal = getCalendar();
  const calendarId = getCalendarId();
  if (!cal || !calendarId || !googleEventId) return;

  try {
    await cal.events.delete({ calendarId, eventId: googleEventId });
    console.log(`[GCal] Deleted event ${googleEventId}`);
  } catch (err) {
    // 404 = already gone, safe to ignore
    const status = (err as { code?: number }).code;
    if (status !== 404) console.error('[GCal] Failed to delete event:', err);
  }
}

/**
 * Return busy time ranges for a given date (used to block availability slots).
 * Returns an array of { start, end } Date pairs.
 */
export async function getGoogleBusyTimes(
  date: string, // "YYYY-MM-DD"
): Promise<Array<{ start: Date; end: Date }>> {
  const cal = getCalendar();
  const calendarId = getCalendarId();
  if (!cal || !calendarId) return [];

  const dayStart = new Date(`${date}T00:00:00-05:00`); // CT
  const dayEnd   = new Date(`${date}T23:59:59-05:00`);

  try {
    const res = await cal.freebusy.query({
      requestBody: {
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        timeZone: 'America/Chicago',
        items: [{ id: calendarId }],
      },
    });

    const busy = res.data.calendars?.[calendarId]?.busy ?? [];
    return busy
      .filter((b) => b.start && b.end)
      .map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }));
  } catch (err) {
    console.error('[GCal] Failed to fetch busy times:', err);
    return [];
  }
}

