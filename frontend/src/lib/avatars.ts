export const GAMER_AVATARS = [
  { id: 'streamer', label: 'Streamer' },
  { id: 'pro', label: 'Pro player' },
  { id: 'neko', label: 'Neko' },
  { id: 'ninja', label: 'Ninja' },
  { id: 'cap', label: 'Casual' },
  { id: 'punk', label: 'Punk' },
  { id: 'hood', label: 'Hacker' },
  { id: 'astro', label: 'Astronauta' },
  { id: 'robot', label: 'Robot' },
  { id: 'knight', label: 'Caballero' },
  { id: 'alien', label: 'Alien' },
  { id: 'pixel', label: 'Retro' },
].map((a) => ({ ...a, url: `/avatars/${a.id}.svg` }));
