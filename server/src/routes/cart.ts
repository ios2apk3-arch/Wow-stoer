import type { FastifyInstance } from "fastify";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { cartItems, favorites, priceTiers, products } from "../db/schema.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { i18n, num } from "../lib/serialize.ts";
import { estimateShipping, totalsFor, unitPriceFor } from "../domain/pricing.ts";
import { requireCompany } from "../lib/context.ts";
import type { Database } from "../db/client.ts";

/**
 * Reads the cart and prices it from the database. Quantities come from the
 * client; every price is derived here.
 */
export async function loadCart(db: Database, companyId: string) {
  const rows = await db
    .select({ item: cartItems, product: products })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.companyId, companyId));

  if (!rows.length) return { lines: [], totals: totalsFor([], 0) };

  const tiers = await db
    .select()
    .from(priceTiers)
    .where(inArray(priceTiers.productId, rows.map((r) => r.product.id)));

  const lines = rows.map(({ item, product }) => {
    const productTiers = tiers
      .filter((t) => t.productId === product.id)
      .map((t) => ({ minQty: t.minQty, price: num(t.price) }));
    const unitPrice = unitPriceFor(productTiers, item.qty);
    return {
      productId: product.id,
      supplierId: product.supplierId,
      name: i18n(product.nameAr, product.nameEn),
      image: product.image,
      unit: product.unit,
      moq: product.moq,
      availability: product.availability,
      qty: item.qty,
      unitPrice,
      lineTotal: Math.round(unitPrice * item.qty * 100) / 100,
      belowMoq: item.qty < product.moq,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  return { lines, totals: totalsFor(lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice })), estimateShipping(subtotal, true)) };
}

export async function registerCartRoutes(app: FastifyInstance) {
  const { db } = app;

  app.get("/cart", async (request) => {
    const user = requireCompany(request, "buyer");
    return loadCart(db, user.companyId);
  });

  app.post("/cart/items", async (request) => {
    const user = requireCompany(request, "buyer");
    const body = z.object({
      productId: z.uuid(),
      qty: z.coerce.number().int().positive().max(1_000_000),
    }).parse(request.body);

    const [product] = await db.select().from(products).where(eq(products.id, body.productId)).limit(1);
    if (!product || !product.isActive) throw notFound("Product");
    if (product.availability === "out_of_stock") throw badRequest("This product is out of stock");

    await db
      .insert(cartItems)
      .values({ companyId: user.companyId, productId: body.productId, qty: body.qty })
      .onConflictDoUpdate({
        target: [cartItems.companyId, cartItems.productId],
        // Adding the same product again accumulates rather than replaces.
        set: { qty: sql`${cartItems.qty} + ${body.qty}` },
      });

    return loadCart(db, user.companyId);
  });

  app.patch("/cart/items/:productId", async (request) => {
    const user = requireCompany(request, "buyer");
    const { productId } = z.object({ productId: z.uuid() }).parse(request.params);
    const body = z.object({ qty: z.coerce.number().int().min(0).max(1_000_000) }).parse(request.body);

    if (body.qty === 0) {
      await db.delete(cartItems).where(and(eq(cartItems.companyId, user.companyId), eq(cartItems.productId, productId)));
    } else {
      await db
        .update(cartItems)
        .set({ qty: body.qty })
        .where(and(eq(cartItems.companyId, user.companyId), eq(cartItems.productId, productId)));
    }
    return loadCart(db, user.companyId);
  });

  app.delete("/cart/items/:productId", async (request) => {
    const user = requireCompany(request, "buyer");
    const { productId } = z.object({ productId: z.uuid() }).parse(request.params);
    await db.delete(cartItems).where(and(eq(cartItems.companyId, user.companyId), eq(cartItems.productId, productId)));
    return loadCart(db, user.companyId);
  });

  app.delete("/cart", async (request) => {
    const user = requireCompany(request, "buyer");
    await db.delete(cartItems).where(eq(cartItems.companyId, user.companyId));
    return loadCart(db, user.companyId);
  });

  app.get("/favorites", async (request) => {
    const user = requireCompany(request);
    const rows = await db
      .select({ productId: favorites.productId })
      .from(favorites)
      .where(eq(favorites.companyId, user.companyId));
    return { productIds: rows.map((r) => r.productId) };
  });

  app.post("/favorites/:productId", async (request) => {
    const user = requireCompany(request);
    const { productId } = z.object({ productId: z.uuid() }).parse(request.params);
    await db.insert(favorites).values({ companyId: user.companyId, productId }).onConflictDoNothing();
    return { favorited: true };
  });

  app.delete("/favorites/:productId", async (request) => {
    const user = requireCompany(request);
    const { productId } = z.object({ productId: z.uuid() }).parse(request.params);
    await db.delete(favorites).where(and(eq(favorites.companyId, user.companyId), eq(favorites.productId, productId)));
    return { favorited: false };
  });
}
