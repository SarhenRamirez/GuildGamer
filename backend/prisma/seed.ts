import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { slugify } from '../src/common/slugify.js';
import { Platform, PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const { PC, PLAYSTATION, XBOX, NINTENDO_SWITCH, MOBILE } = Platform;

const games = [
  { name: 'Fortnite', genre: 'Battle Royale', platforms: [PC, PLAYSTATION, XBOX, NINTENDO_SWITCH, MOBILE], tags: ['crossplay', 'shooter'] },
  { name: 'Minecraft', genre: 'Sandbox', platforms: [PC, PLAYSTATION, XBOX, NINTENDO_SWITCH, MOBILE], tags: ['crossplay', 'cooperativo'] },
  { name: 'League of Legends', genre: 'MOBA', platforms: [PC], tags: ['competitivo', 'ranked'] },
  { name: 'Valorant', genre: 'Shooter táctico', platforms: [PC, PLAYSTATION, XBOX], tags: ['competitivo', 'ranked', 'fps'] },
  { name: 'Counter-Strike 2', genre: 'Shooter táctico', platforms: [PC], tags: ['competitivo', 'fps'] },
  { name: 'Rocket League', genre: 'Deportes', platforms: [PC, PLAYSTATION, XBOX, NINTENDO_SWITCH], tags: ['crossplay', 'competitivo'] },
  { name: 'Apex Legends', genre: 'Battle Royale', platforms: [PC, PLAYSTATION, XBOX, NINTENDO_SWITCH], tags: ['crossplay', 'shooter'] },
  { name: 'EA Sports FC', genre: 'Deportes', platforms: [PC, PLAYSTATION, XBOX, NINTENDO_SWITCH], tags: ['fútbol', 'crossplay'] },
  { name: 'Call of Duty: Warzone', genre: 'Battle Royale', platforms: [PC, PLAYSTATION, XBOX], tags: ['crossplay', 'fps'] },
  { name: 'Among Us', genre: 'Social', platforms: [PC, PLAYSTATION, XBOX, NINTENDO_SWITCH, MOBILE], tags: ['casual', 'crossplay'] },
];

for (const game of games) {
  const slug = slugify(game.name);
  await prisma.game.upsert({
    where: { slug },
    update: {},
    create: { ...game, slug },
  });
}
console.log(`Seed: catálogo con al menos ${games.length} juegos`);
await prisma.$disconnect();
