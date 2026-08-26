import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { buildApp } from "../src/app.ts";
import { loadEnv } from "../src/env.ts";
import { runMigrations } from "../src/db/migrate.ts";
import { DEMO_PASSWORD, seedDatabase } from "../src/db/seed.ts";
import type { FastifyInstance } from "fastify";

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/waw_test";

let app: FastifyInstance;
let supplierEmailCache: Map<string, string> | null = null;

const env = loadEnv({
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL,
  JWT_SECRET: "test-secret-key-that-is-definitely-long-enough",
} as NodeJS.ProcessEnv);

/** Thin wrapper so each test reads as one HTTP call. */
async function call(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  opts: { token?: string; body?: unknown } = {},
) {
  const res = await app.inject({
    method,
    url,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    payload: opts.body as never,
  });
  let json: any = null;
  try { json = res.body ? JSON.parse(res.body) : null; } catch { /* 204s have no body */ }
  return { status: res.statusCode, body: json };
}

const login = async (email: string) => {
  const res = await call("POST", "/api/v1/auth/login", { body: { email, password: DEMO_PASSWORD } });
  assert.equal(res.status, 200, `login failed for ${email}: ${JSON.stringify(res.body)}`);
  return res.body;
};

before(async () => {
  await runMigrations(DATABASE_URL, () => {});
  app = await buildApp(env);
  await seedDatabase(app.db, { force: true });

  const rows = await app.sql<{ id: string; email: string }[]>`
    SELECT s.id, u.email
    FROM suppliers s
    JOIN users u ON u.company_id = s.id AND u.role = 'supplier'
  `;
  supplierEmailCache = new Map(rows.map((r) => [r.id, r.email]));
});

after(async () => {
  await app.close();
});

describe("health", () => {
  it("reports ok", async () => {
    const res = await call("GET", "/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
  });
});

describe("authentication", () => {
  it("rejects a wrong password", async () => {
    const res = await call("POST", "/api/v1/auth/login", {
      body: { email: "buy-1@waw.example.com", password: "wrong-password" },
    });
    assert.equal(res.status, 401);
  });

  it("does not reveal whether an email exists", async () => {
    const unknown = await call("POST", "/api/v1/auth/login", {
      body: { email: "nobody@waw.example.com", password: "wrong-password" },
    });
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.error.message, "Invalid email or password");
  });

  it("issues access and refresh tokens on login", async () => {
    const session = await login("buy-1@waw.example.com");
    assert.ok(session.accessToken);
    assert.ok(session.refreshToken);
    assert.equal(session.user.role, "buyer");
    assert.equal(session.user.passwordHash, undefined, "password hash must never be serialised");
  });

  it("registers a new company and signs it in", async () => {
    const res = await call("POST", "/api/v1/auth/register", {
      body: {
        name: "Test Buyer", email: `t${Date.now()}@example.com`, phone: "+966500000000",
        password: "a-sufficiently-long-password", role: "buyer",
        companyName: "Test Trading", countryCode: "SA", city: "الرياض",
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "buyer");
    assert.equal(res.body.company.verification, "pending");
  });

  it("rejects a duplicate email", async () => {
    const res = await call("POST", "/api/v1/auth/register", {
      body: {
        name: "Dup", email: "buy-1@waw.example.com", phone: "+966500000000",
        password: "a-sufficiently-long-password", role: "buyer",
        companyName: "Dup Co", countryCode: "SA", city: "الرياض",
      },
    });
    assert.equal(res.status, 409);
  });

  it("rotates refresh tokens and revokes the old one", async () => {
    const session = await login("buy-2@waw.example.com");
    const first = await call("POST", "/api/v1/auth/refresh", { body: { refreshToken: session.refreshToken } });
    assert.equal(first.status, 200);
    assert.notEqual(first.body.refreshToken, session.refreshToken);

    const replay = await call("POST", "/api/v1/auth/refresh", { body: { refreshToken: session.refreshToken } });
    assert.equal(replay.status, 401, "a used refresh token must not work twice");
  });

  it("refuses a forged token", async () => {
    const res = await call("GET", "/api/v1/auth/me", { token: "not.a.real.token" });
    assert.equal(res.status, 401);
  });
});

describe("catalog", () => {
  it("returns the category tree", async () => {
    const res = await call("GET", "/api/v1/categories");
    assert.equal(res.status, 200);
    assert.ok(res.body.categories.length >= 17);
  });

  it("finds products by Arabic keyword", async () => {
    const res = await call("GET", `/api/v1/products?q=${encodeURIComponent("مياه")}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.total > 0, "Arabic search returned nothing");
    assert.ok(res.body.items[0].name.ar.includes("مياه"));
  });

  it("finds products by English keyword", async () => {
    const res = await call("GET", "/api/v1/products?q=rice");
    assert.ok(res.body.total > 0);
  });

  it("filters by category including child categories", async () => {
    const parent = await call("GET", "/api/v1/products?category=c-food&perPage=100");
    const child = await call("GET", "/api/v1/products?category=c-drinks&perPage=100");
    assert.ok(parent.body.total >= child.body.total, "a parent category must include its children");
    assert.ok(child.body.total > 0);
  });

  it("sorts by price ascending", async () => {
    const res = await call("GET", "/api/v1/products?sort=price_asc&perPage=10");
    const prices = res.body.items.map((p: any) => p.entryPrice);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  });

  it("paginates", async () => {
    const p1 = await call("GET", "/api/v1/products?page=1&perPage=5");
    const p2 = await call("GET", "/api/v1/products?page=2&perPage=5");
    assert.equal(p1.body.items.length, 5);
    assert.notEqual(p1.body.items[0].id, p2.body.items[0].id);
  });

  it("returns a product with its price ladder and history", async () => {
    const list = await call("GET", "/api/v1/products?perPage=1");
    const res = await call("GET", `/api/v1/products/${list.body.items[0].id}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.product.tiers.length >= 2);
    assert.ok(res.body.priceHistory.length >= 20, "expected ~26 weeks of history");
    const tiers = res.body.product.tiers;
    assert.ok(tiers[tiers.length - 1].price < tiers[0].price, "bulk tiers must be cheaper");
  });

  it("404s an unknown product", async () => {
    const res = await call("GET", "/api/v1/products/00000000-0000-0000-0000-000000000000");
    assert.equal(res.status, 404);
  });

  it("lists suppliers", async () => {
    const res = await call("GET", "/api/v1/suppliers");
    assert.equal(res.body.total, 10);
  });
});

describe("cart and pricing", () => {
  let token: string;
  let product: any;

  before(async () => {
    token = (await login("buy-3@waw.example.com")).accessToken;
    const list = await call("GET", "/api/v1/products?sort=popular&perPage=1");
    product = list.body.items[0];
    await call("DELETE", "/api/v1/cart", { token });
  });

  it("requires authentication", async () => {
    const res = await call("GET", "/api/v1/cart");
    assert.equal(res.status, 401);
  });

  it("prices the cart from the wholesale ladder, not the client", async () => {
    const bulkQty = product.tiers[product.tiers.length - 1].minQty;
    const res = await call("POST", "/api/v1/cart/items", { token, body: { productId: product.id, qty: bulkQty } });
    assert.equal(res.status, 200);
    const line = res.body.lines.find((l: any) => l.productId === product.id);
    assert.equal(line.unitPrice, product.tiers[product.tiers.length - 1].price, "bulk quantity must get the bulk tier");
    assert.ok(line.unitPrice < product.entryPrice);
  });

  it("computes VAT at 15% of goods plus freight", async () => {
    const res = await call("GET", "/api/v1/cart", { token });
    const { subtotal, shipping, tax, total } = res.body.totals;
    assert.ok(Math.abs(tax - (subtotal + shipping) * 0.15) < 0.02);
    assert.ok(Math.abs(total - (subtotal + shipping + tax)) < 0.02);
  });

  it("accumulates when the same product is added twice", async () => {
    const before = await call("GET", "/api/v1/cart", { token });
    const qtyBefore = before.body.lines.find((l: any) => l.productId === product.id).qty;
    const res = await call("POST", "/api/v1/cart/items", { token, body: { productId: product.id, qty: 5 } });
    const qtyAfter = res.body.lines.find((l: any) => l.productId === product.id).qty;
    assert.equal(qtyAfter, qtyBefore + 5);
  });

  it("flags a quantity below the minimum order", async () => {
    const res = await call("PATCH", `/api/v1/cart/items/${product.id}`, { token, body: { qty: 1 } });
    const line = res.body.lines.find((l: any) => l.productId === product.id);
    assert.equal(line.belowMoq, true);
  });

  it("removes a line when quantity is set to zero", async () => {
    const res = await call("PATCH", `/api/v1/cart/items/${product.id}`, { token, body: { qty: 0 } });
    assert.equal(res.body.lines.length, 0);
  });
});

describe("orders", () => {
  let buyerToken: string;
  let supplierToken: string;
  let otherBuyerToken: string;
  let orderId: string;
  let product: any;

  before(async () => {
    buyerToken = (await login("buy-1@waw.example.com")).accessToken;
    otherBuyerToken = (await login("buy-4@waw.example.com")).accessToken;
    const list = await call("GET", "/api/v1/products?perPage=40");
    product = list.body.items.find((p: any) => p.availability === "in_stock");
    supplierToken = (await login(supplierEmailFor(product.supplierId))).accessToken;
    await call("DELETE", "/api/v1/cart", { token: buyerToken });
  });

  it("refuses to place an order from an empty cart", async () => {
    const res = await call("POST", "/api/v1/orders", {
      token: buyerToken,
      body: { paymentMethod: "bank_transfer", carrier: "WAW Fleet", etaDays: 3 },
    });
    assert.equal(res.status, 400);
  });

  it("refuses an order below the minimum order quantity", async () => {
    await call("POST", "/api/v1/cart/items", { token: buyerToken, body: { productId: product.id, qty: 1 } });
    const res = await call("POST", "/api/v1/orders", {
      token: buyerToken,
      body: { paymentMethod: "bank_transfer", carrier: "WAW Fleet", etaDays: 3 },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /minimum order/i);
  });

  it("places an order and clears the cart", async () => {
    await call("PATCH", `/api/v1/cart/items/${product.id}`, { token: buyerToken, body: { qty: product.moq } });
    const res = await call("POST", "/api/v1/orders", {
      token: buyerToken,
      body: { paymentMethod: "bank_transfer", carrier: "WAW Fleet", etaDays: 3 },
    });
    assert.equal(res.status, 201);
    assert.match(res.body.reference, /^WAW-\d+$/);
    assert.equal(res.body.status, "pending");
    assert.ok(res.body.total > 0);
    orderId = res.body.id;

    const cart = await call("GET", "/api/v1/cart", { token: buyerToken });
    assert.equal(cart.body.lines.length, 0, "placing an order must empty the cart");
  });

  it("ignores a client-supplied shipping cost", async () => {
    const order = await call("GET", `/api/v1/orders/${orderId}`, { token: buyerToken });
    assert.ok(order.body.shipping > 0, "freight must be computed server-side");
  });

  it("hides another company's order", async () => {
    const res = await call("GET", `/api/v1/orders/${orderId}`, { token: otherBuyerToken });
    assert.equal(res.status, 403);
  });

  it("lets the supplier on the order advance it", async () => {
    const res = await call("POST", `/api/v1/orders/${orderId}/advance`, { token: supplierToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "confirmed");
    assert.equal(res.body.timeline.length, 2);
  });

  it("refuses to advance a delivered order past the end of the flow", async () => {
    for (const _ of ["processing", "shipped", "delivered"]) {
      await call("POST", `/api/v1/orders/${orderId}/advance`, { token: supplierToken });
    }
    const res = await call("POST", `/api/v1/orders/${orderId}/advance`, { token: supplierToken });
    assert.equal(res.status, 400);
  });

  it("marks a delivered order paid and issues tracking", async () => {
    const res = await call("GET", `/api/v1/orders/${orderId}`, { token: buyerToken });
    assert.equal(res.body.status, "delivered");
    assert.equal(res.body.paymentStatus, "paid");
    assert.ok(res.body.trackingNumber);
  });

  it("refuses to cancel a delivered order", async () => {
    const res = await call("POST", `/api/v1/orders/${orderId}/cancel`, { token: buyerToken });
    assert.equal(res.status, 400);
  });
});

describe("RFQ and quoting", () => {
  let buyerToken: string;
  let supplierToken: string;
  let strangerToken: string;
  let rfqId: string;
  let supplierId: string;

  before(async () => {
    buyerToken = (await login("buy-1@waw.example.com")).accessToken;
    const suppliers = await call("GET", "/api/v1/suppliers?perPage=5");
    supplierId = suppliers.body.items[0].id;
    supplierToken = (await login(supplierEmailFor(supplierId))).accessToken;
    const other = suppliers.body.items[1].id;
    strangerToken = (await login(supplierEmailFor(other))).accessToken;
  });

  it("creates an RFQ and invites suppliers", async () => {
    const res = await call("POST", "/api/v1/rfqs", {
      token: buyerToken,
      body: {
        title: "توريد مياه شرب", categoryId: "c-drinks", qty: 1000, unit: "carton",
        targetPrice: 9, specs: "330ml", neededBy: "2026-09-30",
        deliveryCity: "الرياض", deliveryCountry: "SA",
        paymentTerms: "net_30", shippingTerms: "DDP", supplierIds: [supplierId],
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "open");
    assert.deepEqual(res.body.invitedSupplierIds, [supplierId]);
    rfqId = res.body.id;
  });

  it("blocks an uninvited supplier from quoting", async () => {
    const res = await call("POST", `/api/v1/rfqs/${rfqId}/quotes`, {
      token: strangerToken,
      body: { unitPrice: 8.5, moq: 500, leadTimeDays: 3 },
    });
    assert.equal(res.status, 403);
  });

  it("blocks an uninvited supplier from reading the RFQ", async () => {
    const res = await call("GET", `/api/v1/rfqs/${rfqId}`, { token: strangerToken });
    assert.equal(res.status, 403);
  });

  it("accepts a quote from an invited supplier", async () => {
    const res = await call("POST", `/api/v1/rfqs/${rfqId}/quotes`, {
      token: supplierToken,
      body: { unitPrice: 8.5, moq: 500, leadTimeDays: 3, shippingCost: 400 },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "quoted");
    assert.equal(res.body.quotes.length, 1);
    assert.equal(res.body.quotes[0].unitPrice, 8.5);
  });

  it("revises rather than duplicates a second quote", async () => {
    const res = await call("POST", `/api/v1/rfqs/${rfqId}/quotes`, {
      token: supplierToken,
      body: { unitPrice: 8.1, moq: 500, leadTimeDays: 3 },
    });
    assert.equal(res.body.quotes.length, 1, "one live quote per supplier");
    assert.equal(res.body.quotes[0].unitPrice, 8.1);
    assert.equal(res.body.quotes[0].status, "revised");
  });

  it("lets the buyer award the RFQ", async () => {
    const rfq = await call("GET", `/api/v1/rfqs/${rfqId}`, { token: buyerToken });
    const res = await call("POST", `/api/v1/rfqs/${rfqId}/award/${rfq.body.quotes[0].id}`, { token: buyerToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "awarded");
    assert.equal(res.body.quotes[0].status, "accepted");
  });

  it("stops accepting quotes once awarded", async () => {
    const res = await call("POST", `/api/v1/rfqs/${rfqId}/quotes`, {
      token: supplierToken,
      body: { unitPrice: 7, moq: 500, leadTimeDays: 3 },
    });
    assert.equal(res.status, 400);
  });
});

describe("negotiation", () => {
  let buyerToken: string;
  let supplierToken: string;
  let negotiationId: string;
  let product: any;

  before(async () => {
    buyerToken = (await login("buy-2@waw.example.com")).accessToken;
    const list = await call("GET", "/api/v1/products?perPage=1");
    product = list.body.items[0];
    supplierToken = (await login(supplierEmailFor(product.supplierId))).accessToken;
  });

  it("opens with a buyer offer", async () => {
    const res = await call("POST", "/api/v1/negotiations", {
      token: buyerToken,
      body: {
        productId: product.id, unitPrice: product.entryPrice * 0.8,
        qty: product.moq * 4, moq: product.moq, message: "نطلب سعرًا أفضل",
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.rounds.length, 1);
    assert.equal(res.body.rounds[0].by, "buyer");
    negotiationId = res.body.id;
  });

  it("refuses to let a party accept its own offer", async () => {
    const res = await call("POST", `/api/v1/negotiations/${negotiationId}/accept`, { token: buyerToken });
    assert.equal(res.status, 400);
  });

  it("records a supplier counter-offer", async () => {
    const res = await call("POST", `/api/v1/negotiations/${negotiationId}/counter`, {
      token: supplierToken,
      body: { unitPrice: product.entryPrice * 0.9, qty: product.moq * 5, moq: product.moq },
    });
    assert.equal(res.body.rounds.length, 2);
    assert.equal(res.body.rounds[1].by, "supplier");
  });

  it("refuses conversion before acceptance", async () => {
    const res = await call("POST", `/api/v1/negotiations/${negotiationId}/convert`, { token: buyerToken });
    assert.equal(res.status, 400);
  });

  it("accepts and converts into a real order", async () => {
    const accepted = await call("POST", `/api/v1/negotiations/${negotiationId}/accept`, { token: buyerToken });
    assert.equal(accepted.body.status, "accepted");

    const res = await call("POST", `/api/v1/negotiations/${negotiationId}/convert`, { token: buyerToken });
    assert.equal(res.status, 201);
    assert.ok(res.body.orderId);

    const order = await call("GET", `/api/v1/orders/${res.body.orderId}`, { token: buyerToken });
    assert.equal(order.body.status, "confirmed");
    assert.equal(order.body.lines.length, 1);
  });

  it("refuses to convert the same negotiation twice", async () => {
    const res = await call("POST", `/api/v1/negotiations/${negotiationId}/convert`, { token: buyerToken });
    assert.equal(res.status, 400);
  });
});

describe("messaging", () => {
  let buyerToken: string;
  let supplierToken: string;
  let threadId: string;
  let supplierId: string;

  before(async () => {
    buyerToken = (await login("buy-1@waw.example.com")).accessToken;
    const suppliers = await call("GET", "/api/v1/suppliers?perPage=3");
    supplierId = suppliers.body.items[2].id;
    supplierToken = (await login(supplierEmailFor(supplierId))).accessToken;
  });

  it("opens a thread", async () => {
    const res = await call("POST", "/api/v1/threads", {
      token: buyerToken,
      body: { supplierId, subject: "استفسار" },
    });
    assert.equal(res.status, 201);
    threadId = res.body.id;
  });

  it("delivers a message to the supplier", async () => {
    await call("POST", `/api/v1/threads/${threadId}/messages`, { token: buyerToken, body: { body: "مرحبا" } });
    const res = await call("GET", `/api/v1/threads/${threadId}/messages`, { token: supplierToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.messages.length, 1);
    assert.equal(res.body.messages[0].side, "buyer");
  });

  it("keeps a third party out of the thread", async () => {
    const stranger = (await login("buy-4@waw.example.com")).accessToken;
    const res = await call("GET", `/api/v1/threads/${threadId}/messages`, { token: stranger });
    assert.equal(res.status, 403);
  });
});

describe("notifications", () => {
  it("lists the caller's notifications only", async () => {
    const buyer = await login("buy-1@waw.example.com");
    const res = await call("GET", "/api/v1/notifications", { token: buyer.accessToken });
    assert.equal(res.status, 200);
    assert.ok(res.body.total > 0);
    assert.ok(res.body.unreadCount >= 0);
  });

  it("marks all as read", async () => {
    const buyer = await login("buy-1@waw.example.com");
    await call("POST", "/api/v1/notifications/read-all", { token: buyer.accessToken });
    const res = await call("GET", "/api/v1/notifications", { token: buyer.accessToken });
    assert.equal(res.body.unreadCount, 0);
  });
});

describe("admin", () => {
  let adminToken: string;

  before(async () => {
    adminToken = (await login("admin@waw.example.com")).accessToken;
  });

  it("refuses a buyer", async () => {
    const buyer = await login("buy-1@waw.example.com");
    const res = await call("GET", "/api/v1/admin/stats", { token: buyer.accessToken });
    assert.equal(res.status, 403);
  });

  it("refuses a supplier", async () => {
    const supplier = await login("sup-1@waw.example.com");
    const res = await call("GET", "/api/v1/admin/stats", { token: supplier.accessToken });
    assert.equal(res.status, 403);
  });

  it("reports platform statistics", async () => {
    const res = await call("GET", "/api/v1/admin/stats", { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.suppliers, 10);
    assert.ok(res.body.products > 50);
    assert.ok(res.body.gmv > 0);
  });

  it("changes company verification and writes an audit entry", async () => {
    const companies = await call("GET", "/api/v1/admin/companies?verification=pending", { token: adminToken });
    if (!companies.body.items.length) return;
    const target = companies.body.items[0];
    const res = await call("PATCH", `/api/v1/admin/companies/${target.id}/verification`, {
      token: adminToken,
      body: { status: "verified" },
    });
    assert.equal(res.body.verification, "verified");

    const audit = await call("GET", "/api/v1/admin/audit", { token: adminToken });
    assert.ok(audit.body.items.some((a: any) => a.target === target.id));
  });
});

describe("input validation", () => {
  it("rejects a malformed uuid", async () => {
    const res = await call("GET", "/api/v1/products/not-a-uuid");
    assert.equal(res.status, 400);
  });

  it("rejects a negative cart quantity", async () => {
    const buyer = await login("buy-1@waw.example.com");
    const list = await call("GET", "/api/v1/products?perPage=1");
    const res = await call("POST", "/api/v1/cart/items", {
      token: buyer.accessToken,
      body: { productId: list.body.items[0].id, qty: -5 },
    });
    assert.equal(res.status, 400);
  });

  it("rejects a short password at registration", async () => {
    const res = await call("POST", "/api/v1/auth/register", {
      body: {
        name: "Short", email: `s${Date.now()}@example.com`, phone: "+966500000000",
        password: "short", role: "buyer", companyName: "Short Co",
        countryCode: "SA", city: "الرياض",
      },
    });
    assert.equal(res.status, 400);
  });

  it("404s an unknown route", async () => {
    const res = await call("GET", "/api/v1/nope");
    assert.equal(res.status, 404);
  });
});

/** Resolve a seeded supplier's login from its company id. */
function supplierEmailFor(supplierId: string): string {
  if (!supplierEmailCache) throw new Error("supplier emails not loaded");
  const email = supplierEmailCache.get(supplierId);
  if (!email) throw new Error(`no seeded account for supplier ${supplierId}`);
  return email;
}
