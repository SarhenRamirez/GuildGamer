import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Bell,
  Crown,
  Gamepad2,
  Home,
  LogOut,
  MessageCircle,
  Newspaper,
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
import type { Conversation } from '../lib/types';
import { useRealtime } from '../realtime/RealtimeContext';
import { GameBotWidget } from './GameBotWidget';
import { Toasts } from './Toasts';
import { Avatar, Spinner } from './ui';

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

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={clsx('flex shrink-0 items-center justify-center rounded-xl bg-brand-green/12 ring-1 ring-brand-green/25', className ?? 'size-10')}>
      <img src="/favicon.svg" alt="" className="size-7" />
    </span>
  );
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <Link to="/" className={clsx('flex items-center gap-3', className)}>
      <LogoMark />
      <span className="flex flex-col leading-tight">
        <span className="text-lg font-extrabold tracking-tight text-white">GuildGamer</span>
        {subtitle && <span className="text-[11px] font-bold tracking-wider text-brand-green uppercase">{subtitle}</span>}
      </span>
    </Link>
  );
}

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
    <span className="ml-auto rounded-full bg-brand-green px-1.5 text-[11px] font-bold text-ink-950 tabular-nums">{n > 99 ? '99+' : n}</span>
  ) : null;

function UserMenu({ placement = 'down' }: { placement?: 'down' | 'up' }) {
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
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx('flex items-center gap-3 rounded-xl text-left', placement === 'up' && 'w-full p-2 hover:bg-white/5')}
        aria-label="Menú de usuario"
        aria-expanded={open}
      >
        <Avatar user={me} size={placement === 'up' ? 'md' : 'sm'} availability={me.availability} ring={placement === 'down'} />
        {placement === 'up' && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-white">{me.username}</span>
            <span className="block truncate text-xs text-slate-500">{me.isPremium ? 'Premium' : 'Cuenta gratis'}</span>
          </span>
        )}
      </button>
      {open && (
        <div className={clsx('card absolute z-40 w-56 p-1.5 shadow-2xl', placement === 'down' ? 'right-0 mt-2' : 'bottom-full left-0 mb-2')}>
          <div className="px-3 py-2">
            <p className="truncate font-semibold text-white">{me.username}</p>
            <p className="truncate text-xs text-slate-500">{me.email}</p>
          </div>
          <div className="my-1 h-px bg-white/6" />
          <Link to={`/users/${me.id}`} className={item}>
            <User className="size-4" /> Mi perfil
          </Link>
          <Link to="/messages" className={clsx(item, 'lg:hidden')}>
            <MessageCircle className="size-4" /> Mensajes
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
  const link = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
      isActive ? 'bg-brand-green/12 text-brand-green' : 'text-slate-400 hover:bg-white/5 hover:text-white',
    );
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/6 bg-ink-950 p-4 lg:flex">
      <Logo className="mb-8 px-1" subtitle="Encuentra tu squad" />
      <nav className="space-y-1" aria-label="Principal">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={link}>
            <Icon className="size-5" /> {label}
          </NavLink>
        ))}
        <div className="my-3 h-px bg-white/6" />
        <NavLink to="/messages" className={link}>
          <MessageCircle className="size-5" /> Mensajes <Count n={unread.messages} />
        </NavLink>
        <NavLink to="/notifications" className={link}>
          <Bell className="size-5" /> Notificaciones <Count n={unread.notifications} />
        </NavLink>
        <NavLink to="/premium" className={link}>
          <Crown className="size-5 text-brand-gold-soft" /> {me.isPremium ? 'Mi Premium' : 'Premium'}
        </NavLink>
        {me.role === 'ADMIN' && (
          <NavLink to="/admin" className={link}>
            <Shield className="size-5" /> Administración
          </NavLink>
        )}
      </nav>
      <div className="mt-auto border-t border-white/6 pt-3">
        <UserMenu placement="up" />
      </div>
    </aside>
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
          <Logo subtitle={sectionName(pathname)} />
          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/notifications"
              className="relative rounded-xl p-2 text-slate-300 hover:bg-white/6 hover:text-white"
              aria-label={`Notificaciones (${unread.notifications} sin leer)`}
            >
              <Bell className="size-5" />
              {unread.notifications > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand-green ring-2 ring-ink-950" />}
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-28 lg:px-8 lg:pt-8 lg:pb-12">
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
          <NavLink key={to} to={to} end={end} className="group flex flex-col items-center gap-1 py-1">
            {({ isActive }) => (
              <>
                <span className={clsx('relative rounded-xl px-4 py-1 transition', isActive ? 'bg-brand-green/15 text-brand-green' : 'text-slate-400')}>
                  <Icon className="size-5" />
                  {to === '/friends' && unread.messages > 0 && (
                    <span className="absolute top-0 right-2 size-2 rounded-full bg-brand-green ring-2 ring-ink-950" />
                  )}
                </span>
                <span className={clsx('text-[11px] font-semibold', isActive ? 'text-brand-green' : 'text-slate-400')}>{label}</span>
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
