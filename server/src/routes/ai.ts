import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { i18n, num } from "../lib/serialize.ts";
import { forecastDemand, summarisePrices } from "../domain/forecast.ts";
import { fold, matchSuppliers, variantsOf, type SupplierMatch } from "../domain/assistant.ts";
import { parse, type ParsedQuery } from "../domain/nlu.ts";
import type { Database } from "../db/client.ts";

/**
 * The WAW assistant.
 *
 * It answers from the live catalogue, the buyer's own order history and the
 * same price history the intelligence dashboards read — running here rather
 * than in the browser is what makes that possible, and it keeps the ranking
 * rules on one side of the wire where they can be audited.
 */

type Text = { ar: string; en: string };

type AiAction =
  | { kind: "view_product"; productId: string; label: Text }
  | { kind: "add_to_cart"; productId: string; qty: number; label: Text }
  | { kind: "create_rfq"; label: Text }
  | { kind: "negotiate"; productId: string; qty: number; targetPrice: number; label: Text }
  | { kind: "navigate"; href: string; label: Text };

interface AiReply {
  parsed: ParsedQuery;
  headline: Text;
  body: Text[];
  matches: SupplierMatch[];
  actions: AiAction[];
}

const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

interface NamedProduct {
  id: string;
  name: Text;
  moq: number;
}

/** The single product a "what does X cost" or "forecast X" question is about. */
async function resolveProduct(db: Database, parsed: ParsedQuery): Promise<NamedProduct | null> {
  const terms = parsed.keywords.map(fold).filter((t) => t.length > 1);
  if (!terms.length) return null;

  const [row] = await db.execute<{ id: string; name_ar: string; name_en: string; moq: number }>(sql`
    SELECT p.id, p.name_ar, p.name_en, p.moq
    FROM products p
    WHERE p.is_active
      AND ${sql.join(
        terms.map((t) =>
          sql`(${sql.join(
            variantsOf(t).map(
              (v) => sql`waw_fold(p.name_ar) LIKE ${"%" + v + "%"}
                      OR waw_fold(p.name_en) LIKE ${"%" + v + "%"}
                      OR waw_fold(p.brand)   LIKE ${"%" + v + "%"}`,
            ),
            sql` OR `,
          )})`,
        ),
        sql` AND `,
      )}
    -- Prefer the item the market actually trades: a thin listing makes for a
    -- price answer nobody can act on.
    ORDER BY (SELECT count(*) FROM price_history ph WHERE ph.product_id = p.id) DESC
    LIMIT 1
  `);

  return row ? { id: row.id, name: i18n(row.name_ar, row.name_en), moq: row.moq } : null;
}

async function historyFor(db: Database, productId: string) {
  const rows = await db.execute<{ observed_on: string; volume: number; avg_price: string }>(sql`
    SELECT observed_on, volume, avg_price
    FROM price_history
    WHERE product_id = ${productId}
    ORDER BY observed_on ASC
  `);
  return rows.map((r) => ({
    date: new Date(r.observed_on).toISOString(),
    volume: r.volume,
    price: num(r.avg_price),
  }));
}

export async function registerAiRoutes(app: FastifyInstance) {
  const { db } = app;

  app.post("/ai/query", async (request) => {
    const { q } = z.object({ q: z.string().trim().min(1).max(500) }).parse(request.body);
    const parsed = parse(q);
    const auth = request.auth;
    const companyId = auth?.companyId ?? null;

    const empty = (): AiReply => ({ parsed, headline: { ar: "", en: "" }, body: [], matches: [], actions: [] });
    const signIn: AiAction = { kind: "navigate", href: "/login", label: { ar: "تسجيل الدخول", en: "Sign in" } };

    switch (parsed.intent) {
      case "greeting":
        return {
          ...empty(),
          headline: { ar: "أهلاً بك في مساعد واو الذكي", en: "Welcome to the WAW AI assistant" },
          body: [
            {
              ar: "اكتب طلبك بلغة طبيعية وسأتولى الباقي — مثلاً: «أحتاج 1000 كرتون مياه بسعر مناسب والتوصيل إلى الرياض خلال خمسة أيام».",
              en: 'Describe what you need in plain language — for example: "I need 1000 cartons of water at a good price delivered to Riyadh within five days."',
            },
          ],
          actions: [
            { kind: "navigate", href: "/search", label: { ar: "تصفّح السوق", en: "Browse the marketplace" } },
            { kind: "navigate", href: "/rfq/new", label: { ar: "أنشئ طلب عرض سعر", en: "Create an RFQ" } },
          ],
        } satisfies AiReply;

      case "track_order": {
        if (!companyId || auth?.role !== "buyer") {
          return {
            ...empty(),
            headline: { ar: "سجّل الدخول لعرض طلباتك", en: "Sign in to see your orders" },
            actions: [signIn],
          } satisfies AiReply;
        }
        const live = await db.execute<{
          reference: string; status: string; eta_days: number; tracking_number: string | null;
        }>(sql`
          SELECT reference, status, eta_days, tracking_number
          FROM orders
          WHERE buyer_company_id = ${companyId} AND status NOT IN ('delivered', 'cancelled')
          ORDER BY created_at DESC
          LIMIT 3
        `);
        return {
          ...empty(),
          headline: {
            ar: live.length ? `لديك ${live.length} طلب قيد التنفيذ` : "لا توجد طلبات نشطة حاليًا",
            en: live.length ? `You have ${live.length} order(s) in progress` : "No active orders right now",
          },
          body: live.map((o) => ({
            ar: `${o.reference} — الحالة: ${o.status} · الوصول المتوقع خلال ${o.eta_days} أيام${o.tracking_number ? ` · التتبع ${o.tracking_number}` : ""}`,
            en: `${o.reference} — status: ${o.status} · ETA ${o.eta_days} days${o.tracking_number ? ` · tracking ${o.tracking_number}` : ""}`,
          })),
          actions: [{ kind: "navigate", href: "/orders", label: { ar: "كل الطلبات", en: "All orders" } }],
        } satisfies AiReply;
      }

      case "reorder": {
        if (!companyId || auth?.role !== "buyer") {
          return {
            ...empty(),
            headline: { ar: "سجّل الدخول لاقتراح إعادة الطلب", en: "Sign in for reorder suggestions" },
            actions: [signIn],
          } satisfies AiReply;
        }
        const rows = await db.execute<{
          product_id: string; name_ar: string; name_en: string; moq: number;
          avg_interval_days: string; days_since_last: string; avg_qty: string;
        }>(sql`
          WITH history AS (
            SELECT ol.product_id, o.created_at, ol.qty,
                   lag(o.created_at) OVER (PARTITION BY ol.product_id ORDER BY o.created_at) AS previous_at
            FROM order_lines ol
            JOIN orders o ON o.id = ol.order_id
            WHERE o.buyer_company_id = ${companyId} AND o.status <> 'cancelled'
          )
          SELECT h.product_id, p.name_ar, p.name_en, p.moq,
                 avg(EXTRACT(EPOCH FROM (h.created_at - h.previous_at)) / 86400) AS avg_interval_days,
                 EXTRACT(EPOCH FROM (now() - max(h.created_at))) / 86400        AS days_since_last,
                 avg(h.qty)                                                      AS avg_qty
          FROM history h
          JOIN products p ON p.id = h.product_id
          GROUP BY h.product_id, p.name_ar, p.name_en, p.moq
          HAVING count(*) FILTER (WHERE h.previous_at IS NOT NULL) > 0
             AND avg(EXTRACT(EPOCH FROM (h.created_at - h.previous_at)) / 86400) >= 3
          ORDER BY (avg(EXTRACT(EPOCH FROM (h.created_at - h.previous_at)) / 86400)
                    - EXTRACT(EPOCH FROM (now() - max(h.created_at))) / 86400) ASC
          LIMIT 4
        `);
        const suggestions = rows.map((r) => ({
          productId: r.product_id,
          name: i18n(r.name_ar, r.name_en),
          avgIntervalDays: Math.round(num(r.avg_interval_days)),
          daysSinceLast: Math.round(num(r.days_since_last)),
          suggestedQty: Math.max(r.moq, Math.round(num(r.avg_qty))),
        }));
        return {
          ...empty(),
          headline: {
            ar: suggestions.length ? "أصناف يُنصح بإعادة طلبها" : "لا توجد اقتراحات إعادة طلب بعد",
            en: suggestions.length ? "Items due for reorder" : "No reorder suggestions yet",
          },
          body: suggestions.map((s) => ({
            ar: `${s.name.ar}: تطلبه كل ${s.avgIntervalDays} يومًا تقريبًا، ومضى ${s.daysSinceLast} يومًا على آخر طلب — الكمية المقترحة ${fmt(s.suggestedQty)}.`,
            en: `${s.name.en}: ordered roughly every ${s.avgIntervalDays} days, last one was ${s.daysSinceLast} days ago — suggested quantity ${fmt(s.suggestedQty)}.`,
          })),
          actions: suggestions.slice(0, 2).map((s) => ({
            kind: "add_to_cart" as const,
            productId: s.productId,
            qty: s.suggestedQty,
            label: { ar: `أضف ${s.name.ar}`, en: `Add ${s.name.en}` },
          })),
        } satisfies AiReply;
      }

      case "price_analysis": {
        const target = await resolveProduct(db, parsed);
        const series = target ? summarisePrices((await historyFor(db, target.id)).map((o) => o.price)) : null;
        if (!target || !series) {
          return {
            ...empty(),
            headline: { ar: "لم أجد صنفًا مطابقًا لتحليله", en: "No matching item to analyse" },
            actions: [{ kind: "navigate", href: "/intelligence", label: { ar: "ذكاء السوق", en: "Market intelligence" } }],
          } satisfies AiReply;
        }
        const up = series.changeMonthPct >= 0;
        return {
          ...empty(),
          headline: { ar: `تحليل سعر ${target.name.ar}`, en: `Price analysis — ${target.name.en}` },
          body: [
            {
              ar: `المتوسط الحالي ${fmt(series.current)} ريال، و${up ? "ارتفع" : "انخفض"} بنسبة ${Math.abs(series.changeMonthPct)}% خلال الشهر و${Math.abs(series.changeQuarterPct)}% خلال الربع.`,
              en: `Current average is ${fmt(series.current)} SAR, ${up ? "up" : "down"} ${Math.abs(series.changeMonthPct)}% over the month and ${Math.abs(series.changeQuarterPct)}% over the quarter.`,
            },
            {
              ar: `نطاق الفترة المرصودة: ${fmt(series.min)} – ${fmt(series.max)} ريال، بتذبذب ${series.volatility}%.`,
              en: `Observed range: ${fmt(series.min)}–${fmt(series.max)} SAR, volatility ${series.volatility}%.`,
            },
            series.changeMonthPct < -2
              ? { ar: "السعر أقل من متوسطه — نافذة شراء جيدة.", en: "Price is below its average — a good buying window." }
              : series.changeMonthPct > 3
                ? { ar: "السعر في اتجاه صاعد — يُفضّل تثبيت عقد توريد.", en: "Prices are trending up — consider locking a supply contract." }
                : { ar: "السعر مستقر نسبيًا هذا الشهر.", en: "Prices are broadly stable this month." },
          ],
          actions: [
            { kind: "view_product", productId: target.id, label: { ar: "عرض المنتج", en: "View product" } },
            { kind: "navigate", href: "/intelligence", label: { ar: "لوحة ذكاء السوق", en: "Market intelligence" } },
          ],
        } satisfies AiReply;
      }

      case "forecast": {
        const target = await resolveProduct(db, parsed);
        const f = target ? forecastDemand(await historyFor(db, target.id)) : null;
        if (!target || !f) {
          return {
            ...empty(),
            headline: { ar: "لا يوجد سجل كافٍ للتنبؤ", en: "Not enough history to forecast" },
            actions: [{ kind: "navigate", href: "/forecasting", label: { ar: "لوحة التنبؤ بالطلب", en: "Demand forecasting" } }],
          } satisfies AiReply;
        }
        const dirAr = f.direction === "rising" ? "صاعد" : f.direction === "declining" ? "هابط" : "مستقر";
        return {
          ...empty(),
          headline: { ar: `توقع الطلب — ${target.name.ar}`, en: `Demand forecast — ${target.name.en}` },
          body: [
            {
              ar: `الطلب المتوقع خلال الشهر القادم ${fmt(f.nextMonthUnits)} وحدة، والاتجاه ${dirAr} بثقة ${f.confidence}%.`,
              en: `Projected demand next month is ${fmt(f.nextMonthUnits)} units, trending ${f.direction}, with ${f.confidence}% model confidence.`,
            },
            {
              ar: `قوة الموسمية ${f.seasonalStrength}%، وتوقع تغير السعر ${f.priceOutlookPct}%.`,
              en: `Seasonality strength ${f.seasonalStrength}%, price outlook ${f.priceOutlookPct}%.`,
            },
          ],
          actions: [
            { kind: "view_product", productId: target.id, label: { ar: "عرض المنتج", en: "View product" } },
            { kind: "navigate", href: "/forecasting", label: { ar: "لوحة التنبؤ بالطلب", en: "Demand forecasting" } },
          ],
        } satisfies AiReply;
      }

      case "negotiate": {
        const matches = await matchSuppliers(db, parsed, 3);
        if (!matches.length) {
          return {
            ...empty(),
            headline: { ar: "حدّد الصنف الذي تريد التفاوض عليه", en: "Tell me which item to negotiate on" },
          } satisfies AiReply;
        }
        const best = matches[0];
        const target = parsed.budget ?? Math.round(best.unitPrice * 0.88 * 100) / 100;
        const qty = parsed.qty ?? best.moq * 3;
        return {
          parsed,
          headline: { ar: "جاهز لبدء التفاوض", en: "Ready to open a negotiation" },
          body: [
            {
              ar: `أفضل سعر معروض الآن ${fmt(best.unitPrice)} ريال من ${best.supplierName.ar}. أقترح فتح تفاوض عند ${fmt(target)} ريال لكمية ${fmt(qty)} — وهو ضمن نطاق يقبله عادة الموردون عند هذه الكمية.`,
              en: `The best listed price is ${fmt(best.unitPrice)} SAR from ${best.supplierName.en}. I suggest opening at ${fmt(target)} SAR for ${fmt(qty)} units — within the range suppliers usually accept at this volume.`,
            },
            {
              ar: "نقطة تفاوض قوية: التزم بكمية أكبر أو دفعة مقدمة مقابل خفض السعر أو مجانية الشحن.",
              en: "Strong lever: commit to a larger volume or an advance payment in exchange for a lower price or free freight.",
            },
          ],
          matches,
          actions: [
            {
              kind: "negotiate",
              productId: best.productId,
              qty,
              targetPrice: target,
              label: { ar: "ابدأ التفاوض", en: "Start negotiation" },
            },
          ],
        } satisfies AiReply;
      }

      case "rfq": {
        const matches = await matchSuppliers(db, parsed, 5);
        return {
          parsed,
          headline: { ar: "سأجهّز لك طلب عرض سعر", en: "I'll prepare an RFQ for you" },
          body: [
            {
              ar: `فهمت: ${parsed.qty ? `${fmt(parsed.qty)} ` : ""}${parsed.keywords.join(" ") || "الصنف المطلوب"}${parsed.city ? ` إلى ${parsed.city}` : ""}${parsed.withinDays != null ? ` خلال ${parsed.withinDays} أيام` : ""}.`,
              en: `Understood: ${parsed.qty ? `${fmt(parsed.qty)} ` : ""}${parsed.keywords.join(" ") || "requested item"}${parsed.city ? ` to ${parsed.city}` : ""}${parsed.withinDays != null ? ` within ${parsed.withinDays} days` : ""}.`,
            },
            {
              ar: `سأدعو ${matches.length} موردًا مطابقًا لتقديم عروضهم، ويمكنك مقارنتها جنبًا إلى جنب.`,
              en: `I'll invite ${matches.length} matching suppliers to quote so you can compare side by side.`,
            },
          ],
          matches,
          actions: [{ kind: "create_rfq", label: { ar: "أنشئ طلب عرض السعر", en: "Create the RFQ" } }],
        } satisfies AiReply;
      }

      case "supplier_match": {
        const matches = await matchSuppliers(db, parsed, 5);
        return {
          parsed,
          headline: {
            ar: matches.length ? `أفضل ${matches.length} موردين لطلبك` : "لم أجد موردًا مطابقًا",
            en: matches.length ? `Top ${matches.length} suppliers for your request` : "No matching supplier found",
          },
          body: matches.length
            ? [
                {
                  ar: "رتّبت الموردين حسب السعر والالتزام بالمواعيد والتقييم والقرب الجغرافي.",
                  en: "Ranked by price, on-time delivery, rating and geographic proximity.",
                },
              ]
            : [{ ar: "جرّب وصف الصنف بكلمات أوضح أو تصفّح التصنيفات.", en: "Try describing the item differently, or browse the categories." }],
          matches,
          actions: [{ kind: "navigate", href: "/suppliers", label: { ar: "دليل الموردين", en: "Supplier directory" } }],
        } satisfies AiReply;
      }

      case "search":
      default: {
        const matches = await matchSuppliers(db, parsed, 5);
        if (!matches.length) {
          return {
            ...empty(),
            headline: { ar: "لم أعثر على نتائج مطابقة", en: "I couldn't find a match" },
            body: [
              {
                ar: "جرّب ذكر اسم المنتج والكمية والمدينة، مثل: «أحتاج 500 كرتون زيت إلى جدة خلال أسبوع».",
                en: 'Try naming the product, quantity and city — e.g. "I need 500 cartons of cooking oil to Jeddah within a week".',
              },
            ],
            actions: [{ kind: "navigate", href: "/search", label: { ar: "تصفّح السوق", en: "Browse the marketplace" } }],
          } satisfies AiReply;
        }
        const best = matches[0];
        const qty = Math.max(parsed.qty ?? best.moq, best.moq);
        const ar: string[] = [];
        const en: string[] = [];
        if (parsed.qty) { ar.push(`الكمية ${fmt(parsed.qty)}`); en.push(`quantity ${fmt(parsed.qty)}`); }
        if (parsed.unit) { ar.push(`الوحدة ${parsed.unit}`); en.push(`unit ${parsed.unit}`); }
        if (parsed.city) { ar.push(`التسليم في ${parsed.city}`); en.push(`delivery to ${parsed.city}`); }
        if (parsed.withinDays != null) { ar.push(`خلال ${parsed.withinDays} أيام`); en.push(`within ${parsed.withinDays} days`); }
        if (parsed.budget) { ar.push(`ميزانية ${fmt(parsed.budget)} ريال`); en.push(`budget ${fmt(parsed.budget)} SAR`); }

        return {
          parsed,
          headline: { ar: `وجدت ${matches.length} عرضًا مطابقًا`, en: `Found ${matches.length} matching offers` },
          body: [
            ar.length
              ? { ar: `فهمت من طلبك: ${ar.join("، ")}.`, en: `I understood: ${en.join(", ")}.` }
              : { ar: "بحثت في السوق بناءً على وصفك.", en: "I searched the marketplace from your description." },
            {
              ar: `أفضل خيار: ${best.supplierName.ar} بسعر ${fmt(best.unitPrice)} ريال للوحدة، تجهيز ${best.leadTimeDays} أيام، وإجمالي تقديري ${fmt(best.lineTotal)} ريال.`,
              en: `Best option: ${best.supplierName.en} at ${fmt(best.unitPrice)} SAR per unit, ${best.leadTimeDays}-day lead time, estimated total ${fmt(best.lineTotal)} SAR.`,
            },
          ],
          matches,
          actions: [
            { kind: "add_to_cart", productId: best.productId, qty, label: { ar: "أضف للسلة", en: "Add to cart" } },
            { kind: "create_rfq", label: { ar: "اطلب عروض أسعار", en: "Request quotes" } },
            { kind: "view_product", productId: best.productId, label: { ar: "تفاصيل المنتج", en: "Product details" } },
          ],
        } satisfies AiReply;
      }
    }
  });

  /**
   * Empty-state prompts. The fourth one names the category the buyer actually
   * spends in, so the assistant opens on their business rather than a demo.
   */
  app.get("/ai/prompts", async (request) => {
    const companyId = request.auth?.companyId ?? null;
    let category: Text | null = null;

    if (companyId && request.auth?.role === "buyer") {
      const [row] = await db.execute<{ name_ar: string; name_en: string }>(sql`
        SELECT c.name_ar, c.name_en
        FROM order_lines ol
        JOIN orders o ON o.id = ol.order_id
        JOIN products p ON p.id = ol.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE o.buyer_company_id = ${companyId} AND o.status <> 'cancelled'
        GROUP BY c.id, c.name_ar, c.name_en
        ORDER BY sum(ol.qty * ol.unit_price) DESC
        LIMIT 1
      `);
      if (row) category = i18n(row.name_ar, row.name_en);
    }

    return {
      prompts: {
        ar: [
          "أحتاج 1000 كرتون مياه بسعر مناسب والتوصيل إلى الرياض خلال خمسة أيام",
          "من أفضل مورد معتمد لجبن الموزاريلا؟",
          "ما متوسط سعر زيت دوار الشمس هذا الشهر؟",
          `توقع الطلب على ${category?.ar ?? "المياه"} خلال الشهر القادم`,
          "أريد التفاوض على خصم لكمية كبيرة من الأرز",
        ],
        en: [
          "I need 1000 cartons of water at a good price delivered to Riyadh within five days",
          "Who is the best verified mozzarella supplier?",
          "What is the average price of sunflower oil this month?",
          `Forecast demand for ${category?.en ?? "water"} next month`,
          "I want to negotiate a bulk discount on rice",
        ],
      },
    };
  });
}
