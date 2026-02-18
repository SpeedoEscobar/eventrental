const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");

const dbDir = path.join(__dirname, "data");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const dbPath = path.join(dbDir, "app.db");
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function addColumnIfMissing(table, column, type) {
  const cols = await all(`PRAGMA table_info(${table})`);
  const exists = cols.some((c) => c.name === column);
  if (!exists) await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

async function init({ adminEmail, adminPassword }) {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price_per_day INTEGER NOT NULL,
      quantity_total INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'awaiting_payment',
      amount_total INTEGER NOT NULL DEFAULT 0,

      delivery_address TEXT,
      delivery_city TEXT,
      delivery_landmark TEXT,

      payment_method TEXT DEFAULT 'momo',
      payment_reference TEXT UNIQUE,

      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS booking_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      price_per_day INTEGER NOT NULL,
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (item_id) REFERENCES items(id)
    );
  `);

  // If DB already exists, add missing columns safely
  await addColumnIfMissing("bookings", "delivery_address", "TEXT");
  await addColumnIfMissing("bookings", "delivery_city", "TEXT");
  await addColumnIfMissing("bookings", "delivery_landmark", "TEXT");
  await addColumnIfMissing("bookings", "payment_method", "TEXT");
  await addColumnIfMissing("bookings", "payment_reference", "TEXT");
  await addColumnIfMissing("bookings", "status", "TEXT");

  // Seed admin
  const admin = await get(`SELECT id FROM users WHERE email = ?`, [adminEmail]);
  if (!admin) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await run(`INSERT INTO users(email, password_hash, role) VALUES(?,?,?)`, [
      adminEmail,
      hash,
      "admin",
    ]);
    console.log("✅ Seeded admin:", adminEmail);
  }

  // Seed items if empty
  const count = await get(`SELECT COUNT(*) as c FROM items`);
  if (count.c === 0) {
    await run(
      `INSERT INTO items(name, description, price_per_day, quantity_total) VALUES (?,?,?,?)`,
      ["Chairs", "Plastic chairs (white)", 500, 200]
    );
    await run(
      `INSERT INTO items(name, description, price_per_day, quantity_total) VALUES (?,?,?,?)`,
      ["Tables", "Round/Rectangle tables", 1500, 40]
    );
    await run(
      `INSERT INTO items(name, description, price_per_day, quantity_total) VALUES (?,?,?,?)`,
      ["Canopy/Tent", "Outdoor canopy tent", 8000, 10]
    );
    console.log("✅ Seeded sample inventory");
  }
}

module.exports = { db, run, get, all, init };