import type { Prisma } from '../generated/prisma/client.js';
import { isPremiumActive, subscriptionSelect } from '../premium/premium.service.js';

export const publicUserSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  bannerUrl: true,
  accentColor: true,
  bio: true,
  skillLevel: true,
  languages: true,
  availability: true,
  communicationPreference: true,
  role: true,
  createdAt: true,
  subscription: { select: subscriptionSelect },
} satisfies Prisma.UserSelect;

export const privateUserSelect = {
  ...publicUserSelect,
  email: true,
  authProvider: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const userGameSelect = {
  platform: true,
  gamerTag: true,
  skillLevel: true,
  rank: true,
  role: true,
  isFavorite: true,
  game: { select: { id: true, name: true, slug: true, coverUrl: true } },
} satisfies Prisma.UserGameSelect;

export function withPremiumFlag<T extends { subscription: Parameters<typeof isPremiumActive>[0] }>(
  user: T,
) {
  const { subscription, ...rest } = user;
  return { ...rest, isPremium: isPremiumActive(subscription) };
}
