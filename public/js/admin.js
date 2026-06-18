// js/admin.js
const apiUrl = 'http://localhost:3000/products';
const allProductsDiv = document.getElementById('allProducts');
const productForm = document.getElementById('productForm');
let editingProductId = null;

// Admin access check
const currentUser = JSON.parse(localStorage.getItem('user'));
if (!currentUser || currentUser.role !== 'admin') {
  alert('Access denied! Admins only.');
  window.location.href = 'auth.html';
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

// Load all products
async function loadProducts() {
  allProductsDiv.innerHTML = '';
  try {
    const res = await fetch('http://localhost:3000/products/admin');
    const payload = await res.json();
    const products = payload.products || payload; // handle both shapes

    if (!products || products.length === 0) {
      allProductsDiv.innerHTML = '<p>No products found</p>';
      return;
    }

    products.forEach(p => {
      const div = document.createElement('div');
      div.classList.add('product-card');
      // choose first image if multiple
      const firstImage = p.image && typeof p.image === 'string'
        ? p.image.split(',')[0].trim()
        : p.image;

      div.innerHTML = `
        ${firstImage ? `<img src="${firstImage}" alt="${p.name}">` : ''}

        <h3>${p.name}</h3>
        <p class="category">${p.category || '-'}</p>
        <p class="price" data-field="price">₹${Number(p.price).toLocaleString('en-IN')}</p>
        <p class="desc">${p.description || ''}</p>
        <p class="stock" data-field="stock">Stock: ${p.stock ?? 0}</p>
        <div class="admin-buttons" style="margin-top:8px;">
          <button class="edit-btn page-btn">Edit</button>
          <button class="delete-btn page-btn">Delete</button>
        </div>
      `;

      // Edit button
      div.querySelector('.edit-btn').addEventListener('click', () => editProduct(p.id));
      // Delete button
      div.querySelector('.delete-btn').addEventListener('click', () => deleteProduct(p.id));

      // ----- INLINE EDITING FOR PRICE & STOCK -----
      ['price', 'stock'].forEach(field => {
        const el = div.querySelector(`[data-field="${field}"]`);
        el.style.cursor = 'pointer';
        el.title = `Click to edit ${field}`;

        el.addEventListener('click', () => {
          // prevent multiple active inputs
          if (div.querySelector(`input[data-inline="${field}"]`)) return;

          const currentVal =
            field === 'price'
              ? Number(p.price)
              : Number(p.stock ?? 0);

          const input = document.createElement('input');
          input.type = 'number';
          input.dataset.inline = field;
          input.value = currentVal;
          input.style.width = field === 'price' ? '90px' : '60px';
          input.style.marginLeft = '6px';
          input.style.padding = '3px';
          input.style.borderRadius = '4px';
          input.style.fontSize = '0.9rem';

          // replace text content with input
          el.textContent =
            field === 'price'
              ? '₹'
              : `${field.charAt(0).toUpperCase() + field.slice(1)}: `;
          el.appendChild(input);
          input.focus();

          input.addEventListener('blur', async () => {
            const newVal = Number(input.value);
            if (!isNaN(newVal) && newVal !== currentVal) {
              const updated = { ...p, [field]: newVal };
              try {
                const res = await fetch(`${apiUrl}/${p.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updated)
                });
                if (!res.ok) throw new Error(await res.text());
                loadProducts();
              } catch (err) {
                console.error(err);
                alert('Update failed.');
              }
            } else {
              loadProducts();
            }
          });

          input.addEventListener('keydown', e => {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') loadProducts();
          });
        });
      });
      // --------------------------------------------

      allProductsDiv.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    allProductsDiv.innerHTML = '<p>Error loading products.</p>';
  }
}

loadProducts();

// Add / Update Product
productForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const category = document.getElementById('category').value.trim();
  const description = document.getElementById('description').value.trim();
  const price = parseFloat(document.getElementById('price').value) || 0;
  const stock = parseInt(document.getElementById('stock').value) || 0;
  const img1 = document.getElementById('image1').value.trim();
  const img2 = document.getElementById('image2').value.trim();
  const img3 = document.getElementById('image3').value.trim();

  // merge all into one string
  const image = [img1, img2, img3].filter(Boolean).join(',');

  const body = { name, category, description, price, stock, image };

  try {
    let url = apiUrl;
    let method = 'POST';

    if (editingProductId) {
      url = `${apiUrl}/${editingProductId}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || 'Save failed');
    }

    alert(editingProductId ? 'Product updated!' : 'Product added!');
    editingProductId = null;
    productForm.reset();
    loadProducts();
  } catch (err) {
    console.error(err);
    alert('Error saving product');
  }
});

// Edit product (replace existing editProduct function)
async function editProduct(id) {
  try {
    const res = await fetch(`${apiUrl}/${id}`);
    if (!res.ok) throw new Error('Not found');
    const p = await res.json();

    // Populate text fields safely
    document.getElementById('name').value = p.name || '';
    document.getElementById('category').value = p.category || '';
    document.getElementById('description').value = p.description || '';
    document.getElementById('price').value = p.price || '';
    document.getElementById('stock').value = p.stock || '';

    // --- IMAGE handling ---
    // admin.html should have inputs with ids: image1, image2, image3
    // If you haven't added them yet, this will safely fall back to the older single 'image' input id.
    const img1Input = document.getElementById('image1');
    const img2Input = document.getElementById('image2');
    const img3Input = document.getElementById('image3');
    // p.images may already be an array (from backend) or p.image may be comma-separated string
    let imgs = [];
    if (Array.isArray(p.images) && p.images.length) imgs = p.images.slice();
    else if (p.image && typeof p.image === 'string') {
      imgs = p.image.split(',').map(s => s.trim()).filter(Boolean);
    }

    // write into the 3 inputs if they exist, otherwise try to populate a single 'image' input
    if (img1Input) img1Input.value = imgs[0] || '';
    if (img2Input) img2Input.value = imgs[1] || '';
    if (img3Input) img3Input.value = imgs[2] || '';

    // backward compatibility: if you still have single input with id="image"
    const singleImgInput = document.getElementById('image');
    if (!img1Input && singleImgInput) singleImgInput.value = imgs.join(',') || (p.image || '');

    editingProductId = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    alert('Error fetching product details');
  }
}


// Delete product
async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    const res = await fetch(`${apiUrl}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    alert('Product deleted');
    loadProducts();
  } catch (err) {
    console.error(err);
    alert('Error deleting product');
  }
}
