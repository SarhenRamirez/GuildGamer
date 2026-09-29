import clsx from 'clsx';
import { useId } from 'react';

type Scene = 'shooter' | 'royale' | 'moba' | 'sandbox' | 'sports' | 'space' | 'arcade';

const hueOf = (name: string) => [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

const BY_SLUG: [RegExp, Scene][] = [
  [/valorant|counter|rainbow|overwatch|gta|grand-theft/, 'shooter'],
  [/fortnite|apex|warzone|pubg|call-of-duty/, 'royale'],
  [/league|dota|smite/, 'moba'],
  [/minecraft|terraria|roblox/, 'sandbox'],
  [/fc|fifa|rocket|nba|madden/, 'sports'],
  [/among|space|star/, 'space'],
];

const BY_GENRE: [RegExp, Scene][] = [
  [/shooter|fps/i, 'shooter'],
  [/battle/i, 'royale'],
  [/moba|rpg|estrategia/i, 'moba'],
  [/sandbox|supervivencia/i, 'sandbox'],
  [/deporte|carreras/i, 'sports'],
  [/social|party/i, 'space'],
];

const SCENES: Scene[] = ['shooter', 'royale', 'moba', 'sandbox', 'sports', 'space', 'arcade'];

export function sceneOf(game: { name: string; slug?: string; genre?: string }): Scene {
  const slug = game.slug ?? game.name.toLowerCase().replace(/\s+/g, '-');
  return (
    BY_SLUG.find(([re]) => re.test(slug))?.[1] ??
    (game.genre ? BY_GENRE.find(([re]) => re.test(game.genre!))?.[1] : undefined) ??
    SCENES[hueOf(game.name) % SCENES.length]
  );
}

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

const c = (h: number, s: number, l: number, a = 1) => `hsl(${(h + 360) % 360} ${s}% ${l}% / ${a})`;

function Stars({ h, n, maxY }: { h: number; n: number; maxY: number }) {
  const r = rng(h + 11);
  return (
    <g fill="white">
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={r() * 200} cy={r() * maxY} r={r() * 1.1 + 0.3} opacity={r() * 0.6 + 0.2} />
      ))}
    </g>
  );
}

function Shooter({ h, id }: { h: number; id: string }) {
  const r = rng(h);
  const towers = Array.from({ length: 9 }, (_, i) => ({ x: i * 24 - 6, w: 18 + r() * 10, top: 120 + r() * 60 }));
  return (
    <>
      <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c(h, 70, 32)} />
        <stop offset="1" stopColor={c(h + 30, 60, 10)} />
      </linearGradient>
      <radialGradient id={`${id}g`}>
        <stop offset="0" stopColor={c(h + 20, 95, 70, 0.75)} />
        <stop offset="1" stopColor={c(h + 20, 95, 70, 0)} />
      </radialGradient>
      <rect width="200" height="250" fill={`url(#${id}s)`} />
      <circle cx="140" cy="90" r="80" fill={`url(#${id}g)`} />
      <g fill={c(h, 45, 9)}>
        {towers.map((t, i) => (
          <rect key={i} x={t.x} y={t.top} width={t.w} height={250 - t.top} />
        ))}
      </g>
      <g fill={c(h + 40, 90, 70, 0.55)}>
        {towers.flatMap((t, i) =>
          Array.from({ length: 6 }, (_, j) =>
            r() > 0.55 ? <rect key={`${i}-${j}`} x={t.x + 4 + (j % 2) * 7} y={t.top + 8 + Math.floor(j / 2) * 12} width="3" height="4" /> : null,
          ),
        )}
      </g>
      <g stroke={c(h + 10, 95, 72)} strokeWidth="2" fill="none" opacity="0.9">
        <circle cx="140" cy="88" r="20" />
        <path d="M140 58v16M140 102v16M110 88h16M154 88h16" />
        <circle cx="140" cy="88" r="2" fill={c(h + 10, 95, 72)} />
      </g>
      <g>
        <path d="M14 250c0-46 18-70 48-76 30 6 48 30 48 76z" fill={c(h, 30, 6)} />
        <path d="M44 150c0-14 8-24 20-24s20 10 20 24c0 13-9 22-20 22s-20-9-20-22z" fill={c(h, 30, 6)} />
        <path d="M40 146c2-16 12-26 26-26 13 0 22 9 23 22l-10-6-14 3-12-2z" fill={c(h, 25, 4)} />
        <path d="M70 196l112-26 3 9-110 28z" fill={c(h, 20, 12)} />
        <path d="M84 150c0 13-9 22-20 22M110 250c0-46-18-70-48-76" stroke={c(h + 10, 95, 65, 0.7)} strokeWidth="1.5" fill="none" />
      </g>
    </>
  );
}

function Royale({ h, id }: { h: number; id: string }) {
  return (
    <>
      <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c(h, 70, 30)} />
        <stop offset="0.55" stopColor={c(h + 35, 85, 58)} />
        <stop offset="1" stopColor={c(h + 50, 70, 22)} />
      </linearGradient>
      <rect width="200" height="250" fill={`url(#${id}s)`} />
      <circle cx="100" cy="150" r="34" fill={c(h + 55, 95, 80, 0.85)} />
      <circle cx="100" cy="330" r="190" fill={c(h + 200, 75, 45, 0.18)} stroke={c(h + 200, 85, 65, 0.6)} strokeWidth="6" />
      <g stroke={c(h, 30, 15)} strokeWidth="0.8" fill={c(h + 180, 70, 55)}>
        <path d="M38 48c4-12 22-12 26 0z" />
        <path d="M38 48l11 18M64 48l-11 18" fill="none" />
        <rect x="50" y="66" width="5" height="7" rx="2" fill={c(h, 30, 12)} />
        <path d="M140 26c3-9 16-9 19 0z" fill={c(h + 120, 70, 55)} />
        <path d="M140 26l8 13M159 26l-8 13" fill="none" />
        <rect x="146.5" y="39" width="4" height="5" rx="1.5" fill={c(h, 30, 12)} />
      </g>
      <path d="M-10 250v-52c30-18 60-26 92-22 26 3 44-10 70-8 22 2 40 12 58 22v60z" fill={c(h + 60, 35, 10)} />
      <g fill={c(h + 60, 30, 6)}>
        <path d="M44 200c2-20 0-36-6-50l3-1c7 14 9 31 7 51z" />
        <path d="M40 150c-12-6-24-4-30 4 10-3 20-2 28 2-10 0-18 6-20 14 8-8 16-11 23-11-4 6-4 14 0 20 0-9 3-15 7-19 4 4 6 10 6 17 3-8 1-15-3-20 7 0 15 3 20 9-3-8-12-12-20-12 6-3 15-3 24 1-8-8-22-8-30-3z" />
        <path d="M160 205c1-16 0-28-5-40l3-1c5 12 7 25 6 41z" />
        <path d="M156 164c-10-5-20-3-25 3 8-2 16-1 23 2-8 0-15 5-16 11 6-6 13-9 19-9-3 5-3 11 0 16 0-7 2-12 6-15 3 3 5 8 5 14 2-7 1-12-2-16 6 0 12 2 16 7-2-6-10-10-17-10 5-2 13-2 20 1-7-7-18-7-25-3z" />
      </g>
    </>
  );
}

function Moba({ h, id }: { h: number; id: string }) {
  return (
    <>
      <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c(h, 60, 24)} />
        <stop offset="1" stopColor={c(h + 40, 60, 7)} />
      </linearGradient>
      <radialGradient id={`${id}g`}>
        <stop offset="0" stopColor={c(h + 180, 95, 70, 0.9)} />
        <stop offset="1" stopColor={c(h + 180, 95, 70, 0)} />
      </radialGradient>
      <rect width="200" height="250" fill={`url(#${id}s)`} />
      <Stars h={h} n={30} maxY={120} />
      <circle cx="45" cy="45" r="16" fill={c(h + 40, 40, 85, 0.85)} />
      <path d="M-10 190l45-60 30 34 38-70 40 56 28-26 39 66v60H-10z" fill={c(h + 20, 40, 16)} />
      <path d="M-10 215l40-30 35 22 45-38 40 32 30-18 30 22v45H-10z" fill={c(h + 20, 40, 9)} />
      <circle cx="100" cy="70" r="46" fill={`url(#${id}g)`} />
      <path d="M86 230l4-130h20l4 130z" fill={c(h, 35, 7)} />
      <path d="M80 104h40l-6-10H86z" fill={c(h, 35, 12)} />
      <path d="M100 44l12 22-12 22-12-22z" fill={c(h + 180, 90, 72)} />
      <path d="M100 44l12 22h-24z" fill="white" opacity="0.35" />
      <ellipse cx="100" cy="232" rx="56" ry="10" fill="none" stroke={c(h + 180, 90, 68, 0.75)} strokeWidth="2" strokeDasharray="6 5" />
    </>
  );
}

function Sandbox({ h, id }: { h: number; id: string }) {
  const r = rng(h + 3);
  const cols = Array.from({ length: 10 }, () => 8 + Math.floor(r() * 3));
  const grass = c(105, 50, 42);
  return (
    <>
      <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c(205, 70, 52)} />
        <stop offset="1" stopColor={c(195, 65, 78)} />
      </linearGradient>
      <rect width="200" height="250" fill={`url(#${id}s)`} />
      <rect x="138" y="30" width="30" height="30" fill={c(50, 95, 78)} />
      <g fill="white" opacity="0.8">
        <rect x="20" y="50" width="50" height="10" />
        <rect x="30" y="40" width="25" height="10" />
        <rect x="100" y="80" width="40" height="10" />
      </g>
      {cols.map((rows, i) => (
        <g key={i}>
          {Array.from({ length: rows }, (_, j) => {
            const y = 250 - (j + 1) * 20;
            const top = j === rows - 1;
            const stone = j < 3 && r() > 0.5;
            return (
              <rect
                key={j}
                x={i * 20}
                y={y}
                width="20"
                height="20"
                fill={top ? grass : stone ? c(0, 0, 38) : c(28, 42, 26 + (j % 2) * 3)}
                stroke="black"
                strokeOpacity="0.18"
              />
            );
          })}
        </g>
      ))}
      <g stroke="black" strokeOpacity="0.2">
        <rect x="52" y={250 - cols[2] * 20 - 40} width="16" height="40" fill={c(25, 45, 28)} />
        <rect x="30" y={250 - cols[2] * 20 - 80} width="60" height="44" fill={c(115, 48, 30)} />
        <rect x="42" y={250 - cols[2] * 20 - 100} width="36" height="22" fill={c(115, 48, 36)} />
      </g>
    </>
  );
}

function Sports({ h, id }: { h: number; id: string }) {
  return (
    <>
      <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c(h, 60, 16)} />
        <stop offset="1" stopColor={c(h, 50, 5)} />
      </linearGradient>
      <rect width="200" height="250" fill={`url(#${id}s)`} />
      <g fill="white" opacity="0.1">
        <path d="M18 20L-20 150h80z" />
        <path d="M182 20l38 130h-80z" />
      </g>
      <g fill={c(50, 90, 85)}>
        <rect x="8" y="12" width="20" height="8" rx="2" />
        <rect x="172" y="12" width="20" height="8" rx="2" />
      </g>
      <path d="M-10 140q110-40 220 0v20q-110-36-220 0z" fill={c(h, 40, 12)} />
      <g fill={c(h + 30, 70, 60, 0.6)}>
        {Array.from({ length: 22 }, (_, i) => (
          <circle key={i} cx={i * 10} cy={128 - Math.sin((i / 21) * Math.PI) * 14 + (i % 3)} r="1.4" />
        ))}
      </g>
      <path d="M40 150h120l60 100H-20z" fill={c(h + 100, 50, 28)} />
      <path d="M60 150l-22 100M80 150l-8 100M100 150v100M120 150l8 100M140 150l22 100" stroke="black" strokeOpacity="0.12" strokeWidth="10" />
      <g stroke="white" strokeOpacity="0.55" strokeWidth="1.5" fill="none">
        <path d="M40 150h120l60 100H-20z" />
        <path d="M10 196h180" />
        <ellipse cx="100" cy="196" rx="34" ry="12" />
      </g>
      <circle cx="122" cy="214" r="14" fill="white" />
      <path d="M122 206l7 5-3 8h-8l-3-8z" fill={c(h, 20, 15)} />
      <ellipse cx="124" cy="230" rx="14" ry="3" fill="black" opacity="0.35" />
    </>
  );
}

function Space({ h, id }: { h: number; id: string }) {
  return (
    <>
      <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c(h, 60, 14)} />
        <stop offset="1" stopColor={c(h + 30, 60, 4)} />
      </linearGradient>
      <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={c(h + 30, 80, 65)} />
        <stop offset="1" stopColor={c(h + 60, 70, 25)} />
      </linearGradient>
      <rect width="200" height="250" fill={`url(#${id}s)`} />
      <Stars h={h} n={60} maxY={250} />
      <circle cx="145" cy="70" r="36" fill={`url(#${id}p)`} />
      <ellipse cx="145" cy="70" rx="58" ry="12" fill="none" stroke={c(h + 30, 70, 75, 0.7)} strokeWidth="3" transform="rotate(-18 145 70)" />
      <g transform="rotate(-25 70 170)">
        <path d="M58 200v-50c0-22 24-38 24-38s24 16 24 38v50z" fill={c(h, 15, 80)} />
        <circle cx="82" cy="150" r="9" fill={c(h + 180, 80, 60)} stroke={c(h, 10, 40)} strokeWidth="3" />
        <path d="M58 175l-14 28h14zM106 175l14 28h-14z" fill={c(h + 180, 70, 45)} />
        <path d="M66 200h32l-6 14h-20z" fill={c(h, 10, 40)} />
        <path d="M72 214h20l-10 26z" fill={c(35, 100, 60)} />
      </g>
    </>
  );
}

function Arcade({ h, id }: { h: number; id: string }) {
  return (
    <>
      <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c(h, 65, 28)} />
        <stop offset="1" stopColor={c(h + 50, 60, 8)} />
      </linearGradient>
      <rect width="200" height="250" fill={`url(#${id}s)`} />
      <circle cx="100" cy="100" r="54" fill={c(h + 40, 90, 60, 0.85)} />
      <g fill={c(h, 60, 22)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x="40" y={86 + i * 12} width="120" height={4 + i} />
        ))}
      </g>
      <g stroke={c(h + 180, 80, 60, 0.6)} strokeWidth="1">
        {Array.from({ length: 11 }, (_, i) => (
          <path key={i} d={`M${i * 20} 160L${100 + (i * 20 - 100) * 3} 250`} />
        ))}
        {[166, 178, 194, 216, 244].map((y) => (
          <path key={y} d={`M0 ${y}H200`} />
        ))}
      </g>
      <path d="M0 160h200" stroke={c(h + 180, 90, 70)} strokeWidth="2" />
      <path
        d="M66 188c-12 0-18 10-18 24 0 8 4 14 10 14 5 0 9-6 13-10h58c4 4 8 10 13 10 6 0 10-6 10-14 0-14-6-24-18-24z"
        fill={c(h, 30, 8)}
        stroke={c(h + 180, 90, 70, 0.7)}
      />
    </>
  );
}

const RENDER: Record<Scene, (p: { h: number; id: string }) => React.ReactNode> = {
  shooter: Shooter,
  royale: Royale,
  moba: Moba,
  sandbox: Sandbox,
  sports: Sports,
  space: Space,
  arcade: Arcade,
};

export function SceneArt({ game, className }: { game: { name: string; slug?: string; genre?: string }; className?: string }) {
  const id = useId().replace(/:/g, '');
  const Render = RENDER[sceneOf(game)];
  return (
    <svg viewBox="0 0 200 250" preserveAspectRatio="xMidYMid slice" aria-hidden className={clsx('absolute inset-0 size-full', className)}>
      <Render h={hueOf(game.name)} id={id} />
    </svg>
  );
}

const RAWG_MEDIA = 'https://media.rawg.io/media/';

export const coverSrc = (url: string) =>
  url.startsWith(RAWG_MEDIA) && !/\/media\/(crop|resize)\//.test(url) ? url.replace(RAWG_MEDIA, `${RAWG_MEDIA}resize/640/-/`) : url;

export function CoverFill({ game }: { game: { name: string; slug?: string; genre?: string; coverUrl: string | null } }) {
  return game.coverUrl ? (
    <img src={coverSrc(game.coverUrl)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
  ) : (
    <SceneArt game={game} />
  );
}

export function GameArt({
  game,
  className,
  showName,
  children,
}: {
  game: { name: string; slug?: string; genre?: string; coverUrl: string | null };
  className?: string;
  showName?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={clsx('relative overflow-hidden bg-ink-850', className)}>
      <CoverFill game={game} />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-transparent" />
      {showName && <p className="absolute right-3 bottom-3 left-3 truncate text-sm font-bold text-white drop-shadow">{game.name}</p>}
      {children}
    </div>
  );
}
