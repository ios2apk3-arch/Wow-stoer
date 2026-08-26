import { inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { hashPassword } from "../lib/password.ts";
import { createDb, createSql } from "./client.ts";
import { loadEnv } from "../env.ts";
import {
  addresses, categories, cities, companies, countries, negotiationRounds, negotiations,
  notifications, orderEvents, orderLines, orders, priceHistory, priceTiers, products,
  quotes, reviews, rfqInvitations, rfqs, supplierCategories, suppliers, users,
} from "./schema.ts";
import { REFERENCE, buildSeed } from "./seed-data.ts";
import type { Database } from "./client.ts";

/** Password for every seeded demo account. Never used outside seeded data. */
export const DEMO_PASSWORD = "WawDemo!2026";

/**
 * Populate an empty database with the deterministic marketplace. Refuses to
 * run against a database that already has companies, so a stray call in
 * production cannot duplicate or overwrite real records.
 */
export async function seedDatabase(db: Database, opts: { force?: boolean } = {}) {
  const existing = await db.select({ id: companies.id }).from(companies).limit(1);
  if (existing.length && !opts.force) {
    return { seeded: false, reason: "database already contains data" as const };
  }

  const data = buildSeed();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await db.transaction(async (tx) => {
    if (opts.force) {
      // Truncating the roots cascades through every dependent table.
      await tx.execute(sql`
        TRUNCATE countries, categories, companies, orders, rfqs, negotiations,
                 threads, notifications, audit_log
        RESTART IDENTITY CASCADE
      `);
    }

    await tx.insert(countries).values(REFERENCE.countries);
    await tx.insert(cities).values(REFERENCE.cities);
    // Parents before children: categories reference themselves.
    await tx.insert(categories).values(REFERENCE.categories.filter((c) => !c.parentId));
    await tx.insert(categories).values(REFERENCE.categories.filter((c) => c.parentId));

    await tx.insert(companies).values(data.companies);
    await tx.insert(addresses).values(data.addresses);
    await tx.insert(suppliers).values(data.suppliers);
    await tx.insert(supplierCategories).values(data.supplierCategories);
    await tx.insert(users).values(data.users.map((u) => ({ ...u, passwordHash })));

    await tx.insert(products).values(data.products);
    await tx.insert(priceTiers).values(data.priceTiers);
    // Price history is the biggest table; chunk it to stay under parameter limits.
    for (let i = 0; i < data.priceHistory.length; i += 2000) {
      await tx.insert(priceHistory).values(data.priceHistory.slice(i, i + 2000));
    }
    await tx.insert(reviews).values(data.reviews);

    await tx.insert(orders).values(data.orders);
    await tx.insert(orderLines).values(data.orderLines);
    await tx.insert(orderEvents).values(data.orderEvents);

    await tx.insert(rfqs).values(data.rfqs);
    await tx.insert(rfqInvitations).values(data.rfqInvitations);
    if (data.quotes.length) await tx.insert(quotes).values(data.quotes);

    await tx.insert(negotiations).values(data.negotiations);
    await tx.insert(negotiationRounds).values(data.negotiationRounds);

    // Notifications are authored against emails; user ids come from the database.
    const emails = [...new Set(data.notifications.map((n) => n.email))];
    const recipients = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.email, emails));
    const idByEmail = new Map(recipients.map((r) => [r.email.toLowerCase(), r.id]));

    const notificationRows = data.notifications
      .map(({ email, ...rest }) => {
        const userId = idByEmail.get(email.toLowerCase());
        return userId ? { ...rest, userId } : null;
      })
      .filter((n): n is NonNullable<typeof n> => n !== null);
    if (notificationRows.length) await tx.insert(notifications).values(notificationRows);
  });

  return {
    seeded: true,
    counts: {
      companies: data.companies.length,
      users: data.users.length,
      suppliers: data.suppliers.length,
      products: data.products.length,
      priceHistory: data.priceHistory.length,
      orders: data.orders.length,
      rfqs: data.rfqs.length,
      negotiations: data.negotiations.length,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadEnv();
  const sql = createSql(env.DATABASE_URL, 1);
  const db = createDb(sql);
  try {
    const force = process.argv.includes("--force");
    const result = await seedDatabase(db, { force });
    console.log(JSON.stringify(result, null, 2));
    if (result.seeded) console.log(`\nDemo accounts use the password: ${DEMO_PASSWORD}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
