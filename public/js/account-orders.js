const currentUser = JSON.parse(localStorage.getItem("user"));
if (!currentUser) {
    alert("Please login first.");
    window.location.href = "auth.html?tab=login";
}

const userDetailsEl = document.getElementById("userDetails");
const ordersList = document.getElementById("ordersList");

// ----------- LOAD PROFILE -----------
function loadProfile() {
  userDetailsEl.innerHTML = `
    <p><strong>Name:</strong> ${currentUser.name}</p>
    <p><strong>Email:</strong> ${currentUser.email}</p>
    <p><strong>Role:</strong> ${currentUser.role}</p>
    <p><strong>Address:</strong> <span id="userAddress" class="editable">${currentUser.address || "Enter Address"}</span></p>
    <p><strong>Pincode:</strong> <span id="userPincode" class="editable">${currentUser.pincode || "Enter Pincode"}</span></p>
    <p><strong>Change/Forgot Password:</strong><a href="change-password.html">Click Here</a>
  `;

  enableInlineEdit("userAddress", "address");
  enableInlineEdit("userPincode", "pincode");

}

function enableInlineEdit(elementId, field) {
  const el = document.getElementById(elementId);

  el.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = el.textContent === "Enter Address" || el.textContent === "Enter Pincode" 
      ? "" 
      : el.textContent;

    input.style.padding = "4px";
    input.style.width = "200px";

    el.replaceWith(input);
    input.focus();

    input.addEventListener("blur", async () => {
      const newValue = input.value.trim() || (field === "address" ? "Enter Address" : "Enter Pincode");

      // Save to backend
      await fetch(`${apiUrl}/users/update/${currentUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          address: field === "address" ? newValue : currentUser.address,
          pincode: field === "pincode" ? newValue : currentUser.pincode
        })
      });

      // Update localStorage
      currentUser[field] = newValue;
      localStorage.setItem("user", JSON.stringify(currentUser));

      const span = document.createElement("span");
      span.id = elementId;
      span.className = "editable";
      span.textContent = newValue;

      input.replaceWith(span);
      enableInlineEdit(elementId, field);
    });
  });
}

// ----------- LOAD PRODUCT MAP -----------
let productsMap = {};

async function loadProductsMap() {
    const res = await fetch(`${apiUrl}/products/all`);
    const products = await res.json();

    products.forEach(p => {
        productsMap[p.id] = {
            ...p,
            image: p.image ? p.image.split(",")[0] : ""
        };
    });
}

// ----------- MODERN ITEMS TABLE -----------
function renderItemsTable(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return "<p>No item data</p>";
    }

    let rows = items.map(it => {
        const p = productsMap[it.id];

        const img = p?.image || "";
        const name = p?.name || "Unknown Product";
        const price = Number(p?.price || 0);
        const qty = it.qty;
        const rowTotal = price * qty;

        return `
      <tr onmouseover="this.style.background='#f9fbff'"
          onmouseout="this.style.background='transparent'">
        <td style="padding:14px; border-bottom:1px solid #eee; text-align:center;">
          ${img ? `<img src="${img}" style="width:70px; height:70px; border-radius:10px; object-fit:cover;">` : "No Image"}
        </td>
        <td style="padding:14px; border-bottom:1px solid #eee; font-weight:600;">${name}</td>
        <td style="padding:14px; border-bottom:1px solid #eee; text-align:center;">${qty}</td>
        <td style="padding:14px; border-bottom:1px solid #eee; text-align:right;">₹${price.toLocaleString("en-IN")}</td>
        <td style="padding:14px; border-bottom:1px solid #eee; text-align:right; font-weight:700; color:#10b981;">
          ₹${rowTotal.toLocaleString("en-IN")}
        </td>
      </tr>
    `;
    }).join("");

    return `
    <div style="margin-top:10px; border-radius:12px; overflow:hidden; background:white; box-shadow:0 4px 18px rgba(0,0,0,0.07);">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#eef2ff;">
            <th style="padding:14px;">Image</th>
            <th style="padding:14px;">Product</th>
            <th style="padding:14px;">Qty</th>
            <th style="padding:14px;">Price</th>
            <th style="padding:14px;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ----------- LOAD ORDERS -----------
async function loadOrders() {
    try {
        console.log("Loading orders for user:", currentUser.id);
        const res = await fetch(`${apiUrl}/orders/user/${currentUser.id}`);
        if (!res.ok) {
            console.error("Orders fetch failed:", res.status, await res.text());
            ordersList.innerHTML = "<p>Error loading orders (server).</p>";
            return;
        }

        const orders = await res.json();
        console.log("Orders response:", orders);

        if (!Array.isArray(orders) || orders.length === 0) {
            ordersList.innerHTML = "<p>You have no orders yet.</p>";
            return;
        }

        // build HTML
        ordersList.innerHTML = orders.map(o => {
            // safe parse items
            let items = [];
            try {
                if (typeof o.items === 'string') items = JSON.parse(o.items);
                else if (Array.isArray(o.items)) items = o.items;
                else if (typeof o.items === 'object' && o.items !== null) items = o.items;
            } catch (parseErr) {
                console.warn("Failed to parse items for order", o.id, parseErr, "raw:", o.items);
                items = [];
            }

            // fallback message when items empty
            const itemsHtml = items.length ? renderItemsTable(items) : '<p style="padding:12px;color:#666;">No item details available</p>';

            // use unique id for details block to help JS toggle if needed
            const detailsId = `order-items-${o.id}`;

            return `
        <div class="product-card" style="padding:18px; margin-bottom:16px;">
          <h3>Order #${o.id}</h3>
          <p><strong>Total:</strong> ₹${Number(o.total).toLocaleString("en-IN")}</p>
          <p><strong>Status:</strong> ${o.status}</p>
          <p><strong>Date:</strong> ${new Date(o.created_at).toLocaleString()}</p>
          <p>
          <button
            onclick="window.open('/api/invoice/${o.id}', '_blank')"
            style="margin-top:8px; padding:8px 14px; background:#4f46e5; color:white; border:none; border-radius:6px; cursor:pointer;">
            <i class="fa-solid fa-file-invoice"></i> Download Invoice
          </button>
          </p>
          <details id="${detailsId}" style="margin-top:10px;">
            <summary style="cursor:pointer; font-weight:600;"><i class="fas fa-angle-double-down"></i>View Items</summary>
            <div class="order-items-container" style="padding:10px 0;">
              ${itemsHtml}
            </div>
          </details>
        </div>
      `;
        }).join("");

        document.querySelectorAll('.order-items-container').forEach(el => {
            el.style.display = 'block';
            el.style.maxHeight = 'none';
        });


        console.log("Orders rendered.");
    } catch (err) {
        console.error("Error in loadOrders():", err);
        ordersList.innerHTML = "<p>Error loading orders.</p>";
    }
}

// ----------- INIT -----------
(async function () {
    loadProfile();
    await loadProductsMap();
    await loadOrders();
})();