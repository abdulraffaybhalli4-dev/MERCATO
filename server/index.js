import dotenv from "dotenv";
import crypto from "crypto";
import express from "express";
import cors from "cors";
import session from "express-session";
import { v4 as uuidv4 } from "uuid";
import { dbAll, dbGet, dbRun, dbTransaction, getDbPath } from "./db.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const port = process.env.PORT || 4000;

app.use(express.static(path.join(__dirname, "../web/dist")));

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  })
);

const publicPaths = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/callback",
  "/api/auth/me",
  "/api/auth/logout"
]);

const botToken = process.env.BOT_API_TOKEN;

app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  if (publicPaths.has(req.path)) return next();
  if (req.path.startsWith("/api/bot/")) {
    if (botToken && req.headers["x-bot-token"] === botToken) {
      return next();
    }
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!req.session?.user?.allowed) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

async function seedPriceItems() {
  const row = await dbGet("SELECT COUNT(1) as count FROM price_items");
  if (row?.count > 0) return;

  const items = [
    { category: "ARMI BIANCHE", type: "arma", name: "Tirapugni", unitPrice: 5000 },
    { category: "ARMI BIANCHE", type: "arma", name: "Mazza", unitPrice: 5000 },
    { category: "ARMI BIANCHE", type: "arma", name: "Coltello", unitPrice: 5000 },
    { category: "ARMI BIANCHE", type: "arma", name: "Machete", unitPrice: 10000 },
    { category: "ARMI BIANCHE", type: "arma", name: "Serramanico", unitPrice: 10000 },

    { category: "ARMI LEGGERE", type: "arma", name: "SNS", unitPrice: 30000 },
    { category: "ARMI LEGGERE", type: "arma", name: "Pistola 9mm", unitPrice: 50000 },
    { category: "ARMI LEGGERE", type: "arma", name: "Calibro .50", unitPrice: 65000 },
    { category: "ARMI LEGGERE", type: "arma", name: "Pistola MK2", unitPrice: 85000 },
    { category: "ARMI LEGGERE", type: "arma", name: "Micro Uzi", unitPrice: 250000 },

    { category: "ARMI PESANTI", type: "arma", name: "SMG", unitPrice: 300000 },
    { category: "ARMI PESANTI", type: "arma", name: "Mini-AK", unitPrice: 375000 },
    { category: "ARMI PESANTI", type: "arma", name: "P90", unitPrice: 500000 },
    { category: "ARMI PESANTI", type: "arma", name: "AK-47", unitPrice: 750000 },
    { category: "ARMI PESANTI", type: "arma", name: "Cecchino leggero", unitPrice: 2000000 },

    { category: "ACCESSORI", type: "accessorio", name: "Caricatore pistola", unitPrice: 6000 },
    { category: "ACCESSORI", type: "accessorio", name: "Caricatore SMG", unitPrice: 8000 },
    { category: "ACCESSORI", type: "accessorio", name: "Caricatore fucile", unitPrice: 8000 },
    { category: "ACCESSORI", type: "accessorio", name: "Silenziatore leggero", unitPrice: 6000 },
    { category: "ACCESSORI", type: "accessorio", name: "Silenziatore pesante", unitPrice: 8000 },
    { category: "ACCESSORI", type: "accessorio", name: "Impugnatura", unitPrice: 10000 },
    { category: "ACCESSORI", type: "accessorio", name: "Torcia", unitPrice: 6000 },

    { category: "COLPI ARMA", type: "colpi", name: "9mm", unitPrice: 35 },
    { category: "COLPI ARMA", type: "colpi", name: ".45 ACP", unitPrice: 40 },
    { category: "COLPI ARMA", type: "colpi", name: ".50 AE", unitPrice: 40 },
    { category: "COLPI ARMA", type: "colpi", name: "5.56", unitPrice: 60 },
    { category: "COLPI ARMA", type: "colpi", name: "7.62", unitPrice: 60 },
    { category: "COLPI ARMA", type: "colpi", name: "7.62 NATO", unitPrice: 100 },
    { category: "COLPI ARMA", type: "colpi", name: ".50 BMG", unitPrice: 100 },

    { category: "EXTRA", type: "accessorio", name: "Giubbotto", unitPrice: 8000 },
    { category: "EXTRA", type: "accessorio", name: "Kit pistole", unitPrice: 100000 },
    { category: "EXTRA", type: "accessorio", name: "Kit avanzato", unitPrice: 600000 },

    { category: "SPEDIZIONE", type: "accessorio", name: "Spedizione", unitPrice: 100000 }
  ];

  for (const item of items) {
    await dbRun(
      "INSERT INTO price_items (type, category, name, unit_price) VALUES (?, ?, ?, ?)",
      [item.type, item.category, item.name, item.unitPrice]
    );
  }
}

app.get("/api/auth/login", (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).send("Missing Discord OAuth config");
  }

  const state = crypto.randomUUID();
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state
  });

  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

app.get("/api/auth/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state || state !== req.session.oauthState) {
    return res.status(400).send("Invalid OAuth state");
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildIdsRaw = process.env.DISCORD_GUILD_IDS || process.env.DISCORD_GUILD_ID || "";
  const roleIdsRaw = process.env.DISCORD_ROLE_IDS || process.env.DISCORD_ROLE_ID || "";
  const adminRoleIdsRaw = process.env.DISCORD_ADMIN_ROLE_IDS || process.env.DISCORD_ADMIN_ROLE_ID || "";
  const guildIds = guildIdsRaw.split(/[\s,/]+/).filter(Boolean);
  const roleIds = roleIdsRaw.split(/[\s,/]+/).filter(Boolean);
  const adminRoleIds = adminRoleIdsRaw.split(/[\s,/]+/).filter(Boolean);

  if (!clientId || !clientSecret || !redirectUri || !botToken || guildIds.length === 0 || roleIds.length === 0) {
    return res.status(500).send("Missing Discord config");
  }

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: redirectUri
    })
  });

  if (!tokenRes.ok) {
    return res.status(401).send("OAuth token error");
  }

  const tokenData = await tokenRes.json();
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });

  if (!userRes.ok) {
    return res.status(401).send("OAuth user error");
  }

  const user = await userRes.json();
  let member = null;

  for (let i = 0; i < guildIds.length; i += 1) {
    const guildId = guildIds[i];
    const memberRes = await fetch(
      `https://discord.com/api/guilds/${guildId}/members/${user.id}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );

    if (memberRes.ok) {
      member = await memberRes.json();
      break;
    }
  }

  const renderAuthError = (title) => {
    return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        background: #0b0b0f;
        color: #f1f1f4;
        font-family: "Inter", system-ui, sans-serif;
        display: grid;
        place-items: center;
        min-height: 100vh;
      }
      .card {
        background: #14141f;
        border-radius: 16px;
        padding: 32px 40px;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
        text-align: center;
        min-width: 280px;
      }
      .x {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        border: 2px solid #c63a3a;
        display: grid;
        place-items: center;
        margin: 0 auto 16px;
        color: #c63a3a;
        font-size: 48px;
        font-weight: 700;
        line-height: 1;
      }
      .label {
        letter-spacing: 2px;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="x">×</div>
      <div class="label">${title}</div>
    </div>
  </body>
</html>`;
  };

  if (!member) {
    return res.status(403).type("html").send(renderAuthError("NOT IN GUILD"));
  }

  const hasRole = roleIds.some((roleId) => member.roles.includes(roleId));
  const hasAdminRole = adminRoleIds.some((roleId) => member.roles.includes(roleId));
  const allowed = Array.isArray(member.roles) && (hasRole || hasAdminRole);

  if (!allowed) {
    return res.status(403).type("html").send(renderAuthError("MISSING ROLE"));
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    allowed: true
  };

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  res.redirect(frontendUrl);
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session?.user?.allowed) return res.json({ user: null });
  res.json({ user: req.session.user });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// Families
app.get("/api/families", async (req, res) => {
  const rows = await dbAll("SELECT id, name FROM families ORDER BY name");
  res.json(rows);
});

app.post("/api/families", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const info = await dbRun("INSERT INTO families (name) VALUES (?)", [name]);
  res.json({ id: info.lastInsertRowid, name });
});


app.put("/api/families/:id", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  await dbRun("UPDATE families SET name = ? WHERE id = ?", [name, req.params.id]);
  res.json({ id: Number(req.params.id), name });
});

app.delete("/api/families/:id", async (req, res) => {
  await dbRun("DELETE FROM families WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

app.get("/api/families/:id/history", async (req, res) => {
  const rows = await dbAll(
    "SELECT id, amount, percent, due, created_at FROM family_calculations WHERE family_id = ? ORDER BY created_at DESC",
    [req.params.id]
  );
  res.json(rows);
});

// Cleaning calculator
app.post("/api/calculations/preview", (req, res) => {
  const { amount, percent } = req.body;
  if (amount == null || percent == null) {
    return res.status(400).json({ error: "amount and percent required" });
  }
  const due = Number(amount) * (Number(percent) / 100);
  res.json({ due });
});

app.post("/api/families/:id/history", async (req, res) => {
  const { amount, percent } = req.body;
  if (amount == null || percent == null) {
    return res.status(400).json({ error: "amount and percent required" });
  }
  const due = Number(amount) * (Number(percent) / 100);
  const info = await dbRun(
    "INSERT INTO family_calculations (family_id, amount, percent, due) VALUES (?, ?, ?, ?)",
    [req.params.id, amount, percent, due]
  );
  res.json({ id: info.lastInsertRowid, amount, percent, due });
});

// Price list
app.get("/api/items", async (req, res) => {
  const rows = await dbAll(
    "SELECT id, type, category, name, unit_price FROM price_items ORDER BY category, name"
  );
  res.json(rows);
});

app.post("/api/items", async (req, res) => {
  const { type, category, name, unitPrice } = req.body;
  if (!type || !category || !name || unitPrice == null) {
    return res.status(400).json({ error: "type, category, name, unitPrice required" });
  }
  const info = await dbRun("INSERT INTO price_items (type, name, unit_price) VALUES (?, ?, ?)", [
    type,
    name,
    unitPrice
  ]);
  await dbRun("UPDATE price_items SET category = ? WHERE id = ?", [category, info.lastInsertRowid]);
  res.json({ id: info.lastInsertRowid, type, category, name, unitPrice });
});

app.put("/api/items/:id", async (req, res) => {
  const { type, category, name, unitPrice } = req.body;
  if (!type || !category || !name || unitPrice == null) {
    return res.status(400).json({ error: "type, category, name, unitPrice required" });
  }
  await dbRun("UPDATE price_items SET type = ?, category = ?, name = ?, unit_price = ? WHERE id = ?", [
    type,
    category,
    name,
    unitPrice,
    req.params.id
  ]);
  res.json({ id: Number(req.params.id), type, category, name, unitPrice });
});

app.delete("/api/items/:id", async (req, res) => {
  await dbRun("DELETE FROM price_items WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// Orders
async function getNextOrderNumber() {
  let nextNumber = 1;
  await dbTransaction(async (db) => {
    const result = db.exec("SELECT next_number FROM order_sequence WHERE id = 1");
    const current = result?.[0]?.values?.[0]?.[0] ?? 1;
    nextNumber = current;
    db.run("UPDATE order_sequence SET next_number = ? WHERE id = 1", [current + 1]);
  });
  return nextNumber;
}

async function createOrderRecord({ familyId, items }) {
  let resolvedFamilyId = familyId;
  if (!resolvedFamilyId) {
    const defaultName = "Senza famiglia";
    let family = await dbGet("SELECT id FROM families WHERE name = ?", [defaultName]);
    if (!family) {
      const info = await dbRun("INSERT INTO families (name) VALUES (?)", [defaultName]);
      family = { id: info.lastInsertRowid };
    }
    resolvedFamilyId = family.id;
  }

  const priceRows = await dbAll("SELECT id, unit_price FROM price_items");
  const priceMap = new Map(priceRows.map((row) => [row.id, row.unit_price]));

  let shippingItem = await dbGet(
    "SELECT id, unit_price FROM price_items WHERE name = ? ORDER BY id LIMIT 1",
    ["Spedizione"]
  );
  if (!shippingItem) {
    const info = await dbRun(
      "INSERT INTO price_items (type, category, name, unit_price) VALUES (?, ?, ?, ?)",
      ["accessorio", "SPEDIZIONE", "Spedizione", 100000]
    );
    shippingItem = { id: info.lastInsertRowid, unit_price: 100000 };
  }

  let totalClean = 0;
  const orderLines = [];

  for (const line of items) {
    const unitPrice = priceMap.get(line.itemId);
    if (unitPrice == null) {
      throw new Error(`invalid itemId ${line.itemId}`);
    }
    const quantity = Number(line.quantity);
    const lineTotal = unitPrice * quantity;
    totalClean += lineTotal;
    orderLines.push({ itemId: line.itemId, quantity, unitPrice, lineTotal });
  }

  if (shippingItem?.id) {
    const lineTotal = Number(shippingItem.unit_price) * 1;
    totalClean += lineTotal;
    orderLines.push({
      itemId: shippingItem.id,
      quantity: 1,
      unitPrice: Number(shippingItem.unit_price),
      lineTotal
    });
  }

  const totalDirty = totalClean * 2;
  const orderId = uuidv4();
  const orderNumber = await getNextOrderNumber();

  await dbTransaction(async (db) => {
    db.run("INSERT INTO orders (id, order_number, family_id, total_clean, total_dirty) VALUES (?, ?, ?, ?, ?)", [
      orderId,
      orderNumber,
      resolvedFamilyId,
      totalClean,
      totalDirty
    ]);
    for (const line of orderLines) {
      db.run(
        "INSERT INTO order_items (order_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)",
        [orderId, line.itemId, line.quantity, line.unitPrice, line.lineTotal]
      );
    }
  });

  return { id: orderId, orderNumber, familyId: resolvedFamilyId, totalClean, totalDirty };
}

app.post("/api/orders", async (req, res) => {
  const { familyId, items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items required" });
  }

  try {
    const order = await createOrderRecord({ familyId, items });
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/orders/:id", async (req, res) => {
  const rawId = req.params.id;
  const numericId = Number(rawId);
  const order = await dbGet(
    "SELECT o.id, o.order_number as orderNumber, o.family_id as familyId, f.name as familyName, o.total_clean as totalClean, o.total_dirty as totalDirty, o.created_at as createdAt FROM orders o JOIN families f ON f.id = o.family_id WHERE o.id = ? OR o.order_number = ?",
    [rawId, Number.isFinite(numericId) ? numericId : -1]
  );

  if (!order) return res.status(404).json({ error: "order not found" });

  const items = await dbAll(
    "SELECT i.id, i.name, i.type, oi.quantity, oi.unit_price as unitPrice, oi.line_total as lineTotal FROM order_items oi JOIN price_items i ON i.id = oi.item_id WHERE oi.order_id = ?",
    [order.id]
  );

  res.json({ ...order, items });
});

app.get("/api/bot/orders/:id", async (req, res) => {
  const rawId = req.params.id;
  const numericId = Number(rawId);
  const order = await dbGet(
    "SELECT o.id, o.order_number as orderNumber, o.family_id as familyId, f.name as familyName, o.total_clean as totalClean, o.total_dirty as totalDirty, o.created_at as createdAt FROM orders o JOIN families f ON f.id = o.family_id WHERE o.id = ? OR o.order_number = ?",
    [rawId, Number.isFinite(numericId) ? numericId : -1]
  );

  if (!order) return res.status(404).json({ error: "order not found" });

  const items = await dbAll(
    "SELECT i.id, i.name, i.type, oi.quantity, oi.unit_price as unitPrice, oi.line_total as lineTotal FROM order_items oi JOIN price_items i ON i.id = oi.item_id WHERE oi.order_id = ?",
    [order.id]
  );

  res.json({ ...order, items });
});

app.get("/api/bot/debug", async (req, res) => {
  const count = await dbGet("SELECT COUNT(1) as count FROM orders");
  res.json({ dbPath: getDbPath(), orders: count?.count ?? 0 });
});

app.post("/api/bot/orders", async (req, res) => {
  const { familyId, familyName, items } = req.body;
  if ((!familyId && !familyName) || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "familyId or familyName and items required" });
  }

  let resolvedFamilyId = familyId;
  if (!resolvedFamilyId) {
    const family = await dbGet("SELECT id FROM families WHERE name = ?", [familyName]);
    if (!family) return res.status(400).json({ error: "family not found" });
    resolvedFamilyId = family.id;
  }

  const resolvedItems = [];
  for (const line of items) {
    const item = await dbGet(
      "SELECT id FROM price_items WHERE lower(name) = lower(?)",
      [line.name]
    );
    if (!item) return res.status(400).json({ error: `item not found: ${line.name}` });
    resolvedItems.push({ itemId: item.id, quantity: line.quantity });
  }

  try {
    const order = await createOrderRecord({ familyId: resolvedFamilyId, items: resolvedItems });
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reports
app.get("/api/reports", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: "from and to required (YYYY-MM-DD)" });
  }

  const byFamily = await dbAll(
    `
      SELECT f.id as familyId, f.name as familyName,
             COUNT(o.id) as orderCount,
             COALESCE(SUM(o.total_clean), 0) as totalClean,
             COALESCE(SUM(o.total_dirty), 0) as totalDirty
      FROM families f
      LEFT JOIN orders o
        ON o.family_id = f.id
       AND date(o.created_at) BETWEEN date(?) AND date(?)
      GROUP BY f.id
      ORDER BY f.name
    `,
    [from, to]
  );

  const totals = await dbGet(
    `
      SELECT COUNT(id) as orderCount,
             COALESCE(SUM(total_clean), 0) as totalClean,
             COALESCE(SUM(total_dirty), 0) as totalDirty
      FROM orders
      WHERE date(created_at) BETWEEN date(?) AND date(?)
    `,
    [from, to]
  );

  res.json({ byFamily, totals });
});

// Serve React App for any other route (SPA)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../web/dist/index.html"));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

seedPriceItems();
