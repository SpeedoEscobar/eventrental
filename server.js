require("dotenv").config();
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { init, run, get, all } = require("./db");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

function daysBetweenInclusive(start, end) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const ms = e - s;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(days, 1);
}

function makeReference() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
  return `ERH-${y}${m}${day}-${rand}`;
}

async function getBookedQty(itemId, startDate, endDate) {
  const row = await get(
    `
    SELECT COALESCE(SUM(bi.qty), 0) as booked
    FROM booking_items bi
    JOIN bookings b ON b.id = bi.booking_id
    WHERE bi.item_id = ?
      AND b.status IN ('awaiting_payment','paid')
      AND b.start_date <= ?
      AND b.end_date >= ?
    `,
    [itemId, endDate, startDate]
  );
  return row?.booked || 0;
}

// ---------------- PUBLIC ----------------

app.get("/api/items", async (req, res) => {
  const items = await all(`SELECT * FROM items WHERE is_active = 1 ORDER BY id DESC`);
  res.json(items);
});

app.post("/api/availability", async (req, res) => {
  const { start_date, end_date, cart } = req.body;
  if (!start_date || !end_date || !Array.isArray(cart)) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const result = [];
  for (const c of cart) {
    const item = await get(`SELECT * FROM items WHERE id = ? AND is_active = 1`, [c.item_id]);
    if (!item) {
      result.push({ item_id: c.item_id, ok: false, reason: "Item not found" });
      continue;
    }
    const booked = await getBookedQty(item.id, start_date, end_date);
    const available = item.quantity_total - booked;
    const ok = c.qty <= available;
    result.push({ item_id: item.id, name: item.name, ok, available, requested: c.qty });
  }

  res.json({ start_date, end_date, result });
});

app.get("/api/momo-details", (req, res) => {
  res.json({
    momo_name: process.env.MOMO_NAME || "FS EVENT & RENTAL HUB",
    momo_number: process.env.MOMO_NUMBER || "0598382866",
    momo_network: process.env.MOMO_NETWORK || "MTN MoMo",
  });
});

app.post("/api/bookings/create", async (req, res) => {
  const {
    customer_name,
    customer_email,
    customer_phone,
    start_date,
    end_date,
    delivery_address,
    delivery_city,
    delivery_landmark,
    cart,
  } = req.body;

  if (!customer_name || !customer_email || !customer_phone || !start_date || !end_date) {
    return res.status(400).json({ error: "Missing required customer/date fields" });
  }
  if (!delivery_address || !delivery_city) {
    return res.status(400).json({ error: "Missing delivery address/city" });
  }
  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  const days = daysBetweenInclusive(start_date, end_date);
  let total = 0;

  // validate availability + compute total
  for (const c of cart) {
    const item = await get(`SELECT * FROM items WHERE id = ? AND is_active = 1`, [c.item_id]);
    if (!item) return res.status(400).json({ error: `Item ${c.item_id} not found` });

    const booked = await getBookedQty(item.id, start_date, end_date);
    const available = item.quantity_total - booked;
    if (c.qty > available) {
      return res.status(409).json({ error: `${item.name} not enough quantity. Available: ${available}` });
    }

    total += item.price_per_day * c.qty * days;
  }

  // unique reference (retry if collision)
  let reference = makeReference();
  for (let i = 0; i < 3; i++) {
    const exists = await get(`SELECT id FROM bookings WHERE payment_reference = ?`, [reference]);
    if (!exists) break;
    reference = makeReference();
  }

  // create booking
  const bookingInsert = await run(
    `INSERT INTO bookings(
      customer_name, customer_email, customer_phone,
      start_date, end_date, status, amount_total,
      delivery_address, delivery_city, delivery_landmark,
      payment_method, payment_reference
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      customer_name,
      customer_email,
      customer_phone,
      start_date,
      end_date,
      "awaiting_payment",
      total,
      delivery_address,
      delivery_city,
      delivery_landmark || "",
      "momo",
      reference,
    ]
  );

  const bookingId = bookingInsert.lastID;

  // booking items
  for (const c of cart) {
    const item = await get(`SELECT * FROM items WHERE id = ?`, [c.item_id]);
    await run(
      `INSERT INTO booking_items(booking_id, item_id, qty, price_per_day) VALUES (?,?,?,?)`,
      [bookingId, item.id, c.qty, item.price_per_day]
    );
  }

  // Return MoMo details to customer
  res.json({
    booking_id: bookingId,
    amount_total: total,
    payment: {
      method: "momo",
      momo_name: process.env.MOMO_NAME || "FS EVENT & RENTAL HUB",
      momo_number: process.env.MOMO_NUMBER || "0598382866",
      momo_network: process.env.MOMO_NETWORK || "MTN MoMo",
      reference,
      instructions:
        "Send the exact amount to the MoMo number above and use the reference as the payment reference. Your booking will be confirmed after admin verification.",
    },
  });
});

// ---------------- ADMIN ----------------

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await get(`SELECT * FROM users WHERE email = ?`, [email]);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/api/admin/items", requireAdmin, async (req, res) => {
  const items = await all(`SELECT * FROM items ORDER BY id DESC`);
  res.json(items);
});

app.post("/api/admin/items", requireAdmin, async (req, res) => {
  const { name, description, price_per_day, quantity_total, is_active = 1 } = req.body;
  if (!name || !price_per_day || !quantity_total) return res.status(400).json({ error: "Missing fields" });

  const r = await run(
    `INSERT INTO items(name, description, price_per_day, quantity_total, is_active) VALUES (?,?,?,?,?)`,
    [name, description || "", Number(price_per_day), Number(quantity_total), Number(is_active)]
  );

  res.json({ ok: true, id: r.lastID });
});

app.put("/api/admin/items/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price_per_day, quantity_total, is_active } = req.body;

  await run(
    `UPDATE items SET name=?, description=?, price_per_day=?, quantity_total=?, is_active=? WHERE id=?`,
    [name, description || "", Number(price_per_day), Number(quantity_total), Number(is_active), Number(id)]
  );

  res.json({ ok: true });
});

// ✅ DELETE item (only if never used in booking history)
app.delete("/api/admin/items/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  const used = await get(`SELECT 1 as x FROM booking_items WHERE item_id = ? LIMIT 1`, [id]);
  if (used) {
    return res.status(409).json({
      error: "Cannot delete this item because it has been used in a booking. Disable it instead.",
    });
  }

  await run(`DELETE FROM items WHERE id = ?`, [id]);
  res.json({ ok: true });
});

app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
  const bookings = await all(`SELECT * FROM bookings ORDER BY created_at DESC`);

  for (const b of bookings) {
    b.items = await all(
      `
      SELECT bi.qty, bi.price_per_day, i.name
      FROM booking_items bi
      JOIN items i ON i.id = bi.item_id
      WHERE bi.booking_id = ?
      `,
      [b.id]
    );
  }

  res.json(bookings);
});

app.put("/api/admin/bookings/:id/mark-paid", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await run(`UPDATE bookings SET status = 'paid' WHERE id = ?`, [Number(id)]);
  res.json({ ok: true });
});

app.put("/api/admin/bookings/:id/cancel", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await run(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`, [Number(id)]);
  res.json({ ok: true });
});

(async () => {
  await init({
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
  });

  app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
})();