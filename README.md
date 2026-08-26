# WAW Smart Commerce · واو الاقتصادية

منصة تجارة جملة B2B ذكية — A smart B2B wholesale platform combining a
marketplace, RFQ and negotiation workflows, market intelligence, demand
forecasting, and a natural-language assistant that understands Arabic and
English.

## Running it

```bash
npm install
npm run dev        # development server
npm run build      # production bundle
npm run preview    # serve the production build on :4173
npm run typecheck  # tsc --noEmit
npm run test:e2e   # browser suite against a running preview
```

The e2e suite drives a real Chromium against `http://localhost:4173`. Start
`npm run preview` first. In sandboxes that ship their own browser, point
`WAW_CHROMIUM` at the binary; otherwise Playwright resolves its own.

## What is real, and what is not

This build is a **working application with a client-side persistence layer**.
That distinction matters, so it is stated plainly:

| Area | Status |
| --- | --- |
| Domain model, business rules, pricing, RBAC | Real code |
| Catalog search, cart, orders, RFQ, negotiation, messaging, notifications | Real, fully interactive |
| Market intelligence and demand forecasting | Real computations over the seeded dataset |
| WAW AI intent extraction and supplier matching | Real, deterministic, offline |
| Storage | `localStorage`, behind `platform/api.ts` |
| Payments and shipping | Adapter interfaces with sandbox providers |
| Mobile apps, WhatsApp commerce | Not built — see Roadmap |

Every UI module talks to `src/platform/api.ts` and nothing else. Replacing the
local adapter with HTTP calls to a real backend means reimplementing that one
file; no page or component changes.

Data is seeded deterministically, so every visitor sees the same marketplace.
Bump `SEED_VERSION` in `src/platform/data/seed.ts` to invalidate stored copies.
The admin dashboard has a **Reset demo data** button.

### Demo accounts

Sign-in accepts any seeded email with no password. The login page offers
one-click entry for each role:

| Role | Email |
| --- | --- |
| Buyer | `buy-1@waw.example.com` |
| Supplier | `sup-1@waw.example.com` |
| Admin | `admin@waw.example.com` |

## Architecture

```
src/
  platform/            Storage-agnostic core — no React
    types.ts           Domain model: the single source of truth
    store.ts           Reactive persistence adapter (localStorage)
    api.ts             The ONLY seam between UI and storage; owns RBAC
    pricing.ts         Wholesale tier ladder, VAT, freight estimation
    adapters.ts        Payment + shipping provider interfaces
    intelligence.ts    Price series, indices, rankings, forecasting
    ai/nlu.ts          Arabic + English intent and slot extraction
    ai/assistant.ts    Supplier matching with per-match reasoning
    data/              Reference catalog + deterministic seed generator
  i18n/                Bilingual dictionary, RTL/LTR direction switching
  ui/                  Design-system primitives
  app/                 Router, store hooks, application shell
  components/          Shared cards, badges, charts
  pages/               One module per route
  pages/company/       The original Wow marketing site, served at /company
e2e/                   Browser test suites
```

### Design decisions worth knowing

**The API seam.** `platform/api.ts` is the only module that touches storage.
This is what makes the backend swap a one-file change rather than a rewrite.

**Deterministic AI.** `ai/nlu.ts` is rule-based, not a model call. It runs
offline, costs nothing, and — critically — is *explainable*: the assistant
shows the user every slot it extracted, so a misreading is visible and
correctable instead of silent. A hosted LLM can replace `parse()` behind the
same `ParsedQuery` contract when one is warranted.

**Explainable forecasting.** `forecastDemand` is a least-squares linear trend
plus a fitted annual seasonal term, with an explicit confidence band from the
residuals. A buyer has to trust a reorder number before acting on it, so the
model stays simple enough to explain in one sentence.

**Supplier matching shows its work.** Every match in `matchSuppliers` carries
the reasons it ranked where it did — budget fit, lead time, MOQ, proximity,
verification — rather than an opaque score.

**Bidirectional by construction.** Arabic is the default. Layout uses logical
properties (`ps-*`, `me-*`, `start-*`) throughout, so direction flips cleanly.
Numerals and currency carry a `.num` class that keeps them LTR inside Arabic
text. Charts force their axis labels to LTR, because an SVG always plots index
zero on the left regardless of document direction.

**Prices are a ladder, not a number.** Products carry tiered pricing; the
applicable tier is derived from quantity at every call site through
`pricing.ts`. Editing a price in the supplier dashboard rescales the whole
ladder proportionally so tier discounts survive.

## Roadmap coverage

Against the 28-phase specification:

**Built** — technical foundation, design system and identity, home page,
users and companies, suppliers, products, search and categories, cart and
purchase, RFQ, negotiation, WAW AI, market intelligence, demand forecasting,
buyer dashboard, supplier dashboard, messaging, notifications, admin
dashboard, plus RBAC, audit logging and the e2e suite.

**Partial** — payments and shipping exist as adapter layers with sandbox
providers; real gateway and carrier integrations plug in without call-site
changes. Multi-country, multi-currency and multi-language data structures are
in place; FX rates are static and would come from a rates provider.

**Not started** — mobile applications (phase 25), WhatsApp commerce
(phase 26), and the cloud infrastructure, CI/CD and monitoring of phase 24.
These depend on a real backend, which is the next milestone: implement the
`platform/api.ts` contract against a service and database, then move
authentication off the demo flow onto real credentials.

## The company site

The original Wow marketing site is preserved verbatim at `/company` and is
code-split out of the main bundle, since it is the only route pulling in
framer-motion and the inline illustrations.
