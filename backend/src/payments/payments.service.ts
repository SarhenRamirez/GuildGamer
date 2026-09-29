import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Stripe from 'stripe';
import type { AuthUser } from '../auth/auth.types.js';
import {
  NotificationType,
  PaymentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { isPremiumActive } from '../premium/premium.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const PERIOD_DAYS = 30;

export const PREMIUM_FEATURES = [
  'Perfil destacado en las búsquedas de jugadores',
  'Estadísticas avanzadas (horas por juego, compañeros habituales)',
  'Personalización del perfil (banner y color)',
  'Crear torneos y eventos de hasta 100 jugadores',
];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly provider: 'mock' | 'stripe';
  private readonly stripe?: Stripe;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {
    this.provider = config.get('PAYMENTS_PROVIDER') === 'stripe' ? 'stripe' : 'mock';
    this.frontendUrl = (config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
    if (this.provider === 'stripe') {
      const key = config.get<string>('STRIPE_SECRET_KEY');
      if (!key) throw new Error('PAYMENTS_PROVIDER=stripe requiere STRIPE_SECRET_KEY');
      this.stripe = new Stripe(key);
    }
  }

  plans() {
    return {
      provider: this.provider,
      premium: {
        priceCents: Number(this.config.get('PREMIUM_PRICE_CENTS') ?? 499),
        currency: (this.config.get<string>('PREMIUM_CURRENCY') ?? 'USD').toUpperCase(),
        intervalDays: PERIOD_DAYS,
        features: PREMIUM_FEATURES,
      },
    };
  }

  async mySubscription(user: AuthUser) {
    const [subscription, payments] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { userId: user.id },
        select: { plan: true, status: true, currentPeriodEnd: true, createdAt: true },
      }),
      this.prisma.payment.findMany({
        where: { userId: user.id },
        select: { id: true, amountCents: true, currency: true, status: true, provider: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { isPremium: isPremiumActive(subscription), subscription, payments };
  }

  async checkout(user: AuthUser) {
    const current = await this.prisma.subscription.findUnique({
      where: { userId: user.id },
      select: { plan: true, status: true, currentPeriodEnd: true },
    });
    if (isPremiumActive(current) && current?.status === SubscriptionStatus.ACTIVE) {
      throw new ConflictException('Ya tienes Premium activo');
    }
    const { priceCents, currency } = this.plans().premium;

    if (this.provider === 'mock') {
      const payment = await this.prisma.payment.create({
        data: { userId: user.id, amountCents: priceCents, currency, provider: 'mock' },
        select: { id: true },
      });
      return {
        provider: 'mock',
        paymentId: payment.id,
        checkoutUrl: `/premium/checkout/${payment.id}`,
      };
    }

    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } });
    const session = await this.stripe!.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: this.config.getOrThrow<string>('STRIPE_PRICE_ID'), quantity: 1 }],
      client_reference_id: user.id,
      customer_email: me.email,
      success_url: `${this.frontendUrl}/premium?status=success`,
      cancel_url: `${this.frontendUrl}/premium?status=cancelled`,
    });
    await this.prisma.payment.create({
      data: {
        userId: user.id,
        amountCents: session.amount_total ?? priceCents,
        currency: (session.currency ?? currency).toUpperCase(),
        provider: 'stripe',
        providerPaymentId: session.id,
      },
    });
    return { provider: 'stripe', paymentId: session.id, checkoutUrl: session.url };
  }

  async simulate(paymentId: string, outcome: 'success' | 'failure', user: AuthUser) {
    if (this.provider !== 'mock') {
      throw new ForbiddenException('La simulación solo existe con PAYMENTS_PROVIDER=mock');
    }
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId: user.id },
      select: { status: true },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictException('Este pago ya se procesó');
    }
    if (outcome === 'failure') {
      await this.prisma.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.FAILED } });
      return this.mySubscription(user);
    }
    const current = await this.prisma.subscription.findUnique({
      where: { userId: user.id },
      select: { plan: true, status: true, currentPeriodEnd: true },
    });
    const from = isPremiumActive(current) && current?.currentPeriodEnd
      ? current.currentPeriodEnd.getTime()
      : Date.now();
    const periodEnd = new Date(from + PERIOD_DAYS * 24 * 3600_000);
    await this.activate(user.id, periodEnd, { paymentId });
    return this.mySubscription(user);
  }

  async cancel(user: AuthUser) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId: user.id } });
    if (!sub || sub.plan !== SubscriptionPlan.PREMIUM || sub.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('No tienes una suscripción activa');
    }
    if (this.provider === 'stripe' && sub.providerSubId) {
      await this.stripe!.subscriptions.update(sub.providerSubId, { cancel_at_period_end: true });
    }
    await this.prisma.subscription.update({
      where: { userId: user.id },
      data: { status: SubscriptionStatus.CANCELLED },
    });
    return this.mySubscription(user);
  }

  async handleStripeWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!this.stripe) throw new ServiceUnavailableException('Stripe no está configurado');
    if (!rawBody || !signature) throw new BadRequestException('Falta la firma de Stripe');
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET'),
      );
    } catch {
      throw new BadRequestException('Firma de webhook no válida');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (!userId || !subId) break;
        const sub = await this.stripe.subscriptions.retrieve(subId);
        await this.activate(userId, this.periodEndOf(sub), {
          stripePaymentId: session.id,
          providerSubId: subId,
          providerCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
        });
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await this.prisma.subscription.updateMany({
          where: { providerSubId: sub.id },
          data: {
            currentPeriodEnd: this.periodEndOf(sub),
            status: sub.cancel_at_period_end ? SubscriptionStatus.CANCELLED : SubscriptionStatus.ACTIVE,
          },
        });
        break;
      }
      case 'customer.subscription.deleted':
        await this.prisma.subscription.updateMany({
          where: { providerSubId: event.data.object.id },
          data: { status: SubscriptionStatus.EXPIRED, plan: SubscriptionPlan.FREE },
        });
        break;
      case 'invoice.payment_failed': {
        const customer = event.data.object.customer;
        const customerId = typeof customer === 'string' ? customer : customer?.id;
        if (customerId) {
          await this.prisma.subscription.updateMany({
            where: { providerCustomerId: customerId },
            data: { status: SubscriptionStatus.PAST_DUE },
          });
        }
        break;
      }
    }
    return { received: true };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expireSubscriptions() {
    const { count } = await this.prisma.subscription.updateMany({
      where: {
        plan: SubscriptionPlan.PREMIUM,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED] },
        currentPeriodEnd: { lt: new Date() },
      },
      data: { status: SubscriptionStatus.EXPIRED, plan: SubscriptionPlan.FREE },
    });
    if (count) this.logger.log(`${count} suscripciones Premium caducadas`);
    return count;
  }

  private periodEndOf(sub: Stripe.Subscription) {
    const end = sub.items.data[0]?.current_period_end;
    return end ? new Date(end * 1000) : new Date(Date.now() + PERIOD_DAYS * 24 * 3600_000);
  }

  private async activate(
    userId: string,
    periodEnd: Date,
    ref: { paymentId?: string; stripePaymentId?: string; providerSubId?: string; providerCustomerId?: string },
  ) {
    await this.prisma.$transaction([
      ref.paymentId
        ? this.prisma.payment.update({ where: { id: ref.paymentId }, data: { status: PaymentStatus.SUCCEEDED } })
        : this.prisma.payment.updateMany({
            where: { providerPaymentId: ref.stripePaymentId },
            data: { status: PaymentStatus.SUCCEEDED },
          }),
      this.prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: SubscriptionPlan.PREMIUM,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: periodEnd,
          providerSubId: ref.providerSubId,
          providerCustomerId: ref.providerCustomerId,
        },
        update: {
          plan: SubscriptionPlan.PREMIUM,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: periodEnd,
          providerSubId: ref.providerSubId,
          providerCustomerId: ref.providerCustomerId,
        },
      }),
    ]);
    await this.notifications.notify([userId], {
      type: NotificationType.PREMIUM_ACTIVATED,
      title: '¡Ya eres Premium!',
      body: 'Gracias por apoyar GuildGamer. Tus ventajas ya están activas.',
      data: { periodEnd: periodEnd.toISOString() },
    });
  }
}
