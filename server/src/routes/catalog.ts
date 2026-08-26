import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  categories, cities, companies, countries, priceHistory, priceTiers,
  products, reviews, supplierCategories, suppliers,
} from "../db/schema.ts";
import { notFound } from "../lib/errors.ts";
import { i18n, num, paged } from "../lib/serialize.ts";

const searchQuery = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(64).optional(),
  supplier: z.uuid().optional(),
  countries: z.string().trim().max(200).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  maxMoq: z.coerce.number().int().positive().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  availability: z.string().trim().max(120).optional(),
  tags: z.string().trim().max(200).optional(),
  sort: z.enum(["relevance", "price_asc", "price_desc", "rating", "newest", "popular", "lead_time"]).default("relevance"),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(24),
});

const csv = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

/**
 * Arabic normalisation mirrored from the client so both sides match the same
 * text: strip diacritics, fold alef/ya/ta-marbuta variants.
 */
const normalizeArabic = (s: string) =>
  s.toLowerCase()
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();

export async function registerCatalogRoutes(app: FastifyInstance) {
  const { db } = app;

  app.get("/reference/countries", async () => {
    const rows = await db.select().from(countries).orderBy(asc(countries.nameEn));
    const cityRows = await db.select().from(cities).orderBy(asc(cities.nameEn));
    return {
      countries: rows.map((c) => ({
        code: c.code,
        name: i18n(c.nameAr, c.nameEn),
        currency: c.currency,
        dialCode: c.dialCode,
        cities: cityRows.filter((x) => x.countryCode === c.code).map((x) => i18n(x.nameAr, x.nameEn)),
      })),
    };
  });

  app.get("/categories", async () => {
    const rows = await db.select().from(categories).orderBy(asc(categories.id));
    return {
      categories: rows.map((c) => ({
        id: c.id,
        parentId: c.parentId,
        slug: c.slug,
        icon: c.icon,
        name: i18n(c.nameAr, c.nameEn),
      })),
    };
  });

  app.get("/products", async (request) => {
    const query = searchQuery.parse(request.query);
    const filters: SQL[] = [eq(products.isActive, true)];

    if (query.category) {
      // A parent category matches everything beneath it.
      const children = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.parentId, query.category));
      const ids = [query.category, ...children.map((c) => c.id)];
      filters.push(inArray(products.categoryId, ids));
    }
    if (query.supplier) filters.push(eq(products.supplierId, query.supplier));
    if (csv(query.countries).length) filters.push(inArray(products.originCountry, csv(query.countries)));
    if (csv(query.availability).length) {
      filters.push(inArray(products.availability, csv(query.availability) as ("in_stock" | "low_stock" | "made_to_order" | "out_of_stock")[]));
    }
    if (query.maxMoq !== undefined) filters.push(lte(products.moq, query.maxMoq));
    if (query.minRating !== undefined) filters.push(gte(products.rating, String(query.minRating)));
    if (csv(query.tags).length) filters.push(sql`${products.tags} && ${csv(query.tags)}::text[]`);

    if (query.q) {
      const normalized = normalizeArabic(query.q);
      const terms = normalized.split(/\s+/).filter((t) => t.length > 1);
      if (terms.length) {
        // Prefix matching so "ميا" finds "مياه"; ILIKE covers the folded forms
        // that the 'simple' tsvector config does not normalise.
        const tsQuery = terms.map((t) => `${t}:*`).join(" & ");
        const like = terms.map((t) =>
          or(
            sql`lower(${products.nameAr}) LIKE ${"%" + t + "%"}`,
            sql`lower(${products.nameEn}) LIKE ${"%" + t + "%"}`,
            sql`lower(${products.brand}) LIKE ${"%" + t + "%"}`,
          ),
        );
        filters.push(or(sql`${products.searchVector} @@ to_tsquery('simple', ${tsQuery})`, and(...like)!)!);
      }
    }

    // The entry-tier price drives price filters and price sorting.
    const entryPrice = sql<string>`(
      SELECT pt.price FROM price_tiers pt
      WHERE pt.product_id = ${products.id}
      ORDER BY pt.min_qty ASC LIMIT 1
    )`;
    if (query.minPrice !== undefined) filters.push(sql`${entryPrice} >= ${query.minPrice}`);
    if (query.maxPrice !== undefined) filters.push(sql`${entryPrice} <= ${query.maxPrice}`);

    const where = and(...filters);
    const orderBy = {
      price_asc: [asc(entryPrice)],
      price_desc: [desc(entryPrice)],
      rating: [desc(products.rating)],
      newest: [desc(products.createdAt)],
      popular: [desc(products.soldUnits)],
      lead_time: [asc(products.leadTimeDays)],
      relevance: [desc(products.soldUnits), desc(products.rating)],
    }[query.sort];

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(where);

    const rows = await db
      .select({
        product: products,
        supplierNameAr: companies.nameAr,
        supplierNameEn: companies.nameEn,
        supplierLogo: companies.logo,
        supplierRating: suppliers.rating,
        verification: companies.verification,
      })
      .from(products)
      .innerJoin(suppliers, eq(suppliers.id, products.supplierId))
      .innerJoin(companies, eq(companies.id, suppliers.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage);

    const tiers = rows.length
      ? await db.select().from(priceTiers).where(inArray(priceTiers.productId, rows.map((r) => r.product.id)))
      : [];

    const items = rows.map((r) => shapeProduct(r, tiers));
    return paged(items, count, query.page, query.perPage);
  });

  app.get("/products/:id", async (request) => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const [row] = await db
      .select({
        product: products,
        supplierNameAr: companies.nameAr,
        supplierNameEn: companies.nameEn,
        supplierLogo: companies.logo,
        supplierRating: suppliers.rating,
        verification: companies.verification,
      })
      .from(products)
      .innerJoin(suppliers, eq(suppliers.id, products.supplierId))
      .innerJoin(companies, eq(companies.id, suppliers.id))
      .where(eq(products.id, id))
      .limit(1);
    if (!row) throw notFound("Product");

    const tiers = await db.select().from(priceTiers).where(eq(priceTiers.productId, id));
    const history = await db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.productId, id))
      .orderBy(asc(priceHistory.observedOn));

    return {
      product: shapeProduct(row, tiers),
      priceHistory: history.map((h) => ({
        date: h.observedOn,
        avgPrice: num(h.avgPrice),
        volume: h.volume,
      })),
    };
  });

  app.get("/suppliers", async (request) => {
    const query = z.object({
      q: z.string().trim().max(200).optional(),
      country: z.string().length(2).optional(),
      category: z.string().max(64).optional(),
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(100).default(24),
    }).parse(request.query);

    const filters: SQL[] = [];
    if (query.country) filters.push(eq(companies.countryCode, query.country.toUpperCase()));
    if (query.q) {
      const t = normalizeArabic(query.q);
      filters.push(or(
        sql`lower(${companies.nameAr}) LIKE ${"%" + t + "%"}`,
        sql`lower(${companies.nameEn}) LIKE ${"%" + t + "%"}`,
        sql`lower(${companies.city}) LIKE ${"%" + t + "%"}`,
      )!);
    }
    if (query.category) {
      filters.push(sql`EXISTS (
        SELECT 1 FROM supplier_categories sc
        WHERE sc.supplier_id = ${suppliers.id} AND sc.category_id = ${query.category}
      )`);
    }

    const where = filters.length ? and(...filters) : undefined;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(suppliers)
      .innerJoin(companies, eq(companies.id, suppliers.id))
      .where(where);

    const rows = await db
      .select({ supplier: suppliers, company: companies })
      .from(suppliers)
      .innerJoin(companies, eq(companies.id, suppliers.id))
      .where(where)
      .orderBy(desc(suppliers.rating), desc(suppliers.fulfilledOrders))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage);

    return paged(rows.map(shapeSupplier), count, query.page, query.perPage);
  });

  app.get("/suppliers/:id", async (request) => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const [row] = await db
      .select({ supplier: suppliers, company: companies })
      .from(suppliers)
      .innerJoin(companies, eq(companies.id, suppliers.id))
      .where(eq(suppliers.id, id))
      .limit(1);
    if (!row) throw notFound("Supplier");

    const cats = await db
      .select({ categoryId: supplierCategories.categoryId })
      .from(supplierCategories)
      .where(eq(supplierCategories.supplierId, id));

    const supplierReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.supplierId, id))
      .orderBy(desc(reviews.createdAt))
      .limit(20);

    return {
      ...shapeSupplier(row),
      categories: cats.map((c) => c.categoryId),
      reviews: supplierReviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        body: i18n(r.bodyAr, r.bodyEn),
        at: r.createdAt,
      })),
    };
  });
}

type ProductRow = {
  product: typeof products.$inferSelect;
  supplierNameAr: string;
  supplierNameEn: string;
  supplierLogo: string;
  supplierRating: string;
  verification: string;
};

function shapeProduct(row: ProductRow, allTiers: (typeof priceTiers.$inferSelect)[]) {
  const p = row.product;
  const tiers = allTiers
    .filter((t) => t.productId === p.id)
    .map((t) => ({ minQty: t.minQty, price: num(t.price) }))
    .sort((a, b) => a.minQty - b.minQty);

  return {
    id: p.id,
    supplierId: p.supplierId,
    supplier: {
      id: p.supplierId,
      name: i18n(row.supplierNameAr, row.supplierNameEn),
      logo: row.supplierLogo,
      rating: num(row.supplierRating),
      verification: row.verification,
    },
    categoryId: p.categoryId,
    name: i18n(p.nameAr, p.nameEn),
    description: i18n(p.descriptionAr, p.descriptionEn),
    brand: p.brand,
    image: p.image,
    specs: p.specs,
    unit: p.unit,
    moq: p.moq,
    stock: p.stock,
    leadTimeDays: p.leadTimeDays,
    tiers,
    entryPrice: tiers.length ? tiers[0].price : 0,
    currency: p.currency,
    originCountry: p.originCountry,
    availability: p.availability,
    rating: num(p.rating),
    reviewCount: p.reviewCount,
    soldUnits: p.soldUnits,
    tags: p.tags,
    createdAt: p.createdAt,
  };
}

function shapeSupplier(row: { supplier: typeof suppliers.$inferSelect; company: typeof companies.$inferSelect }) {
  const { supplier: s, company: c } = row;
  return {
    id: s.id,
    name: i18n(c.nameAr, c.nameEn),
    description: i18n(c.descriptionAr, c.descriptionEn),
    logo: c.logo,
    countryCode: c.countryCode,
    city: c.city,
    website: c.website,
    verification: c.verification,
    memberSince: c.memberSince,
    rating: num(s.rating),
    reviewCount: s.reviewCount,
    responseHours: num(s.responseHours),
    onTimeRate: num(s.onTimeRate),
    fulfilledOrders: s.fulfilledOrders,
    yearsActive: s.yearsActive,
    badges: s.badges,
  };
}

