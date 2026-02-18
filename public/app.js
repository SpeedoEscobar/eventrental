"use strict";

const itemsEl = document.getElementById("items");
const cartEl = document.getElementById("cart");
const totalEl = document.getElementById("total");
const availabilityEl = document.getElementById("availabilityResult");
const payMsgEl = document.getElementById("payMsg");

const startDateEl = document.getElementById("startDate");
const endDateEl = document.getElementById("endDate");

const cart = new Map();

function money(v) {
  return `GHS ${(Number(v || 0) / 100).toFixed(2)}`;
}

function calcDays(start, end) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const days = Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(days, 1);
}

function renderCart() {
  cartEl.innerHTML = "";
  let total = 0;

  const start = startDateEl.value;
  const end = endDateEl.value;
  const days = start && end ? calcDays(start, end) : 1;

  for (const [id, row] of cart.entries()) {
    const lineTotal = row.item.price_per_day * row.qty * days;
    total += lineTotal;

    const line = document.createElement("div");
    line.className = "cartLine";
    line.innerHTML = `
      <div>
        <strong>${row.item.name}</strong>
        <div class="muted small">${money(row.item.price_per_day)}/day • qty ${row.qty} • ${days} day(s)</div>
      </div>
      <div class="right">
        <div><strong>${money(lineTotal)}</strong></div>
        <div class="qtyRow">
          <button type="button" data-dec="${id}">-</button>
          <span>${row.qty}</span>
          <button type="button" data-inc="${id}">+</button>
          <button type="button" data-rm="${id}" class="danger">x</button>
        </div>
      </div>
    `;
    cartEl.appendChild(line);
  }

  totalEl.textContent = money(total);

  cartEl.querySelectorAll("button[data-inc]").forEach((btn) => {
    btn.onclick = () => {
      const id = Number(btn.dataset.inc);
      const row = cart.get(id);
      if (!row) return;
      row.qty += 1;
      renderCart();
    };
  });

  cartEl.querySelectorAll("button[data-dec]").forEach((btn) => {
    btn.onclick = () => {
      const id = Number(btn.dataset.dec);
      const row = cart.get(id);
      if (!row) return;
      row.qty = Math.max(1, row.qty - 1);
      renderCart();
    };
  });

  cartEl.querySelectorAll("button[data-rm]").forEach((btn) => {
    btn.onclick = () => {
      const id = Number(btn.dataset.rm);
      cart.delete(id);
      renderCart();
    };
  });
}

async function loadItems() {
  itemsEl.innerHTML = `<div class="muted">Loading items…</div>`;
  try {
    const res = await fetch("/api/items", { cache: "no-store" });
    if (!res.ok) throw new Error("API /api/items failed. Make sure server.js is running.");
    const items = await res.json();

    itemsEl.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) {
      itemsEl.innerHTML = `<div class="muted">No items yet. Add items in Admin.</div>`;
      return;
    }

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "itemCard";
      card.innerHTML = `
        <h4>${item.name}</h4>
        <div class="muted">${item.description || ""}</div>
        <div class="rowSpace">
          <strong>${money(item.price_per_day)}/day</strong>
          <button type="button">Add</button>
        </div>
      `;
      card.querySelector("button").onclick = () => {
        if (!cart.has(item.id)) cart.set(item.id, { item, qty: 1 });
        else cart.get(item.id).qty += 1;

        availabilityEl.textContent = "";
        payMsgEl.textContent = "";
        renderCart();
      };
      itemsEl.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    itemsEl.innerHTML = `
      <div class="note" style="white-space:pre-wrap;">
❌ ${err.message}

Fix:
1) Run: node server.js
2) Open: http://localhost:3000 (not Live Server)
      </div>
    `;
  }
}

document.getElementById("checkAvailability").onclick = async () => {
  availabilityEl.textContent = "";

  const start = startDateEl.value;
  const end = endDateEl.value;
  if (!start || !end) return (availabilityEl.textContent = "Pick start and end dates.");

  const cartArr = [...cart.entries()].map(([item_id, row]) => ({ item_id, qty: row.qty }));
  if (cartArr.length === 0) return (availabilityEl.textContent = "Add items to cart.");

  try {
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: start, end_date: end, cart: cartArr }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Availability check failed");

    const bad = (data.result || []).filter((r) => !r.ok);
    if (bad.length === 0) availabilityEl.textContent = "✅ All items available for those dates.";
    else availabilityEl.textContent = "❌ Not available: " + bad.map((b) => `${b.name} (available ${b.available})`).join(", ");
  } catch (e) {
    availabilityEl.textContent = "❌ " + e.message;
  }
};

document.getElementById("bookAndPay").onclick = async () => {
  payMsgEl.textContent = "";

  const start = startDateEl.value;
  const end = endDateEl.value;

  const customer_name = document.getElementById("custName").value.trim();
  const customer_email = document.getElementById("custEmail").value.trim();
  const customer_phone = document.getElementById("custPhone").value.trim();

  const delivery_address = document.getElementById("deliveryAddress").value.trim();
  const delivery_city = document.getElementById("deliveryCity").value.trim();
  const delivery_landmark = document.getElementById("deliveryLandmark").value.trim();

  if (!start || !end) return (payMsgEl.textContent = "Pick your dates first.");
  if (!customer_name || !customer_email || !customer_phone) return (payMsgEl.textContent = "Fill customer name, email, phone.");
  if (!delivery_address || !delivery_city) return (payMsgEl.textContent = "Enter delivery address and city.");
  if (cart.size === 0) return (payMsgEl.textContent = "Add at least 1 item.");

  const cartArr = [...cart.entries()].map(([item_id, row]) => ({ item_id, qty: row.qty }));

  try {
    const res = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name,
        customer_email,
        customer_phone,
        start_date: start,
        end_date: end,
        delivery_address,
        delivery_city,
        delivery_landmark,
        cart: cartArr,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Booking failed");

    const p = data.payment;

    payMsgEl.innerHTML = `
      <div style="white-space:pre-wrap;">
✅ Booking created (ID: ${data.booking_id})

<strong>MoMo Payment Details</strong>
Network: ${p.momo_network}
Name: ${p.momo_name}
Number: ${p.momo_number}
Amount: ${money(data.amount_total)}
Reference: <strong>${p.reference}</strong>

${p.instructions}
      </div>
    `;

    // Optional: clear cart after booking
    cart.clear();
    renderCart();
  } catch (e) {
    payMsgEl.textContent = "❌ " + e.message;
  }
};

document.getElementById("goInventory").onclick = () =>
  document.getElementById("inventory").scrollIntoView({ behavior: "smooth" });

startDateEl.addEventListener("change", renderCart);
endDateEl.addEventListener("change", renderCart);

loadItems();
renderCart();