import clsx from 'clsx';
import { Crown, Loader2, X } from 'lucide-react';
import {
  cloneElement,
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import { AVAILABILITY, AVAILABILITY_COLOR } from '../lib/format';
import type { Availability, UserSummary } from '../lib/types';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-green text-ink-950 font-bold hover:bg-brand-green/90',
  soft: 'bg-brand-green/12 text-brand-green font-semibold ring-1 ring-brand-green/25 hover:bg-brand-green/20',
  secondary: 'bg-ink-800 text-slate-100 font-medium ring-1 ring-white/8 hover:bg-ink-700',
  ghost: 'text-slate-300 hover:bg-white/6 hover:text-white',
  danger: 'bg-brand-red/12 text-brand-red-soft font-medium ring-1 ring-brand-red/25 hover:bg-brand-red/20',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-5 py-3.5 text-base',
        VARIANTS[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  active,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 transition',
        active ? 'bg-brand-green/15 text-brand-green ring-brand-green/30' : 'bg-ink-800 text-slate-300 ring-white/8 hover:text-white',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactElement<{ id?: string; 'aria-describedby'?: string }>; hint?: string }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {cloneElement(children, { id, 'aria-describedby': hintId })}
      {hint && (
        <span id={hintId} className="mt-1 block text-xs text-slate-500">
          {hint}
        </span>
      )}
    </div>
  );
}

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={clsx('input', className)} {...props} />
);

export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={clsx('input resize-none', className)} {...props} />
);

export function Select<T extends string>({
  options,
  placeholder,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: Record<T, string> | [T, string][]; placeholder?: string }) {
  const entries = Array.isArray(options) ? options : (Object.entries(options) as [T, string][]);
  return (
    <select className={clsx('input', className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {entries.map(([value, text]) => (
        <option key={value} value={value}>
          {text}
        </option>
      ))}
    </select>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('card', className)}>{children}</div>;
}

export type Tone = 'green' | 'blue' | 'red' | 'gold' | 'gray';

const TONES: Record<Tone, string> = {
  green: 'bg-brand-green/12 text-brand-green ring-brand-green/25',
  blue: 'bg-brand-blue-deep/25 text-brand-blue ring-brand-blue/25',
  red: 'bg-brand-red/12 text-brand-red-soft ring-brand-red/25',
  gold: 'bg-brand-gold/12 text-brand-gold-soft ring-brand-gold/25',
  gray: 'bg-white/5 text-slate-300 ring-white/10',
};

export function Tag({ tone = 'gray', caps, className, children }: { tone?: Tone; caps?: boolean; className?: string; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold ring-1 ring-inset whitespace-nowrap',
        caps ? 'text-[10px] tracking-wider uppercase' : 'text-xs',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        className ?? 'bg-white/5 text-slate-300 ring-white/8',
      )}
    >
      {children}
    </span>
  );
}

export const PremiumBadge = () => (
  <Tag tone="gold">
    <Crown className="size-3" aria-hidden /> Premium
  </Tag>
);

export function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: [T, ReactNode][];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="tablist" aria-label={label}>
      {tabs.map(([key, text]) => (
        <button
          key={key}
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={clsx(
            'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ring-1 transition',
            value === key ? 'bg-brand-green/15 text-brand-green ring-brand-green/30' : 'bg-ink-800 text-slate-300 ring-white/6 hover:text-white',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const AVATAR_COLORS = ['bg-brand-green-deep', 'bg-brand-blue-deep', 'bg-brand-red-deep'];
const avatarColor = (name: string) =>
  AVATAR_COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];

const SIZES = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-20 text-2xl',
};

export function Avatar({
  user,
  size = 'md',
  availability,
  ring,
  className,
}: {
  user: Pick<UserSummary, 'username' | 'avatarUrl'>;
  size?: keyof typeof SIZES;
  availability?: Availability;
  ring?: boolean;
  className?: string;
}) {
  return (
    <span className={clsx('relative inline-flex shrink-0', className)}>
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt=""
          className={clsx('rounded-full object-cover', SIZES[size], ring && 'ring-2 ring-brand-green/70 ring-offset-2 ring-offset-ink-950')}
        />
      ) : (
        <span
          aria-hidden
          className={clsx(
            'inline-flex items-center justify-center rounded-full font-bold uppercase text-white',
            avatarColor(user.username),
            SIZES[size],
            ring && 'ring-2 ring-brand-green/70 ring-offset-2 ring-offset-ink-950',
          )}
        >
          {user.username.slice(0, 2)}
        </span>
      )}
      {availability && (
        <span
          title={AVAILABILITY[availability]}
          className={clsx(
            'absolute -right-0.5 -bottom-0.5 rounded-full ring-2 ring-ink-900',
            size === 'xl' ? 'size-4' : size === 'xs' ? 'size-2' : 'size-3',
            AVAILABILITY_COLOR[availability],
          )}
        />
      )}
    </span>
  );
}

export function UserLink({ user, size = 'sm' }: { user: UserSummary; size?: 'xs' | 'sm' | 'md' }) {
  return (
    <Link to={`/users/${user.id}`} className="inline-flex min-w-0 items-center gap-2 hover:text-white">
      <Avatar user={user} size={size} />
      <span className="truncate font-semibold">{user.username}</span>
    </Link>
  );
}

export const Spinner = ({ className }: { className?: string }) => (
  <div className={clsx('flex justify-center py-12', className)} role="status" aria-label="Cargando">
    <Loader2 className="size-7 animate-spin text-brand-green" />
  </div>
);

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 text-slate-500">{icon}</div>}
      <p className="font-semibold text-slate-200">{title}</p>
      {children && <div className="max-w-sm text-sm text-slate-400">{children}</div>}
    </div>
  );
}

export const ErrorText = ({ children }: { children?: ReactNode }) =>
  children ? (
    <p role="alert" className="rounded-xl bg-brand-red/10 px-3 py-2 text-sm text-brand-red-soft ring-1 ring-brand-red/20">
      {children}
    </p>
  ) : null;

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-b-none p-5 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/8 hover:text-white" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-brand-green" />
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="section-label">{children}</h2>
      {action}
    </div>
  );
}

export function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  return (
    <span className={clsx('tracking-tight text-brand-gold-soft', size === 'lg' ? 'text-xl' : 'text-sm')} aria-label={`${value} de 5 estrellas`}>
      {'★'.repeat(Math.round(value))}
      <span className="text-slate-600">{'★'.repeat(5 - Math.round(value))}</span>
    </span>
  );
}
