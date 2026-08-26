import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { notifications, quotes, rfqInvitations, rfqs, suppliers, users } from "../db/schema.ts";
import { badRequest, forbidden, notFound } from "../lib/errors.ts";
import { i18n, num, paged } from "../lib/serialize.ts";
import { requireAuth, requireCompany } from "../lib/context.ts";
import type { Database } from "../db/client.ts";

const createBody = z.object({
  title: z.string().trim().min(3).max(200),
  categoryId: z.string().trim().min(1).max(64),
  productId: z.uuid().nullish(),
  qty: z.coerce.number().int().positive().max(10_000_000),
  unit: z.enum(["carton", "pallet", "kg", "piece", "liter", "box"]),
  targetPrice: z.coerce.number().nonnegative().nullish(),
  specs: z.string().max(4000).default(""),
  neededBy: z.iso.date(),
  deliveryCity: z.string().trim().max(120).default(""),
  deliveryCountry: z.string().length(2).toUpperCase(),
  paymentTerms: z.string().max(60).default("net_30"),
  shippingTerms: z.string().max(60).default("DDP"),
  notes: z.string().max(4000).default(""),
  supplierIds: z.array(z.uuid()).min(1).max(20),
});

const quoteBody = z.object({
  unitPrice: z.coerce.number().positive(),
  moq: z.coerce.number().int().positive(),
  leadTimeDays: z.coerce.number().int().min(0).max(365),
  shippingCost: z.coerce.number().nonnegative().default(0),
  shippingTerms: z.string().max(60).default("DDP"),
  paymentTerms: z.string().max(60).default("net_30"),
  validDays: z.coerce.number().int().positive().max(365).default(14),
  notes: z.string().max(2000).default(""),
});

export async function registerRfqRoutes(app: FastifyInstance) {
  const { db } = app;

  app.post("/rfqs", async (request, reply) => {
    const user = requireCompany(request, "buyer");
    const body = createBody.parse(request.body);

    const valid = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(inArray(suppliers.id, body.supplierIds));
    if (!valid.length) throw badRequest("None of the selected suppliers exist");

    const created = await db.transaction(async (tx) => {
      const [{ nextval }] = await tx.execute<{ nextval: number }>(
        sql`SELECT (count(*) + 5000)::int AS nextval FROM rfqs`,
      );
      const [rfq] = await tx.insert(rfqs).values({
        reference: `RFQ-${nextval}`,
        buyerCompanyId: user.companyId,
        titleAr: body.title,
        titleEn: body.title,
        categoryId: body.categoryId,
        productId: body.productId ?? null,
        qty: body.qty,
        unit: body.unit,
        targetPrice: body.targetPrice != null ? String(body.targetPrice) : null,
        specs: body.specs,
        neededBy: body.neededBy,
        deliveryCity: body.deliveryCity,
        deliveryCountry: body.deliveryCountry,
        paymentTerms: body.paymentTerms,
        shippingTerms: body.shippingTerms,
        notes: body.notes,
        expiresAt: new Date(Date.now() + 30 * 864e5),
      }).returning();

      await tx.insert(rfqInvitations).values(valid.map((s) => ({ rfqId: rfq.id, supplierId: s.id })));

      const supplierUsers = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(inArray(users.companyId, valid.map((s) => s.id)), eq(users.role, "supplier")));
      if (supplierUsers.length) {
        await tx.insert(notifications).values(supplierUsers.map((su) => ({
          userId: su.id,
          kind: "rfq_new",
          titleAr: "دعوة لتقديم عرض سعر",
          titleEn: "Invitation to quote",
          bodyAr: `تمت دعوتك لتقديم عرض على ${rfq.reference}.`,
          bodyEn: `You were invited to quote on ${rfq.reference}.`,
          href: `/rfq/${rfq.id}`,
          channels: ["in_app", "email", "whatsapp"],
        })));
      }
      return rfq;
    });

    return reply.status(201).send(await fetchRfq(db, created.id));
  });

  app.get("/rfqs", async (request) => {
    const user = requireAuth(request);
    const query = z.object({
      status: z.enum(["open", "quoted", "awarded", "closed", "expired"]).optional(),
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(100).default(20),
    }).parse(request.query);

    const filters: SQL[] = [];
    if (user.role === "buyer") {
      filters.push(eq(rfqs.buyerCompanyId, user.companyId!));
    } else if (user.role === "supplier") {
      filters.push(sql`EXISTS (
        SELECT 1 FROM rfq_invitations ri
        WHERE ri.rfq_id = ${rfqs.id} AND ri.supplier_id = ${user.companyId}
      )`);
    }
    if (query.status) filters.push(eq(rfqs.status, query.status));

    const where = filters.length ? and(...filters) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(rfqs).where(where);
    const rows = await db
      .select()
      .from(rfqs)
      .where(where)
      .orderBy(desc(rfqs.createdAt))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage);

    const counts = rows.length
      ? await db
          .select({ rfqId: quotes.rfqId, n: sql<number>`count(*)::int`, best: sql<string>`min(unit_price)` })
          .from(quotes)
          .where(inArray(quotes.rfqId, rows.map((r) => r.id)))
          .groupBy(quotes.rfqId)
      : [];

    const items = rows.map((r) => {
      const c = counts.find((x) => x.rfqId === r.id);
      return { ...shapeRfq(r), quoteCount: c?.n ?? 0, bestQuote: c ? num(c.best) : null };
    });
    return paged(items, count, query.page, query.perPage);
  });

  app.get("/rfqs/:id", async (request) => {
    const user = requireAuth(request);
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const rfq = await fetchRfq(db, id);
    await assertCanSeeRfq(db, user, id, rfq.buyerCompanyId);
    return rfq;
  });

  /** Suppliers submit or revise their single quote on an RFQ. */
  app.post("/rfqs/:id/quotes", async (request, reply) => {
    const user = requireCompany(request, "supplier");
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const body = quoteBody.parse(request.body);

    const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
    if (!rfq) throw notFound("RFQ");
    if (rfq.status === "awarded" || rfq.status === "closed") throw badRequest("This RFQ is no longer accepting quotes");

    const [invited] = await db
      .select({ supplierId: rfqInvitations.supplierId })
      .from(rfqInvitations)
      .where(and(eq(rfqInvitations.rfqId, id), eq(rfqInvitations.supplierId, user.companyId)))
      .limit(1);
    if (!invited) throw forbidden("You were not invited to quote on this RFQ");

    const values = {
      rfqId: id,
      supplierId: user.companyId,
      unitPrice: String(body.unitPrice),
      moq: body.moq,
      leadTimeDays: body.leadTimeDays,
      shippingCost: String(body.shippingCost),
      shippingTerms: body.shippingTerms,
      paymentTerms: body.paymentTerms,
      validUntil: new Date(Date.now() + body.validDays * 864e5),
      notes: body.notes,
    };

    await db.transaction(async (tx) => {
      await tx.insert(quotes).values({ ...values, status: "submitted" }).onConflictDoUpdate({
        target: [quotes.rfqId, quotes.supplierId],
        set: { ...values, status: "revised" },
      });
      if (rfq.status === "open") {
        await tx.update(rfqs).set({ status: "quoted" }).where(eq(rfqs.id, id));
      }
      const [buyerUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.companyId, rfq.buyerCompanyId), eq(users.role, "buyer")))
        .limit(1);
      if (buyerUser) {
        await tx.insert(notifications).values({
          userId: buyerUser.id,
          kind: "quote_new",
          titleAr: "عرض سعر جديد",
          titleEn: "New quotation",
          bodyAr: `استلمت عرضًا جديدًا على ${rfq.reference}.`,
          bodyEn: `A new quote arrived on ${rfq.reference}.`,
          href: `/rfq/${id}`,
          channels: ["in_app", "email", "push"],
        });
      }
    });

    return reply.status(201).send(await fetchRfq(db, id));
  });

  /** Buyer awards the RFQ to one quote; the rest are rejected together. */
  app.post("/rfqs/:id/award/:quoteId", async (request) => {
    const user = requireCompany(request, "buyer");
    const { id, quoteId } = z.object({ id: z.uuid(), quoteId: z.uuid() }).parse(request.params);

    const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
    if (!rfq) throw notFound("RFQ");
    if (rfq.buyerCompanyId !== user.companyId && user.role !== "admin") throw forbidden();
    if (rfq.status === "awarded") throw badRequest("This RFQ has already been awarded");

    const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.rfqId, id))).limit(1);
    if (!quote) throw notFound("Quote");

    await db.transaction(async (tx) => {
      await tx.update(quotes).set({ status: "rejected" }).where(eq(quotes.rfqId, id));
      await tx.update(quotes).set({ status: "accepted" }).where(eq(quotes.id, quoteId));
      await tx.update(rfqs).set({ status: "awarded" }).where(eq(rfqs.id, id));
    });

    return fetchRfq(db, id);
  });

  app.post("/rfqs/:id/close", async (request) => {
    const user = requireCompany(request, "buyer");
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
    if (!rfq) throw notFound("RFQ");
    if (rfq.buyerCompanyId !== user.companyId && user.role !== "admin") throw forbidden();
    await db.update(rfqs).set({ status: "closed" }).where(eq(rfqs.id, id));
    return fetchRfq(db, id);
  });
}

async function assertCanSeeRfq(db: Database, user: { role: string; companyId: string | null }, rfqId: string, buyerCompanyId: string) {
  if (user.role === "admin") return;
  if (user.companyId === buyerCompanyId) return;
  if (user.role === "supplier" && user.companyId) {
    const [row] = await db
      .select({ supplierId: rfqInvitations.supplierId })
      .from(rfqInvitations)
      .where(and(eq(rfqInvitations.rfqId, rfqId), eq(rfqInvitations.supplierId, user.companyId)))
      .limit(1);
    if (row) return;
  }
  throw forbidden();
}

async function fetchRfq(db: Database, id: string) {
  const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
  if (!rfq) throw notFound("RFQ");
  const invited = await db.select().from(rfqInvitations).where(eq(rfqInvitations.rfqId, id));
  const rows = await db.select().from(quotes).where(eq(quotes.rfqId, id)).orderBy(quotes.unitPrice);
  return {
    ...shapeRfq(rfq),
    invitedSupplierIds: invited.map((i) => i.supplierId),
    quotes: rows.map((q) => ({
      id: q.id,
      supplierId: q.supplierId,
      unitPrice: num(q.unitPrice),
      currency: q.currency,
      moq: q.moq,
      leadTimeDays: q.leadTimeDays,
      shippingCost: num(q.shippingCost),
      shippingTerms: q.shippingTerms,
      paymentTerms: q.paymentTerms,
      validUntil: q.validUntil,
      notes: q.notes,
      status: q.status,
      createdAt: q.createdAt,
    })),
  };
}

const shapeRfq = (r: typeof rfqs.$inferSelect) => ({
  id: r.id,
  reference: r.reference,
  buyerCompanyId: r.buyerCompanyId,
  title: i18n(r.titleAr, r.titleEn),
  categoryId: r.categoryId,
  productId: r.productId,
  qty: r.qty,
  unit: r.unit,
  targetPrice: r.targetPrice ? num(r.targetPrice) : null,
  currency: r.currency,
  specs: r.specs,
  neededBy: r.neededBy,
  deliveryCity: r.deliveryCity,
  deliveryCountry: r.deliveryCountry,
  paymentTerms: r.paymentTerms,
  shippingTerms: r.shippingTerms,
  notes: r.notes,
  status: r.status,
  createdAt: r.createdAt,
  expiresAt: r.expiresAt,
});
