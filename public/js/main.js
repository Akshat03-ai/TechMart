const apiUrl = 'http://localhost:3000';

// --- SIGNUP ---
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email-signup').value;
    const password = document.getElementById('password-signup').value;

    try {
      const res = await fetch(`${apiUrl}/users/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const text = await res.text();

      if (res.ok) {
        alert(text); // User registered successfully!
        document.getElementById('loginTab').click(); // switch to login tab
      } else {
        alert(text); // Email already registered
      }
    } catch (err) {
      console.error(err);
      alert('Signup failed!');
    }
  });
}

// --- LOGIN ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email-login').value;
    const password = document.getElementById('password-login').value;

    try {
      const res = await fetch(`${apiUrl}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('user', JSON.stringify(data));
        if (data.role === 'admin') window.location.href = 'admin.html';
        else window.location.href = 'index.html';
      } else {
        const text = await res.text();
        alert(text); // 'User not found' or 'Wrong password'
      }
    } catch (err) {
      console.error(err);
      alert('Login failed!');
    }
  });
}

// --- LOGOUT ---
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('user');
    alert('Logged out successfully!');
    window.location.href = 'auth.html';
  });
}

// ---------- HOMEPAGE: categories + products (search/filter/sort/pagination) ----------

// elements (may be null on auth/admin pages)
const productsDiv = document.getElementById('products');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const categoryFilter = document.getElementById('categoryFilter');
const sortSelect = document.getElementById('sortSelect');
const paginationDiv = document.getElementById('pagination');

// --- Capture search from URL (?search=keyword) ---
const urlparams = new URLSearchParams(location.search);
const searchFromURL = urlparams.get("search");

if (searchFromURL && searchInput) {
  searchInput.value = searchFromURL;
}

let currentPage = 1;
const limit = 10;

// Load categories reliably: prefer server endpoint, fallback to deriving from /products
async function loadCategories() {
  if (!categoryFilter) return;
  try {
    // try dedicated endpoint first (server route: /products/categories/list)
    const res = await fetch(`${apiUrl}/products/categories/list`);
    if (res.ok) {
      const payload = await res.json();
      const cats = payload.categories || [];
      cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        categoryFilter.appendChild(opt);
      });
      return;
    }
  } catch (e) {
    // ignore and fallback
    console.warn('categories list fetch failed, falling back to full products', e);
  }

  // fallback: fetch products (no pagination) and derive categories
  try {
    const r = await fetch(`${apiUrl}/products?limit=1000&page=1`);
    const allPayload = await r.json();
    const all = allPayload.products ?? allPayload;
    const cats = Array.from(new Set((all.map(p => p.category).filter(Boolean))));
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      categoryFilter.appendChild(opt);
    });
  } catch (err) {
    console.error('fallback categories error', err);
  }
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


function setupGlobalSearchRedirect() {
  const input = document.getElementById("searchInput");
  const btn = document.getElementById("searchBtn");

  if (!input || !btn) return;

  function runSearch() {
    const q = input.value.trim();
    if (!q) return;

    // If already on index.html → use loadProducts
    if (document.getElementById('products')) {
      loadProducts(1);
      return;
    }

    // Otherwise redirect to homepage search results
    window.location.href = `index.html?search=${encodeURIComponent(q)}`;
  }

  btn.addEventListener("click", runSearch);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });
}

setupGlobalSearchRedirect();

// Load products with robust handling for either paginated or raw-array responses
async function loadProducts(page = 1) {
  if (!productsDiv) return;
  currentPage = page;

  const q = (searchInput && searchInput.value) ? encodeURIComponent(searchInput.value.trim()) : '';
  const category = categoryFilter ? encodeURIComponent(categoryFilter.value) : '';
  const sort = sortSelect ? encodeURIComponent(sortSelect.value) : '';
  const url = `${apiUrl}/products?page=${page}&limit=${limit}` + (q ? `&q=${q}` : '') + (category ? `&category=${category}` : '') + (sort ? `&sort=${sort}` : '');

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('products fetch returned not ok', res.status);
      productsDiv.innerHTML = '<p style="text-align:center;">Error loading products.</p>';
      paginationDiv && (paginationDiv.innerHTML = '');
      return;
    }

    const payload = await res.json();

    // handle both shapes: { total, page, limit, products } OR plain [ ...products... ]
    let products = [];
    let total = 0;
    if (Array.isArray(payload)) {
      products = payload;
      total = products.length;
    } else if (payload.products) {
      products = payload.products;
      total = Number(payload.total ?? products.length);
    } else {
      // unexpected but attempt to use payload directly
      products = payload;
      total = (Array.isArray(payload) ? payload.length : 0);
    }

    if (!products || products.length === 0) {
      productsDiv.innerHTML = '<p style="text-align:center;">No products available</p>';
      paginationDiv && (paginationDiv.innerHTML = '');
      return;
    }

    productsDiv.innerHTML = `
      <div class="products-grid">
        ${products.map(p => `
          <div class="product-card">
            ${p.image ? `<img src="${p.image}" alt="${p.name}">` : ''}
            <h3>${p.name}</h3>
            <p class="category">${p.category || '-'}</p>
            <p class="price">₹${Number(p.price).toLocaleString('en-IN')}</p>
            <p class="desc">${p.description || ''}</p>
            <p class="stock">Stock: ${p.stock ?? 0}</p>
            <div style="width:100%;display:flex;gap:8px;">
              <a class="page-btn" href="product.html?id=${p.id}" style="flex:1;text-align:center;text-decoration:none;">View</a>
              <button class="add-cart-btn" data-id="${p.id}" style="flex:1">Add to Cart</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // pagination UI
    paginationDiv && (() => {
      const pages = Math.max(1, Math.ceil(total / limit));
      paginationDiv.innerHTML = '';
      for (let i = 1; i <= pages; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
        btn.textContent = i;
        btn.addEventListener('click', () => loadProducts(i));
        paginationDiv.appendChild(btn);
      }
    })();

    // wire Add to Cart handlers
    document.querySelectorAll('.add-cart-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'));
        // simple localStorage cart (same shape used elsewhere)
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const item = cart.find(x => x.id === id);
        if (item) item.qty++;
        else cart.push({ id, qty: 1 });
        localStorage.setItem('cart', JSON.stringify(cart));
        const cc = document.getElementById('cartCount');
        if (cc) cc.textContent = cart.reduce((s, it) => s + it.qty, 0);
        alert('Added to cart');
      });
    });

  } catch (err) {
    console.error('loadProducts error', err);
    productsDiv.innerHTML = '<p style="text-align:center;">Error loading products.</p>';
    paginationDiv && (paginationDiv.innerHTML = '');
  }
}

// hook up filters if present
if (categoryFilter) categoryFilter.addEventListener('change', () => loadProducts(1));
if (sortSelect) sortSelect.addEventListener('change', () => loadProducts(1));

// Run homepage logic only if #products exists (i.e., we're on the homepage)
if (document.getElementById('products')) {
  loadCategories().then(() => loadProducts(1));

  const cartCountEl = document.getElementById('cartCount');
  if (cartCountEl && typeof getCart === 'function') {
    cartCountEl.textContent = getCart().reduce((s, it) => s + it.qty, 0);
  }
}

// ---------- TAB SWITCHING (auth.html) ----------
(function setupTabs() {
  const loginTabBtn = document.getElementById('loginTab');
  const signupTabBtn = document.getElementById('signupTab');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  function showLogin() {
    loginTabBtn.classList.add('active');
    signupTabBtn.classList.remove('active');
    loginForm.classList.add('active');
    signupForm.classList.remove('active');
  }
  function showSignup() {
    signupTabBtn.classList.add('active');
    loginTabBtn.classList.remove('active');
    signupForm.classList.add('active');
    loginForm.classList.remove('active');
  }

  if (loginTabBtn && signupTabBtn && loginForm && signupForm) {
    loginTabBtn.addEventListener('click', showLogin);
    signupTabBtn.addEventListener('click', showSignup);

    // If URL contains ?tab=login open login by default (index.html redirect uses this)
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'login') showLogin();
    else showSignup();
  }
})();