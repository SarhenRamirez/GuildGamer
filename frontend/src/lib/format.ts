import { format, formatDistanceToNowStrict, isToday, isTomorrow } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  Availability,
  CommunicationPreference,
  JoinMode,
  MemberStatus,
  Platform,
  ReportReason,
  ReviewTag,
  SessionStatus,
  SkillLevel,
} from './types';

export const PLATFORMS: Record<Platform, string> = {
  PC: 'PC',
  PLAYSTATION: 'PlayStation',
  XBOX: 'Xbox',
  NINTENDO_SWITCH: 'Nintendo Switch',
  MOBILE: 'Celular',
};

export const SKILL_LEVELS: Record<SkillLevel, string> = {
  BEGINNER: 'Principiante',
  INTERMEDIATE: 'Intermedio',
  ADVANCED: 'Avanzado',
  PRO: 'Pro',
};

export const AVAILABILITY: Record<Availability, string> = {
  AVAILABLE: 'Disponible',
  AWAY: 'Ausente',
  UNAVAILABLE: 'No disponible',
};

export const AVAILABILITY_COLOR: Record<Availability, string> = {
  AVAILABLE: 'bg-brand-green',
  AWAY: 'bg-brand-gold',
  UNAVAILABLE: 'bg-slate-500',
};

export const COMMUNICATION: Record<CommunicationPreference, string> = {
  TEXT: 'Solo texto',
  VOICE: 'Voz',
  BOTH: 'Texto y voz',
};

export const SESSION_STATUS: Record<SessionStatus, string> = {
  OPEN: 'Abierta',
  FULL: 'Completa',
  IN_PROGRESS: 'En curso',
  FINISHED: 'Terminada',
  CANCELLED: 'Cancelada',
};

export const SESSION_STATUS_STYLE: Record<SessionStatus, string> = {
  OPEN: 'bg-brand-green/15 text-brand-green ring-brand-green/30',
  FULL: 'bg-brand-gold/15 text-brand-gold-soft ring-brand-gold/30',
  IN_PROGRESS: 'bg-brand-blue/15 text-brand-blue ring-brand-blue/30',
  FINISHED: 'bg-slate-500/15 text-slate-300 ring-slate-400/30',
  CANCELLED: 'bg-brand-red/15 text-brand-red-soft ring-brand-red/30',
};

export const JOIN_MODES: Record<JoinMode, string> = {
  AUTOMATIC: 'Ingreso automático',
  MANUAL: 'El creador aprueba',
};

export const MEMBER_STATUS: Record<MemberStatus, string> = {
  PENDING: 'Solicitud pendiente',
  INVITED: 'Invitado',
  ACCEPTED: 'Dentro',
  REJECTED: 'Rechazado',
  LEFT: 'Saliste',
  KICKED: 'Expulsado',
};

export const REVIEW_TAGS: Record<ReviewTag, string> = {
  GOOD_TEAMMATE: 'Buen compañero',
  GOOD_COMMUNICATION: 'Buena comunicación',
  RESPECTFUL: 'Respetuoso',
  SKILLED: 'Buen jugador',
  PUNCTUAL: 'Puntual',
};

export const REPORT_REASONS: Record<ReportReason, string> = {
  SPAM: 'Spam',
  HARASSMENT: 'Acoso',
  FAKE_ACCOUNT: 'Cuenta falsa',
  INAPPROPRIATE_CONTENT: 'Contenido inapropiado',
  OTHER: 'Otro',
};

export const LANGUAGES: Record<string, string> = {
  es: 'Español',
  en: 'Inglés',
  pt: 'Portugués',
  fr: 'Francés',
  it: 'Italiano',
  de: 'Alemán',
};

export const languageName = (code: string) => LANGUAGES[code] ?? code.toUpperCase();

export function sessionTime(iso: string) {
  const d = new Date(iso);
  const time = format(d, 'HH:mm');
  if (isToday(d)) return `Hoy, ${time}`;
  if (isTomorrow(d)) return `Mañana, ${time}`;
  return format(d, "EEE d MMM, HH:mm", { locale: es });
}

export const timeAgo = (iso: string) =>
  formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: es });

export const fullDate = (iso: string) => format(new Date(iso), "d 'de' MMMM yyyy, HH:mm", { locale: es });

export const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('es', { style: 'currency', currency }).format(cents / 100);

export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
