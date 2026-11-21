'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Crew app wording in English and Spanish. Ported from the Infinite Resources
// "My Time" app; the Spanish is theirs wherever the same phrase exists there.
// Errors arrive from the server as codes and are worded here, so every
// message reads in the language the phone is set to.

const en = {
  // shell
  appName: 'OPN Crew', signOut: 'Sign out', signOutQ: 'Sign out of the crew app?',
  tabClock: 'Clock', tabWeek: 'Week', tabJobs: 'Jobs', tabOff: 'Time off', tabNews: 'News',
  language: 'Language',
  // sign in
  signInLede: 'Clock in, check your hours and see your jobs.',
  emailOrPhone: 'Email or phone', pin: 'PIN', pinPlaceholder: '4 to 6 digits',
  signIn: 'Sign In', signingIn: 'Signing in...', noPin: 'No PIN yet? Ask the office to set one up.',
  needLogin: 'Enter your email or phone and your PIN.',
  // clock (from IR)
  holdHint: 'Press and hold for three seconds.',
  holdIn: 'Hold to\nclock in', holdOut: 'Hold to\nclock out',
  keepHolding: 'Keep holding…', released: 'Let go too soon — try again.',
  notWorking: 'You are not clocked in.', working: 'You are clocked in',
  since: (t: string) => `since ${t}`,
  clockedIn: 'Clocked in', clockedOut: 'Clocked out',
  haveAGoodShift: 'Have a good shift.', seeYouNext: 'Thanks — see you next shift.',
  savedOffline: 'Saved. It will send when you have signal.',
  done: 'Done', online: 'Online', offline: 'No signal — punches are saved',
  waitingToSend: (n: number) => `${n} waiting to send`,
  job: 'Job', noJob: 'No specific job (shop, errands)', noJobShort: 'No specific job',
  noJobsYet: 'You are not on any jobs yet. You can still clock in for shop time.',
  breakLabel: 'Unpaid break today', minutes: (n: number) => (n ? `${n} min` : 'None'),
  switchJob: 'Moving to another job? Switch job', switchTo: 'Switch to this job', cancel: 'Cancel',
  switched: 'Switched jobs',
  locationNote: 'Your location is saved with each punch so the office can see you were on site.',
  today: 'Today', thisWeek: 'This week', yourJobs: 'Your jobs',
  hi: (n: string) => `Hi ${n}`,
  // week / time card
  myWeek: 'My week', weekOf: 'Week of', total: 'Total', regular: 'Regular', overtime: 'Overtime',
  waitingApproval: (n: number) => `${n} ${n === 1 ? 'shift is' : 'shifts are'} waiting for the office to approve. Only approved time is paid.`,
  stApprovedTime: 'Approved', stPendingTime: 'Waiting for approval', stRejectedTime: 'Not approved',
  onTheClock: 'On the clock', now: 'now', enteredByOffice: 'Hours entered by office',
  breakShort: (n: number) => `${n}m break`, officeSays: 'Office:',
  addMissed: 'Add Missed Time', addMissedHelp: 'Forgot to clock in? Add the shift here and the office will review it. Tap a shift to fix it until it is approved.',
  fixShift: 'Fix Shift', date: 'Date', start: 'Start', end: 'End', breakMinutes: 'Unpaid break (minutes)',
  noteForOffice: 'Note for the office', noteExample: 'e.g. Phone died, forgot to clock in',
  sendForApproval: 'Send for Approval', saving: 'Saving...', deleteShift: 'Delete shift', deleteShiftQ: 'Delete this shift?',
  // jobs
  jobsTitle: 'Your Jobs', currentOnly: 'Current only', showFinished: 'Show finished',
  noJobsTitle: 'No jobs assigned', noJobsBody: 'When the office puts you on a job it shows up here.',
  datesNotSet: 'Dates not set', you: 'you',
  jobStatus: { ESTIMATING: 'Upcoming', ACTIVE: 'In progress', INVOICED: 'Wrapping up', COMPLETE: 'Done', CANCELLED: 'Cancelled' } as Record<string, string>,
  backToJobs: 'Jobs', forCustomer: (n: string) => `For ${n}`, directions: 'Directions',
  clockedInHere: 'You are clocked in on this job', clockInHere: 'Clock In Here', switchHere: 'Switch to This Job',
  switchQ: 'Clock out of your current job and into this one?',
  instructions: 'Instructions', crew: 'Crew', yourHoursHere: (h: string) => `Your hours on this job: ${h}`,
  jobUpdates: 'Job updates', updatePlaceholder: 'What got done? Anything the office should know?',
  photo: 'Photo', removePhoto: 'Remove photo', post: 'Post Update', posting: 'Posting...',
  notOnList: 'This job is not on your list.',
  // time off (from IR)
  timeOff: 'Time off',
  cantMakeIt: "Can't make it today", cantMakeItSub: 'Tell the office now',
  requestOff: 'Request time off', requestOffSub: 'Pick the days you need',
  yourRequests: 'Your time off', noRequests: 'Nothing booked.',
  callOffTitle: "Can't make it today", callOffLede: 'The office is told straight away. Nobody has to approve this.',
  requestTitle: 'Request time off', requestLede: 'Pick the days. You will hear back once it is decided.',
  reason: 'Reason', note: 'Anything to add?', notePlaceholder: 'Optional',
  firstDay: 'First day', lastDay: 'Last day',
  reasons: {
    sick: 'Sick', family_emergency: 'Family emergency', child_care: 'Child care',
    no_transportation: 'No ride / car trouble', medical_appointment: 'Doctor or medical appointment',
    weather: 'Weather / roads', legal: 'Court or legal appointment', vacation: 'Vacation',
    family_event: 'Family event', personal: 'Personal', other: 'Other',
  } as Record<string, string>,
  sendCallOff: 'Tell the office', sendRequest: 'Send request',
  stPending: 'Waiting', stApproved: 'Approved', stDenied: 'Denied', stCancelled: 'Withdrawn', stReported: 'Reported',
  withdraw: 'Withdraw', withdrawQ: 'Withdraw this?', yes: 'Yes', no: 'No',
  dayCount: (n: number) => (n === 1 ? '1 day' : `${n} days`),
  // news
  news: 'Announcements', noNews: 'Nothing new.', newTag: 'New',
  loading: 'Loading...',
  err: {
    already_clocked_in: 'You are already clocked in.',
    no_open_punch: 'You are not clocked in yet.',
    not_assigned: 'You are not on that job. Check with the office.',
    same_job: 'You are already on that job.',
    overlaps_existing: (d: string | null) => (d ? `You already have time off on ${d}.` : 'You already have time off on those days.'),
    request_must_be_future: 'Requests start tomorrow at the earliest. For today, call off instead.',
    still_clocked_in: 'You are clocked in. Clock out first, then call off if you cannot finish.',
    end_before_start: 'The last day cannot be before the first day.',
    span_too_long: 'That is too many days. Check the dates.',
    too_far_ahead: 'That date is too far away.',
    already_past: 'Those days have already passed.',
    already_decided: 'That has already been decided.',
    already_approved: 'This time is already approved. Ask the office to change it.',
    clock_out_first: 'Clock out first.',
    pick_date: 'Pick a date.', future_day: 'You cannot log time for a future day.',
    need_times: 'Enter a start and end time.', bad_length: 'That shift length does not look right.',
    missing_field: 'Fill in every field.', not_found: 'Not found.',
    bad_login: 'That email or phone and PIN did not match.',
    pin_locked: 'Too many tries. Wait 15 minutes or ask the office to reset your PIN.',
    network: 'Could not reach the office. Check your connection.',
    generic: 'Something went wrong. Please try again.',
  } as Record<string, string | ((d: string | null) => string)>,
};

type Strings = typeof en;

const es: Strings = {
  appName: 'OPN Crew', signOut: 'Cerrar sesión', signOutQ: '¿Cerrar sesión en la app?',
  tabClock: 'Reloj', tabWeek: 'Semana', tabJobs: 'Trabajos', tabOff: 'Ausencias', tabNews: 'Avisos',
  language: 'Idioma',
  signInLede: 'Marque entrada, revise sus horas y vea sus trabajos.',
  emailOrPhone: 'Correo o teléfono', pin: 'PIN', pinPlaceholder: '4 a 6 dígitos',
  signIn: 'Entrar', signingIn: 'Entrando...', noPin: '¿No tiene PIN? Pídale uno a la oficina.',
  needLogin: 'Escriba su correo o teléfono y su PIN.',
  holdHint: 'Mantenga presionado tres segundos.',
  holdIn: 'Mantenga para\nmarcar entrada', holdOut: 'Mantenga para\nmarcar salida',
  keepHolding: 'Siga presionando…', released: 'Soltó muy pronto — intente de nuevo.',
  notWorking: 'No ha marcado entrada.', working: 'Entrada marcada',
  since: (t: string) => `desde las ${t}`,
  clockedIn: 'Entrada marcada', clockedOut: 'Salida marcada',
  haveAGoodShift: 'Que tenga buen turno.', seeYouNext: 'Gracias — hasta el próximo turno.',
  savedOffline: 'Guardado. Se enviará cuando tenga señal.',
  done: 'Listo', online: 'En línea', offline: 'Sin señal — los registros se guardan',
  waitingToSend: (n: number) => `${n} por enviar`,
  job: 'Trabajo', noJob: 'Sin trabajo específico (taller, mandados)', noJobShort: 'Sin trabajo específico',
  noJobsYet: 'Todavía no tiene trabajos asignados. Puede marcar entrada para tiempo de taller.',
  breakLabel: 'Descanso sin pago hoy', minutes: (n: number) => (n ? `${n} min` : 'Ninguno'),
  switchJob: '¿Se va a otro trabajo? Cambiar de trabajo', switchTo: 'Cambiar a este trabajo', cancel: 'Cancelar',
  switched: 'Cambió de trabajo',
  locationNote: 'Su ubicación se guarda con cada registro para que la oficina vea que estaba en el sitio.',
  today: 'Hoy', thisWeek: 'Esta semana', yourJobs: 'Sus trabajos',
  hi: (n: string) => `Hola ${n}`,
  myWeek: 'Mi semana', weekOf: 'Semana del', total: 'Total', regular: 'Regular', overtime: 'Horas extra',
  waitingApproval: (n: number) => `${n} ${n === 1 ? 'turno espera' : 'turnos esperan'} la aprobación de la oficina. Solo se paga el tiempo aprobado.`,
  stApprovedTime: 'Aprobado', stPendingTime: 'Esperando aprobación', stRejectedTime: 'No aprobado',
  onTheClock: 'Trabajando', now: 'ahora', enteredByOffice: 'Horas registradas por la oficina',
  breakShort: (n: number) => `${n} min de descanso`, officeSays: 'Oficina:',
  addMissed: 'Agregar tiempo olvidado', addMissedHelp: '¿Olvidó marcar entrada? Agregue el turno aquí y la oficina lo revisará. Toque un turno para corregirlo hasta que se apruebe.',
  fixShift: 'Corregir turno', date: 'Fecha', start: 'Inicio', end: 'Fin', breakMinutes: 'Descanso sin pago (minutos)',
  noteForOffice: 'Nota para la oficina', noteExample: 'p. ej. Se murió el teléfono, olvidé marcar',
  sendForApproval: 'Enviar para aprobación', saving: 'Guardando...', deleteShift: 'Borrar turno', deleteShiftQ: '¿Borrar este turno?',
  jobsTitle: 'Sus trabajos', currentOnly: 'Solo actuales', showFinished: 'Ver terminados',
  noJobsTitle: 'Sin trabajos asignados', noJobsBody: 'Cuando la oficina lo asigne a un trabajo aparecerá aquí.',
  datesNotSet: 'Sin fechas', you: 'usted',
  jobStatus: { ESTIMATING: 'Próximo', ACTIVE: 'En curso', INVOICED: 'Terminando', COMPLETE: 'Terminado', CANCELLED: 'Cancelado' },
  backToJobs: 'Trabajos', forCustomer: (n: string) => `Para ${n}`, directions: 'Cómo llegar',
  clockedInHere: 'Tiene entrada marcada en este trabajo', clockInHere: 'Marcar entrada aquí', switchHere: 'Cambiar a este trabajo',
  switchQ: '¿Marcar salida del trabajo actual y entrada en este?',
  instructions: 'Instrucciones', crew: 'Equipo', yourHoursHere: (h: string) => `Sus horas en este trabajo: ${h}`,
  jobUpdates: 'Novedades del trabajo', updatePlaceholder: '¿Qué se hizo? ¿Algo que la oficina deba saber?',
  photo: 'Foto', removePhoto: 'Quitar foto', post: 'Publicar', posting: 'Publicando...',
  notOnList: 'Este trabajo no está en su lista.',
  timeOff: 'Ausencias',
  cantMakeIt: 'Hoy no puedo ir', cantMakeItSub: 'Avise a la oficina ahora',
  requestOff: 'Solicitar días libres', requestOffSub: 'Elija los días que necesita',
  yourRequests: 'Sus ausencias', noRequests: 'No hay nada registrado.',
  callOffTitle: 'Hoy no puedo ir', callOffLede: 'La oficina se entera de inmediato. Nadie tiene que aprobarlo.',
  requestTitle: 'Solicitar días libres', requestLede: 'Elija los días. Le avisaremos cuando se decida.',
  reason: 'Motivo', note: '¿Algo más?', notePlaceholder: 'Opcional',
  firstDay: 'Primer día', lastDay: 'Último día',
  reasons: {
    sick: 'Enfermedad', family_emergency: 'Emergencia familiar', child_care: 'Cuidado de niños',
    no_transportation: 'Sin transporte / problema con el carro', medical_appointment: 'Cita médica',
    weather: 'Clima / caminos', legal: 'Cita en la corte o legal', vacation: 'Vacaciones',
    family_event: 'Evento familiar', personal: 'Personal', other: 'Otro',
  },
  sendCallOff: 'Avisar a la oficina', sendRequest: 'Enviar solicitud',
  stPending: 'En espera', stApproved: 'Aprobado', stDenied: 'Denegado', stCancelled: 'Retirado', stReported: 'Avisado',
  withdraw: 'Retirar', withdrawQ: '¿Retirar esto?', yes: 'Sí', no: 'No',
  dayCount: (n: number) => (n === 1 ? '1 día' : `${n} días`),
  news: 'Avisos', noNews: 'No hay nada nuevo.', newTag: 'Nuevo',
  loading: 'Cargando...',
  err: {
    already_clocked_in: 'Usted ya marcó entrada.',
    no_open_punch: 'Usted todavía no ha marcado entrada.',
    not_assigned: 'No está asignado a ese trabajo. Consulte a la oficina.',
    same_job: 'Ya está en ese trabajo.',
    overlaps_existing: (d: string | null) => (d ? `Ya tiene ausencia registrada en ${d}.` : 'Ya tiene ausencia registrada en esos días.'),
    request_must_be_future: 'Las solicitudes empiezan mañana como mínimo. Para hoy, avise que no puede ir.',
    still_clocked_in: 'Usted tiene entrada marcada. Marque salida primero.',
    end_before_start: 'El último día no puede ser antes del primero.',
    span_too_long: 'Son demasiados días. Revise las fechas.',
    too_far_ahead: 'Esa fecha está demasiado lejos.',
    already_past: 'Esos días ya pasaron.',
    already_decided: 'Eso ya fue decidido.',
    already_approved: 'Este tiempo ya fue aprobado. Pida a la oficina que lo cambie.',
    clock_out_first: 'Primero marque salida.',
    pick_date: 'Elija una fecha.', future_day: 'No puede registrar tiempo para un día futuro.',
    need_times: 'Escriba la hora de inicio y de fin.', bad_length: 'Ese turno no parece correcto.',
    missing_field: 'Complete todos los campos.', not_found: 'No se encontró.',
    bad_login: 'El correo o teléfono y el PIN no coinciden.',
    pin_locked: 'Demasiados intentos. Espere 15 minutos o pida a la oficina un PIN nuevo.',
    network: 'No se pudo conectar con la oficina. Revise su conexión.',
    generic: 'Algo salió mal. Intente de nuevo.',
  },
};

export const STRINGS = { en, es };
export type Lang = keyof typeof STRINGS;
export const LANG_NAME: Record<Lang, string> = { en: 'English', es: 'Español' };
export const LOCALE: Record<Lang, string> = { en: 'en-US', es: 'es-US' };

const guess = (): Lang =>
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';

export const useLang = create<{ lang: Lang | null; setLang: (l: Lang) => void }>()(
  persist((set) => ({ lang: null, setLang: (lang) => set({ lang }) }), { name: 'brushpro-crew-lang' }),
);

export function useT() {
  const stored = useLang((s) => s.lang);
  const lang: Lang = stored ?? guess();
  return { t: STRINGS[lang], lang, locale: LOCALE[lang] };
}

// Turns an API error into a sentence in the phone's language.
export function errorText(t: Strings, e: unknown, locale: string): string {
  const r = (e as { response?: { data?: { code?: string; error?: string; detail?: { starts_on?: string; ends_on?: string } } } })?.response;
  if (!r) return t.err.network as string;
  const entry = r.data?.code ? t.err[r.data.code] : undefined;
  if (typeof entry === 'function') {
    const d = r.data?.detail;
    const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
    return entry(d?.starts_on ? (d.starts_on === d.ends_on ? fmt(d.starts_on) : `${fmt(d.starts_on)} – ${fmt(d.ends_on!)}`) : null);
  }
  return (entry as string) || r.data?.error || (t.err.generic as string);
}
