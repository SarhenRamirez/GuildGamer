import { useQuery } from '@tanstack/react-query';
import { Bell, Gamepad2, Mic, Users } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Layout';
import { Button, ErrorText, Field, Input } from '../components/ui';
import { api, errorMessage } from '../lib/api';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

function GoogleButton({ onError }: { onError: (msg: string) => void }) {
  const { loginWithGoogle } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => api.get<{ google: boolean; googleClientId: string | null }>('/auth/providers'),
    staleTime: Infinity,
  });
  const clientId = data?.google ? data.googleClientId : null;

  useEffect(() => {
    if (!clientId || !ref.current) return;
    const render = () => {
      window.google!.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => loginWithGoogle(credential).catch((e) => onError(errorMessage(e))),
      });
      window.google!.accounts.id.renderButton(ref.current!, {
        theme: 'filled_black',
        size: 'large',
        width: 320,
        text: 'continue_with',
        locale: 'es',
      });
    };
    if (window.google) {
      render();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [clientId, loginWithGoogle, onError]);

  if (!clientId) return null;
  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-white/10" /> o <span className="h-px flex-1 bg-white/10" />
      </div>
      <div ref={ref} className="flex justify-center" />
    </>
  );
}

const FEATURES = [
  { icon: Users, text: 'Encuentra jugadores de tu nivel, idioma y horario' },
  { icon: Gamepad2, text: 'Crea sesiones para cualquier juego y plataforma' },
  { icon: Mic, text: 'Coordínate por chat de texto y canal de voz' },
  { icon: Bell, text: 'Recordatorios antes de empezar a jugar' },
];

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden border-r border-white/5 bg-ink-900/60 p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(rgb(255 255 255 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.05) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <Logo className="relative" />
        <div className="relative">
          <p className="mb-3 text-xs font-semibold tracking-[0.3em] text-brand-green">RED SOCIAL PARA GAMERS</p>
          <h2 className="text-4xl leading-tight font-extrabold text-white">
            Encuentra con quién jugar. <span className="text-brand-green">Hoy mismo.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-slate-300">
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/6 ring-1 ring-white/10">
                  <Icon className="size-4 text-brand-blue" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">GuildGamer organiza a los jugadores; tú juegas en tu plataforma de siempre.</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 lg:hidden" />
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-slate-400">{subtitle}</p>
          {children}
        </div>
      </section>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Bienvenido de nuevo" subtitle="Inicia sesión para ver tus sesiones y tu grupo.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Correo electrónico">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Contraseña">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy} className="w-full">
          Entrar
        </Button>
      </form>
      <GoogleButton onError={setError} />
      <p className="mt-6 text-center text-sm text-slate-400">
        ¿Aún no tienes cuenta?{' '}
        <Link to="/register" className="font-semibold text-brand-green hover:underline">
          Regístrate
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form.email, form.username, form.password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Crea tu cuenta" subtitle="En un minuto estarás buscando partida.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Correo electrónico">
          <Input type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Nombre de usuario" hint="3–20 caracteres: letras, números y guion bajo">
          <Input autoComplete="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" value={form.username} onChange={set('username')} />
        </Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres">
          <Input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={form.password} onChange={set('password')} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy} className="w-full">
          Crear cuenta
        </Button>
      </form>
      <GoogleButton onError={setError} />
      <p className="mt-6 text-center text-sm text-slate-400">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-semibold text-brand-green hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}
