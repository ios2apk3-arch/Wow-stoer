import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { messages, suppliers, threads } from "../db/schema.ts";
import { forbidden, notFound } from "../lib/errors.ts";
import { i18n } from "../lib/serialize.ts";
import { requireCompany } from "../lib/context.ts";
import type { Database } from "../db/client.ts";

export async function registerMessagingRoutes(app: FastifyInstance) {
  const { db } = app;

  app.get("/threads", async (request) => {
    const user = requireCompany(request);
    const rows = await db
      .select()
      .from(threads)
      .where(or(eq(threads.buyerCompanyId, user.companyId), eq(threads.supplierId, user.companyId)))
      .orderBy(desc(threads.lastMessageAt));

    const unread = await db
      .select({ threadId: messages.threadId, n: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(threads, eq(threads.id, messages.threadId))
      .where(and(
        isNull(messages.readAt),
        or(eq(threads.buyerCompanyId, user.companyId), eq(threads.supplierId, user.companyId)),
        // Unread means "sent by the other side"; your own messages never count.
        user.companyId === undefined ? undefined : ne(messages.side, sql`CASE WHEN ${threads.buyerCompanyId} = ${user.companyId} THEN 'buyer'::negotiation_party ELSE 'supplier'::negotiation_party END`),
      ))
      .groupBy(messages.threadId);

    return {
      threads: rows.map((t) => ({
        id: t.id,
        buyerCompanyId: t.buyerCompanyId,
        supplierId: t.supplierId,
        subject: i18n(t.subjectAr, t.subjectEn),
        lastMessageAt: t.lastMessageAt,
        unreadCount: unread.find((u) => u.threadId === t.id)?.n ?? 0,
      })),
    };
  });

  app.post("/threads", async (request, reply) => {
    const user = requireCompany(request, "buyer");
    const body = z.object({
      supplierId: z.uuid(),
      subject: z.string().trim().max(200).default(""),
    }).parse(request.body);

    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, body.supplierId)).limit(1);
    if (!supplier) throw notFound("Supplier");

    const [thread] = await db
      .insert(threads)
      .values({
        buyerCompanyId: user.companyId,
        supplierId: body.supplierId,
        subjectAr: body.subject,
        subjectEn: body.subject,
      })
      .onConflictDoUpdate({
        target: [threads.buyerCompanyId, threads.supplierId],
        set: { lastMessageAt: new Date() },
      })
      .returning();

    return reply.status(201).send({ id: thread.id, subject: i18n(thread.subjectAr, thread.subjectEn) });
  });

  app.get("/threads/:id/messages", async (request) => {
    const user = requireCompany(request);
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const thread = await requireThreadAccess(db, id, user.companyId);

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.threadId, id))
      .orderBy(asc(messages.createdAt))
      .limit(500);

    return {
      thread: {
        id: thread.id,
        buyerCompanyId: thread.buyerCompanyId,
        supplierId: thread.supplierId,
        subject: i18n(thread.subjectAr, thread.subjectEn),
      },
      messages: rows.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.senderName,
        side: m.side,
        kind: m.kind,
        body: m.body,
        attachmentRef: m.attachmentRef,
        readAt: m.readAt,
        at: m.createdAt,
      })),
    };
  });

  app.post("/threads/:id/messages", async (request, reply) => {
    const user = requireCompany(request);
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const body = z.object({
      body: z.string().trim().min(1).max(4000),
      kind: z.enum(["text", "quote", "product", "order", "file"]).default("text"),
      attachmentRef: z.string().max(400).nullish(),
    }).parse(request.body);

    const thread = await requireThreadAccess(db, id, user.companyId);
    const side = thread.buyerCompanyId === user.companyId ? "buyer" : "supplier";

    const [created] = await db.transaction(async (tx) => {
      const inserted = await tx.insert(messages).values({
        threadId: id,
        senderId: user.id,
        senderName: "",
        side,
        kind: body.kind,
        body: body.body,
        attachmentRef: body.attachmentRef ?? null,
      }).returning();
      await tx.update(threads).set({ lastMessageAt: new Date() }).where(eq(threads.id, id));
      return inserted;
    });

    return reply.status(201).send({ id: created.id, at: created.createdAt });
  });

  app.post("/threads/:id/read", async (request, reply) => {
    const user = requireCompany(request);
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const thread = await requireThreadAccess(db, id, user.companyId);
    const mySide = thread.buyerCompanyId === user.companyId ? "buyer" : "supplier";

    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(eq(messages.threadId, id), isNull(messages.readAt), ne(messages.side, mySide)));

    return reply.status(204).send();
  });
}

async function requireThreadAccess(db: Database, threadId: string, companyId: string) {
  const [thread] = await db.select().from(threads).where(eq(threads.id, threadId)).limit(1);
  if (!thread) throw notFound("Thread");
  if (thread.buyerCompanyId !== companyId && thread.supplierId !== companyId) throw forbidden();
  return thread;
}
