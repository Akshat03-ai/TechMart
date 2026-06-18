const apiUrl = "http://localhost:3000";

// ADMIN PROTECTION
const currentUser = JSON.parse(localStorage.getItem("user"));
if (!currentUser || currentUser.role !== "admin") {
  alert("Access denied!");
  window.location.href = "auth.html";
}

// Get user ID from URL
const params = new URLSearchParams(window.location.search);
const userId = params.get("id");

const userNameEl = document.getElementById("userName");
const userDetailsEl = document.getElementById("userDetails");
const userOrdersEl = document.getElementById("userOrders");

if (!userId) {
  userNameEl.textContent = "Invalid user.";
}

// Load user info
async function loadUser() {
  try {
    const res = await fetch(`${apiUrl}/users/admin/list`);
    const users = await res.json();

    const user = users.find(u => u.id == userId);
    if (!user) {
      userNameEl.textContent = "User not found.";
      return;
    }

    userNameEl.textContent = user.name;

    userDetailsEl.innerHTML = `
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Role:</strong> ${user.role}</p>
      <p><strong>Status:</strong> ${user.is_blocked ? "❌ Blocked" : "✔ Active"}</p>
      <p><strong>Address:</strong> <span id="userAddress">${user.address}</span></p>
      <p><strong>Pincode:</strong> <span id="userPincode">${user.pincode}</span></p>
      <p><strong>Total Orders:</strong> ${user.orderCount}</p>
    `;
  } catch (err) {
    console.error(err);
    userNameEl.textContent = "Error loading user.";
  }
}

// Cache all products to avoid repeated DB calls
let productsMap = {};

async function loadProductsMap() {
  const res = await fetch(`${apiUrl}/products/all`);
  const products = await res.json();

  products.forEach(p => {
    // Use first image of comma-separated list
    const firstImg = p.image ? p.image.split(",")[0] : "";
    productsMap[p.id] = {
      ...p,
      image: firstImg
    };
  });
}

// Load user orders
async function loadOrders() {
  try {
    // Fetch orders
    const res = await fetch(`${apiUrl}/orders/user/${userId}`);
    const orders = await res.json();

    if (!Array.isArray(orders) || orders.length === 0) {
      userOrdersEl.innerHTML = "<p>No orders found.</p>";
      return;
    }

    userOrdersEl.innerHTML = orders.map(o => {

      // SAFE JSON PARSE
      let parsedItems;
      try {
        parsedItems = JSON.parse(o.items);
      } catch {
        parsedItems = typeof o.items === "object" ? o.items : [{ error: "Invalid item data" }];
      }

      return `
    <div class="product-card" style="padding:10px; margin-bottom:10px; font-size:0.9rem;">
      <h4>Order #${o.id}</h4>
      <p><strong>Total:</strong> ₹${Number(o.total).toLocaleString("en-IN")}</p>
      <p><strong>Status:</strong> ${o.status}</p>
      <p><strong>Date:</strong> ${new Date(o.created_at).toLocaleString()}</p>

      <p>
        <button 
          onclick="window.open('/api/invoice/${o.id}', '_blank')" 
          style="margin-top:8px; padding:6px 10px; background:#2563eb; color:white; border:none; border-radius:5px; cursor:pointer; font-size:0.9rem;">
          <i class="fa-solid fa-file-invoice"></i> Download Invoice
        </button>
      </p>

      <details style="margin-top:10px;">
        <summary style="cursor:pointer; font-weight:600;">View Items</summary>
        ${renderItemsTable(parsedItems)}
      </details>
    </div>
  `;
    }).join("");

  } catch (err) {
    console.error(err);
    userOrdersEl.innerHTML = "<p>Error loading orders.</p>";
  }
}
function renderItemsTable(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "<p>No item data</p>";
  }

  let rows = items.map(it => {
    const p = productsMap[it.id];

    const img = p?.image ? p.image.split(",")[0] : "";
    const name = p?.name || "Unknown Product";
    const price = Number(p?.price || 0);
    const qty = it.qty;
    const rowTotal = price * qty;

    return `
      <tr style="
        transition: background 0.2s ease;
      " 
      onmouseover="this.style.background='#f9fbff'" 
      onmouseout="this.style.background='transparent'">

        <td style="
          padding:14px; 
          border-bottom:1px solid #e5e7eb; 
          text-align:center;
        ">
          ${img
        ? `<img src="${img}" style="width:70px; height:70px; object-fit:cover; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.15);">`
        : "<span style='font-size:0.9rem;'>No Image</span>"
      }
        </td>

        <td style="
          padding:14px; 
          border-bottom:1px solid #e5e7eb;
          font-size:1.05rem; 
          font-weight:600;
          color:#1f2937;
        ">
          ${name}
        </td>

        <td style="
          padding:14px; 
          border-bottom:1px solid #e5e7eb; 
          text-align:center;
          font-size:1rem;
          color:#374151;
        ">
          ${qty}
        </td>

        <td style="
          padding:14px; 
          border-bottom:1px solid #e5e7eb; 
          text-align:right;
          font-size:1rem;
          color:#111827;
        ">
          ₹${price.toLocaleString("en-IN")}
        </td>

        <td style="
          padding:14px; 
          border-bottom:1px solid #e5e7eb; 
          text-align:right;
          font-size:1.05rem; 
          font-weight:700;
          color:#10b981;
        ">
          ₹${rowTotal.toLocaleString("en-IN")}
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div style="
      width:100%;
      border-radius:12px;
      overflow:hidden;
      box-shadow:0 4px 18px rgba(0,0,0,0.08);
      margin-top:16px;
      background:white;
    ">
      <table style="
        width:100%;
        border-collapse:collapse;
        font-size:1rem;
      ">
        <thead>
          <tr style="background:#f3f6ff; border-bottom:1px solid #d1d5db;">
            <th style="padding:14px; font-size:1.05rem; text-align:left;">Image</th>
            <th style="padding:14px; font-size:1.05rem; text-align:left;">Product</th>
            <th style="padding:14px; font-size:1.05rem; text-align:center;">Qty</th>
            <th style="padding:14px; font-size:1.05rem; text-align:right;">Price</th>
            <th style="padding:14px; font-size:1.05rem; text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

(async function () {
  await loadProductsMap(); // load product data first
  await loadUser();
  await loadOrders();
})();
