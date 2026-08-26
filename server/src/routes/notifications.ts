import type { FastifyInstance } from "fastify";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { notifications } from "../db/schema.ts";
import { notFound } from "../lib/errors.ts";
import { i18n, paged } from "../lib/serialize.ts";
import { requireAuth } from "../lib/context.ts";

export async function registerNotificationRoutes(app: FastifyInstance) {
  const { db } = app;

  app.get("/notifications", async (request) => {
    const user = requireAuth(request);
    const query = z.object({
      unreadOnly: z.stringbool().default(false),
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(100).default(30),
    }).parse(request.query);

    const where = query.unreadOnly
      ? and(eq(notifications.userId, user.id), isNull(notifications.readAt))
      : eq(notifications.userId, user.id);

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(where);
    const [{ unread }] = await db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

    const rows = await db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage);

    return {
      ...paged(rows.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: i18n(n.titleAr, n.titleEn),
        body: i18n(n.bodyAr, n.bodyEn),
        href: n.href,
        channels: n.channels,
        read: n.readAt !== null,
        at: n.createdAt,
      })), count, query.page, query.perPage),
      unreadCount: unread,
    };
  });

  app.post("/notifications/:id/read", async (request, reply) => {
    const user = requireAuth(request);
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const updated = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
      .returning({ id: notifications.id });
    if (!updated.length) throw notFound("Notification");
    return reply.status(204).send();
  });

  app.post("/notifications/read-all", async (request, reply) => {
    const user = requireAuth(request);
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return reply.status(204).send();
  });
}
