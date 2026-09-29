import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

type SubscriptionLike = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
} | null;

export function isPremiumActive(sub: SubscriptionLike, now = new Date()) {
  if (!sub || sub.plan !== SubscriptionPlan.PREMIUM) return false;
  const inPeriod = !sub.currentPeriodEnd || sub.currentPeriodEnd > now;
  return (
    inPeriod &&
    (sub.status === SubscriptionStatus.ACTIVE ||
      sub.status === SubscriptionStatus.CANCELLED)
  );
}

export const subscriptionSelect = {
  plan: true,
  status: true,
  currentPeriodEnd: true,
} as const;

@Injectable()
export class PremiumService {
  constructor(private readonly prisma: PrismaService) {}

  async isPremium(userId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      select: subscriptionSelect,
    });
    return isPremiumActive(sub);
  }

  async assertPremium(userId: string, feature: string) {
    if (!(await this.isPremium(userId))) {
      throw new ForbiddenException(`${feature} es una función Premium`);
    }
  }
}
