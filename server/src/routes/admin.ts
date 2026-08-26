import type { FastifyInstance } from "fastify";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { auditLog, companies, negotiations, orders, products, rfqs, suppliers, users } from "../db/schema.ts";
import { notFound } from "../lib/errors.ts";
import { i18n, num, paged } from "../lib/serialize.ts";
import { requireRole } from "../lib/context.ts";

export async function registerAdminRoutes(app: FastifyInstance) {
  const { db } = app;

  app.get("/admin/stats", async (request) => {
    requireRole(request, "admin");
    const [row] = await db.execute<{
      users: number; companies: number; suppliers: number; products: number;
      orders: number; open_rfqs: number; active_negotiations: number;
      pending_verification: number; gmv: string;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM users)                                          AS users,
        (SELECT count(*)::int FROM companies)                                      AS companies,
        (SELECT count(*)::int FROM suppliers)                                      AS suppliers,
        (SELECT count(*)::int FROM products WHERE is_active)                       AS products,
        (SELECT count(*)::int FROM orders)                                         AS orders,
        (SELECT count(*)::int FROM rfqs WHERE status IN ('open','quoted'))         AS open_rfqs,
        (SELECT count(*)::int FROM negotiations WHERE status = 'active')           AS active_negotiations,
        (SELECT count(*)::int FROM companies WHERE verification = 'pending')       AS pending_verification,
        (SELECT coalesce(sum(total),0) FROM orders WHERE status <> 'cancelled')    AS gmv
    `);

    return {
      users: row.users,
      companies: row.companies,
      suppliers: row.suppliers,
      products: row.products,
      orders: row.orders,
      openRfqs: row.open_rfqs,
      activeNegotiations: row.active_negotiations,
      pendingVerification: row.pending_verification,
      gmv: num(row.gmv),
      avgOrderValue: row.orders ? Math.round((num(row.gmv) / row.orders) * 100) / 100 : 0,
    };
  });

  app.get("/admin/companies", async (request) => {
    requireRole(request, "admin");
    const query = z.object({
      verification: z.enum(["unverified", "pending", "verified", "rejected"]).optional(),
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(100).default(30),
    }).parse(request.query);

    const where = query.verification ? eq(companies.verification, query.verification) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(companies).where(where);
    const rows = await db
      .select({
        company: companies,
        isSupplier: sql<boolean>`EXISTS (SELECT 1 FROM suppliers s WHERE s.id = ${companies.id})`,
      })
      .from(companies)
      .where(where)
      .orderBy(desc(companies.createdAt))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage);

    const items = rows.map(({ company: c, isSupplier }) => ({
      id: c.id,
      name: i18n(c.nameAr, c.nameEn),
      logo: c.logo,
      taxId: c.taxId,
      email: c.email,
      countryCode: c.countryCode,
      city: c.city,
      verification: c.verification,
      memberSince: c.memberSince,
      isSupplier,
    }));
    return paged(items, count, query.page, query.perPage);
  });

  app.patch("/admin/companies/:id/verification", async (request) => {
    const admin = requireRole(request, "admin");
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const body = z.object({
      status: z.enum(["unverified", "pending", "verified", "rejected"]),
    }).parse(request.body);

    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(companies)
        .set({ verification: body.status })
        .where(eq(companies.id, id))
        .returning();
      if (!rows.length) return null;
      await tx.insert(auditLog).values({
        actorId: admin.id,
        action: `company.verification.${body.status}`,
        target: id,
        metadata: { previous: rows[0].verification },
      });
      return rows[0];
    });

    if (!updated) throw notFound("Company");
    return { id: updated.id, verification: updated.verification };
  });

  app.get("/admin/audit", async (request) => {
    requireRole(request, "admin");
    const query = z.object({
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(100).default(50),
    }).parse(request.query);

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLog);
    const rows = await db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage);

    return paged(
      rows.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        action: r.action,
        target: r.target,
        metadata: r.metadata,
        at: r.createdAt,
      })),
      count,
      query.page,
      query.perPage,
    );
  });
}
