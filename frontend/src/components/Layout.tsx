import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Bell,
  Crown,
  Gamepad2,
  Home,
  LogOut,
  MessageSquareText,
  Newspaper,
  Search,
  Settings,
  Shield,
  User,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useMe } from '../auth/AuthContext';
import { api } from '../lib/api';
import { AVAILABILITY, AVAILABILITY_COLOR } from '../lib/format';
import type { Conversation } from '../lib/types';
import { useRealtime } from '../realtime/RealtimeContext';
import { Logo } from './Brand';
import { GameBotWidget } from './GameBotWidget';
import { Toasts } from './Toasts';
import { Avatar, Button, Spinner } from './ui';

export { Logo } from './Brand';

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/sessions', label: 'Sesiones', icon: Gamepad2 },
  { to: '/players', label: 'Jugadores', icon: Users },
  { to: '/feed', label: 'Comunidad', icon: Newspaper },
  { to: '/friends', label: 'Amigos', icon: UsersRound },
];

const SECTIONS: [RegExp, string][] = [
  [/^\/$/, 'Inicio'],
  [/^\/sessions\/new/, 'Crear sesión'],
  [/^\/sessions\/[^/]+/, 'Detalle sesión'],
  [/^\/sessions/, 'Sesiones'],
  [/^\/players/, 'Jugadores'],
  [/^\/feed/, 'Comunidad'],
  [/^\/friends/, 'Amigos'],
  [/^\/messages/, 'Mensajes'],
  [/^\/notifications/, 'Notificaciones'],
  [/^\/users/, 'Perfil'],
  [/^\/profile/, 'Editar perfil'],
  [/^\/premium/, 'Premium'],
  [/^\/admin/, 'Administración'],
];

const sectionName = (path: string) => SECTIONS.find(([re]) => re.test(path))?.[1] ?? '';

function useUnread() {
  const { data: notif } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
  });
  const { data: convs } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<Conversation[]>('/messages/conversations'),
    refetchInterval: 60_000,
  });
  return {
    notifications: notif?.count ?? 0,
    messages: convs?.reduce((n, c) => n + c.unread, 0) ?? 0,
  };
}

const Count = ({ n }: { n: number }) =>
  n > 0 ? (
    <span className="ml-auto flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-ink-950 tabular-nums">{n > 99 ? '99' : n}</span>
  ) : null;

function UserMenu() {
  const me = useMe();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const item = 'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/6 hover:text-white';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="rounded-full" aria-label="Menú de usuario" aria-expanded={open}>
        <Avatar user={me} size="sm" availability={me.availability} ring />
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-56 p-1.5 shadow-2xl">
          <div className="px-3 py-2">
            <p className="truncate font-semibold text-white">{me.username}</p>
            <p className="truncate text-xs text-slate-500">{me.email}</p>
          </div>
          <div className="my-1 h-px bg-white/6" />
          <Link to={`/users/${me.id}`} className={item}>
            <User className="size-4" /> Mi perfil
          </Link>
          <Link to="/messages" className={item}>
            <MessageSquareText className="size-4" /> Mensajes
          </Link>
          <Link to="/premium" className={item}>
            <Crown className="size-4 text-brand-gold-soft" /> {me.isPremium ? 'Mi Premium' : 'Hazte Premium'}
          </Link>
          {me.role === 'ADMIN' && (
            <Link to="/admin" className={item}>
              <Shield className="size-4" /> Administración
            </Link>
          )}
          <div className="my-1 h-px bg-white/6" />
          <button onClick={logout} className={clsx(item, 'w-full')}>
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ unread }: { unread: ReturnType<typeof useUnread> }) {
  const me = useMe();
  const { logout } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'group flex items-center gap-4 rounded-2xl px-4 py-3 text-[15px] font-semibold transition',
      isActive ? 'bg-accent/15 text-white ring-1 ring-accent/25' : 'text-slate-300 hover:bg-white/5 hover:text-white',
    );
  const icon = (isActive: boolean) => clsx('size-6 shrink-0', isActive ? 'text-accent' : 'text-slate-400 group-hover:text-slate-200');

  return (
    <aside className="scrollbar-thin fixed inset-y-0 left-0 z-30 hidden w-72 flex-col overflow-y-auto border-r border-white/6 sidebar-bg px-4 py-6 lg:flex">
      <Logo size="lg" subtitle="Encuentra tu squad" className="relative mb-8 px-2" />
      <nav className="relative space-y-1.5" aria-label="Principal">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={link}>
            {({ isActive }) => (
              <>
                <Icon className={icon(isActive)} /> {label}
              </>
            )}
          </NavLink>
        ))}
        <div className="mx-2 my-4 h-px bg-white/8" />
        <NavLink to="/messages" className={link}>
          {({ isActive }) => (
            <>
              <MessageSquareText className={icon(isActive)} /> Mensajes <Count n={unread.messages} />
            </>
          )}
        </NavLink>
        <NavLink to="/notifications" className={link}>
          {({ isActive }) => (
            <>
              <Bell className={icon(isActive)} /> Notificaciones <Count n={unread.notifications} />
            </>
          )}
        </NavLink>
        <NavLink to="/premium" className={link}>
          <Crown className="size-6 shrink-0 text-brand-gold" /> Premium
        </NavLink>
        {me.role === 'ADMIN' && (
          <NavLink to="/admin" className={link}>
            {({ isActive }) => (
              <>
                <Shield className={icon(isActive)} /> Administración
              </>
            )}
          </NavLink>
        )}
      </nav>

      <div className="relative mt-auto space-y-4 pt-6">
        <div className="card flex items-center gap-3 p-3">
          <Link to={`/users/${me.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar user={me} size="md" availability={me.availability} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-white">{me.username}</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className={clsx('size-2 rounded-full', AVAILABILITY_COLOR[me.availability])} />
                {me.availability === 'AVAILABLE' ? 'En línea' : AVAILABILITY[me.availability]}
              </span>
            </span>
          </Link>
          <Link to="/profile" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/6 hover:text-white" aria-label="Ajustes del perfil">
            <Settings className="size-5" />
          </Link>
          <button onClick={logout} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/6 hover:text-white" aria-label="Cerrar sesión">
            <LogOut className="size-5" />
          </button>
        </div>
        {!me.isPremium && (
          <div className="card space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Crown className="size-7 shrink-0 text-brand-gold" />
              <p className="font-bold text-white">Hazte Premium</p>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">Perfil destacado, estadísticas avanzadas y torneos de hasta 100 jugadores.</p>
            <Link to="/premium">
              <Button size="sm">Ver planes</Button>
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}

function TopActions({ unread }: { unread: ReturnType<typeof useUnread> }) {
  const round = 'relative flex size-11 items-center justify-center rounded-full bg-ink-900 text-slate-300 ring-1 ring-white/8 transition hover:text-white';
  return (
    <div className="mb-5 hidden items-center justify-end gap-3 lg:flex">
      <Link to="/players" className={round} aria-label="Buscar jugadores">
        <Search className="size-5" />
      </Link>
      <Link to="/notifications" className={round} aria-label={`Notificaciones (${unread.notifications} sin leer)`}>
        <Bell className="size-5" />
        {unread.notifications > 0 && <span className="absolute top-2 right-2.5 size-2.5 rounded-full bg-brand-red ring-2 ring-ink-900" />}
      </Link>
      <Link to="/messages" className={round} aria-label={`Mensajes (${unread.messages} sin leer)`}>
        <MessageSquareText className="size-5" />
        {unread.messages > 0 && <span className="absolute top-2 right-2.5 size-2.5 rounded-full bg-accent ring-2 ring-ink-900" />}
      </Link>
    </div>
  );
}

export function Layout() {
  const unread = useUnread();
  const { toasts, dismissToast } = useRealtime();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen">
      <Sidebar unread={unread} />

      <header className="sticky top-0 z-30 border-b border-white/6 bg-ink-950/95 backdrop-blur-md lg:hidden">
        <div className="flex h-16 items-center gap-3 px-4">
          <Logo size="sm" subtitle={sectionName(pathname)} />
          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/notifications"
              className="relative rounded-xl p-2 text-slate-300 hover:bg-white/6 hover:text-white"
              aria-label={`Notificaciones (${unread.notifications} sin leer)`}
            >
              <Bell className="size-5" />
              {unread.notifications > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand-red ring-2 ring-ink-950" />}
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="lg:pl-72">
        <div className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-28 lg:px-8 lg:pt-6 lg:pb-12">
          <TopActions unread={unread} />
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/6 bg-ink-950/95 px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
        aria-label="Principal"
      >
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="flex flex-col items-center gap-1 py-1">
            {({ isActive }) => (
              <>
                <span className={clsx('relative rounded-xl px-4 py-1 transition', isActive ? 'bg-accent/15 text-accent' : 'text-slate-400')}>
                  <Icon className="size-5" />
                  {to === '/friends' && unread.messages > 0 && (
                    <span className="absolute top-0 right-2 size-2 rounded-full bg-accent ring-2 ring-ink-950" />
                  )}
                </span>
                <span className={clsx('text-[11px] font-semibold', isActive ? 'text-accent' : 'text-slate-400')}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <GameBotWidget />
    </div>
  );
}
