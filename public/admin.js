const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";

document.getElementById("logout").onclick = () => {
  localStorage.removeItem("token");
  window.location.href = "/login.html";
};

function headers() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function money(v) {
  return `GHS ${(v / 100).toFixed(2)}`;
}

async function loadItems() {
  const res = await fetch("/api/admin/items", { headers: headers() });
  if (res.status === 401) return (window.location.href = "/login.html");
  const items = await res.json();

  const box = document.getElementById("itemsList");
  box.innerHTML = "";

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "cartLine";

    div.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <div class="muted small">${item.description || ""}</div>
        <div class="muted small">Qty: ${item.quantity_total} • Active: ${item.is_active ? "Yes" : "No"}</div>
      </div>
      <div class="right">
        <div><strong>${money(item.price_per_day)}/day</strong></div>
        <div class="qtyRow">
          <button type="button" data-toggle="${item.id}">
            ${item.is_active ? "Disable" : "Enable"}
          </button>
          <button type="button" data-delete="${item.id}" class="danger">
            Delete
          </button>
        </div>
      </div>
    `;

    // Enable/Disable
    const toggleBtn = div.querySelector("button[data-toggle]");
    toggleBtn.onclick = async () => {
      await fetch(`/api/admin/items/${item.id}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({
          name: item.name,
          description: item.description,
          price_per_day: item.price_per_day,
          quantity_total: item.quantity_total,
          is_active: item.is_active ? 0 : 1,
        }),
      });
      loadItems();
    };

    // Delete
    const delBtn = div.querySelector("button[data-delete]");
    delBtn.onclick = async () => {
      const ok = confirm(`Delete "${item.name}" permanently?`);
      if (!ok) return;

      const r = await fetch(`/api/admin/items/${item.id}`, {
        method: "DELETE",
        headers: headers(),
      });

      const data = await r.json();
      if (!r.ok) {
        alert(data.error || "Delete failed");
        return;
      }

      loadItems();
    };

    box.appendChild(div);
  });
}

document.getElementById("addItem").onclick = async () => {
  const msg = document.getElementById("itemMsg");
  msg.textContent = "";

  const name = document.getElementById("iName").value.trim();
  const description = document.getElementById("iDesc").value.trim();
  const priceGhs = Number(document.getElementById("iPrice").value);
  const qty = Number(document.getElementById("iQty").value);

  if (!name || !priceGhs || !qty) return (msg.textContent = "Fill name, price, quantity.");

  const res = await fetch("/api/admin/items", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name,
      description,
      price_per_day: Math.round(priceGhs * 100),
      quantity_total: qty,
    }),
  });

  const data = await res.json();
  if (!res.ok) return (msg.textContent = data.error || "Failed");

  msg.textContent = "✅ Added";
  document.getElementById("iName").value = "";
  document.getElementById("iDesc").value = "";
  document.getElementById("iPrice").value = "";
  document.getElementById("iQty").value = "";
  loadItems();
};

document.getElementById("loadBookings").onclick = async () => {
  const res = await fetch("/api/admin/bookings", { headers: headers() });
  const bookings = await res.json();

  const box = document.getElementById("bookingsList");
  box.innerHTML = "";

  bookings.forEach((b) => {
    const div = document.createElement("div");
    div.className = "cartLine";

    div.innerHTML = `
      <div>
        <strong>#${b.id} • ${b.customer_name}</strong>
        <div class="muted small">${b.customer_email} • ${b.customer_phone}</div>
        <div class="muted small">${b.start_date} → ${b.end_date}</div>

        <div class="muted small">
          Delivery: ${b.delivery_address || ""}, ${b.delivery_city || ""} ${
            b.delivery_landmark ? "(" + b.delivery_landmark + ")" : ""
          }
        </div>

        <div class="muted small">Items: ${(b.items || []).map(i => `${i.name} x${i.qty}`).join(", ")}</div>

        <div class="muted small">
          Amount: <strong>${money(b.amount_total)}</strong> • Status: <strong>${b.status}</strong><br/>
          Reference: <strong>${b.payment_reference || ""}</strong>
        </div>
      </div>

      <div class="right">
        <div class="qtyRow">
          ${b.status !== "paid" ? `<button type="button" data-paid="${b.id}">Mark Paid</button>` : ""}
          ${b.status !== "cancelled" ? `<button type="button" data-cancel="${b.id}" class="danger">Cancel</button>` : ""}
        </div>
      </div>
    `;

    const paidBtn = div.querySelector("button[data-paid]");
    if (paidBtn) {
      paidBtn.onclick = async () => {
        await fetch(`/api/admin/bookings/${b.id}/mark-paid`, { method: "PUT", headers: headers() });
        document.getElementById("loadBookings").click();
      };
    }

    const cancelBtn = div.querySelector("button[data-cancel]");
    if (cancelBtn) {
      cancelBtn.onclick = async () => {
        await fetch(`/api/admin/bookings/${b.id}/cancel`, { method: "PUT", headers: headers() });
        document.getElementById("loadBookings").click();
      };
    }

    box.appendChild(div);
  });
};

loadItems();