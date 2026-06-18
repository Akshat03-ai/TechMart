// cart.js
// helper cart in localStorage (same shape used elsewhere: [{id, qty}, ...])
function getCart() { return JSON.parse(localStorage.getItem('cart') || '[]'); }
function saveCart(cart) { localStorage.setItem('cart', JSON.stringify(cart)); updateCartCount(); }
function updateCartCount() {
  const el = document.getElementById('cartCount');
  if (el) el.textContent = getCart().reduce((s, i) => s + i.qty, 0);
}

function setupAccountMenu() {
  const user = JSON.parse(localStorage.getItem('user'));
  const textEl = document.getElementById('accountText');
  const dropdown = document.getElementById('accountDropdown');

  if (!textEl || !dropdown) return;

  if (!user) {
    textEl.textContent = "Account";
    dropdown.innerHTML = `
      <a href="auth.html?tab=login">Login</a>
      <a href="auth.html?tab=signup">Sign Up</a>
    `;
    return;
  }

  // logged in menu
  textEl.textContent = `Welcome, ${user.name.split(" ")[0]}`;

  dropdown.innerHTML = `
    <a href="account.html"><i class="fa-solid fa-user"></i>My Account</a>
    <button id="logoutBtn2"><i class="fas fa-sign-out-alt"></i>Logout</button>
  `;
  // CLICK TOGGLE for dropdown
  accountMenuContainer = document.getElementById("accountMenuContainer");

  const menu = document.getElementById("accountMenuContainer");

  menu.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    menu.classList.remove("open");
  });

  // logout handler
  setTimeout(() => {
    const logout2 = document.getElementById('logoutBtn2');
    if (!logout2) return;
    logout2.addEventListener('click', () => {
      localStorage.removeItem('user');
      window.location.href = 'auth.html?tab=login';
    });
  }, 200);
}

// run it automatically
setupAccountMenu();

// DOM
const cartItemsDiv = document.getElementById('cartItems');
const subtotalEl = document.getElementById('subtotal');
const taxEl = document.getElementById('tax');
const deliveryEl = document.getElementById('delivery');
const grandEl = document.getElementById('grandTotal');
const discountEl = document.getElementById('discount');
const couponInput = document.getElementById('couponInput');
const applyCouponBtn = document.getElementById('applyCoupon');
const couponMsg = document.getElementById('couponMsg');
const checkoutBtn = document.getElementById('checkoutBtn');
const confirmPay = document.getElementById('confirmPay');
const cancelPay = document.getElementById('cancelPay');

let currentCart = [];
let productsCache = {}; // id -> product
let appliedCoupon = null;

// pricing rules
const TAX_PERCENT = 18; // GST
const DELIVERY_CHARGE = 99; // flat fee under threshold
const FREE_DELIVERY_THRESHOLD = 10000;

// load detailed product info for items in cart
async function refreshCartUI() {
  currentCart = getCart();
  if (currentCart.length === 0) {
    cartItemsDiv.innerHTML =
      '<p style="text-align:center; padding:30px;">Your cart is empty. <a href="index.html">Continue shopping</a></p>';
    subtotalEl.innerText = '₹0';
    discountEl.innerText = '-₹0';
    taxEl.innerText = '₹0';
    deliveryEl.innerText = '₹0';
    grandEl.innerText = '₹0';
    updateCartCount();
    return;
  }

  productsCache = {};

  for (const item of currentCart) {
    try {
      const res = await fetch(`${apiUrl}/products/${item.id}`);
      if (!res.ok) continue;
      const p = await res.json();
      productsCache[p.id] = p;
    } catch (err) {
      console.warn('Product fetch failed for ID', item.id, err);
    }
  }

  cartItemsDiv.innerHTML = '';
  let subtotal = 0;
  currentCart.forEach(item => {
    const p = productsCache[item.id];
    if (!p) return;
    const lineTotal = (Number(p.price) || 0) * item.qty;
    subtotal += lineTotal;

    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.display = 'flex';
    card.style.flexDirection = 'row';
    card.style.alignItems = 'center';
    card.style.gap = '12px';
    card.style.padding = '12px';

    card.innerHTML = `
      ${p.image ? `<img src="${p.image}" style="width:120px; height:80px; object-fit:cover; border-radius:8px;">` : ''}
      <div style="flex:1;">
        <h3 style="margin:0; font-size:1rem;">${p.name}</h3>
        <p style="margin:6px 0; color:#666;">₹${Number(p.price).toLocaleString('en-IN')} • Stock: ${p.stock ?? 0}</p>
        <div style="display:flex; gap:8px; align-items:center;">
          <label>Qty:
            <input type="number" min="1" value="${item.qty}" data-id="${item.id}" class="cart-qty" style="width:72px; margin-left:6px; padding:6px;">
          </label>
          <button class="page-btn remove-btn" data-id="${item.id}" style="background:#dc3545; color:white;">Remove</button>
        </div>
      </div>
      <div style="text-align:right; min-width:120px;">
        <div style="font-weight:700; font-size:1.05rem;">₹${Number(lineTotal).toLocaleString('en-IN')}</div>
      </div>
    `;

    cartItemsDiv.appendChild(card);
  });

  // calculate totals
  let discount = 0;
  if (appliedCoupon && appliedCoupon.valid) {
    if (appliedCoupon.type === 'pct') discount = (appliedCoupon.value / 100) * subtotal;
    else discount = appliedCoupon.value;
  }

  const taxable = Math.max(0, subtotal - discount);
  const tax = (TAX_PERCENT / 100) * taxable;
  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;
  const grand = Math.max(0, taxable + tax + delivery);

  subtotalEl.innerText = `₹${Number(subtotal).toLocaleString('en-IN')}`;
  discountEl.innerText = `-₹${Number(discount).toLocaleString('en-IN')}`;
  taxEl.innerText = `₹${Number(tax).toLocaleString('en-IN')}`;
  deliveryEl.innerText = `₹${Number(delivery).toLocaleString('en-IN')}`;
  grandEl.innerText = `₹${Number(grand).toLocaleString('en-IN')}`;

  // wire quantity and remove handlers
  document.querySelectorAll('.cart-qty').forEach(inp => {
    inp.addEventListener('change', e => {
      const id = parseInt(e.target.getAttribute('data-id'));
      let val = parseInt(e.target.value) || 1;
      const p = productsCache[id];
      if (p && p.stock !== undefined && val > p.stock) {
        alert('Requested quantity exceeds stock');
        e.target.value = p.stock;
        val = p.stock;
      }
      const cart = getCart();
      const it = cart.find(x => x.id === id);
      if (it) it.qty = val;
      saveCart(cart);
      refreshCartUI();
    });
  });

  document.querySelectorAll('.remove-btn').forEach(b => {
    b.addEventListener('click', e => {
      const id = parseInt(e.target.getAttribute('data-id'));
      let cart = getCart();
      cart = cart.filter(x => x.id !== id);
      saveCart(cart);
      refreshCartUI();
    });
  });

  updateCartCount();
}

const user = JSON.parse(localStorage.getItem("user") || "null");
if (!user || !user.address || user.address === "Enter Address" ||
    !user.pincode || user.pincode === "Enter Pincode") {
  checkoutBtn.disabled = true;
  checkoutBtn.style.opacity = "0.5";
  checkoutBtn.style.cursor = "not-allowed";
} else {
  checkoutBtn.disabled = false;
}

// coupon validate
applyCouponBtn.addEventListener('click', async () => {
  const code = (couponInput.value || '').trim();
  if (!code) {
    couponMsg.innerText = 'Enter a coupon code';
    couponMsg.style.color = 'red';
    return;
  }
  try {
    const res = await fetch(`${apiUrl}/coupons/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal: getCartSubtotalForValidation() })
    });
    const data = await res.json();
    if (res.ok) {
      appliedCoupon = data;
      couponMsg.innerText = data.message || 'Coupon applied';
      couponMsg.style.color = 'green';
    } else {
      appliedCoupon = null;
      couponMsg.innerText = data.message || 'Invalid coupon';
      couponMsg.style.color = 'red';
    }
    refreshCartUI();
  } catch (err) {
    console.error(err);
    couponMsg.innerText = 'Error validating coupon';
    couponMsg.style.color = 'red';
  }
});

// coupon validation
function getCartSubtotalForValidation() {
  const cart = getCart();
  if (!cart.length) return 0;
  let subtotal = 0;
  cart.forEach(it => {
    const p = productsCache[it.id];
    const price = p ? Number(p.price) : 0;
    subtotal += price * it.qty;
  });
  return subtotal;
}

async function loadAvailableCoupons() {
  const listDiv = document.getElementById("availableCoupons");
  if (!listDiv) return;

  try {
    const res = await fetch(`${apiUrl}/coupons`);
    const coupons = await res.json();

    if (!Array.isArray(coupons) || coupons.length === 0) {
      listDiv.innerHTML = "<p>No coupons available right now.</p>";
      return;
    }
    // Click coupon to auto-fill input (but NOT apply)
    document.addEventListener("click", (e) => {
      const item = e.target.closest(".coupon-item");
      if (!item) return;

      const code = item.dataset.code;
      const input = document.getElementById("couponInput");

      if (input && code) {
        input.value = code;  // auto-fill only
      }
    });

    listDiv.innerHTML = coupons.map(c => {
      const isPct = c.type === "pct";
      const discount = isPct
        ? `${c.value}%`
        : `₹${Number(c.value).toLocaleString('en-IN')}`;

      const minText = c.min_order_value
        ? `Minimum Order Value: ₹${Number(c.min_order_value).toLocaleString('en-IN')}`
        : `No minimum order`;

      return `
  <div class="coupon-item" data-code="${c.code}">
    <strong>${c.code} — ${discount} OFF</strong>
    <small>${minText}</small>
  </div>
`;
    }).join("");

  } catch (err) {
    console.error("Coupon list error:", err);
    listDiv.innerHTML = "<p>Error loading coupons.</p>";
  }
}

loadAvailableCoupons();

// --- Dropdown toggle logic ---
const couponDropdown = document.querySelector(".coupon-dropdown");
const couponToggle = document.querySelector(".coupon-toggle");

if (couponToggle && couponDropdown) {
  couponToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    couponDropdown.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    couponDropdown.classList.remove("open");
  });
}

// checkout 
checkoutBtn.addEventListener("click", async () => {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!user) {
    alert("Please login first.");
    return (window.location.href = "auth.html?tab=login");
  }

  if (!user.address || !user.pincode) {
    alert("Please add Address and Pincode before checking out.");
    return (window.location.href = "account.html");
  }

  const cart = getCart();
  if (!cart.length) return alert("Cart is empty!");

const amount = Number(grandEl.innerText.replace("₹", "").replace(/,/g, ""));

// ❗ Razorpay max allowed = 10 lakh
if (amount > 1000000) {
    alert("Razorpay allows maximum ₹ 1,00,000 per order. Reduce items.");
    return;
}

  // Create order on backend
  const orderRes = await fetch("/api/payment/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, user })
  });

  const orderData = await orderRes.json();
  if (!orderData.success) return alert("Error creating Razorpay order");

  // Razorpay checkout
  const options = {
    key: orderData.razorpay_key,
    amount: amount * 100,
    currency: "INR",
    name: "TechMart",
    description: "Order Payment",
    order_id: orderData.order_id,
    handler: async function (response) {
      // backend verify
      const verifyRes = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          cart: cart,
          totals: {
            subtotal: Number(subtotalEl.innerText.replace("₹","").replace(/,/g,'')),
            discount: Number(discountEl.innerText.replace("₹","").replace(/,/g,'')) * -1,
            tax: Number(taxEl.innerText.replace("₹","").replace(/,/g,'')),
            delivery: Number(deliveryEl.innerText.replace("₹","").replace(/,/g,'')),
            grandTotal: amount
          },
          userId: user.id
        })
      });

      const data = await verifyRes.json();

      if (data.success) {
        localStorage.removeItem("cart");
        alert("Payment Successful!");
        window.location.href = "account.html";
      } else {
        alert("Payment verification failed!");
      }
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
});

// initial load
refreshCartUI();
updateCartCount();