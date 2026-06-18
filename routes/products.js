// backend/routes/products.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // your mysql connection

// Helper: build WHERE clauses and params
function buildWhereClauses(query) {
  const clauses = [];
  const params = [];

  if (query.q) {
    clauses.push("(name LIKE ?)");
    const like = `%${query.q}%`;
    params.push(like);
  }

  if (query.category) {
    clauses.push("category = ?");
    params.push(query.category);
  }

  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  return { where, params };
}

router.get("/all", (req, res) => {
  db.query("SELECT * FROM products ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(results);
  });
});

/**
 * GET /products/admin
 */
router.get('/admin', (req, res) => {
  const sql = 'SELECT id, name, category, description, price, stock, image FROM products ORDER BY id DESC';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Admin products fetch error', err);
      return res.status(500).send('Database error');
    }
    res.json(results);
  });
});

/**
 * GET /products
 * Paginated + normalized for comma-separated images
 */
router.get('/', (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    const category = req.query.category ? String(req.query.category).trim() : '';
    const sort = req.query.sort ? String(req.query.sort).trim() : '';
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = 10;
    const offset = (page - 1) * limit;

    const { where, params } = buildWhereClauses({ q, category });

    const countSql = `SELECT COUNT(*) AS total FROM products ${where}`;
    db.query(countSql, params, (err, countRes) => {
      if (err) {
        console.error('Count error', err);
        return res.status(500).send('Database error');
      }
      const total = countRes[0].total || 0;

      let orderBy = 'ORDER BY id DESC';
      if (sort === 'price_asc') orderBy = 'ORDER BY price ASC';
      else if (sort === 'price_desc') orderBy = 'ORDER BY price DESC';
      else if (sort === 'newest') orderBy = 'ORDER BY id DESC';

      const prodSql = `SELECT id, name, category, description, price, stock, image FROM products ${where} ${orderBy} LIMIT ? OFFSET ?`;
      const prodParams = params.concat([limit, offset]);

      db.query(prodSql, prodParams, (err2, products) => {
        if (err2) {
          console.error('Products fetch error', err2);
          return res.status(500).send('Database error');
        }

        const normalized = (products || []).map(p => {
          // split comma-separated images safely
          const images = [];
          if (p.image && typeof p.image === 'string' && p.image.trim()) {
            images.push(...p.image.split(',').map(s => s.trim()).filter(Boolean));
          }
          return {
            id: p.id,
            name: p.name,
            category: p.category,
            description: p.description,
            price: p.price,
            stock: p.stock,
            image: p.image || null,
            images
          };
        });

        res.json({ total, page, limit, products: normalized });
      });
    });
  } catch (ex) {
    console.error('Unexpected error in GET /products', ex);
    res.status(500).send('Server error');
  }
});

/**
 * GET /products/categories/list
 */
router.get('/categories/list', (req, res) => {
  db.query('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> ""', (err, results) => {
    if (err) {
      console.error('Categories fetch error', err);
      return res.status(500).send('Database error');
    }
    const categories = (results || []).map(r => r.category).filter(Boolean);
    res.json({ categories });
  });
});

/**
 * GET /products/:id
 * Returns product with array of images (split from comma-separated string)
 */
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).send('Invalid product id');

  db.query('SELECT id, name, category, description, price, stock, image FROM products WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Product fetch error', err);
      return res.status(500).send('Database error');
    }
    if (!results || results.length === 0) return res.status(404).send('Product not found');

    const p = results[0];
    const images = [];
    if (p.image && typeof p.image === 'string' && p.image.trim()) {
      images.push(...p.image.split(',').map(s => s.trim()).filter(Boolean));
    }

    res.json({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      price: p.price,
      stock: p.stock,
      image: p.image || null,
      images
    });
  });
});

/**
 * POST /products
 * Adds a new product (joins multiple image URLs into single comma-separated string)
 */
router.post('/', (req, res) => {
  const { name, category, description, price, stock, image } = req.body;
  if (!name || !price) return res.status(400).send('Missing required fields');

  // handle array of images or comma string
  let imageString = image;
  if (Array.isArray(image)) imageString = image.join(',');
  if (typeof image === 'string') imageString = image.split(',').map(s => s.trim()).filter(Boolean).join(',');

  const sql = `
    INSERT INTO products (name, category, description, price, stock, image)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  db.query(sql, [name, category, description, price, stock, imageString], (err, result) => {
    if (err) {
      console.error('Product insert error', err);
      return res.status(500).send('Database error');
    }
    res.json({ id: result.insertId, message: 'success' });
  });
});

/**
 * PUT /products/:id
 * Updates a product (joins multiple image URLs into single comma-separated string)
 */
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, category, description, price, stock, image } = req.body;
  if (!id) return res.status(400).send('Invalid ID');

  let imageString = image;
  if (Array.isArray(image)) imageString = image.join(',');
  if (typeof image === 'string') imageString = image.split(',').map(s => s.trim()).filter(Boolean).join(',');

  const sql = `
    UPDATE products
    SET name=?, category=?, description=?, price=?, stock=?, image=?
    WHERE id=?
  `;
  db.query(sql, [name, category, description, price, stock, imageString, id], (err, result) => {
    if (err) {
      console.error('Product update error', err);
      return res.status(500).send('Database error');
    }
    if (result.affectedRows === 0) return res.status(404).send('Product not found');
    res.send('success');
  });
});

/**
 * DELETE /products/:id
 */
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).send('Invalid ID');

  const sql = 'DELETE FROM products WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('Product delete error', err);
      return res.status(500).send('Database error');
    }
    if (result.affectedRows === 0) return res.status(404).send('Product not found');
    res.send('success');
  });
});

module.exports = router;
