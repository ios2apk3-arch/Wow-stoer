import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { notFound } from "../lib/errors.ts";
import { i18n, num } from "../lib/serialize.ts";
import { forecastDemand, summarisePrices } from "../domain/forecast.ts";
import { requireCompany, requireAuth } from "../lib/context.ts";

/**
 * Analytics endpoints. Aggregation happens in Postgres — sending thousands of
 * order lines to the browser to sum them there would be the wrong shape.
 */
export async function registerAnalyticsRoutes(app: FastifyInstance) {
  const { db } = app;

  /* ------------------------------------------------------------ buyer */

  app.get("/analytics/buyer", async (request) => {
    const user = requireCompany(request, "buyer");
    const companyId = user.companyId;

    const [totals] = await db.execute<{
      total_spend: string; order_count: number; supplier_count: number;
    }>(sql`
      SELECT
        coalesce(sum(o.total), 0)                      AS total_spend,
        count(*)::int                                  AS order_count,
        (SELECT count(DISTINCT ol.supplier_id)::int
           FROM order_lines ol
           JOIN orders o2 ON o2.id = ol.order_id
          WHERE o2.buyer_company_id = ${companyId}
            AND o2.status <> 'cancelled')              AS supplier_count
      FROM orders o
      WHERE o.buyer_company_id = ${companyId} AND o.status <> 'cancelled'
    `);

    const monthly = await db.execute<{ month: string; value: string }>(sql`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
             sum(total) AS value
      FROM orders
      WHERE buyer_company_id = ${companyId} AND status <> 'cancelled'
      GROUP BY 1 ORDER BY 1
    `);

    const topCategories = await db.execute<{ category_id: string; name_ar: string; name_en: string; value: string }>(sql`
      SELECT p.category_id, c.name_ar, c.name_en, sum(ol.qty * ol.unit_price) AS value
      FROM order_lines ol
      JOIN orders o ON o.id = ol.order_id
      JOIN products p ON p.id = ol.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE o.buyer_company_id = ${companyId} AND o.status <> 'cancelled'
      GROUP BY 1, 2, 3 ORDER BY value DESC LIMIT 5
    `);

    const topSuppliers = await db.execute<{
      supplier_id: string; name_ar: string; name_en: string; logo: string; value: string; order_count: number;
    }>(sql`
      SELECT ol.supplier_id, co.name_ar, co.name_en, co.logo,
             sum(ol.qty * ol.unit_price) AS value,
             count(DISTINCT o.id)::int   AS order_count
      FROM order_lines ol
      JOIN orders o ON o.id = ol.order_id
      JOIN companies co ON co.id = ol.supplier_id
      WHERE o.buyer_company_id = ${companyId} AND o.status <> 'cancelled'
      GROUP BY 1, 2, 3, 4 ORDER BY value DESC LIMIT 5
    `);

    const [counts] = await db.execute<{ open_rfqs: number; active_negotiations: number; favourites: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM rfqs WHERE buyer_company_id = ${companyId} AND status IN ('open','quoted'))       AS open_rfqs,
        (SELECT count(*)::int FROM negotiations WHERE buyer_company_id = ${companyId} AND status = 'active')          AS active_negotiations,
        (SELECT count(*)::int FROM favorites WHERE company_id = ${companyId})                                         AS favourites
    `);

    const totalSpend = num(totals.total_spend);
    return {
      totalSpend,
      orderCount: totals.order_count,
      avgOrderValue: totals.order_count ? Math.round((totalSpend / totals.order_count) * 100) / 100 : 0,
      supplierCount: totals.supplier_count,
      openRfqs: counts.open_rfqs,
      activeNegotiations: counts.active_negotiations,
      favourites: counts.favourites,
      monthly: monthly.map((m) => ({ month: m.month, value: num(m.value) })),
      topCategories: topCategories.map((c) => ({
        categoryId: c.category_id,
        name: i18n(c.name_ar, c.name_en),
        value: num(c.value),
        share: totalSpend ? Math.round((num(c.value) / totalSpend) * 1000) / 10 : 0,
      })),
      topSuppliers: topSuppliers.map((s) => ({
        supplierId: s.supplier_id,
        name: i18n(s.name_ar, s.name_en),
        logo: s.logo,
        value: num(s.value),
        orderCount: s.order_count,
      })),
    };
  });

  /**
   * Reorder timing from the buyer's own cadence. Products bought once give no
   * interval, so they are excluded rather than guessed at.
   */
  app.get("/analytics/buyer/reorders", async (request) => {
    const user = requireCompany(request, "buyer");
    const rows = await db.execute<{
      product_id: string; name_ar: string; name_en: string; image: string; moq: number;
      order_count: number; avg_interval_days: string; days_since_last: string; avg_qty: string;
    }>(sql`
      WITH history AS (
        SELECT ol.product_id, o.created_at, ol.qty,
               lag(o.created_at) OVER (PARTITION BY ol.product_id ORDER BY o.created_at) AS previous_at
        FROM order_lines ol
        JOIN orders o ON o.id = ol.order_id
        WHERE o.buyer_company_id = ${user.companyId} AND o.status <> 'cancelled'
      )
      SELECT h.product_id, p.name_ar, p.name_en, p.image, p.moq,
             count(*)::int AS order_count,
             avg(EXTRACT(EPOCH FROM (h.created_at - h.previous_at)) / 86400) AS avg_interval_days,
             EXTRACT(EPOCH FROM (now() - max(h.created_at))) / 86400        AS days_since_last,
             avg(h.qty)                                                      AS avg_qty
      FROM history h
      JOIN products p ON p.id = h.product_id
      GROUP BY h.product_id, p.name_ar, p.name_en, p.image, p.moq
      -- Two orders minutes apart are a correction or a duplicate, not a
      -- purchasing rhythm; require at least a few days between repeats.
      HAVING count(*) FILTER (WHERE h.previous_at IS NOT NULL) > 0
         AND avg(EXTRACT(EPOCH FROM (h.created_at - h.previous_at)) / 86400) >= 3
      ORDER BY (avg(EXTRACT(EPOCH FROM (h.created_at - h.previous_at)) / 86400)
                - EXTRACT(EPOCH FROM (now() - max(h.created_at))) / 86400) ASC
      LIMIT 8
    `);

    return {
      suggestions: rows.map((r) => {
        const avgInterval = Math.round(num(r.avg_interval_days));
        const daysSince = Math.round(num(r.days_since_last));
        const daysUntil = avgInterval - daysSince;
        return {
          productId: r.product_id,
          name: i18n(r.name_ar, r.name_en),
          image: r.image,
          avgIntervalDays: avgInterval,
          daysSinceLast: daysSince,
          daysUntilReorder: daysUntil,
          suggestedQty: Math.max(r.moq, Math.round(num(r.avg_qty))),
          urgency: daysUntil <= 0 ? "overdue" : daysUntil <= 10 ? "soon" : "later",
        };
      }),
    };
  });

  /* --------------------------------------------------------- supplier */

  app.get("/analytics/supplier", async (request) => {
    const user = requireCompany(request, "supplier");
    const supplierId = user.companyId;

    const [totals] = await db.execute<{ revenue: string; order_count: number; buyer_count: number }>(sql`
      SELECT
        coalesce(sum(ol.qty * ol.unit_price), 0) AS revenue,
        count(DISTINCT o.id)::int                AS order_count,
        count(DISTINCT o.buyer_company_id)::int  AS buyer_count
      FROM order_lines ol
      JOIN orders o ON o.id = ol.order_id
      WHERE ol.supplier_id = ${supplierId} AND o.status <> 'cancelled'
    `);

    const monthly = await db.execute<{ month: string; value: string }>(sql`
      SELECT to_char(date_trunc('month', o.created_at), 'YYYY-MM') AS month,
             sum(ol.qty * ol.unit_price) AS value
      FROM order_lines ol
      JOIN orders o ON o.id = ol.order_id
      WHERE ol.supplier_id = ${supplierId} AND o.status <> 'cancelled'
      GROUP BY 1 ORDER BY 1
    `);

    const topProducts = await db.execute<{
      product_id: string; name_ar: string; name_en: string; image: string; value: string; qty: number;
    }>(sql`
      SELECT ol.product_id, p.name_ar, p.name_en, p.image,
             sum(ol.qty * ol.unit_price) AS value, sum(ol.qty)::int AS qty
      FROM order_lines ol
      JOIN orders o ON o.id = ol.order_id
      JOIN products p ON p.id = ol.product_id
      WHERE ol.supplier_id = ${supplierId} AND o.status <> 'cancelled'
      GROUP BY 1, 2, 3, 4 ORDER BY value DESC LIMIT 5
    `);

    const lowStock = await db.execute<{
      id: string; name_ar: string; name_en: string; image: string; stock: number; availability: string;
    }>(sql`
      SELECT id, name_ar, name_en, image, stock, availability
      FROM products
      WHERE supplier_id = ${supplierId} AND availability IN ('low_stock', 'out_of_stock')
      ORDER BY stock ASC LIMIT 8
    `);

    const [counts] = await db.execute<{
      open_rfqs: number; active_negotiations: number; product_count: number; rating: string; on_time: string;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM rfq_invitations ri
           JOIN rfqs r ON r.id = ri.rfq_id
          WHERE ri.supplier_id = ${supplierId} AND r.status IN ('open','quoted'))              AS open_rfqs,
        (SELECT count(*)::int FROM negotiations
          WHERE supplier_id = ${supplierId} AND status = 'active')                              AS active_negotiations,
        (SELECT count(*)::int FROM products WHERE supplier_id = ${supplierId} AND is_active)    AS product_count,
        (SELECT rating FROM suppliers WHERE id = ${supplierId})                                 AS rating,
        (SELECT on_time_rate FROM suppliers WHERE id = ${supplierId})                           AS on_time
    `);

    const revenue = num(totals.revenue);
    return {
      revenue,
      orderCount: totals.order_count,
      avgOrderValue: totals.order_count ? Math.round((revenue / totals.order_count) * 100) / 100 : 0,
      buyerCount: totals.buyer_count,
      openRfqs: counts.open_rfqs,
      activeNegotiations: counts.active_negotiations,
      productCount: counts.product_count,
      rating: num(counts.rating),
      onTimeRate: num(counts.on_time),
      monthly: monthly.map((m) => ({ month: m.month, value: num(m.value) })),
      topProducts: topProducts.map((p) => ({
        productId: p.product_id,
        name: i18n(p.name_ar, p.name_en),
        image: p.image,
        value: num(p.value),
        qty: p.qty,
      })),
      lowStock: lowStock.map((p) => ({
        id: p.id,
        name: i18n(p.name_ar, p.name_en),
        image: p.image,
        stock: p.stock,
        availability: p.availability,
      })),
    };
  });

  /* ----------------------------------------------------- intelligence */

  app.get("/intelligence/categories", async (request) => {
    requireAuth(request);
    // Only top-level categories; a child rolls up into its parent.
    const rows = await db.execute<{
      id: string; name_ar: string; name_en: string; icon: string;
      avg_price: string; product_count: number; supplier_count: number; demand: string; prev_demand: string;
    }>(sql`
      WITH scoped AS (
        SELECT p.id, coalesce(parent.id, c.id) AS root_id, p.supplier_id
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN categories parent ON parent.id = c.parent_id
        WHERE p.is_active
      ),
      -- Compare by row position, not by date arithmetic: an inclusive date
      -- window catches five weekly points against four and inflates growth.
      ranked AS (
        SELECT s.root_id, ph.volume, ph.avg_price,
               row_number() OVER (PARTITION BY ph.product_id ORDER BY ph.observed_on DESC) AS rn
        FROM price_history ph
        JOIN scoped s ON s.id = ph.product_id
      ),
      windows AS (
        SELECT root_id,
               sum(volume) FILTER (WHERE rn <= 4)              AS demand,
               sum(volume) FILTER (WHERE rn BETWEEN 5 AND 8)   AS prev_demand,
               avg(avg_price) FILTER (WHERE rn = 1)            AS avg_price
        FROM ranked GROUP BY root_id
      )
      SELECT c.id, c.name_ar, c.name_en, c.icon,
             coalesce(w.avg_price, 0)           AS avg_price,
             count(DISTINCT s.id)::int          AS product_count,
             count(DISTINCT s.supplier_id)::int AS supplier_count,
             coalesce(w.demand, 0)              AS demand,
             coalesce(w.prev_demand, 0)         AS prev_demand
      FROM categories c
      JOIN scoped s ON s.root_id = c.id
      LEFT JOIN windows w ON w.root_id = c.id
      WHERE c.parent_id IS NULL
      GROUP BY c.id, c.name_ar, c.name_en, c.icon, w.avg_price, w.demand, w.prev_demand
      ORDER BY coalesce(w.demand, 0) DESC
    `);

    return {
      categories: rows.map((r) => {
        const demand = num(r.demand);
        const prev = num(r.prev_demand);
        return {
          categoryId: r.id,
          name: i18n(r.name_ar, r.name_en),
          icon: r.icon,
          avgPrice: Math.round(num(r.avg_price) * 100) / 100,
          productCount: r.product_count,
          supplierCount: r.supplier_count,
          demandIndex: Math.round(demand),
          changeMonthPct: prev ? Math.round(((demand - prev) / prev) * 1000) / 10 : 0,
        };
      }),
    };
  });

  app.get("/intelligence/alerts", async (request) => {
    requireAuth(request);
    const rows = await db.execute<{
      id: string; name_ar: string; name_en: string; image: string; current: string; previous: string;
    }>(sql`
      SELECT p.id, p.name_ar, p.name_en, p.image,
             (SELECT avg_price FROM price_history WHERE product_id = p.id ORDER BY observed_on DESC LIMIT 1)        AS current,
             (SELECT avg_price FROM price_history WHERE product_id = p.id
               ORDER BY observed_on DESC OFFSET 4 LIMIT 1)                                                          AS previous
      FROM products p
      WHERE p.is_active
    `);

    const alerts = rows
      .map((r) => {
        const current = num(r.current);
        const previous = num(r.previous);
        if (!current || !previous) return null;
        const changePct = Math.round(((current - previous) / previous) * 1000) / 10;
        return {
          productId: r.id,
          name: i18n(r.name_ar, r.name_en),
          image: r.image,
          current: Math.round(current * 100) / 100,
          previous: Math.round(previous * 100) / 100,
          changePct,
          direction: changePct >= 0 ? ("up" as const) : ("down" as const),
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null && Math.abs(a.changePct) >= 3)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 12);

    return { alerts };
  });

  app.get("/intelligence/trending", async (request) => {
    requireAuth(request);
    const rows = await db.execute<{
      id: string; name_ar: string; name_en: string; image: string;
      recent: string; prior: string; current_price: string; month_price: string;
    }>(sql`
      WITH ranked AS (
        SELECT ph.product_id, ph.volume, ph.avg_price,
               row_number() OVER (PARTITION BY ph.product_id ORDER BY ph.observed_on DESC) AS rn
        FROM price_history ph
      ),
      windows AS (
        SELECT product_id,
               sum(volume) FILTER (WHERE rn <= 4)            AS recent,
               sum(volume) FILTER (WHERE rn BETWEEN 5 AND 8) AS prior,
               max(avg_price) FILTER (WHERE rn = 1)          AS current_price,
               max(avg_price) FILTER (WHERE rn = 5)          AS month_price
        FROM ranked GROUP BY product_id
      )
      SELECT p.id, p.name_ar, p.name_en, p.image,
             coalesce(w.recent, 0) AS recent, coalesce(w.prior, 0) AS prior,
             coalesce(w.current_price, 0) AS current_price,
             coalesce(w.month_price, 0) AS month_price
      FROM products p
      JOIN windows w ON w.product_id = p.id
      WHERE p.is_active AND coalesce(w.prior, 0) > 0
      ORDER BY (w.recent::numeric / NULLIF(w.prior, 0)) DESC
      LIMIT 8
    `);

    return {
      trending: rows.map((r) => {
        const recent = num(r.recent);
        const prior = num(r.prior);
        const current = num(r.current_price);
        const month = num(r.month_price);
        return {
          productId: r.id,
          name: i18n(r.name_ar, r.name_en),
          image: r.image,
          recentVolume: Math.round(recent),
          demandGrowthPct: prior ? Math.round(((recent - prior) / prior) * 1000) / 10 : 0,
          priceChangePct: month ? Math.round(((current - month) / month) * 1000) / 10 : 0,
        };
      }),
    };
  });

  app.get("/intelligence/suppliers", async (request) => {
    requireAuth(request);
    const rows = await db.execute<{
      id: string; name_ar: string; name_en: string; logo: string;
      rating: string; on_time_rate: string; response_hours: string;
      fulfilled_orders: number; product_count: number; competitiveness: string;
    }>(sql`
      WITH medians AS (
        SELECT p.category_id,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY t.price) AS median_price
        FROM products p
        JOIN LATERAL (
          SELECT price FROM price_tiers WHERE product_id = p.id ORDER BY min_qty ASC LIMIT 1
        ) t ON true
        WHERE p.is_active
        GROUP BY p.category_id
      )
      SELECT s.id, co.name_ar, co.name_en, co.logo,
             s.rating, s.on_time_rate, s.response_hours, s.fulfilled_orders,
             count(p.id)::int AS product_count,
             coalesce(avg((m.median_price - t.price) / NULLIF(m.median_price, 0)) * 100, 0) AS competitiveness
      FROM suppliers s
      JOIN companies co ON co.id = s.id
      LEFT JOIN products p ON p.supplier_id = s.id AND p.is_active
      LEFT JOIN LATERAL (
        SELECT price FROM price_tiers WHERE product_id = p.id ORDER BY min_qty ASC LIMIT 1
      ) t ON true
      LEFT JOIN medians m ON m.category_id = p.category_id
      GROUP BY s.id, co.name_ar, co.name_en, co.logo, s.rating, s.on_time_rate, s.response_hours, s.fulfilled_orders
    `);

    // Composite score: cheap but unreliable should not outrank dependable.
    const ranked = rows
      .map((r) => {
        const rating = num(r.rating);
        const onTime = num(r.on_time_rate);
        const responseHours = num(r.response_hours);
        const competitiveness = Math.round(num(r.competitiveness) * 10) / 10;
        const score =
          rating * 12 +
          onTime * 30 +
          Math.max(0, 10 - responseHours) * 1.5 +
          Math.min(20, r.fulfilled_orders / 200) +
          competitiveness * 0.6;
        return {
          supplierId: r.id,
          name: i18n(r.name_ar, r.name_en),
          logo: r.logo,
          rating,
          onTimeRate: onTime,
          responseHours,
          fulfilledOrders: r.fulfilled_orders,
          productCount: r.product_count,
          competitivenessPct: competitiveness,
          score: Math.round(score * 10) / 10,
        };
      })
      .sort((a, b) => b.score - a.score);

    return { suppliers: ranked };
  });

  app.get("/intelligence/regions", async (request) => {
    requireAuth(request);
    const rows = await db.execute<{
      country_code: string; name_ar: string; name_en: string; order_count: number; value: string;
    }>(sql`
      SELECT co.country_code, ctry.name_ar, ctry.name_en,
             count(*)::int AS order_count, sum(o.total) AS value
      FROM orders o
      JOIN companies co ON co.id = o.buyer_company_id
      JOIN countries ctry ON ctry.code = co.country_code
      WHERE o.status <> 'cancelled'
      GROUP BY 1, 2, 3 ORDER BY value DESC
    `);

    const total = rows.reduce((s, r) => s + num(r.value), 0) || 1;
    return {
      regions: rows.map((r) => ({
        countryCode: r.country_code,
        name: i18n(r.name_ar, r.name_en),
        orderCount: r.order_count,
        value: num(r.value),
        share: Math.round((num(r.value) / total) * 1000) / 10,
      })),
    };
  });

  /* -------------------------------------------------------- forecast */

  app.get("/forecast/:productId", async (request) => {
    requireAuth(request);
    const { productId } = z.object({ productId: z.uuid() }).parse(request.params);

    const rows = await db.execute<{ observed_on: string; volume: number; avg_price: string }>(sql`
      SELECT observed_on, volume, avg_price
      FROM price_history
      WHERE product_id = ${productId}
      ORDER BY observed_on ASC
    `);
    if (!rows.length) throw notFound("Product history");

    const observations = rows.map((r) => ({
      date: new Date(r.observed_on).toISOString(),
      volume: r.volume,
      price: num(r.avg_price),
    }));

    const forecast = forecastDemand(observations);
    if (!forecast) throw notFound("Insufficient history");

    return { productId, forecast, priceSummary: summarisePrices(observations.map((o) => o.price)) };
  });
}
