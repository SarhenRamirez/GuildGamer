import clsx from 'clsx';
import { Link } from 'react-router-dom';

const SIZES = {
  sm: 'size-9 text-sm',
  md: 'size-11 text-base',
  lg: 'size-14 text-xl',
};

export function GGLogo({ size = 'md', className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={clsx('gg-logo font-black tracking-tighter text-white', SIZES[size], className)} aria-hidden>
      GG
    </span>
  );
}

export function Logo({ className, subtitle, size = 'md' }: { className?: string; subtitle?: string; size?: keyof typeof SIZES }) {
  return (
    <Link to="/" className={clsx('flex items-center gap-3', className)} aria-label="GuildGamer, ir al inicio">
      <GGLogo size={size} />
      <span className="flex flex-col leading-tight">
        <span className={clsx('font-extrabold tracking-tight text-white', size === 'lg' ? 'text-2xl' : 'text-lg')}>GuildGamer</span>
        {subtitle && <span className="text-[11px] font-bold tracking-wider text-accent uppercase">{subtitle}</span>}
      </span>
    </Link>
  );
}
