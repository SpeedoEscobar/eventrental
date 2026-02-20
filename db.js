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
      image_url TEXT,
      category TEXT,
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
  await addColumnIfMissing("items", "image_url", "TEXT");
  await addColumnIfMissing("items", "category", "TEXT");

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
    const sampleItems = [
      // Seating [name, description, price, quantity, image_url, category]
      ["Plastic Chairs (White)", "Durable white plastic chairs suitable for any event", 500, 200, "https://images.unsplash.com/photo-1503602642458-232111445657?w=400&q=80", "seating"],
      ["Plastic Chairs (Colored)", "Colorful plastic chairs - multiple colors available", 600, 100, "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&q=80", "seating"],
      ["VIP Banquet Chairs", "Premium padded chairs with elegant covers", 1500, 50, "https://images.unsplash.com/photo-1551298370-9d3d53745e3a?w=400&q=80", "seating"],
      ["Round Tables (10-seater)", "Large round tables perfect for banquet seating", 3000, 30, "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=400&q=80", "seating"],
      ["Rectangular Tables", "6-foot rectangular tables for various uses", 2000, 40, "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80", "seating"],
      ["Cocktail/High Tables", "Standing height tables for cocktail events", 2500, 20, "https://images.unsplash.com/photo-1577140917170-285929fb55b7?w=400&q=80", "seating"],
      
      // Tents & Canopy
      ["Canopy Tent (Small)", "10x10ft outdoor canopy tent - seats 30", 8000, 15, "https://images.unsplash.com/photo-1478827536114-da961b7f86d2?w=400&q=80", "tents"],
      ["Canopy Tent (Large)", "20x30ft outdoor canopy tent - seats 100", 15000, 8, "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400&q=80", "tents"],
      ["Marquee Tent", "Premium marquee tent with sidewalls", 25000, 5, "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&q=80", "tents"],
      ["Gazebo Tent", "Elegant gazebo for ceremonies", 12000, 6, "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=400&q=80", "tents"],
      
      // Sound & Lighting
      ["PA Sound System", "Complete PA system with amplifier and speakers", 20000, 5, "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80", "sound"],
      ["Microphone Set", "Wireless microphone set (2 mics)", 3000, 10, "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&q=80", "sound"],
      ["DJ Equipment", "Full DJ setup with mixer and turntables", 30000, 3, "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400&q=80", "sound"],
      ["Stage Lighting Set", "Colorful stage lights with controller", 15000, 4, "https://images.unsplash.com/photo-1504501650895-2441b7915699?w=400&q=80", "sound"],
      ["String Lights", "Decorative string lights (50m)", 5000, 20, "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400&q=80", "sound"],
      ["Spotlight", "Professional spotlight for events", 8000, 8, "https://images.unsplash.com/photo-1508854710579-5cecc3a9ff17?w=400&q=80", "sound"],
      
      // Decor
      ["Backdrop Stand", "Adjustable backdrop stand for photos", 5000, 15, "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&q=80", "decor"],
      ["Red Carpet", "Premium red carpet (20m)", 10000, 5, "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400&q=80", "decor"],
      ["Flower Stands", "Elegant flower arrangement stands", 2000, 30, "https://images.unsplash.com/photo-1519741347686-c1e0aadf4611?w=400&q=80", "decor"],
      ["Table Centerpieces", "Decorative table centerpieces", 1500, 40, "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80", "decor"],
      ["Chair Covers (White)", "Elegant white chair covers with ribbons", 300, 200, "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=400&q=80", "decor"],
      ["Table Cloths", "Premium table cloths in various colors", 800, 50, "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80", "decor"],
    ];
    
    for (const item of sampleItems) {
      await run(
        `INSERT INTO items(name, description, price_per_day, quantity_total, image_url, category) VALUES (?,?,?,?,?,?)`,
        item
      );
    }
    console.log("✅ Seeded sample inventory with", sampleItems.length, "items");
  }
}

module.exports = { db, run, get, all, init };