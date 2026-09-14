import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { grantOrExtendEntitlement } from "@/lib/entitlement/checker";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing webhook signature." }, { status: 400 });
    }

    // ─── 1. Cryptographic HMAC Signature Verification ──────────────────────────
    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const receivedBuffer = Buffer.from(signature, "utf8");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventId = event.event_id || `${event.event}_${event.created_at || Date.now()}`;

    // ─── 2. Webhook Idempotency Check ──────────────────────────────────────────
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { eventId },
    });

    if (alreadyProcessed) {
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    // Record event in ledger to guarantee idempotency
    await prisma.processedWebhookEvent.create({
      data: {
        eventId,
        eventType: event.event,
        payload: event.payload || {},
      },
    });

    // ─── 3. Event: order.paid / payment.captured ───────────────────────────────
    if (event.event === "order.paid" || event.event === "payment.captured") {
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;
      const rzpOrderId = paymentEntity?.order_id || orderEntity?.id;
      const rzpPaymentId = paymentEntity?.id;

      const paymentStatus = paymentEntity?.status;
      if (
        paymentStatus &&
        paymentStatus !== "captured" &&
        paymentStatus !== "paid" &&
        event.event !== "order.paid"
      ) {
        return NextResponse.json({ message: "Payment not in captured state yet." });
      }

      if (rzpOrderId) {
        const order = await prisma.order.findUnique({
          where: { razorpayOrderId: rzpOrderId },
          include: { items: true },
        });

        if (order && order.paymentStatus !== "PAID") {
          // Update order to CONFIRMED + PAID
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: "CONFIRMED",
              paymentStatus: "PAID",
              razorpayPaymentId: rzpPaymentId || order.razorpayPaymentId,
            },
          });

          // Provision UserAutomation workspace + Entitlements
          for (const item of order.items) {
            const ua = await prisma.userAutomation.upsert({
              where: {
                clerkUserId_automationId: {
                  clerkUserId: order.clerkUserId,
                  automationId: item.automationId,
                },
              },
              update: {},
              create: {
                clerkUserId: order.clerkUserId,
                automationId: item.automationId,
                status: "NOT_CONFIGURED",
              },
            });

            // Provision or extend entitlement
            await grantOrExtendEntitlement({
              clerkUserId: order.clerkUserId,
              automationId: item.automationId,
              planId: item.planId,
              orderId: order.id,
              userAutomationId: ua.id,
              durationDays: item.durationDaysSnapshot,
              isLifetime: item.isLifetimeSnapshot,
              maintenanceEnabled: !!(item.maintenancePriceSnapshot && item.maintenancePriceSnapshot > 0),
            });
          }

          // Clear purchased items from user's shopping cart
          const purchasedIds = order.items.map((item) => item.automationId);
          if (purchasedIds.length > 0) {
            await prisma.cartItem.deleteMany({
              where: {
                cart: { clerkUserId: order.clerkUserId },
                automationId: { in: purchasedIds },
              },
            });
          }
        }
      }
    }

    // ─── 4. Event: subscription.authenticated / subscription.charged ───────────
    if (event.event === "subscription.authenticated" || event.event === "subscription.charged") {
      const subEntity = event.payload?.subscription?.entity;
      const rzpSubId = subEntity?.id;

      if (rzpSubId) {
        const userSub = await prisma.userSubscription.findUnique({
          where: { razorpaySubscriptionId: rzpSubId },
        });

        if (userSub) {
          const currentEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000) : null;
          const currentStart = subEntity.current_start ? new Date(subEntity.current_start * 1000) : null;

          await prisma.userSubscription.update({
            where: { id: userSub.id },
            data: {
              status: "ACTIVE",
              currentPeriodStart: currentStart,
              currentPeriodEnd: currentEnd,
            },
          });

          // Mark maintenance status ACTIVE on associated entitlements
          await prisma.automationEntitlement.updateMany({
            where: {
              clerkUserId: userSub.clerkUserId,
              automationId: userSub.automationId,
            },
            data: {
              maintenanceStatus: "ACTIVE",
              maintenanceSubscriptionId: userSub.id,
              gracePeriodEndsAt: null,
            },
          });
        }
      }
    }

    // ─── 5. Event: payment.failed (Recurring Maintenance Debit Failure) ───────
    if (event.event === "payment.failed") {
      const paymentEntity = event.payload?.payment?.entity;
      const rzpSubId = paymentEntity?.subscription_id;

      if (rzpSubId) {
        const userSub = await prisma.userSubscription.findUnique({
          where: { razorpaySubscriptionId: rzpSubId },
        });

        if (userSub) {
          await prisma.userSubscription.update({
            where: { id: userSub.id },
            data: { status: "PAST_DUE" },
          });

          // Give 7-day grace period for maintenance payment retry
          const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

          await prisma.automationEntitlement.updateMany({
            where: {
              clerkUserId: userSub.clerkUserId,
              automationId: userSub.automationId,
            },
            data: {
              maintenanceStatus: "PAST_DUE",
              gracePeriodEndsAt: gracePeriodEnd,
            },
          });
        }
      }
    }

    // ─── 6. Event: subscription.halted / subscription.cancelled ──────────────
    if (event.event === "subscription.halted" || event.event === "subscription.cancelled") {
      const subEntity = event.payload?.subscription?.entity;
      const rzpSubId = subEntity?.id;

      if (rzpSubId) {
        const userSub = await prisma.userSubscription.findUnique({
          where: { razorpaySubscriptionId: rzpSubId },
        });

        if (userSub) {
          await prisma.userSubscription.update({
            where: { id: userSub.id },
            data: {
              status: event.event === "subscription.halted" ? "HALTED" : "CANCELLED",
              endedAt: new Date(),
            },
          });

          await prisma.automationEntitlement.updateMany({
            where: {
              clerkUserId: userSub.clerkUserId,
              automationId: userSub.automationId,
            },
            data: {
              maintenanceStatus: "CANCELLED",
            },
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Razorpay Webhook Error]:", error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
