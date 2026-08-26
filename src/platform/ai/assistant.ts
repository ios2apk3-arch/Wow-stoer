import { auth, catalog, orders, type ProductFilters } from "../api";
import { buyerSpend, forecastDemand, priceSeries, reorderSuggestions, supplierRankings, trendingProducts } from "../intelligence";
import { unitPrice } from "../pricing";
import { parse, type ParsedQuery } from "./nlu";
import type { Locale, Product } from "../types";

export interface SupplierMatch {
  supplierId: string;
  name: { ar: string; en: string };
  product: Product;
  unitPrice: number;
  lineTotal: number;
  leadTimeDays: number;
  meetsDeadline: boolean;
  meetsBudget: boolean;
  meetsMoq: boolean;
  rating: number;
  onTimeRate: number;
  verified: boolean;
  matchScore: number;
  reasons: { ar: string; en: string }[];
}

export type AiAction =
  | { kind: "view_product"; productId: string; label: { ar: string; en: string } }
  | { kind: "add_to_cart"; productId: string; qty: number; label: { ar: string; en: string } }
  | { kind: "create_rfq"; prefill: Partial<ParsedQuery>; label: { ar: string; en: string } }
  | { kind: "negotiate"; productId: string; qty: number; targetPrice: number; label: { ar: string; en: string } }
  | { kind: "navigate"; href: string; label: { ar: string; en: string } };

export interface AiReply {
  parsed: ParsedQuery;
  headline: { ar: string; en: string };
  body: { ar: string; en: string }[];
  matches: SupplierMatch[];
  actions: AiAction[];
}

const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

/**
 * Rank suppliers against everything the buyer said: price, MOQ, lead time,
 * destination and reliability. Every match carries its reasons so the buyer
 * can see why it ranked where it did.
 */
export function matchSuppliers(parsed: ParsedQuery, limit = 5): SupplierMatch[] {
  const filters: ProductFilters = {
    query: parsed.keywords.join(" "),
    sort: parsed.wantsCheapest ? "price_asc" : parsed.wantsFastest ? "lead_time" : "relevance",
  };
  const candidates = catalog.search(filters).slice(0, 40);
  const qty = parsed.qty ?? 0;
  const rankings = new Map(supplierRankings().map((r) => [r.supplierId, r]));

  const matches = candidates.map((product) => {
    const supplier = catalog.supplier(product.supplierId);
    const company = catalog.supplierCompany(product.supplierId);
    const effectiveQty = Math.max(qty || product.moq, product.moq);
    const price = unitPrice(product, effectiveQty);
    const reasons: { ar: string; en: string }[] = [];

    const meetsMoq = qty === 0 || qty >= product.moq;
    const meetsDeadline = parsed.withinDays == null || product.leadTimeDays <= parsed.withinDays;
    const meetsBudget = parsed.budget == null || price <= parsed.budget;
    const verified = company?.verification === "verified";

    let score = 50;
    if (meetsBudget && parsed.budget != null) {
      score += 18;
      reasons.push({
        ar: `السعر ${fmt(price)} ريال ضمن ميزانيتك`,
        en: `Unit price ${fmt(price)} SAR fits your budget`,
      });
    } else if (parsed.budget != null) {
      score -= 22;
      reasons.push({
        ar: `أعلى من ميزانيتك بـ ${fmt(price - parsed.budget)} ريال`,
        en: `${fmt(price - parsed.budget)} SAR above your budget`,
      });
    }
    if (meetsDeadline && parsed.withinDays != null) {
      score += 16;
      reasons.push({
        ar: `التجهيز ${product.leadTimeDays} أيام — ضمن الموعد المطلوب`,
        en: `${product.leadTimeDays}-day lead time meets your deadline`,
      });
    } else if (parsed.withinDays != null) {
      score -= 20;
      reasons.push({
        ar: `يحتاج ${product.leadTimeDays} أيام — يتجاوز موعدك`,
        en: `Needs ${product.leadTimeDays} days — misses your deadline`,
      });
    }
    if (!meetsMoq) {
      score -= 14;
      reasons.push({
        ar: `الحد الأدنى للطلب ${fmt(product.moq)} وحدة`,
        en: `Minimum order is ${fmt(product.moq)} units`,
      });
    }
    if (parsed.countryCode && product.originCountry === parsed.countryCode) {
      score += 10;
      reasons.push({ ar: "مورد محلي — شحن أسرع وأرخص", en: "Domestic supplier — faster, cheaper freight" });
    }
    if (verified) {
      score += 8;
      if (parsed.wantsVerified) score += 6;
      reasons.push({ ar: "شركة موثّقة على المنصة", en: "Verified company on the platform" });
    }
    if (product.availability === "in_stock") {
      score += 7;
      reasons.push({ ar: "متوفر في المخزون الآن", en: "In stock right now" });
    } else if (product.availability === "out_of_stock") {
      score -= 25;
    }
    score += (supplier?.rating ?? 0) * 3;
    score += (rankings.get(product.supplierId)?.competitivenessPct ?? 0) * 0.25;

    return {
      supplierId: product.supplierId,
      name: company?.name ?? { ar: product.supplierId, en: product.supplierId },
      product,
      unitPrice: price,
      lineTotal: Math.round(price * effectiveQty * 100) / 100,
      leadTimeDays: product.leadTimeDays,
      meetsDeadline,
      meetsBudget,
      meetsMoq,
      rating: supplier?.rating ?? 0,
      onTimeRate: supplier?.onTimeRate ?? 0,
      verified,
      matchScore: Math.max(0, Math.min(100, Math.round(score))),
      reasons: reasons.slice(0, 3),
    };
  });

  // Keep the best offer per supplier so one vendor cannot fill the whole list.
  const bestPerSupplier = new Map<string, SupplierMatch>();
  for (const m of matches) {
    const existing = bestPerSupplier.get(m.supplierId);
    if (!existing || m.matchScore > existing.matchScore) bestPerSupplier.set(m.supplierId, m);
  }
  return [...bestPerSupplier.values()].sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
}

export function respond(raw: string): AiReply {
  const parsed = parse(raw);
  const user = auth.currentUser();
  const company = auth.currentCompany();

  const empty: AiReply = { parsed, headline: { ar: "", en: "" }, body: [], matches: [], actions: [] };

  switch (parsed.intent) {
    case "greeting":
      return {
        ...empty,
        headline: {
          ar: "أهلاً بك في مساعد واو الذكي",
          en: "Welcome to the WAW AI assistant",
        },
        body: [
          {
            ar: "اكتب طلبك بلغة طبيعية وسأتولى الباقي — مثلاً: «أحتاج 1000 كرتون مياه بسعر مناسب والتوصيل إلى الرياض خلال خمسة أيام».",
            en: "Describe what you need in plain language — for example: \"I need 1000 cartons of water at a good price delivered to Riyadh within five days.\"",
          },
        ],
        actions: [
          { kind: "navigate", href: "/search", label: { ar: "تصفّح السوق", en: "Browse the marketplace" } },
          { kind: "navigate", href: "/rfq/new", label: { ar: "أنشئ طلب عرض سعر", en: "Create an RFQ" } },
        ],
      };

    case "track_order": {
      if (!company) {
        return {
          ...empty,
          headline: { ar: "سجّل الدخول لعرض طلباتك", en: "Sign in to see your orders" },
          actions: [{ kind: "navigate", href: "/login", label: { ar: "تسجيل الدخول", en: "Sign in" } }],
        };
      }
      const live = orders
        .forBuyer(company.id)
        .filter((o) => !["delivered", "cancelled"].includes(o.status))
        .slice(0, 3);
      return {
        ...empty,
        headline: {
          ar: live.length ? `لديك ${live.length} طلب قيد التنفيذ` : "لا توجد طلبات نشطة حاليًا",
          en: live.length ? `You have ${live.length} order(s) in progress` : "No active orders right now",
        },
        body: live.map((o) => ({
          ar: `${o.reference} — الحالة: ${o.status} · الوصول المتوقع خلال ${o.etaDays} أيام${o.trackingNumber ? ` · التتبع ${o.trackingNumber}` : ""}`,
          en: `${o.reference} — status: ${o.status} · ETA ${o.etaDays} days${o.trackingNumber ? ` · tracking ${o.trackingNumber}` : ""}`,
        })),
        actions: [{ kind: "navigate", href: "/orders", label: { ar: "كل الطلبات", en: "All orders" } }],
      };
    }

    case "reorder": {
      if (!company) {
        return {
          ...empty,
          headline: { ar: "سجّل الدخول لاقتراح إعادة الطلب", en: "Sign in for reorder suggestions" },
          actions: [{ kind: "navigate", href: "/login", label: { ar: "تسجيل الدخول", en: "Sign in" } }],
        };
      }
      const suggestions = reorderSuggestions(company.id, 4);
      return {
        ...empty,
        headline: {
          ar: suggestions.length ? "أصناف يُنصح بإعادة طلبها" : "لا توجد اقتراحات إعادة طلب بعد",
          en: suggestions.length ? "Items due for reorder" : "No reorder suggestions yet",
        },
        body: suggestions.map((s) => ({
          ar: `${s.product.name.ar}: تطلبه كل ${s.avgIntervalDays} يومًا تقريبًا، ومضى ${s.daysSinceLast} يومًا على آخر طلب — الكمية المقترحة ${fmt(s.suggestedQty)}.`,
          en: `${s.product.name.en}: ordered roughly every ${s.avgIntervalDays} days, last one was ${s.daysSinceLast} days ago — suggested quantity ${fmt(s.suggestedQty)}.`,
        })),
        actions: suggestions.slice(0, 2).map((s) => ({
          kind: "add_to_cart" as const,
          productId: s.product.id,
          qty: s.suggestedQty,
          label: { ar: `أضف ${s.product.name.ar}`, en: `Add ${s.product.name.en}` },
        })),
      };
    }

    case "price_analysis": {
      const target = catalog.search({ query: parsed.keywords.join(" ") })[0];
      if (!target) {
        return {
          ...empty,
          headline: { ar: "لم أجد صنفًا مطابقًا لتحليله", en: "No matching item to analyse" },
          actions: [{ kind: "navigate", href: "/intelligence", label: { ar: "ذكاء السوق", en: "Market intelligence" } }],
        };
      }
      const series = priceSeries(target.id);
      if (!series) return empty;
      const dir = series.changeMonthPct >= 0 ? "ارتفع" : "انخفض";
      return {
        ...empty,
        headline: {
          ar: `تحليل سعر ${target.name.ar}`,
          en: `Price analysis — ${target.name.en}`,
        },
        body: [
          {
            ar: `المتوسط الحالي ${fmt(series.current)} ريال، و${dir} بنسبة ${Math.abs(series.changeMonthPct)}% خلال الشهر و${Math.abs(series.changeQuarterPct)}% خلال الربع.`,
            en: `Current average is ${fmt(series.current)} SAR, ${series.changeMonthPct >= 0 ? "up" : "down"} ${Math.abs(series.changeMonthPct)}% over the month and ${Math.abs(series.changeQuarterPct)}% over the quarter.`,
          },
          {
            ar: `نطاق آخر 26 أسبوعًا: ${fmt(series.min)} – ${fmt(series.max)} ريال، بتذبذب ${series.volatility}%.`,
            en: `26-week range: ${fmt(series.min)}–${fmt(series.max)} SAR, volatility ${series.volatility}%.`,
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
      };
    }

    case "forecast": {
      const target = catalog.search({ query: parsed.keywords.join(" ") })[0] ?? trendingProducts(1)[0]?.product;
      if (!target) return empty;
      const f = forecastDemand(target.id);
      if (!f) return empty;
      return {
        ...empty,
        headline: { ar: `توقع الطلب — ${target.name.ar}`, en: `Demand forecast — ${target.name.en}` },
        body: [
          {
            ar: `الطلب المتوقع خلال الشهر القادم ${fmt(f.nextMonthUnits)} وحدة، والاتجاه ${f.direction === "rising" ? "صاعد" : f.direction === "declining" ? "هابط" : "مستقر"} بثقة ${f.confidence}%.`,
            en: `Projected demand next month is ${fmt(f.nextMonthUnits)} units, trending ${f.direction}, with ${f.confidence}% model confidence.`,
          },
          {
            ar: `قوة الموسمية ${f.seasonalStrength}%، وتوقع تغير السعر ${f.priceOutlookPct}%.`,
            en: `Seasonality strength ${f.seasonalStrength}%, price outlook ${f.priceOutlookPct}%.`,
          },
        ],
        actions: [{ kind: "navigate", href: "/forecasting", label: { ar: "لوحة التنبؤ بالطلب", en: "Demand forecasting" } }],
      };
    }

    case "negotiate": {
      const matches = matchSuppliers(parsed, 3);
      if (!matches.length) {
        return { ...empty, headline: { ar: "حدّد الصنف الذي تريد التفاوض عليه", en: "Tell me which item to negotiate on" } };
      }
      const best = matches[0];
      const target = parsed.budget ?? Math.round(best.unitPrice * 0.88 * 100) / 100;
      const qty = parsed.qty ?? best.product.moq * 3;
      return {
        parsed,
        headline: { ar: "جاهز لبدء التفاوض", en: "Ready to open a negotiation" },
        body: [
          {
            ar: `أفضل سعر معروض الآن ${fmt(best.unitPrice)} ريال من ${best.name.ar}. أقترح فتح تفاوض عند ${fmt(target)} ريال لكمية ${fmt(qty)} — وهو ضمن نطاق يقبله عادة الموردون عند هذه الكمية.`,
            en: `The best listed price is ${fmt(best.unitPrice)} SAR from ${best.name.en}. I suggest opening at ${fmt(target)} SAR for ${fmt(qty)} units — within the range suppliers usually accept at this volume.`,
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
            productId: best.product.id,
            qty,
            targetPrice: target,
            label: { ar: "ابدأ التفاوض", en: "Start negotiation" },
          },
        ],
      };
    }

    case "rfq": {
      const matches = matchSuppliers(parsed, 5);
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
        actions: [
          { kind: "create_rfq", prefill: parsed, label: { ar: "أنشئ طلب عرض السعر", en: "Create the RFQ" } },
        ],
      };
    }

    case "supplier_match": {
      const matches = matchSuppliers(parsed, 5);
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
      };
    }

    case "search":
    default: {
      const matches = matchSuppliers(parsed, 5);
      if (!matches.length) {
        return {
          ...empty,
          headline: { ar: "لم أعثر على نتائج مطابقة", en: "I couldn't find a match" },
          body: [
            {
              ar: "جرّب ذكر اسم المنتج والكمية والمدينة، مثل: «أحتاج 500 كرتون زيت إلى جدة خلال أسبوع».",
              en: "Try naming the product, quantity and city — e.g. \"I need 500 cartons of cooking oil to Jeddah within a week\".",
            },
          ],
          actions: [{ kind: "navigate", href: "/search", label: { ar: "تصفّح السوق", en: "Browse the marketplace" } }],
        };
      }
      const best = matches[0];
      const qty = parsed.qty ?? best.product.moq;
      const understood: string[] = [];
      const understoodEn: string[] = [];
      if (parsed.qty) { understood.push(`الكمية ${fmt(parsed.qty)}`); understoodEn.push(`quantity ${fmt(parsed.qty)}`); }
      if (parsed.unit) { understood.push(`الوحدة ${parsed.unit}`); understoodEn.push(`unit ${parsed.unit}`); }
      if (parsed.city) { understood.push(`التسليم في ${parsed.city}`); understoodEn.push(`delivery to ${parsed.city}`); }
      if (parsed.withinDays != null) { understood.push(`خلال ${parsed.withinDays} أيام`); understoodEn.push(`within ${parsed.withinDays} days`); }
      if (parsed.budget) { understood.push(`ميزانية ${fmt(parsed.budget)} ريال`); understoodEn.push(`budget ${fmt(parsed.budget)} SAR`); }

      return {
        parsed,
        headline: {
          ar: `وجدت ${matches.length} عرضًا مطابقًا`,
          en: `Found ${matches.length} matching offers`,
        },
        body: [
          understood.length
            ? { ar: `فهمت من طلبك: ${understood.join("، ")}.`, en: `I understood: ${understoodEn.join(", ")}.` }
            : { ar: "بحثت في السوق بناءً على وصفك.", en: "I searched the marketplace from your description." },
          {
            ar: `أفضل خيار: ${best.name.ar} بسعر ${fmt(best.unitPrice)} ريال للوحدة، تجهيز ${best.leadTimeDays} أيام، وإجمالي تقديري ${fmt(best.lineTotal)} ريال.`,
            en: `Best option: ${best.name.en} at ${fmt(best.unitPrice)} SAR per unit, ${best.leadTimeDays}-day lead time, estimated total ${fmt(best.lineTotal)} SAR.`,
          },
        ],
        matches,
        actions: [
          { kind: "add_to_cart", productId: best.product.id, qty: Math.max(qty, best.product.moq), label: { ar: "أضف للسلة", en: "Add to cart" } },
          { kind: "create_rfq", prefill: parsed, label: { ar: "اطلب عروض أسعار", en: "Request quotes" } },
          { kind: "view_product", productId: best.product.id, label: { ar: "تفاصيل المنتج", en: "Product details" } },
        ],
      };
    }
  }
}

/** Short, personalised prompts for the assistant's empty state. */
export function suggestedPrompts(locale: Locale): string[] {
  const company = auth.currentCompany();
  const spend = company ? buyerSpend(company.id) : null;
  const topCat = spend?.topCategories[0];
  const catName = topCat ? catalog.categories().find((c) => c.id === topCat.categoryId)?.name[locale] : null;

  const ar = [
    "أحتاج 1000 كرتون مياه بسعر مناسب والتوصيل إلى الرياض خلال خمسة أيام",
    "من أفضل مورد معتمد للأجبان في الخليج؟",
    "ما متوسط سعر زيت دوار الشمس هذا الشهر؟",
    catName ? `توقع الطلب على ${catName} خلال الشهر القادم` : "توقع الطلب على المياه خلال الشهر القادم",
    "أريد التفاوض على خصم لكمية كبيرة من الأرز",
  ];
  const en = [
    "I need 1000 cartons of water at a good price delivered to Riyadh within five days",
    "Who is the best verified cheese supplier in the Gulf?",
    "What is the average price of sunflower oil this month?",
    catName ? `Forecast demand for ${catName} next month` : "Forecast water demand for next month",
    "I want to negotiate a bulk discount on rice",
  ];
  return locale === "ar" ? ar : en;
}
