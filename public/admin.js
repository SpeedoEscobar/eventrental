// ===================================
// F S Rental - Admin Dashboard
// ===================================

"use strict";

// Check authentication
const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";

// State
let allBookings = [];
let allItems = [];

// Auth headers
function headers() {
  return { 
    "Content-Type": "application/json", 
    Authorization: `Bearer ${token}` 
  };
}

// Format money (pesewas to GHS)
function money(v) {
  return `GHS ${(Number(v || 0) / 100).toFixed(2)}`;
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { 
    day: "numeric", 
    month: "short", 
    year: "numeric" 
  });
}

// Get status badge HTML
function getStatusBadge(status) {
  const statusMap = {
    "awaiting_payment": { label: "Awaiting Payment", class: "badge-warning" },
    "paid": { label: "Paid", class: "badge-success" },
    "completed": { label: "Completed", class: "badge-primary" },
    "cancelled": { label: "Cancelled", class: "badge-danger" }
  };
  const s = statusMap[status] || { label: status, class: "badge-primary" };
  return `<span class="badge ${s.class}">${s.label}</span>`;
}

// ===================================
// Tab Navigation
// ===================================

function switchTab(tabId) {
  // Update sidebar active state
  document.querySelectorAll(".sidebar-nav a").forEach(a => {
    a.classList.remove("active");
    if (a.dataset.tab === tabId) a.classList.add("active");
  });
  
  // Update mobile bottom nav active state
  document.querySelectorAll(".mobile-bottom-nav a").forEach(a => {
    a.classList.remove("active");
    if (a.dataset.tab === tabId) a.classList.add("active");
  });
  
  // Show/hide tab content
  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.classList.remove("active");
  });
  document.getElementById(`tab-${tabId}`).classList.add("active");
  
  // Load data for the tab
  if (tabId === "dashboard") loadDashboard();
  if (tabId === "bookings") loadAllBookings();
  if (tabId === "inventory") loadItems();
  if (tabId === "customers") loadCustomers();
  if (tabId === "reports") loadReports();
}

// Setup tab navigation
document.querySelectorAll(".sidebar-nav a[data-tab]").forEach(link => {
  link.onclick = (e) => {
    e.preventDefault();
    switchTab(link.dataset.tab);
  };
});

// Setup mobile bottom navigation
document.querySelectorAll(".mobile-bottom-nav a[data-tab]").forEach(link => {
  link.onclick = (e) => {
    e.preventDefault();
    const tabId = link.dataset.tab;
    
    // Update active state for mobile nav
    document.querySelectorAll(".mobile-bottom-nav a").forEach(a => a.classList.remove("active"));
    link.classList.add("active");
    
    switchTab(tabId);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
});

// ===================================
// Dashboard
// ===================================

async function loadDashboard() {
  try {
    const bookingsRes = await fetch("/api/admin/bookings", { headers: headers() });
    if (bookingsRes.status === 401) return window.location.href = "/login.html";
    
    allBookings = await bookingsRes.json();
    
    // Calculate stats
    const totalBookings = allBookings.length;
    const paidBookings = allBookings.filter(b => b.status === "paid" || b.status === "completed").length;
    const pendingBookings = allBookings.filter(b => b.status === "awaiting_payment").length;
    const totalRevenue = allBookings
      .filter(b => b.status === "paid" || b.status === "completed")
      .reduce((sum, b) => sum + (b.amount_total || 0), 0);
    
    // Update stats
    document.getElementById("statTotalBookings").textContent = totalBookings;
    document.getElementById("statPaidBookings").textContent = paidBookings;
    document.getElementById("statPendingBookings").textContent = pendingBookings;
    document.getElementById("statRevenue").textContent = money(totalRevenue);
    
    // Render recent bookings (last 5)
    renderBookingsTable(
      allBookings.slice(0, 5), 
      document.getElementById("recentBookings"),
      true
    );
    
  } catch (err) {
    console.error("Dashboard load error:", err);
  }
}

// ===================================
// Bookings
// ===================================

async function loadAllBookings() {
  try {
    const res = await fetch("/api/admin/bookings", { headers: headers() });
    if (res.status === 401) return window.location.href = "/login.html";
    
    allBookings = await res.json();
    renderBookingsTable(allBookings, document.getElementById("allBookings"), false);
    
  } catch (err) {
    console.error("Bookings load error:", err);
  }
}

function renderBookingsTable(bookings, container, compact = false) {
  if (bookings.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="${compact ? 7 : 9}" class="muted" style="text-align: center; padding: 32px;">
          No bookings found
        </td>
      </tr>
    `;
    return;
  }
  
  container.innerHTML = bookings.map(b => {
    const items = (b.items || []).map(i => `${i.name} ×${i.qty}`).join(", ");
    
    if (compact) {
      return `
        <tr>
          <td><strong>${b.payment_reference || `#${b.id}`}</strong></td>
          <td>
            <div class="booking-customer">${b.customer_name}</div>
          </td>
          <td>${formatDate(b.start_date)}</td>
          <td class="booking-items">${items || "-"}</td>
          <td class="booking-amount">${money(b.amount_total)}</td>
          <td>${getStatusBadge(b.status)}</td>
          <td>
            <div class="quick-actions">
              ${b.status === "awaiting_payment" ? `
                <button class="action-btn success" onclick="markPaid(${b.id})">✓ Paid</button>
              ` : ""}
              ${b.status !== "cancelled" && b.status !== "completed" ? `
                <button class="action-btn danger" onclick="cancelBooking(${b.id})">Cancel</button>
              ` : ""}
            </div>
          </td>
        </tr>
      `;
    }
    
    return `
      <tr>
        <td><strong>${b.payment_reference || `#${b.id}`}</strong></td>
        <td>
          <div class="booking-customer">
            ${b.customer_name}
            <small>${b.customer_email}</small>
          </div>
        </td>
        <td>${b.customer_phone}</td>
        <td>
          <strong>${formatDate(b.start_date)}</strong>
          <br><span class="muted small">to ${formatDate(b.end_date)}</span>
        </td>
        <td>
          <span class="small">
            ${b.delivery_address || ""}<br>
            ${b.delivery_city || ""}
            ${b.delivery_landmark ? `<br><em>(${b.delivery_landmark})</em>` : ""}
          </span>
        </td>
        <td class="booking-items">${items || "-"}</td>
        <td class="booking-amount">${money(b.amount_total)}</td>
        <td>${getStatusBadge(b.status)}</td>
        <td>
          <div class="quick-actions">
            ${b.status === "awaiting_payment" ? `
              <button class="action-btn success" onclick="markPaid(${b.id})">✓ Mark Paid</button>
            ` : ""}
            ${b.status === "paid" ? `
              <button class="action-btn" style="background: var(--info); color: white;" onclick="markCompleted(${b.id})">Complete</button>
            ` : ""}
            ${b.status !== "cancelled" && b.status !== "completed" ? `
              <button class="action-btn danger" onclick="cancelBooking(${b.id})">Cancel</button>
            ` : ""}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// Booking actions
async function markPaid(id) {
  if (!confirm("Mark this booking as paid?")) return;
  
  try {
    await fetch(`/api/admin/bookings/${id}/mark-paid`, { 
      method: "PUT", 
      headers: headers() 
    });
    loadAllBookings();
    loadDashboard();
  } catch (err) {
    alert("Failed to update booking");
  }
}

async function markCompleted(id) {
  if (!confirm("Mark this booking as completed?")) return;
  
  try {
    await fetch(`/api/admin/bookings/${id}/complete`, { 
      method: "PUT", 
      headers: headers() 
    });
    loadAllBookings();
    loadDashboard();
  } catch (err) {
    alert("Failed to update booking");
  }
}

async function cancelBooking(id) {
  if (!confirm("Are you sure you want to cancel this booking?")) return;
  
  try {
    await fetch(`/api/admin/bookings/${id}/cancel`, { 
      method: "PUT", 
      headers: headers() 
    });
    loadAllBookings();
    loadDashboard();
  } catch (err) {
    alert("Failed to cancel booking");
  }
}

// Booking filter
document.getElementById("applyBookingFilter").onclick = () => {
  const status = document.getElementById("bookingStatusFilter").value;
  const startDate = document.getElementById("bookingStartFilter").value;
  const endDate = document.getElementById("bookingEndFilter").value;
  
  let filtered = [...allBookings];
  
  if (status !== "all") {
    filtered = filtered.filter(b => b.status === status);
  }
  
  if (startDate) {
    filtered = filtered.filter(b => b.start_date >= startDate);
  }
  
  if (endDate) {
    filtered = filtered.filter(b => b.end_date <= endDate);
  }
  
  renderBookingsTable(filtered, document.getElementById("allBookings"), false);
};

// ===================================
// Inventory
// ===================================

// Category icons for fallback
const categoryIcons = {
  seating: "🪑",
  tents: "⛺",
  sound: "🔊",
  decor: "🎨",
  default: "📦"
};

function getCategoryLabel(category) {
  const labels = {
    seating: "Seating",
    tents: "Tents & Canopy",
    sound: "Sound & Lighting",
    decor: "Decor"
  };
  return labels[category] || "-";
}

async function loadItems() {
  try {
    const res = await fetch("/api/admin/items", { headers: headers() });
    if (res.status === 401) return window.location.href = "/login.html";
    
    allItems = await res.json();
    
    document.getElementById("itemCount").textContent = `${allItems.length} items`;
    
    const container = document.getElementById("itemsList");
    
    if (allItems.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="muted" style="text-align: center; padding: 32px;">
            No items yet. Add your first item above.
          </td>
        </tr>
      `;
      return;
    }
    
    container.innerHTML = allItems.map(item => {
      const icon = categoryIcons[item.category] || categoryIcons.default;
      const imageHtml = item.image_url 
        ? `<img src="${item.image_url}" alt="${item.name}" class="item-image" onerror="this.outerHTML='<div class=\\'item-image-placeholder\\'>${icon}</div>'">`
        : `<div class="item-image-placeholder">${icon}</div>`;
      
      return `
        <tr>
          <td class="item-image-cell">${imageHtml}</td>
          <td>
            <div class="booking-customer">
              ${item.name}
              <small>${item.description || "No description"}</small>
            </div>
          </td>
          <td><span class="badge badge-primary">${getCategoryLabel(item.category)}</span></td>
          <td><strong>${money(item.price_per_day)}</strong></td>
          <td>${item.quantity_total}</td>
          <td>
            ${item.is_active 
              ? '<span class="badge badge-success">Active</span>' 
              : '<span class="badge badge-danger">Disabled</span>'}
          </td>
          <td>
            <div class="quick-actions">
              <button class="action-btn" style="background: var(--primary); color: white;" onclick="editItem(${item.id})">
                Edit
              </button>
              <button class="action-btn" style="background: var(--gray-100);" onclick="toggleItem(${item.id}, ${item.is_active})">
                ${item.is_active ? "Disable" : "Enable"}
              </button>
              <button class="action-btn danger" onclick="deleteItem(${item.id}, '${item.name.replace(/'/g, "\\'")}')">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
    
  } catch (err) {
    console.error("Items load error:", err);
  }
}

// Image gallery selection
function setupImageGallery() {
  const gallery = document.getElementById("imageGallery");
  const imageUrlInput = document.getElementById("iImageUrl");
  const previewRow = document.getElementById("imagePreviewRow");
  const previewImg = document.getElementById("imagePreview");
  
  if (!gallery) return;
  
  gallery.querySelectorAll(".gallery-item").forEach(item => {
    item.onclick = () => {
      const url = item.dataset.url;
      imageUrlInput.value = url;
      
      // Update selection state
      gallery.querySelectorAll(".gallery-item").forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      
      // Show preview
      previewImg.src = url;
      previewRow.style.display = "block";
    };
  });
  
  // Also handle manual URL input
  imageUrlInput.addEventListener("input", () => {
    const url = imageUrlInput.value.trim();
    if (url) {
      previewImg.src = url;
      previewRow.style.display = "block";
    } else {
      previewRow.style.display = "none";
    }
    // Clear gallery selection
    gallery.querySelectorAll(".gallery-item").forEach(i => i.classList.remove("selected"));
  });
}

// Clear image selection
function clearImageSelection() {
  document.getElementById("iImageUrl").value = "";
  document.getElementById("imagePreviewRow").style.display = "none";
  document.querySelectorAll(".gallery-item").forEach(i => i.classList.remove("selected"));
}

// Edit item (populate form)
function editItem(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  
  document.getElementById("iName").value = item.name;
  document.getElementById("iDesc").value = item.description || "";
  document.getElementById("iPrice").value = (item.price_per_day / 100).toFixed(2);
  document.getElementById("iQty").value = item.quantity_total;
  document.getElementById("iCategory").value = item.category || "";
  document.getElementById("iImageUrl").value = item.image_url || "";
  
  // Show image preview if exists
  if (item.image_url) {
    document.getElementById("imagePreview").src = item.image_url;
    document.getElementById("imagePreviewRow").style.display = "block";
  }
  
  // Change button to Update mode
  const addBtn = document.getElementById("addItem");
  addBtn.textContent = "Update Item";
  addBtn.dataset.editId = id;
  
  // Scroll to form
  document.querySelector("#tab-inventory .content-card").scrollIntoView({ behavior: "smooth" });
}

// Add item
document.getElementById("addItem").onclick = async () => {
  const msg = document.getElementById("itemMsg");
  msg.textContent = "";
  msg.className = "note";

  const name = document.getElementById("iName").value.trim();
  const description = document.getElementById("iDesc").value.trim();
  const priceGhs = Number(document.getElementById("iPrice").value);
  const qty = Number(document.getElementById("iQty").value);
  const category = document.getElementById("iCategory").value;
  const image_url = document.getElementById("iImageUrl").value.trim();
  const editId = document.getElementById("addItem").dataset.editId;

  if (!name || !priceGhs || !qty) {
    msg.textContent = "Please fill in item name, price, and quantity.";
    msg.className = "note error";
    return;
  }

  try {
    const endpoint = editId ? `/api/admin/items/${editId}` : "/api/admin/items";
    const method = editId ? "PUT" : "POST";
    
    const res = await fetch(endpoint, {
      method,
      headers: headers(),
      body: JSON.stringify({
        name,
        description,
        price_per_day: Math.round(priceGhs * 100),
        quantity_total: qty,
        category,
        image_url,
        is_active: 1,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || "Failed to save item";
      msg.className = "note error";
      return;
    }

    msg.textContent = editId ? "Item updated successfully!" : "Item added successfully!";
    msg.className = "note success";
    
    // Clear form
    document.getElementById("iName").value = "";
    document.getElementById("iDesc").value = "";
    document.getElementById("iPrice").value = "";
    document.getElementById("iQty").value = "";
    document.getElementById("iCategory").value = "";
    clearImageSelection();
    
    // Reset button
    const addBtn = document.getElementById("addItem");
    addBtn.textContent = "+ Add Item";
    delete addBtn.dataset.editId;
    
    loadItems();
  } catch (err) {
    msg.textContent = "Error saving item";
    msg.className = "note error";
  }
};

// Toggle item active status
async function toggleItem(id, currentActive) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  
  try {
    await fetch(`/api/admin/items/${id}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({
        name: item.name,
        description: item.description,
        price_per_day: item.price_per_day,
        quantity_total: item.quantity_total,
        is_active: currentActive ? 0 : 1,
        image_url: item.image_url || "",
        category: item.category || "",
      }),
    });
    loadItems();
  } catch (err) {
    alert("Failed to update item");
  }
}

// Delete item
async function deleteItem(id, name) {
  if (!confirm(`Delete "${name}" permanently?\n\nNote: You cannot delete items that have been used in bookings.`)) return;

  try {
    const res = await fetch(`/api/admin/items/${id}`, {
      method: "DELETE",
      headers: headers(),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Delete failed");
      return;
    }

    loadItems();
  } catch (err) {
    alert("Failed to delete item");
  }
}

// ===================================
// Customers
// ===================================

async function loadCustomers() {
  try {
    const res = await fetch("/api/admin/bookings", { headers: headers() });
    if (res.status === 401) return window.location.href = "/login.html";
    
    const bookings = await res.json();
    
    // Group by customer email
    const customerMap = new Map();
    
    bookings.forEach(b => {
      const email = b.customer_email;
      if (!customerMap.has(email)) {
        customerMap.set(email, {
          name: b.customer_name,
          email: b.customer_email,
          phone: b.customer_phone,
          bookings: [],
          totalSpent: 0
        });
      }
      
      const customer = customerMap.get(email);
      customer.bookings.push(b);
      if (b.status === "paid" || b.status === "completed") {
        customer.totalSpent += b.amount_total || 0;
      }
    });
    
    const customers = Array.from(customerMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent);
    
    const container = document.getElementById("customersList");
    
    if (customers.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="5" class="muted" style="text-align: center; padding: 32px;">
            No customers yet
          </td>
        </tr>
      `;
      return;
    }
    
    container.innerHTML = customers.map(c => {
      const lastBooking = c.bookings.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      )[0];
      
      return `
        <tr>
          <td>
            <div class="booking-customer">
              ${c.name}
              <small>${c.email}</small>
            </div>
          </td>
          <td>${c.phone}</td>
          <td>${c.bookings.length}</td>
          <td><strong>${money(c.totalSpent)}</strong></td>
          <td>${formatDate(lastBooking?.created_at)}</td>
        </tr>
      `;
    }).join("");
    
  } catch (err) {
    console.error("Customers load error:", err);
  }
}

// ===================================
// Reports
// ===================================

async function loadReports() {
  try {
    const res = await fetch("/api/admin/bookings", { headers: headers() });
    if (res.status === 401) return window.location.href = "/login.html";
    
    const bookings = await res.json();
    
    // This month's data
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const thisMonthBookings = bookings.filter(b => 
      new Date(b.created_at) >= firstOfMonth
    );
    
    const thisMonthPaid = thisMonthBookings.filter(b => 
      b.status === "paid" || b.status === "completed"
    );
    
    const monthRevenue = thisMonthPaid.reduce((sum, b) => sum + (b.amount_total || 0), 0);
    
    document.getElementById("monthRevenue").textContent = money(monthRevenue);
    document.getElementById("monthBookings").textContent = thisMonthBookings.length;
    
    // Average order value
    const paidBookings = bookings.filter(b => b.status === "paid" || b.status === "completed");
    const avgOrder = paidBookings.length > 0 
      ? paidBookings.reduce((sum, b) => sum + (b.amount_total || 0), 0) / paidBookings.length 
      : 0;
    document.getElementById("avgOrder").textContent = money(avgOrder);
    
    // Item popularity
    const itemStats = new Map();
    bookings.forEach(b => {
      (b.items || []).forEach(item => {
        if (!itemStats.has(item.name)) {
          itemStats.set(item.name, { name: item.name, count: 0, qty: 0, revenue: 0 });
        }
        const stat = itemStats.get(item.name);
        stat.count += 1;
        stat.qty += item.qty;
        if (b.status === "paid" || b.status === "completed") {
          stat.revenue += item.price_per_day * item.qty;
        }
      });
    });
    
    const itemPopularity = Array.from(itemStats.values())
      .sort((a, b) => b.count - a.count);
    
    if (itemPopularity.length > 0) {
      document.getElementById("topItem").textContent = itemPopularity[0].name;
    }
    
    // Render item popularity table
    const popContainer = document.getElementById("itemPopularity");
    popContainer.innerHTML = itemPopularity.map(item => `
      <tr>
        <td><strong>${item.name}</strong></td>
        <td>${item.count}</td>
        <td>${item.qty}</td>
        <td>${money(item.revenue)}</td>
      </tr>
    `).join("") || `
      <tr>
        <td colspan="4" class="muted" style="text-align: center;">No data</td>
      </tr>
    `;
    
    // Revenue breakdown
    const revenueByStatus = {
      paid: bookings.filter(b => b.status === "paid").reduce((s, b) => s + (b.amount_total || 0), 0),
      completed: bookings.filter(b => b.status === "completed").reduce((s, b) => s + (b.amount_total || 0), 0),
      awaiting: bookings.filter(b => b.status === "awaiting_payment").reduce((s, b) => s + (b.amount_total || 0), 0),
      cancelled: bookings.filter(b => b.status === "cancelled").reduce((s, b) => s + (b.amount_total || 0), 0)
    };
    
    document.getElementById("revenueBreakdown").innerHTML = `
      <div style="background: #d1fae5; padding: 20px; border-radius: var(--radius);">
        <div class="small muted">Paid</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: #065f46;">${money(revenueByStatus.paid)}</div>
      </div>
      <div style="background: #dbeafe; padding: 20px; border-radius: var(--radius);">
        <div class="small muted">Completed</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: #1e40af;">${money(revenueByStatus.completed)}</div>
      </div>
      <div style="background: #fef3c7; padding: 20px; border-radius: var(--radius);">
        <div class="small muted">Awaiting Payment</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: #92400e;">${money(revenueByStatus.awaiting)}</div>
      </div>
      <div style="background: #fee2e2; padding: 20px; border-radius: var(--radius);">
        <div class="small muted">Cancelled</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: #991b1b;">${money(revenueByStatus.cancelled)}</div>
      </div>
    `;
    
  } catch (err) {
    console.error("Reports load error:", err);
  }
}

// ===================================
// Logout
// ===================================

document.getElementById("logout").onclick = (e) => {
  e.preventDefault();
  localStorage.removeItem("token");
  window.location.href = "/login.html";
};

const logoutMobile = document.getElementById("logoutMobile");
if (logoutMobile) {
  logoutMobile.onclick = (e) => {
    e.preventDefault();
    localStorage.removeItem("token");
    window.location.href = "/login.html";
  };
}

// ===================================
// Initialize
// ===================================

loadDashboard();
loadItems();
setupImageGallery();
