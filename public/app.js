"use strict";

// ===================================
// FS Rental - Frontend Application
// ===================================

// DOM Elements
const itemsEl = document.getElementById("items");
const cartEl = document.getElementById("cart");
const totalEl = document.getElementById("total");
const availabilityEl = document.getElementById("availabilityResult");
const payMsgEl = document.getElementById("payMsg");
const startDateEl = document.getElementById("startDate");
const endDateEl = document.getElementById("endDate");

// State
const cart = new Map();
let allItems = [];
let currentCategory = "all";

// Item category icons mapping
const categoryIcons = {
  seating: "🪑",
  tents: "⛺",
  sound: "🔊",
  decor: "🎨",
  lighting: "💡",
  tables: "🪑",
  default: "📦"
};

// Item category mapping based on name keywords
function getItemCategory(name) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("chair") || lowerName.includes("seat")) return "seating";
  if (lowerName.includes("table")) return "seating";
  if (lowerName.includes("tent") || lowerName.includes("canopy") || lowerName.includes("gazebo")) return "tents";
  if (lowerName.includes("sound") || lowerName.includes("speaker") || lowerName.includes("microphone") || lowerName.includes("pa system")) return "sound";
  if (lowerName.includes("light") || lowerName.includes("lamp") || lowerName.includes("bulb")) return "lighting";
  if (lowerName.includes("decor") || lowerName.includes("flower") || lowerName.includes("backdrop") || lowerName.includes("drape")) return "decor";
  return "all";
}

// Get icon for item
function getItemIcon(name) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("chair")) return "🪑";
  if (lowerName.includes("table")) return "🪑";
  if (lowerName.includes("tent") || lowerName.includes("canopy")) return "⛺";
  if (lowerName.includes("sound") || lowerName.includes("speaker")) return "🔊";
  if (lowerName.includes("microphone")) return "🎤";
  if (lowerName.includes("light")) return "💡";
  if (lowerName.includes("decor") || lowerName.includes("flower")) return "🌸";
  if (lowerName.includes("backdrop")) return "🎭";
  if (lowerName.includes("drape") || lowerName.includes("cloth")) return "🎪";
  return "📦";
}

// Format money (stored in pesewas, display in GHS)
function money(v) {
  return `GHS ${(Number(v || 0) / 100).toFixed(2)}`;
}

// Calculate days between two dates (inclusive)
function calcDays(start, end) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const days = Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(days, 1);
}

// Set minimum date to today
function initializeDates() {
  const today = new Date().toISOString().split('T')[0];
  startDateEl.setAttribute("min", today);
  endDateEl.setAttribute("min", today);
  
  // Set default to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  startDateEl.value = tomorrow.toISOString().split('T')[0];
  
  // Set end date to day after tomorrow
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  endDateEl.value = dayAfter.toISOString().split('T')[0];
}

// Render the shopping cart
function renderCart() {
  if (cart.size === 0) {
    cartEl.innerHTML = `
      <div class="empty-state" style="padding: 24px 0;">
        <div class="empty-state-icon">🛒</div>
        <p class="muted">Your cart is empty.<br>Add items from the inventory.</p>
      </div>
    `;
    totalEl.textContent = "GHS 0.00";
    return;
  }

  cartEl.innerHTML = "";
  let total = 0;

  const start = startDateEl.value;
  const end = endDateEl.value;
  const days = start && end ? calcDays(start, end) : 1;

  for (const [id, row] of cart.entries()) {
    const lineTotal = row.item.price_per_day * row.qty * days;
    total += lineTotal;

    const line = document.createElement("div");
    line.className = "cartLine fade-in";
    line.innerHTML = `
      <div>
        <strong>${getItemIcon(row.item.name)} ${row.item.name}</strong>
        <div class="muted small">
          ${money(row.item.price_per_day)}/day × ${row.qty} item${row.qty > 1 ? 's' : ''} × ${days} day${days > 1 ? 's' : ''}
        </div>
      </div>
      <div class="right">
        <div><strong style="color: var(--primary);">${money(lineTotal)}</strong></div>
        <div class="qtyRow">
          <button type="button" data-dec="${id}" title="Decrease">−</button>
          <span style="min-width: 24px; text-align: center; font-weight: 600;">${row.qty}</span>
          <button type="button" data-inc="${id}" title="Increase">+</button>
          <button type="button" data-rm="${id}" class="danger" title="Remove">×</button>
        </div>
      </div>
    `;
    cartEl.appendChild(line);
  }

  totalEl.textContent = money(total);

  // Event listeners for cart buttons
  cartEl.querySelectorAll("button[data-inc]").forEach((btn) => {
    btn.onclick = () => {
      const id = Number(btn.dataset.inc);
      const row = cart.get(id);
      if (row) {
        row.qty += 1;
        renderCart();
        clearMessages();
      }
    };
  });

  cartEl.querySelectorAll("button[data-dec]").forEach((btn) => {
    btn.onclick = () => {
      const id = Number(btn.dataset.dec);
      const row = cart.get(id);
      if (row) {
        row.qty = Math.max(1, row.qty - 1);
        renderCart();
        clearMessages();
      }
    };
  });

  cartEl.querySelectorAll("button[data-rm]").forEach((btn) => {
    btn.onclick = () => {
      const id = Number(btn.dataset.rm);
      cart.delete(id);
      renderCart();
      clearMessages();
    };
  });
}

// Clear message areas
function clearMessages() {
  availabilityEl.textContent = "";
  availabilityEl.className = "note";
  payMsgEl.innerHTML = "";
}

// Render inventory items with filtering
function renderItems(items, filter = "all") {
  itemsEl.innerHTML = "";
  
  // Filter by category from database or by name keywords
  const filteredItems = filter === "all" 
    ? items 
    : items.filter(item => {
        // Check database category first
        if (item.category && item.category === filter) return true;
        // Fallback to name-based category detection
        return getItemCategory(item.name) === filter;
      });

  if (filteredItems.length === 0) {
    itemsEl.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-state-icon">📦</div>
        <h4>No items found</h4>
        <p class="muted">Try selecting a different category or check back later.</p>
      </div>
    `;
    return;
  }

  filteredItems.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "itemCard fade-in";
    card.style.animationDelay = `${index * 0.03}s`;
    
    const icon = getItemIcon(item.name);
    const inCart = cart.has(item.id);
    
    // Use image_url from database if available, otherwise fallback to icon
    const imageHtml = item.image_url 
      ? `<img src="${item.image_url}" alt="${item.name}" onerror="this.parentElement.innerHTML='${icon}'">`
      : icon;
    
    card.innerHTML = `
      <div class="itemCard-image">${imageHtml}</div>
      <h4>${item.name}</h4>
      <div class="muted item-desc">${item.description || "Premium quality rental item"}</div>
      <div class="rowSpace">
        <div class="price">${money(item.price_per_day)}<span class="muted small">/day</span></div>
        <button type="button" class="${inCart ? 'added' : ''}">
          ${inCart ? '✓ Added' : '+ Add'}
        </button>
      </div>
    `;
    
    const btn = card.querySelector("button");
    btn.onclick = () => {
      if (!cart.has(item.id)) {
        cart.set(item.id, { item, qty: 1 });
      } else {
        cart.get(item.id).qty += 1;
      }
      
      clearMessages();
      renderCart();
      renderItems(allItems, currentCategory);
      
      // Visual feedback
      btn.textContent = "✓ Added";
      btn.classList.add("added");
    };
    
    itemsEl.appendChild(card);
  });
}

// Load items from API
async function loadItems() {
  itemsEl.innerHTML = `
    <div class="loading" style="grid-column: 1/-1; text-align: center; padding: 48px;">
      <div class="spinner" style="margin: 0 auto 16px;"></div>
      <p class="muted">Loading inventory...</p>
    </div>
  `;

  try {
    const res = await fetch("/api/items", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load items. Make sure the server is running.");
    
    const items = await res.json();
    allItems = items;

    if (!Array.isArray(items) || items.length === 0) {
      itemsEl.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon">📦</div>
          <h4>No items available</h4>
          <p class="muted">Check back soon or contact us for custom rentals.</p>
        </div>
      `;
      return;
    }

    renderItems(items, currentCategory);
  } catch (err) {
    console.error(err);
    itemsEl.innerHTML = `
      <div class="note error" style="grid-column: 1/-1;">
        <strong>Connection Error</strong>
        <p>${err.message}</p>
        <p class="small muted" style="margin-top: 8px;">
          Make sure the server is running: <code>node server.js</code>
        </p>
      </div>
    `;
  }
}

// Setup category filters
function setupCategoryFilters() {
  const filterContainer = document.getElementById("categoryFilter");
  if (!filterContainer) return;

  filterContainer.querySelectorAll(".category-pill").forEach(pill => {
    pill.onclick = () => {
      // Update active state
      filterContainer.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      
      // Filter items
      currentCategory = pill.dataset.category;
      renderItems(allItems, currentCategory);
    };
  });
}

// Check availability
document.getElementById("checkAvailability").onclick = async () => {
  clearMessages();

  const start = startDateEl.value;
  const end = endDateEl.value;

  if (!start || !end) {
    availabilityEl.textContent = "Please select start and end dates.";
    availabilityEl.className = "note error";
    return;
  }

  if (new Date(start) > new Date(end)) {
    availabilityEl.textContent = "End date must be after start date.";
    availabilityEl.className = "note error";
    return;
  }

  if (cart.size === 0) {
    availabilityEl.textContent = "Add items to your cart first.";
    availabilityEl.className = "note info";
    return;
  }

  const cartArr = [...cart.entries()].map(([item_id, row]) => ({ item_id, qty: row.qty }));

  try {
    availabilityEl.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; display: inline-block; margin-right: 8px;"></div> Checking availability...';
    availabilityEl.className = "note";
    
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: start, end_date: end, cart: cartArr }),
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Availability check failed");

    const bad = (data.result || []).filter((r) => !r.ok);
    
    if (bad.length === 0) {
      availabilityEl.innerHTML = "✓ All items are available for your selected dates!";
      availabilityEl.className = "note success";
    } else {
      availabilityEl.innerHTML = `
        <strong>⚠ Some items have limited availability:</strong><br>
        ${bad.map((b) => `• ${b.name}: only ${b.available} available (you requested ${b.requested})`).join("<br>")}
      `;
      availabilityEl.className = "note error";
    }
  } catch (e) {
    availabilityEl.textContent = "Error: " + e.message;
    availabilityEl.className = "note error";
  }
};

// Book and Pay
document.getElementById("bookAndPay").onclick = async () => {
  clearMessages();

  const start = startDateEl.value;
  const end = endDateEl.value;

  const customer_name = document.getElementById("custName").value.trim();
  const customer_email = document.getElementById("custEmail").value.trim();
  const customer_phone = document.getElementById("custPhone").value.trim();

  const delivery_address = document.getElementById("deliveryAddress").value.trim();
  const delivery_city = document.getElementById("deliveryCity").value.trim();
  const delivery_landmark = document.getElementById("deliveryLandmark").value.trim();

  // Validation
  if (!start || !end) {
    showError(payMsgEl, "Please select your event dates.");
    return;
  }

  if (new Date(start) > new Date(end)) {
    showError(payMsgEl, "End date must be after start date.");
    return;
  }

  if (!customer_name || !customer_email || !customer_phone) {
    showError(payMsgEl, "Please fill in all customer information fields.");
    return;
  }

  // Simple email validation
  if (!customer_email.includes("@") || !customer_email.includes(".")) {
    showError(payMsgEl, "Please enter a valid email address.");
    return;
  }

  if (!delivery_address || !delivery_city) {
    showError(payMsgEl, "Please enter delivery address and city.");
    return;
  }

  if (cart.size === 0) {
    showError(payMsgEl, "Your cart is empty. Add items to book.");
    return;
  }

  const cartArr = [...cart.entries()].map(([item_id, row]) => ({ item_id, qty: row.qty }));

  try {
    payMsgEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="spinner"></div>
        <span>Processing your booking...</span>
      </div>
    `;

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
      <div class="note success" style="margin-top: 16px;">
        <h4 style="margin-bottom: 12px;">🎉 Booking Confirmed!</h4>
        <p>Booking ID: <strong>#${data.booking_id}</strong></p>
      </div>
      
      <div class="payment-box">
        <h4>💳 Payment Instructions</h4>
        <div class="payment-detail">
          <span>Network</span>
          <strong>${p.momo_network}</strong>
        </div>
        <div class="payment-detail">
          <span>Name</span>
          <strong>${p.momo_name}</strong>
        </div>
        <div class="payment-detail">
          <span>Number</span>
          <strong>${p.momo_number}</strong>
        </div>
        <div class="payment-detail">
          <span>Amount</span>
          <strong>${money(data.amount_total)}</strong>
        </div>
        <div class="payment-detail">
          <span>Reference</span>
          <strong style="color: #fef3c7;">${p.reference}</strong>
        </div>
        <p style="margin-top: 16px; font-size: 0.9rem; opacity: 0.9;">
          📱 Send the exact amount to the MoMo number above.<br>
          📋 Use <strong>${p.reference}</strong> as your payment reference.<br>
          ✅ Your booking will be confirmed after payment verification.
        </p>
      </div>
    `;

    // Clear cart after successful booking
    cart.clear();
    renderCart();
    renderItems(allItems, currentCategory);

    // Scroll to payment info
    payMsgEl.scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (e) {
    showError(payMsgEl, e.message);
  }
};

// Show error message
function showError(element, message) {
  element.innerHTML = `
    <div class="note error">
      <strong>⚠ Error</strong>
      <p>${message}</p>
    </div>
  `;
}

// Navigate to inventory section
document.getElementById("goInventory").onclick = () => {
  document.getElementById("inventory").scrollIntoView({ behavior: "smooth" });
};

// Update cart when dates change
startDateEl.addEventListener("change", () => {
  // Ensure end date is not before start date
  if (endDateEl.value && new Date(endDateEl.value) < new Date(startDateEl.value)) {
    endDateEl.value = startDateEl.value;
  }
  endDateEl.setAttribute("min", startDateEl.value);
  renderCart();
  clearMessages();
});

endDateEl.addEventListener("change", () => {
  renderCart();
  clearMessages();
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Mobile menu toggle
function setupMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const nav = document.querySelector('.topbar nav');
  
  if (menuBtn && nav) {
    menuBtn.onclick = () => {
      nav.classList.toggle('open');
      menuBtn.textContent = nav.classList.contains('open') ? '✕' : '☰';
    };
    
    // Close menu when clicking a link
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        menuBtn.textContent = '☰';
      });
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !menuBtn.contains(e.target)) {
        nav.classList.remove('open');
        menuBtn.textContent = '☰';
      }
    });
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initializeDates();
  loadItems();
  setupCategoryFilters();
  renderCart();
  setupMobileMenu();
});
