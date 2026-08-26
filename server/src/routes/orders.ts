import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  addresses, cartItems, companies, notifications, orderEvents, orderLines, orders, products, users,
} from "../db/schema.ts";
import { badRequest, forbidden, notFound } from "../lib/errors.ts";
import { i18n, num, paged } from "../lib/serialize.ts";
import { shippingQuotes, totalsFor } from "../domain/pricing.ts";
import { requireAuth, requireCompany } from "../lib/context.ts";
import { loadCart } from "./cart.ts";
import type { Database } from "../db/client.ts";

const FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"] as const;
type Status = (typeof FLOW)[number] | "cancelled";

export async function registerOrderRoutes(app: FastifyInstance) {
  const { db } = app;

  app.get("/shipping/quotes", async (request) => {
    const query = z.object({
      subtotal: z.coerce.number().nonnegative(),
      from: z.string().length(2).default("SA"),
      to: z.string().length(2).default("SA"),
    }).parse(request.query);
    return { quotes: shippingQuotes(query.subtotal, query.from.toUpperCase(), query.to.toUpperCase()) };
  });

  app.post("/orders", async (request, reply) => {
    const user = requireCompany(request, "buyer");
    const body = z.object({
      shippingAddressId: z.uuid().nullish(),
      paymentMethod: z.enum(["card", "bank_transfer", "credit_terms"]),
      carrier: z.string().trim().min(1).max(80),
      etaDays: z.coerce.number().int().min(0).max(120),
    }).parse(request.body);

    const cart = await loadCart(db, user.companyId);
    if (!cart.lines.length) throw badRequest("Your cart is empty");

    const below = cart.lines.filter((l) => l.belowMoq);
    if (below.length) {
      throw badRequest("Some items are below their minimum order quantity", {
        products: below.map((l) => ({ productId: l.productId, qty: l.qty, moq: l.moq })),
      });
    }

    if (body.shippingAddressId) {
      const [addr] = await db.select().from(addresses).where(eq(addresses.id, body.shippingAddressId)).limit(1);
      if (!addr) throw notFound("Address");
      if (addr.companyId !== user.companyId) throw forbidden("That address belongs to another company");
    }

    // The carrier quote is recomputed here; a client-sent shipping cost is ignored.
    const [company] = await db.select().from(companies).where(eq(companies.id, user.companyId)).limit(1);
    const subtotal = cart.lines.reduce((s, l) => s + l.lineTotal, 0);
    const quote = shippingQuotes(subtotal, "SA", company?.countryCode ?? "SA")
      .find((q) => q.carrier === body.carrier);
    if (!quote) throw badRequest("Unknown shipping carrier");

    const totals = totalsFor(cart.lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice })), quote.cost);

    const order = await db.transaction(async (tx) => {
      const [{ nextval }] = await tx.execute<{ nextval: number }>(
        sql`SELECT (count(*) + 30000)::int AS nextval FROM orders`,
      );
      const [created] = await tx.insert(orders).values({
        reference: `WAW-${nextval}`,
        buyerCompanyId: user.companyId,
        subtotal: String(totals.subtotal),
        shipping: String(totals.shipping),
        tax: String(totals.tax),
        total: String(totals.total),
        currency: "SAR",
        status: "pending",
        paymentStatus: body.paymentMethod === "credit_terms" ? "unpaid" : "authorized",
        paymentMethod: body.paymentMethod,
        shippingAddressId: body.shippingAddressId ?? null,
        carrier: quote.carrier,
        etaDays: quote.etaDays,
      }).returning();

      await tx.insert(orderLines).values(cart.lines.map((l) => ({
        orderId: created.id,
        productId: l.productId,
        supplierId: l.supplierId,
        nameAr: l.name.ar,
        nameEn: l.name.en,
        qty: l.qty,
        unitPrice: String(l.unitPrice),
        unit: l.unit,
      })));

      await tx.insert(orderEvents).values({ orderId: created.id, status: "pending" });
      await tx.delete(cartItems).where(eq(cartItems.companyId, user.companyId));

      // Notify every supplier with a line on this order.
      const supplierIds = [...new Set(cart.lines.map((l) => l.supplierId))];
      const supplierUsers = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(inArray(users.companyId, supplierIds), eq(users.role, "supplier")));
      if (supplierUsers.length) {
        await tx.insert(notifications).values(supplierUsers.map((su) => ({
          userId: su.id,
          kind: "order_new",
          titleAr: "طلب جديد",
          titleEn: "New order",
          bodyAr: `وصلك طلب شراء جديد ${created.reference} بانتظار التأكيد.`,
          bodyEn: `New purchase order ${created.reference} is awaiting confirmation.`,
          href: `/order/${created.id}`,
          channels: ["in_app", "email", "push"],
        })));
      }
      return created;
    });

    return reply.status(201).send(await fetchOrder(db, order.id));
  });

  app.get("/orders", async (request) => {
    const user = requireAuth(request);
    const query = z.object({
      status: z.enum([...FLOW, "cancelled"]).optional(),
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(100).default(20),
    }).parse(request.query);

    const filters: SQL[] = [];
    if (user.role === "buyer") {
      filters.push(eq(orders.buyerCompanyId, user.companyId!));
    } else if (user.role === "supplier") {
      // Suppliers see only orders containing one of their lines.
      filters.push(sql`EXISTS (
        SELECT 1 FROM order_lines ol
        WHERE ol.order_id = ${orders.id} AND ol.supplier_id = ${user.companyId}
      )`);
    }
    if (query.status) filters.push(eq(orders.status, query.status));

    const where = filters.length ? and(...filters) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(orders).where(where);
    const rows = await db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage);

    const lines = rows.length
      ? await db.select().from(orderLines).where(inArray(orderLines.orderId, rows.map((r) => r.id)))
      : [];

    const items = rows.map((o) => ({
      ...shapeOrder(o),
      lines: lines.filter((l) => l.orderId === o.id).map(shapeLine),
    }));
    return paged(items, count, query.page, query.perPage);
  });

  app.get("/orders/:id", async (request) => {
    const user = requireAuth(request);
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const order = await fetchOrder(db, id);
    await assertCanSeeOrder(db, user, id, order.buyerCompanyId);
    return order;
  });

  /** Advance one step along the fulfilment flow. Suppliers and admins only. */
  app.post("/orders/:id/advance", async (request) => {
    const user = requireCompany(request, "supplier");
    const { id } = z.object({ id: z.uuid() }).parse(request.params);

    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) throw notFound("Order");
    await assertCanSeeOrder(db, user, id, order.buyerCompanyId);
    if (order.status === "cancelled") throw badRequest("A cancelled order cannot be advanced");

    const next = FLOW[FLOW.indexOf(order.status as (typeof FLOW)[number]) + 1];
    if (!next) throw badRequest("This order is already delivered");

    await db.transaction(async (tx) => {
      await tx.update(orders).set({
        status: next,
        paymentStatus: next === "delivered" ? "paid" : order.paymentStatus,
        trackingNumber: next === "shipped"
          ? order.trackingNumber ?? `TRK${Math.floor(Math.random() * 9e8 + 1e8)}`
          : order.trackingNumber,
      }).where(eq(orders.id, id));
      await tx.insert(orderEvents).values({ orderId: id, status: next });

      const [buyerUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.companyId, order.buyerCompanyId), eq(users.role, "buyer")))
        .limit(1);
      if (buyerUser) {
        await tx.insert(notifications).values({
          userId: buyerUser.id,
          kind: "order_status",
          titleAr: "تحديث حالة الطلب",
          titleEn: "Order status updated",
          bodyAr: `طلبك ${order.reference} أصبح في مرحلة ${next}.`,
          bodyEn: `Order ${order.reference} moved to ${next}.`,
          href: `/order/${id}`,
          channels: ["in_app", "push"],
        });
      }
    });

    return fetchOrder(db, id);
  });

  app.post("/orders/:id/cancel", async (request) => {
    const user = requireAuth(request);
    const { id } = z.object({ id: z.uuid() }).parse(request.params);

    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) throw notFound("Order");
    await assertCanSeeOrder(db, user, id, order.buyerCompanyId);

    if (!["pending", "confirmed"].includes(order.status)) {
      throw badRequest("Only pending or confirmed orders can be cancelled");
    }

    await db.transaction(async (tx) => {
      await tx.update(orders).set({
        status: "cancelled",
        paymentStatus: order.paymentStatus === "paid" ? "refunded" : "unpaid",
      }).where(eq(orders.id, id));
      await tx.insert(orderEvents).values({ orderId: id, status: "cancelled" });
    });

    return fetchOrder(db, id);
  });
}

async function assertCanSeeOrder(db: Database, user: { role: string; companyId: string | null }, orderId: string, buyerCompanyId: string) {
  if (user.role === "admin") return;
  if (user.role === "buyer" && user.companyId === buyerCompanyId) return;
  if (user.role === "supplier" && user.companyId) {
    const [row] = await db
      .select({ id: orderLines.id })
      .from(orderLines)
      .where(and(eq(orderLines.orderId, orderId), eq(orderLines.supplierId, user.companyId)))
      .limit(1);
    if (row) return;
  }
  throw forbidden();
}

async function fetchOrder(db: Database, id: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) throw notFound("Order");
  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, id));
  const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(orderEvents.createdAt);
  return {
    ...shapeOrder(order),
    lines: lines.map(shapeLine),
    timeline: events.map((e) => ({
      status: e.status,
      at: e.createdAt,
      note: e.noteAr || e.noteEn ? i18n(e.noteAr ?? "", e.noteEn ?? "") : undefined,
    })),
  };
}

const shapeOrder = (o: typeof orders.$inferSelect) => ({
  id: o.id,
  reference: o.reference,
  buyerCompanyId: o.buyerCompanyId,
  subtotal: num(o.subtotal),
  shipping: num(o.shipping),
  tax: num(o.tax),
  total: num(o.total),
  currency: o.currency,
  status: o.status as Status,
  paymentStatus: o.paymentStatus,
  paymentMethod: o.paymentMethod,
  carrier: o.carrier,
  trackingNumber: o.trackingNumber,
  etaDays: o.etaDays,
  createdAt: o.createdAt,
});

const shapeLine = (l: typeof orderLines.$inferSelect) => ({
  productId: l.productId,
  supplierId: l.supplierId,
  name: i18n(l.nameAr, l.nameEn),
  qty: l.qty,
  unitPrice: num(l.unitPrice),
  unit: l.unit,
});
