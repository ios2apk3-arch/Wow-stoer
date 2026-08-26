import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  negotiationRounds, negotiations, orderEvents, orderLines, orders, products,
} from "../db/schema.ts";
import { badRequest, forbidden, notFound } from "../lib/errors.ts";
import { i18n, num, paged } from "../lib/serialize.ts";
import { totalsFor } from "../domain/pricing.ts";
import { requireAuth, requireCompany } from "../lib/context.ts";
import type { Database } from "../db/client.ts";

const terms = z.object({
  unitPrice: z.coerce.number().positive(),
  qty: z.coerce.number().int().positive(),
  moq: z.coerce.number().int().positive(),
  shippingCost: z.coerce.number().nonnegative().default(0),
  shippingTerms: z.string().max(60).default("DDP"),
  paymentTerms: z.string().max(60).default("net_30"),
  message: z.string().max(2000).default(""),
});

export async function registerNegotiationRoutes(app: FastifyInstance) {
  const { db } = app;

  app.post("/negotiations", async (request, reply) => {
    const user = requireCompany(request, "buyer");
    const body = terms.extend({
      productId: z.uuid(),
      rfqId: z.uuid().nullish(),
      quoteId: z.uuid().nullish(),
    }).parse(request.body);

    const [product] = await db.select().from(products).where(eq(products.id, body.productId)).limit(1);
    if (!product) throw notFound("Product");

    const created = await db.transaction(async (tx) => {
      const [{ nextval }] = await tx.execute<{ nextval: number }>(
        sql`SELECT (count(*) + 8000)::int AS nextval FROM negotiations`,
      );
      const [negotiation] = await tx.insert(negotiations).values({
        reference: `NEG-${nextval}`,
        productId: body.productId,
        buyerCompanyId: user.companyId,
        supplierId: product.supplierId,
        rfqId: body.rfqId ?? null,
        quoteId: body.quoteId ?? null,
      }).returning();

      await tx.insert(negotiationRounds).values({
        negotiationId: negotiation.id,
        byParty: "buyer",
        actorName: "",
        kind: "offer",
        unitPrice: String(body.unitPrice),
        qty: body.qty,
        moq: body.moq,
        shippingCost: String(body.shippingCost),
        shippingTerms: body.shippingTerms,
        paymentTerms: body.paymentTerms,
        message: body.message,
      });
      return negotiation;
    });

    return reply.status(201).send(await fetchNegotiation(db, created.id));
  });

  app.get("/negotiations", async (request) => {
    const user = requireAuth(request);
    const query = z.object({
      status: z.enum(["active", "accepted", "rejected", "converted"]).optional(),
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(100).default(20),
    }).parse(request.query);

    const filters: SQL[] = [];
    if (user.role === "buyer") filters.push(eq(negotiations.buyerCompanyId, user.companyId!));
    else if (user.role === "supplier") filters.push(eq(negotiations.supplierId, user.companyId!));
    if (query.status) filters.push(eq(negotiations.status, query.status));

    const where = filters.length ? and(...filters) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(negotiations).where(where);
    const rows = await db
      .select()
      .from(negotiations)
      .where(where)
      .orderBy(desc(negotiations.createdAt))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage);

    const rounds = rows.length
      ? await db
          .select()
          .from(negotiationRounds)
          .where(inArray(negotiationRounds.negotiationId, rows.map((r) => r.id)))
          .orderBy(asc(negotiationRounds.createdAt))
      : [];

    const items = rows.map((n) => ({
      ...shapeNegotiation(n),
      rounds: rounds.filter((r) => r.negotiationId === n.id).map(shapeRound),
    }));
    return paged(items, count, query.page, query.perPage);
  });

  app.get("/negotiations/:id", async (request) => {
    const user = requireAuth(request);
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const negotiation = await fetchNegotiation(db, id);
    assertParty(user, negotiation.buyerCompanyId, negotiation.supplierId);
    return negotiation;
  });

  /** Either side may counter while the negotiation is still active. */
  app.post("/negotiations/:id/counter", async (request) => {
    const user = requireCompany(request);
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const body = terms.parse(request.body);

    const [negotiation] = await db.select().from(negotiations).where(eq(negotiations.id, id)).limit(1);
    if (!negotiation) throw notFound("Negotiation");
    const side = assertParty(user, negotiation.buyerCompanyId, negotiation.supplierId);
    if (negotiation.status !== "active") throw badRequest("This negotiation is closed");

    await db.insert(negotiationRounds).values({
      negotiationId: id,
      byParty: side,
      actorName: "",
      kind: "counter",
      unitPrice: String(body.unitPrice),
      qty: body.qty,
      moq: body.moq,
      shippingCost: String(body.shippingCost),
      shippingTerms: body.shippingTerms,
      paymentTerms: body.paymentTerms,
      message: body.message,
    });

    return fetchNegotiation(db, id);
  });

  app.post("/negotiations/:id/:decision", async (request) => {
    const user = requireCompany(request);
    const { id, decision } = z.object({
      id: z.uuid(),
      decision: z.enum(["accept", "reject"]),
    }).parse(request.params);

    const [negotiation] = await db.select().from(negotiations).where(eq(negotiations.id, id)).limit(1);
    if (!negotiation) throw notFound("Negotiation");
    const side = assertParty(user, negotiation.buyerCompanyId, negotiation.supplierId);
    if (negotiation.status !== "active") throw badRequest("This negotiation is closed");

    const [last] = await db
      .select()
      .from(negotiationRounds)
      .where(eq(negotiationRounds.negotiationId, id))
      .orderBy(desc(negotiationRounds.createdAt))
      .limit(1);
    if (!last) throw badRequest("This negotiation has no offers yet");

    // You cannot accept your own offer — the other side must respond.
    if (decision === "accept" && last.byParty === side) {
      throw badRequest("You cannot accept your own offer; wait for the other party");
    }

    await db.transaction(async (tx) => {
      await tx.insert(negotiationRounds).values({
        negotiationId: id,
        byParty: side,
        kind: decision,
        unitPrice: last.unitPrice,
        qty: last.qty,
        moq: last.moq,
        shippingCost: last.shippingCost,
        shippingTerms: last.shippingTerms,
        paymentTerms: last.paymentTerms,
        message: "",
      });
      await tx
        .update(negotiations)
        .set({ status: decision === "accept" ? "accepted" : "rejected" })
        .where(eq(negotiations.id, id));
    });

    return fetchNegotiation(db, id);
  });

  /** Turn an accepted negotiation into a real order. */
  app.post("/negotiations/:id/convert", async (request, reply) => {
    const user = requireCompany(request, "buyer");
    const { id } = z.object({ id: z.uuid() }).parse(request.params);

    const [negotiation] = await db.select().from(negotiations).where(eq(negotiations.id, id)).limit(1);
    if (!negotiation) throw notFound("Negotiation");
    assertParty(user, negotiation.buyerCompanyId, negotiation.supplierId);
    if (negotiation.status !== "accepted") throw badRequest("Only an accepted negotiation can become an order");
    if (negotiation.orderId) throw badRequest("This negotiation already produced an order");

    const [product] = await db.select().from(products).where(eq(products.id, negotiation.productId)).limit(1);
    if (!product) throw notFound("Product");

    const [last] = await db
      .select()
      .from(negotiationRounds)
      .where(eq(negotiationRounds.negotiationId, id))
      .orderBy(desc(negotiationRounds.createdAt))
      .limit(1);

    const unitPrice = num(last.unitPrice);
    const shipping = num(last.shippingCost);
    const totals = totalsFor([{ qty: last.qty, unitPrice }], shipping);

    const order = await db.transaction(async (tx) => {
      const [{ nextval }] = await tx.execute<{ nextval: number }>(
        sql`SELECT (count(*) + 30000)::int AS nextval FROM orders`,
      );
      const [created] = await tx.insert(orders).values({
        reference: `WAW-${nextval}`,
        buyerCompanyId: negotiation.buyerCompanyId,
        subtotal: String(totals.subtotal),
        shipping: String(totals.shipping),
        tax: String(totals.tax),
        total: String(totals.total),
        status: "confirmed",
        paymentStatus: "authorized",
        paymentMethod: last.paymentTerms,
        etaDays: product.leadTimeDays,
      }).returning();

      await tx.insert(orderLines).values({
        orderId: created.id,
        productId: product.id,
        supplierId: product.supplierId,
        nameAr: product.nameAr,
        nameEn: product.nameEn,
        qty: last.qty,
        unitPrice: String(unitPrice),
        unit: product.unit,
      });

      await tx.insert(orderEvents).values([
        { orderId: created.id, status: "pending" },
        {
          orderId: created.id,
          status: "confirmed",
          noteAr: "ناتج عن اتفاق تفاوض",
          noteEn: "Created from an agreed negotiation",
        },
      ]);

      await tx
        .update(negotiations)
        .set({ status: "converted", orderId: created.id })
        .where(eq(negotiations.id, id));

      return created;
    });

    return reply.status(201).send({ orderId: order.id, reference: order.reference });
  });
}

/** Returns which side of the table the caller sits on, or refuses. */
function assertParty(
  user: { role: string; companyId: string | null },
  buyerCompanyId: string,
  supplierId: string,
): "buyer" | "supplier" {
  if (user.companyId === buyerCompanyId) return "buyer";
  if (user.companyId === supplierId) return "supplier";
  if (user.role === "admin") return "buyer";
  throw forbidden();
}

async function fetchNegotiation(db: Database, id: string) {
  const [negotiation] = await db.select().from(negotiations).where(eq(negotiations.id, id)).limit(1);
  if (!negotiation) throw notFound("Negotiation");
  const rounds = await db
    .select()
    .from(negotiationRounds)
    .where(eq(negotiationRounds.negotiationId, id))
    .orderBy(asc(negotiationRounds.createdAt));
  return { ...shapeNegotiation(negotiation), rounds: rounds.map(shapeRound) };
}

const shapeNegotiation = (n: typeof negotiations.$inferSelect) => ({
  id: n.id,
  reference: n.reference,
  productId: n.productId,
  buyerCompanyId: n.buyerCompanyId,
  supplierId: n.supplierId,
  rfqId: n.rfqId,
  quoteId: n.quoteId,
  currency: n.currency,
  status: n.status,
  orderId: n.orderId,
  createdAt: n.createdAt,
});

const shapeRound = (r: typeof negotiationRounds.$inferSelect) => ({
  id: r.id,
  by: r.byParty,
  actorName: r.actorName,
  kind: r.kind,
  terms: {
    unitPrice: num(r.unitPrice),
    qty: r.qty,
    moq: r.moq,
    shippingCost: num(r.shippingCost),
    shippingTerms: r.shippingTerms,
    paymentTerms: r.paymentTerms,
  },
  message: r.message,
  at: r.createdAt,
});
